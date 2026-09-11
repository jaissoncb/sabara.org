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
  return normalizedKey.startsWith('sb_secret_') || normalizedKey.includes('service_role')
}
