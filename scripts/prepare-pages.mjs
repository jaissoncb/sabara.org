import { access, cp, lstat, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { dirname, resolve, relative, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { assertPublicBundle } from '../apps/futebol/scripts/bundle-security.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultRepositoryRoot = resolve(scriptDirectory, '..')
export const rootFiles = Object.freeze(['index.html', 'style.css', '404.html', 'CNAME', 'favicon.ico'])
export const optionalRootFiles = Object.freeze(['robots.txt', '.nojekyll'])
export const siteVariants = Object.freeze(['full', 'root-only'])
const appPath = /^(index\.html|manifest\.webmanifest|sw\.js|workbox-[\w-]+\.js|(assets|icons)\/[\w-][\w.-]*\.(js|css|png|svg|ico))$/

function assertVariant(variant) {
  if (!siteVariants.includes(variant)) throw new Error('site_variant deve ser full ou root-only.')
}

export async function filesUnder(directory, prefix = '') {
  if (!(await lstat(directory)).isDirectory()) throw new Error('Diretório não regular no artefato Pages.')
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`
    if (entry.name.startsWith('.') && path !== '.nojekyll') throw new Error('Hidden file/diretório não permitido no artefato Pages.')
    if (entry.isSymbolicLink()) throw new Error('Links simbólicos não são permitidos no artefato Pages.')
    if (entry.name === '.nojekyll' && !entry.isFile()) throw new Error('.nojekyll deve ser um arquivo regular.')
    if (entry.isDirectory()) {
      // Reject empty unexpected directories too, not only their eventual files.
      if (/^(node_modules|coverage|dist|cache|caches|apps)$/i.test(entry.name)) throw new Error('Diretório privado/cache não permitido no artefato Pages.')
      for (const child of await filesUnder(resolve(directory, entry.name), `${path}/`)) files.push(`${entry.name}/${child}`)
    } else if (entry.isFile()) {
      if (/^(Thumbs\.db|Desktop\.ini)$/i.test(entry.name)) throw new Error('Arquivo de editor/sistema não permitido no artefato Pages.')
      files.push(entry.name)
    }
    else throw new Error('Entrada não regular no artefato Pages.')
  }
  return files
}

async function directoriesUnder(directory) {
  const directories = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      directories.push(entry.name)
      for (const child of await directoriesUnder(resolve(directory, entry.name))) directories.push(`${entry.name}/${child}`)
    }
  }
  return directories.sort()
}

async function rootInputs(repositoryRoot, requireOptionals) {
  const copiedRootFiles = [...rootFiles]
  for (const file of optionalRootFiles) {
    const info = await lstat(resolve(repositoryRoot, file)).catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (info) copiedRootFiles.push(file)
    else if (requireOptionals) throw new Error(`Arquivo obrigatório para publicação ausente: ${file}`)
  }
  for (const file of copiedRootFiles) {
    if (!(await lstat(resolve(repositoryRoot, file))).isFile()) throw new Error(`Arquivo raiz não regular: ${file}`)
  }
  return { copiedRootFiles, assets: await filesUnder(resolve(repositoryRoot, 'assets'), 'assets/') }
}

/** Validate both the staging tree and a downloaded artifact before ANY upload.
 * Root bytes come from the run's checkout; full app paths are restricted to
 * compiled public resources. Build also compares all app bytes with dist.
 */
export async function validatePublication({ directory, repositoryRoot = defaultRepositoryRoot, variant = 'full', requireOptionals = true, appBuild, expectedContentDigest } = {}) {
  assertVariant(variant)
  directory = resolve(directory)
  repositoryRoot = resolve(repositoryRoot)
  const files = (await filesUnder(directory)).sort()
  const { copiedRootFiles, assets } = await rootInputs(repositoryRoot, requireOptionals)
  const rootPaths = [...copiedRootFiles, ...assets.map((file) => `assets/${file}`)].sort()
  const top = await readdir(directory, { withFileTypes: true })
  for (const entry of top) {
    if (entry.isDirectory() ? !['assets', ...(variant === 'full' ? ['futebol'] : [])].includes(entry.name) : !copiedRootFiles.includes(entry.name)) {
      throw new Error('Arquivo/diretório fora da allowlist de publicação.')
    }
  }
  const actualRoot = files.filter((file) => !file.startsWith('futebol/'))
  if (JSON.stringify(actualRoot) !== JSON.stringify(rootPaths)) throw new Error('Conteúdo raiz fora da allowlist de publicação.')
  if (JSON.stringify(await directoriesUnder(resolve(directory, 'assets'))) !== JSON.stringify(await directoriesUnder(resolve(repositoryRoot, 'assets')))) throw new Error('Diretórios assets divergentes da fonte aprovada.')
  for (const file of rootPaths) {
    if (!(await readFile(resolve(repositoryRoot, file))).equals(await readFile(resolve(directory, file)))) throw new Error('Bytes do site raiz divergentes da fonte aprovada.')
  }
  if (variant === 'full') {
    const appFiles = files.filter((file) => file.startsWith('futebol/')).map((file) => file.slice(8))
    if (!appFiles.length || appFiles.some((file) => !appPath.test(file))) throw new Error('Conteúdo Futebol fora da allowlist pública.')
    if ((await directoriesUnder(resolve(directory, 'futebol'))).some((path) => !['assets', 'icons'].includes(path))) throw new Error('Diretório Futebol fora da allowlist pública.')
    await Promise.all(['index.html', 'manifest.webmanifest', 'sw.js', 'assets'].map((file) => access(resolve(directory, 'futebol', file))))
    if (appBuild) {
      if (JSON.stringify(appFiles.sort()) !== JSON.stringify((await filesUnder(appBuild, 'futebol/')).sort())) throw new Error('Inventário Futebol divergente do build.')
      for (const file of appFiles) if (!(await readFile(resolve(appBuild, file))).equals(await readFile(resolve(directory, 'futebol', file)))) throw new Error('Bytes Futebol divergentes do build.')
    }
  }
  const digest = createHash('sha256')
  for (const file of files) {
    const content = await readFile(resolve(directory, file))
    if (/\.(js|map|html|css|webmanifest|txt|svg)$/.test(file) || file === 'CNAME') assertPublicBundle(content.toString('utf8'))
    digest.update(`${file}\0${createHash('sha256').update(content).digest('hex')}\n`)
  }
  const contentDigest = digest.digest('hex')
  if (expectedContentDigest !== undefined && (!/^[a-f0-9]{64}$/.test(expectedContentDigest) || expectedContentDigest !== contentDigest)) throw new Error('Digest do conteúdo divergente do BUILD aprovado.')
  return { variant, fileCount: files.length, contentDigest, hiddenFiles: files.filter((file) => file.split('/').some((part) => part.startsWith('.'))) }
}

export async function preparePages({ repositoryRoot = defaultRepositoryRoot, variant = 'full', requireOptionals = false } = {}) {
  assertVariant(variant)
  repositoryRoot = resolve(repositoryRoot)
  const siteRoot = resolve(repositoryRoot, variant === 'full' ? '_site' : 'apps/futebol/coverage/root-rollback')
  const appBuild = resolve(repositoryRoot, 'apps', 'futebol', 'dist')
  // Only these two generated destinations are permitted; check every ancestor
  // before reconstructing either tree (including coverage on Windows).
  const targetRelative = relative(repositoryRoot, siteRoot)
  if (targetRelative.startsWith('..') || !targetRelative) throw new Error('Destino do artefato Pages fora do repositorio.')
  let target = repositoryRoot
  for (const part of targetRelative.split(sep)) {
    target = resolve(target, part)
    const info = await lstat(target).catch((error) => { if (error.code === 'ENOENT') return null; throw error })
    if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new Error('Destino/ancestor do artefato Pages não regular.')
  }
  const { copiedRootFiles, assets } = await rootInputs(repositoryRoot, requireOptionals)
  const appFiles = variant === 'full' ? await filesUnder(appBuild, 'futebol/') : []
  if (variant === 'full') await Promise.all(['index.html', 'manifest.webmanifest', 'sw.js', 'assets'].map((file) => access(resolve(appBuild, file))))
  for (const file of appFiles) {
    if (!appPath.test(file)) throw new Error('Conteúdo Futebol fora da allowlist pública.')
    if (/\.(js|map|html|css|webmanifest|txt)$/.test(file)) assertPublicBundle(await readFile(resolve(appBuild, file), 'utf8'))
  }
  await rm(siteRoot, { force: true, recursive: true })
  await mkdir(siteRoot, { recursive: true })

  for (const file of copiedRootFiles) {
    await cp(resolve(repositoryRoot, file), resolve(siteRoot, file))
  }

  await cp(resolve(repositoryRoot, 'assets'), resolve(siteRoot, 'assets'), { recursive: true })
  if (variant === 'full') await cp(appBuild, resolve(siteRoot, 'futebol'), { recursive: true })

  for (const file of [...copiedRootFiles, ...assets.map((file) => `assets/${file}`), ...appFiles.map((file) => `futebol/${file}`)]) {
    const source = await readFile(file.startsWith('futebol/')
      ? resolve(appBuild, file.slice('futebol/'.length)) : resolve(repositoryRoot, file))
    const assembled = await readFile(resolve(siteRoot, file))

    if (!source.equals(assembled)) {
      throw new Error(`Arquivo raiz alterado durante a montagem: ${file}`)
    }
  }

  const validation = await validatePublication({ directory: siteRoot, repositoryRoot, variant, requireOptionals, appBuild: variant === 'full' ? appBuild : undefined })
  return { siteRoot, copiedRootFiles, rootAssetCount: assets.length, ...validation }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const variant = process.argv[2] || 'full'
  const result = await preparePages({ variant, requireOptionals: true })
  console.log(`Artefato ${variant} preparado e validado: ${result.fileCount} arquivos, digest ${result.contentDigest}, hidden permitido: ${result.hiddenFiles.join(', ')}.`)
}
