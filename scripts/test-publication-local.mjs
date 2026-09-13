/** Local-only release smoke test. Never uploads or deploys. The tar invocation
 * below tests the archive flags from the official v5.0.0 Linux action; it is
 * NOT an alternate production Pages packager.
 */
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises'
import { resolve, relative, sep, extname } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from '../apps/futebol/node_modules/playwright/index.mjs'
import { verifyBuild } from '../apps/futebol/scripts/verify-build.mjs'
import { preparePages, validatePublication, filesUnder } from './prepare-pages.mjs'

const repo = resolve(import.meta.dirname, '..')
const main = '6286335e9cb96eb140c2683ab609da0760b440e7'
const tar = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/tar.exe' : 'tar'
const platformTarFlags = process.platform === 'win32' ? ['--force-local'] : []
const tarPath = (path) => process.platform === 'win32' ? path.replaceAll('\\', '/').replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`) : path
const fixture = await mkdtemp(resolve(tmpdir(), 'futebol-release-archive-'))
assert.equal(relative(tmpdir(), fixture).split(sep).length, 1)
assert.ok(fixture.startsWith(resolve(tmpdir(), 'futebol-release-archive-')))
const normalize = (buffer) => buffer.toString().replaceAll('\r\n', '\n')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain' }
let browser
try {
  await verifyBuild()
  browser = await chromium.launch({ channel: 'chrome' })
  for (const variant of ['full', 'root-only']) {
    const prepared = await preparePages({ variant, requireOptionals: true })
    const sourceFiles = await filesUnder(prepared.siteRoot)
    for (const file of sourceFiles.filter((path) => !path.startsWith('futebol/'))) {
      const approved = execFileSync('git', ['show', `${main}:${file}`], { cwd: repo, windowsHide: true })
      const staged = await readFile(resolve(prepared.siteRoot, file))
      if (file.startsWith('assets/') || file.endsWith('.ico')) assert.ok(staged.equals(approved), 'Root binary differs from approved main')
      else assert.equal(normalize(staged), normalize(approved), 'Root content differs from approved main')
    }
    // Exercise the official archive command with include-hidden-files=true:
    // no generic dotfile exclusion, but .git/.github remain excluded.
    const archive = resolve(fixture, `${variant}.tar`)
    const packed = spawnSync(tar, [...platformTarFlags, '--dereference', '--hard-dereference', '--directory', tarPath(prepared.siteRoot), '-cvf', tarPath(archive), '--exclude=.git', '--exclude=.github', '.'], { windowsHide: true, encoding: 'utf8' })
    assert.equal(packed.status, 0, packed.stderr || 'Official archive flags failed')
    const unpacked = resolve(fixture, variant)
    await mkdir(unpacked)
    const extracted = spawnSync(tar, [...platformTarFlags, '-xf', tarPath(archive), '-C', tarPath(unpacked)], { windowsHide: true, encoding: 'utf8' })
    assert.equal(extracted.status, 0, extracted.stderr)
    const validation = await validatePublication({ directory: unpacked, variant })
    assert.deepEqual(validation.hiddenFiles, ['.nojekyll'])
    assert.equal(validation.contentDigest, prepared.contentDigest, 'Archive transport changed the content')
    if (variant === 'full') await verifyBuild({ directory: resolve(unpacked, 'futebol') })
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url, 'http://127.0.0.1')
        let file = resolve(unpacked, '.' + decodeURIComponent(url.pathname))
        assert.ok(file === unpacked || file.startsWith(unpacked + sep))
        if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html')
        response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream')
        response.setHeader('Cache-Control', 'no-store')
        response.end(await readFile(file))
      } catch { response.writeHead(404); response.end() }
    })
    await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done) })
    const origin = `http://127.0.0.1:${server.address().port}`
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 850 } })
      try {
        await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
        const page = await context.newPage()
        const failures = []
        page.on('pageerror', (error) => failures.push(error.message))
        await page.goto(origin + '/')
        await page.getByRole('heading', { name: 'SABARÁ', exact: true }).waitFor()
        assert.equal(await page.title(), 'Sabará')
        assert.equal(await page.locator('.logo').evaluate((el) => el.complete && el.naturalWidth > 0), true)
        assert.ok((await page.evaluate(() => getComputedStyle(document.body).backgroundImage)).includes('radial-gradient'))
        for (const file of sourceFiles) assert.equal((await context.request.get(origin + '/' + file)).status(), 200)
        assert.equal((await context.request.get(origin + '/futebol/')).status(), variant === 'full' ? 200 : 404)
        assert.equal(await page.evaluate(() => navigator.serviceWorker.controller), null)
        if (variant === 'full') {
          await page.goto(origin + '/futebol/#/login')
          await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor()
          await page.evaluate(async () => { await navigator.serviceWorker.ready })
          await page.reload()
          await page.waitForFunction(() => !!navigator.serviceWorker.controller)
          assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope), origin + '/futebol/')
          await context.setOffline(true)
          await page.reload()
          await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor()
          await context.setOffline(false)
          await page.goto(origin + '/')
          await page.getByRole('heading', { name: 'SABARÁ', exact: true }).waitFor()
          assert.equal(await page.evaluate(() => navigator.serviceWorker.controller), null)
        }
        assert.deepEqual(failures, [])
      } finally { await context.close() }
    } finally { await new Promise((done) => server.close(done)) }
    console.log(`PASS: ${variant}, approved root, official v5 archive flags, .nojekyll, hidden allowlist, all resources, Chrome smoke${variant === 'full' ? ', hash/refresh/offline/scoped worker' : ', /futebol/ absent'}.`)
  }
} finally {
  await browser?.close()
  await rm(fixture, { recursive: true, force: true })
}
