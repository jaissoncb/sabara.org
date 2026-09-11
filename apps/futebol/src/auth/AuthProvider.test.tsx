import { act, render, screen } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { FutebolSupabaseClient } from '../lib/supabase/client'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './auth-context'

function SessionState() {
  const { session } = useAuth()
  return <span>{session?.user.email ?? 'anônimo'}</span>
}

describe('AuthProvider', () => {
  it('acompanha mudanças entre estado autenticado e não autenticado sem rede', () => {
    let notify: ((event: AuthChangeEvent, session: Session | null) => void) | undefined
    const client = {
      auth: {
        onAuthStateChange: vi.fn((callback: typeof notify) => {
          notify = callback
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
      },
    } as unknown as FutebolSupabaseClient

    render(<AuthProvider client={client} initialSession={null}><SessionState /></AuthProvider>)
    expect(screen.getByText('anônimo')).toBeInTheDocument()

    act(() => notify?.('SIGNED_IN', { user: { email: 'jogador@example.com' } } as Session))
    expect(screen.getByText('jogador@example.com')).toBeInTheDocument()

    act(() => notify?.('SIGNED_OUT', null))
    expect(screen.getByText('anônimo')).toBeInTheDocument()
  })
})
