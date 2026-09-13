export interface SupabaseEnvironment {
  publishableKey: string
  url: string
}

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupabaseConfigurationError'
  }
}

interface PublicEnvironment {
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  VITE_SUPABASE_URL?: string
}

export function getSupabaseEnvironment(
  env: PublicEnvironment = import.meta.env,
): SupabaseEnvironment | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) {
    return null
  }

  const parsedUrl = parseSupabaseUrl(url)

  if (isSecretKey(publishableKey)) {
    throw new SupabaseConfigurationError(
      'Use somente a chave pública VITE_SUPABASE_PUBLISHABLE_KEY no navegador.',
    )
  }

  return { publishableKey, url: parsedUrl.href.replace(/\/$/, '') }
}

function parseSupabaseUrl(value: string): URL {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new SupabaseConfigurationError('VITE_SUPABASE_URL não contém uma URL válida.')
  }

  const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)

  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new SupabaseConfigurationError(
      'VITE_SUPABASE_URL deve usar HTTPS, exceto no desenvolvimento local.',
    )
  }

  return url
}

function isSecretKey(key: string): boolean {
  const normalizedKey = key.toLowerCase()
  if (normalizedKey.startsWith('sb_secret_') || normalizedKey.includes('service_role')) return true
  // Legacy keys encode the role in the JWT payload, not in the literal key.
  if (key.split('.').length === 3) {
    try {
      const payload: unknown = JSON.parse(atob(key.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')))
      return typeof payload !== 'object' || payload === null || !('role' in payload) || payload.role !== 'anon'
    } catch { return true }
  }
  return false
}
