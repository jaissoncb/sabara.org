import { access, cp, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..')
const siteRoot = resolve(repositoryRoot, '_site')
const appBuild = resolve(repositoryRoot, 'apps', 'futebol', 'dist')
const rootFiles = ['index.html', 'style.css', '404.html', 'CNAME', 'favicon.ico']

if (dirname(siteRoot) !== repositoryRoot) {
  throw new Error('Destino do artefato Pages fora do repositorio.')
}

await access(appBuild)
await rm(siteRoot, { force: true, recursive: true })
await mkdir(siteRoot, { recursive: true })

for (const file of rootFiles) {
  await cp(resolve(repositoryRoot, file), resolve(siteRoot, file))
}

await cp(resolve(repositoryRoot, 'assets'), resolve(siteRoot, 'assets'), { recursive: true })
await cp(appBuild, resolve(siteRoot, 'futebol'), { recursive: true })

for (const file of rootFiles) {
  const source = await readFile(resolve(repositoryRoot, file))
  const assembled = await readFile(resolve(siteRoot, file))

  if (!source.equals(assembled)) {
    throw new Error(`Arquivo raiz alterado durante a montagem: ${file}`)
  }
}

await Promise.all([
  access(resolve(siteRoot, 'assets')),
  access(resolve(siteRoot, 'futebol', 'index.html')),
  access(resolve(siteRoot, 'futebol', 'manifest.webmanifest')),
  access(resolve(siteRoot, 'futebol', 'sw.js')),
])

console.log('Artefato Pages preparado com a raiz preservada e a aplicacao em /futebol/.')
