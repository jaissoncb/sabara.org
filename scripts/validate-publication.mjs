import { resolve } from 'node:path'
import { appendFile } from 'node:fs/promises'
import { validatePublication } from './prepare-pages.mjs'

const variant = process.argv[2] || 'full'
const directory = resolve(process.argv[3] || '_site')
const result = await validatePublication({ directory, variant, expectedContentDigest: process.env.EXPECTED_CONTENT_DIGEST })
if (variant === 'full') {
  const { verifyBuild } = await import('../apps/futebol/scripts/verify-build.mjs')
  await verifyBuild({ directory: resolve(directory, 'futebol') })
}
console.log(`Publicação ${variant} validada: ${result.fileCount} arquivos, digest ${result.contentDigest}; hidden: ${result.hiddenFiles.join(', ')}.`)
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${variant.replace('-', '_')}_digest=${result.contentDigest}\n`)
