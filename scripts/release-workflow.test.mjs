import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateReleaseRequest } from './release-guard.mjs'

const workflow = await readFile(new URL('../.github/workflows/ci-pages.yml', import.meta.url), 'utf8')
const job = (name) => workflow.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z]+:|$(?![\\s\\S]))`, 'm'))?.[1]
const condition = (name) => job(name).match(/^    if: >-\n((?:      .*\n)+)/m)[1].trim()
// Evaluate the exact restricted conditions from the checked-in YAML, not a
// parallel hand-written permission matrix. These are trusted repo expressions.
const permits = (name, context) => Function('github', 'inputs', 'needs', `return (${condition(name)})`)(context.github, context.inputs, context.needs)
const sha = 'a'.repeat(40)
const request = { eventName: 'workflow_dispatch', ref: 'refs/heads/main', sha, expectedSha: sha, variant: 'full' }

for (const variant of ['full', 'root-only']) test(`correct main dispatch permits ${variant}`, () => {
  assert.deepEqual(validateReleaseRequest({ ...request, variant }), { releaseAllowed: true, variant, sha })
})
for (const [name, override] of [
  ['wrong branch', { ref: 'refs/heads/codex/futebol-mvp' }],
  ['tag', { ref: 'refs/tags/main' }],
  ['empty expected SHA', { expectedSha: '' }],
  ['missing expected SHA', { expectedSha: undefined }],
  ['wrong expected SHA', { expectedSha: 'b'.repeat(40) }],
  ['short expected SHA', { expectedSha: 'aaaaaaa' }],
  ['invalid variant', { variant: '../full' }],
]) test(`guard fails closed on ${name}`, () => { assert.throws(() => validateReleaseRequest({ ...request, ...override })) })

for (const eventName of ['push', 'pull_request']) for (const ref of ['refs/heads/main', 'refs/heads/codex/futebol-mvp']) {
  test(`${eventName} ${ref} cannot package or deploy`, () => {
    assert.equal(validateReleaseRequest({ ...request, eventName, ref }).releaseAllowed, false)
    const context = { github: { event_name: eventName, ref, sha }, inputs: { expected_sha: sha }, needs: { build: { outputs: { release_allowed: 'true' } }, package: { result: 'success' } } }
    assert.equal(permits('package', context), false)
    assert.equal(permits('deploy', context), false)
  })
}
test('exact YAML conditions only permit validated main dispatch and successful package', () => {
  const context = { github: { event_name: 'workflow_dispatch', ref: 'refs/heads/main', sha }, inputs: { expected_sha: sha }, needs: { build: { outputs: { release_allowed: 'true' } }, package: { result: 'success' } } }
  assert.equal(permits('package', context), true)
  assert.equal(permits('deploy', context), true)
  for (const ref of ['refs/heads/codex/futebol-mvp', 'refs/tags/main']) {
    const other = { ...context, github: { ...context.github, ref } }
    assert.equal(permits('package', other), false)
    assert.equal(permits('deploy', other), false)
  }
  for (const expected_sha of ['', 'b'.repeat(40)]) {
    const other = { ...context, inputs: { expected_sha } }
    assert.equal(permits('package', other), false)
    assert.equal(permits('deploy', other), false)
  }
  assert.equal(permits('package', { ...context, needs: { ...context.needs, build: { outputs: { release_allowed: 'false' } } } }), false)
  assert.equal(permits('deploy', { ...context, needs: { ...context.needs, package: { result: 'failure' } } }), false)
})
test('workflow preserves immutable same-run transport and structural approval boundary', () => {
  assert.match(workflow, /workflow_dispatch:\n    inputs:\n      expected_sha:/)
  assert.match(workflow, /expected_sha:[\s\S]*?required: true\n        type: string/)
  assert.match(workflow, /type: choice\n        default: full\n        options:\n          - full\n          - root-only/)
  assert.doesNotMatch(workflow, /ENABLE_PAGES_DEPLOY/)
  assert.match(job('package'), /needs: build/)
  assert.match(job('package'), /artifact-ids:.*needs\.build\.outputs\.rollback_id.*needs\.build\.outputs\.preview_id/)
  assert.doesNotMatch(job('package'), /run-id:|repository:|github-token:|environment:/)
  assert.match(job('package'), /actions\/upload-pages-artifact@v5\.0\.0/)
  assert.match(job('package'), /include-hidden-files: true/)
  assert.match(job('package'), /Validate exact selected package before Pages upload/)
  assert.match(job('package'), /Require a single artifact ID and BUILD content digest/)
  assert.match(job('package'), /EXPECTED_CONTENT_DIGEST:.*needs\.build\.outputs\.rollback_digest.*needs\.build\.outputs\.full_digest/)
  assert.match(job('deploy'), /needs: package/)
  assert.match(job('deploy'), /environment:\n      name: github-pages/)
  assert.match(job('deploy'), /contents: read\n      pages: write\n      id-token: write/)
  assert.match(job('deploy'), /actions\/deploy-pages@v4/)
  assert.doesNotMatch(job('deploy'), /checkout@|download-artifact@|upload-pages-artifact@|pnpm|prepare-pages/)
  assert.doesNotMatch(workflow, /ref:.*expected_sha/)
  assert.equal((job('build').match(/include-hidden-files: true/g) || []).length, 2)
  assert.equal((job('build').match(/actions\/upload-artifact@v4/g) || []).length, 2)
  assert.match(job('build'), /name: root-rollback/)
  assert.match(job('build'), /Validate both publication trees before conventional uploads/)
})
