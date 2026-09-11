import { getSupabaseEnvironment } from './environment'

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
})
