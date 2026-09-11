import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '..', 'dist')
const manifestPath = resolve(dist, 'manifest.webmanifest')
const indexPath = resolve(dist, 'index.html')
const serviceWorkerPath = resolve(dist, 'sw.js')

await Promise.all([access(manifestPath), access(indexPath), access(serviceWorkerPath)])

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const index = await readFile(indexPath, 'utf8')

if (manifest.scope !== '/futebol/') {
  throw new Error(`PWA scope invalido: ${String(manifest.scope)}`)
}

if (manifest.start_url !== '/futebol/#/') {
  throw new Error(`PWA start_url invalido: ${String(manifest.start_url)}`)
}

if (!index.includes('/futebol/assets/')) {
  throw new Error('O build nao aplicou base /futebol/ aos assets.')
}

console.log('Build verificado: base, manifest, scope e service worker estao limitados a /futebol/.')
