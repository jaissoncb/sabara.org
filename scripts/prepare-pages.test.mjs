import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { preparePages, validatePublication } from './prepare-pages.mjs'

async function fixture(t) {
  const repositoryRoot = await mkdtemp(resolve(tmpdir(), 'futebol-pages-'))
  assert.equal(dirname(repositoryRoot), resolve(tmpdir()))
  assert.ok(repositoryRoot.startsWith(resolve(tmpdir(), 'futebol-pages-')))
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }))
  const appBuild = resolve(repositoryRoot, 'apps/futebol/dist')
  await mkdir(resolve(appBuild, 'assets'), { recursive: true })
  await mkdir(resolve(repositoryRoot, 'assets/nested'), { recursive: true })
  for (const [file, text] of Object.entries({
    'index.html': '<!doctype html><title>Root fixture</title><img src="assets/nested/logo.svg">',
    'style.css': 'body { color: green; }', '404.html': '<title>Root 404</title>',
    CNAME: 'fixture.invalid\n', 'favicon.ico': 'icon fixture',
    'assets/nested/logo.svg': '<svg></svg>', 'unlisted-private.txt': 'must not ship',
  })) await writeFile(resolve(repositoryRoot, file), text)
  for (const [file, text] of Object.entries({
    'index.html': '<title>Futebol fixture</title>', 'manifest.webmanifest': '{}',
    'sw.js': '// fixture worker', 'assets/app.js': '// fixture app',
  })) await writeFile(resolve(appBuild, file), text)
  return { repositoryRoot, appBuild }
}

test('preserves root/assets and isolates Futebol without inventing optional files', async (t) => {
  const { repositoryRoot } = await fixture(t)
  const result = await preparePages({ repositoryRoot })
  assert.equal((await readFile(resolve(result.siteRoot, 'index.html'), 'utf8')).includes('Root fixture'), true)
  assert.equal((await readFile(resolve(result.siteRoot, 'futebol/index.html'), 'utf8')).includes('Futebol fixture'), true)
  assert.equal((await readFile(resolve(repositoryRoot, 'CNAME'))).equals(await readFile(resolve(result.siteRoot, 'CNAME'))), true)
  assert.deepEqual((await readdir(result.siteRoot)).sort(), ['404.html', 'CNAME', 'assets', 'favicon.ico', 'futebol', 'index.html', 'style.css'])
  assert.equal(result.rootAssetCount, 1)
})
test('copies robots.txt and .nojekyll byte for byte when present after integration', async (t) => {
  const { repositoryRoot } = await fixture(t)
  for (const [file, text] of [['robots.txt', 'User-agent: *\nAllow: /\n'], ['.nojekyll', '']]) await writeFile(resolve(repositoryRoot, file), text)
  const result = await preparePages({ repositoryRoot })
  for (const file of ['robots.txt', '.nojekyll']) assert.equal((await readFile(resolve(repositoryRoot, file))).equals(await readFile(resolve(result.siteRoot, file))), true)
})
test('rejects privileged app content before replacing an existing preview', async (t) => {
  const { repositoryRoot, appBuild } = await fixture(t)
  await mkdir(resolve(repositoryRoot, '_site'))
  await writeFile(resolve(repositoryRoot, '_site/sentinel.txt'), 'existing preview')
  await writeFile(resolve(appBuild, 'assets/app.js'), 'const key="sb_secret_synthetic-not-real"')
  await assert.rejects(preparePages({ repositoryRoot }), /publicação bloqueada/)
  assert.equal(await readFile(resolve(repositoryRoot, '_site/sentinel.txt'), 'utf8'), 'existing preview')
})

for (const variant of ['full', 'root-only']) {
  test(`${variant} preserves the shared root allowlist and only root .nojekyll`, async (t) => {
    const { repositoryRoot } = await fixture(t)
    await writeFile(resolve(repositoryRoot, 'robots.txt'), 'User-agent: *\nAllow: /\n')
    await writeFile(resolve(repositoryRoot, '.nojekyll'), '')
    const result = await preparePages({ repositoryRoot, variant, requireOptionals: true })
    assert.deepEqual(result.hiddenFiles, ['.nojekyll'])
    assert.equal((await readdir(result.siteRoot)).includes('futebol'), variant === 'full')
    assert.ok((await readFile(resolve(result.siteRoot, 'CNAME'))).equals(await readFile(resolve(repositoryRoot, 'CNAME'))))
    assert.equal((await readFile(resolve(result.siteRoot, 'index.html'), 'utf8')).includes('Root fixture'), true)
    assert.ok((await readFile(resolve(result.siteRoot, '.nojekyll'))).equals(Buffer.alloc(0)))
    await validatePublication({ directory: result.siteRoot, repositoryRoot, variant })
  })
  for (const path of ['.env', '.env.local', '.git/config', '.github/workflow.yml', '.cache/data', '.vscode/settings.json', '.unexpected', 'assets/.nojekyll', 'assets/.hidden/item']) {
    test(`${variant} rejects hidden ${path} before upload`, async (t) => {
      const { repositoryRoot } = await fixture(t)
      const { siteRoot } = await preparePages({ repositoryRoot, variant })
      await mkdir(dirname(resolve(siteRoot, path)), { recursive: true })
      await writeFile(resolve(siteRoot, path), 'synthetic private fixture')
      await assert.rejects(validatePublication({ directory: siteRoot, repositoryRoot, variant, requireOptionals: false }), /Hidden/)
    })
  }
  test(`${variant} rejects a directory symlink/junction`, async (t) => {
    const { repositoryRoot } = await fixture(t)
    const { siteRoot } = await preparePages({ repositoryRoot, variant })
    await symlink(resolve(repositoryRoot, 'assets/nested'), resolve(siteRoot, 'assets/linked'), process.platform === 'win32' ? 'junction' : 'dir')
    await assert.rejects(validatePublication({ directory: siteRoot, repositoryRoot, variant, requireOptionals: false }), /simbólicos/)
  })
  test(`${variant} rejects unlisted root file and changed root bytes`, async (t) => {
    const { repositoryRoot } = await fixture(t)
    const { siteRoot } = await preparePages({ repositoryRoot, variant })
    await writeFile(resolve(siteRoot, 'private-config.json'), '{}')
    await assert.rejects(validatePublication({ directory: siteRoot, repositoryRoot, variant, requireOptionals: false }), /allowlist/)
    await rm(resolve(siteRoot, 'private-config.json'))
    await writeFile(resolve(siteRoot, 'style.css'), 'changed')
    await assert.rejects(validatePublication({ directory: siteRoot, repositoryRoot, variant, requireOptionals: false }), /Bytes/)
  })
  test(`${variant} rejects even an empty hidden or cache directory`, async (t) => {
    const { repositoryRoot } = await fixture(t)
    const { siteRoot } = await preparePages({ repositoryRoot, variant })
    await mkdir(resolve(siteRoot, 'assets/.cache'))
    await assert.rejects(validatePublication({ directory: siteRoot, repositoryRoot, variant, requireOptionals: false }), /Hidden/)
    await rm(resolve(siteRoot, 'assets/.cache'), { recursive: true })
    await mkdir(resolve(siteRoot, 'assets/node_modules'))
    await assert.rejects(validatePublication({ directory: siteRoot, repositoryRoot, variant, requireOptionals: false }), /privado\/cache/)
  })
  test(`${variant} rejects an unexpected empty public directory`, async (t) => {
    const { repositoryRoot } = await fixture(t)
    const { siteRoot } = await preparePages({ repositoryRoot, variant })
    await mkdir(resolve(siteRoot, 'assets/unexpected'))
    await assert.rejects(validatePublication({ directory: siteRoot, repositoryRoot, variant, requireOptionals: false }), /Diretórios assets/)
  })
  test(`${variant} checks immutable BUILD content digest`, async (t) => {
    const { repositoryRoot } = await fixture(t)
    const { siteRoot, contentDigest } = await preparePages({ repositoryRoot, variant })
    const options = { directory: siteRoot, repositoryRoot, variant, requireOptionals: false }
    await validatePublication({ ...options, expectedContentDigest: contentDigest })
    for (const expectedContentDigest of ['', 'a'.repeat(64), 'short']) {
      await assert.rejects(validatePublication({ ...options, expectedContentDigest }), /Digest/)
    }
    if (variant === 'full') {
      await writeFile(resolve(siteRoot, 'futebol/assets/app.js'), '// changed public app')
      await assert.rejects(validatePublication({ ...options, expectedContentDigest: contentDigest }), /Digest/)
    }
  })
}
test('full rejects empty nested app directories; root-only rejects any futebol directory', async (t) => {
  const { repositoryRoot } = await fixture(t)
  const full = await preparePages({ repositoryRoot })
  await mkdir(resolve(full.siteRoot, 'futebol/assets/unexpected'))
  await assert.rejects(validatePublication({ directory: full.siteRoot, repositoryRoot, requireOptionals: false }), /Diretório Futebol/)
  const rollback = await preparePages({ repositoryRoot, variant: 'root-only' })
  await mkdir(resolve(rollback.siteRoot, 'futebol'))
  await assert.rejects(validatePublication({ directory: rollback.siteRoot, repositoryRoot, variant: 'root-only', requireOptionals: false }), /allowlist/)
})
test('root-only does not require or copy the Futebol build', async (t) => {
  const { repositoryRoot, appBuild } = await fixture(t)
  await rm(appBuild, { recursive: true })
  const { siteRoot } = await preparePages({ repositoryRoot, variant: 'root-only' })
  assert.equal((await readdir(siteRoot)).includes('futebol'), false)
})
test('publication requires robots and .nojekyll; no unknown variant is accepted', async (t) => {
  const { repositoryRoot } = await fixture(t)
  await assert.rejects(preparePages({ repositoryRoot, requireOptionals: true }), /obrigatório/)
  await assert.rejects(preparePages({ repositoryRoot, variant: 'unknown' }), /site_variant/)
})
test('hidden app input is rejected before replacing a preview', async (t) => {
  const { repositoryRoot, appBuild } = await fixture(t)
  await mkdir(resolve(repositoryRoot, '_site'))
  await writeFile(resolve(repositoryRoot, '_site/sentinel.txt'), 'keep')
  await writeFile(resolve(appBuild, '.env'), 'synthetic')
  await assert.rejects(preparePages({ repositoryRoot }), /Hidden/)
  assert.equal(await readFile(resolve(repositoryRoot, '_site/sentinel.txt'), 'utf8'), 'keep')
})
