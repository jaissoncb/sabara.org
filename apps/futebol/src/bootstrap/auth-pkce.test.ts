import { bootstrapApplication, readAuthCallback } from './auth-pkce'

describe('readAuthCallback', () => {
  it('le um code PKCE da query string antes da rota hash', () => {
    const callback = readAuthCallback(
      new URL('https://sabara.org/futebol/?code=abc123&sb_flow_id=flow-1#/jogadores'),
    )

    expect(callback).toEqual({ kind: 'pkce', code: 'abc123', flowId: 'flow-1' })
  })

  it('mantem a rota hash independente quando nao ha callback', () => {
    const callback = readAuthCallback(
      new URL('https://sabara.org/futebol/#/jogadores'),
    )

    expect(callback).toEqual({ kind: 'none' })
  })

  it('normaliza erros sem expor detalhes tecnicos na interface', () => {
    const callback = readAuthCallback(
      new URL('https://sabara.org/futebol/?error_code=otp_expired&error_description=Link%20expirado#/'),
    )

    expect(callback).toEqual({
      kind: 'error',
      code: 'otp_expired',
      description: 'Link expirado',
    })
  })
})
describe('bootstrapApplication', () => {
  it('disponibiliza o callback antes da montagem do router', async () => {
    const context = await bootstrapApplication(
      new URL('https://sabara.org/futebol/?code=one-time-code#/'),
    )

    expect(context.authCallback.kind).toBe('pkce')
  })
})
