import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { preparePages } from './prepare-pages.mjs'

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
