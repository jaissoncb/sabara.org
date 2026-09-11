import { getSupabaseEnvironment, SupabaseConfigurationError } from './environment'

describe('getSupabaseEnvironment', () => {
  it('nao inicializa integracao parcial', () => {
    expect(getSupabaseEnvironment({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toBeNull()
  })

  it('aceita apenas as duas variaveis publicas previstas', () => {
    expect(
      getSupabaseEnvironment({
        VITE_SUPABASE_URL: ' https://example.supabase.co ',
        VITE_SUPABASE_PUBLISHABLE_KEY: ' publishable-key ',
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'publishable-key',
    })
  })

  it('rejeita URL insegura fora do ambiente local', () => {
    expect(() => getSupabaseEnvironment({
      VITE_SUPABASE_URL: 'http://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    })).toThrow(SupabaseConfigurationError)
  })

  it('rejeita uma chave secreta no bundle do navegador', () => {
    expect(() => getSupabaseEnvironment({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do-not-use',
    })).toThrow(/chave pública/i)
  })
})
