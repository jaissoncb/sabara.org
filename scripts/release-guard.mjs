import { appendFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { siteVariants } from './prepare-pages.mjs'

export function validateReleaseRequest({ eventName, ref, sha, expectedSha, variant }) {
  if (eventName !== 'workflow_dispatch') return { releaseAllowed: false }
  if (ref !== 'refs/heads/main') throw new Error('Release manual exige refs/heads/main.')
  if (!/^[a-f0-9]{40}$/.test(expectedSha || '')) throw new Error('expected_sha exige um SHA completo e não vazio.')
  if (expectedSha !== sha) throw new Error(`expected_sha ${expectedSha} diverge do run SHA ${sha}.`)
  if (!siteVariants.includes(variant)) throw new Error('site_variant deve ser full ou root-only.')
  return { releaseAllowed: true, variant, sha }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const request = validateReleaseRequest({ eventName: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA, expectedSha: process.env.EXPECTED_SHA, variant: process.env.SITE_VARIANT })
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `release_allowed=${request.releaseAllowed}\n`)
  console.log(request.releaseAllowed ? `Release manual validada: SHA ${request.sha}, variant ${request.variant}.` : 'CI sem autorização de package/deploy.')
}
