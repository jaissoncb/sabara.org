import { access, cp, lstat, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertPublicBundle } from '../apps/futebol/scripts/bundle-security.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultRepositoryRoot = resolve(scriptDirectory, '..')
const rootFiles = ['index.html', 'style.css', '404.html', 'CNAME', 'favicon.ico']
const optionalRootFiles = ['robots.txt', '.nojekyll']

async function filesUnder(directory) {
  if (!(await lstat(directory)).isDirectory()) throw new Error('Diretório não regular no artefato Pages.')
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Links simbólicos não são permitidos no artefato Pages.')
    if (entry.isDirectory()) {
      for (const child of await filesUnder(resolve(directory, entry.name))) files.push(`${entry.name}/${child}`)
    } else if (entry.isFile()) files.push(entry.name)
    else throw new Error('Entrada não regular no artefato Pages.')
  }
  return files
}

export async function preparePages({ repositoryRoot = defaultRepositoryRoot } = {}) {
  repositoryRoot = resolve(repositoryRoot)
  const siteRoot = resolve(repositoryRoot, '_site')
  const appBuild = resolve(repositoryRoot, 'apps', 'futebol', 'dist')
  if (dirname(siteRoot) !== repositoryRoot || (await lstat(siteRoot).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  }))?.isSymbolicLink()) {
    throw new Error('Destino do artefato Pages fora do repositorio.')
  }

  const copiedRootFiles = [...rootFiles]
  for (const file of optionalRootFiles) {
    const info = await lstat(resolve(repositoryRoot, file)).catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (info) copiedRootFiles.push(file)
  }
  for (const file of copiedRootFiles) {
    if (!(await lstat(resolve(repositoryRoot, file))).isFile()) throw new Error(`Arquivo raiz não regular: ${file}`)
  }
  const assets = await filesUnder(resolve(repositoryRoot, 'assets'))
  const appFiles = await filesUnder(appBuild)
  await Promise.all(['index.html', 'manifest.webmanifest', 'sw.js', 'assets'].map((file) => access(resolve(appBuild, file))))
  for (const file of appFiles) {
    if (/\.(js|map|html|css|webmanifest|txt)$/.test(file)) assertPublicBundle(await readFile(resolve(appBuild, file), 'utf8'))
  }
  await rm(siteRoot, { force: true, recursive: true })
  await mkdir(siteRoot, { recursive: true })

  for (const file of copiedRootFiles) {
    await cp(resolve(repositoryRoot, file), resolve(siteRoot, file))
  }

  await cp(resolve(repositoryRoot, 'assets'), resolve(siteRoot, 'assets'), { recursive: true })
  await cp(appBuild, resolve(siteRoot, 'futebol'), { recursive: true })

  for (const file of [...copiedRootFiles, ...assets.map((file) => `assets/${file}`), ...appFiles.map((file) => `futebol/${file}`)]) {
    const source = await readFile(file.startsWith('futebol/')
      ? resolve(appBuild, file.slice('futebol/'.length)) : resolve(repositoryRoot, file))
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

  return { siteRoot, copiedRootFiles, rootAssetCount: assets.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await preparePages()
  console.log(`Artefato Pages preparado: raiz/assets preservados, Futebol em /futebol/. Opcionais presentes: ${result.copiedRootFiles.filter((file) => optionalRootFiles.includes(file)).join(', ') || 'nenhum'}.`)
}
