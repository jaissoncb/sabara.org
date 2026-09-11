export type AuthCallback =
  | { kind: 'none' }
  | { kind: 'pkce'; code: string; flowId?: string }
  | { kind: 'error'; code?: string; description: string }

export interface BootstrapContext {
  authCallback: AuthCallback
}

export function readAuthCallback(url: URL): AuthCallback {
  const error = url.searchParams.get('error')
  const errorCode = url.searchParams.get('error_code')
  const errorDescription = url.searchParams.get('error_description')

  if (error || errorCode || errorDescription) {
    return {
      kind: 'error',
      code: errorCode ?? error ?? undefined,
      description: errorDescription ?? 'Não foi possível concluir a autenticação.',
    }
  }

  const code = url.searchParams.get('code')

  if (!code) {
    return { kind: 'none' }
  }

  const flowId = url.searchParams.get('sb_flow_id')

  return {
    kind: 'pkce',
    code,
    flowId: flowId ?? undefined,
  }
}

export async function bootstrapApplication(url: URL): Promise<BootstrapContext> {
  const authCallback = readAuthCallback(url)

  // Fase 2: troque o code PKCE por uma sessão Supabase neste ponto.
  // Esta função é aguardada antes que o HashRouter seja montado.
  await Promise.resolve()

  return { authCallback }
}
