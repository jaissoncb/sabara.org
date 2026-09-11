export interface SupabaseEnvironment {
  publishableKey: string
  url: string
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

  return { publishableKey, url }
}
