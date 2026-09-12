import { render, screen, within, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrawPanel } from './DrawPanel'
import type { GroupWithRole, Player } from '../groups/group-service'

const group: GroupWithRole = { id: 'a', name: 'Grupo', role: 'owner', sport: 'futsal', default_players_on_court: 5, created_by: 'user', created_at: '', updated_at: '' }
const players: Player[] = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, group_id: 'a', name: `Pessoa ${i}`, nickname: null, skill_rating: 3, is_goalkeeper: i < 3, active: true, preferred_position: null, created_at: '', updated_at: '' }))

describe.skip('prévia substituída pelo fluxo de jogo da Fase 5', () => {
afterEach(() => vi.restoreAllMocks())
it.each(['owner', 'admin', 'member'] as const)('respeita acesso do papel %s', (role) => {
  render(<DrawPanel group={{ ...group, role }} players={players} />)
  expect(screen.queryByRole('button', { name: 'Abrir sorteio' }) !== null).toBe(role !== 'member')
})
it('seleciona elegíveis, gera 5/5/4 e invalida a prévia ao alterar a seleção', async () => {
  const user = userEvent.setup()
  render(<DrawPanel group={group} players={[...players, { ...players[0]!, id: 'inactive', active: false }, { ...players[0]!, id: 'other', group_id: 'b' }]} />)
  await user.click(screen.getByRole('button', { name: 'Abrir sorteio' }))
  expect(screen.getAllByRole('checkbox')).toHaveLength(14)
  expect(screen.getByRole('button', { name: 'Sortear times' })).toBeDisabled()
  await user.selectOptions(screen.getByLabelText('Número de times'), '3')
  await user.click(screen.getByRole('button', { name: 'Selecionar todos' }))
  expect(screen.getByText('14 jogadores selecionados')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Sortear times' }))
  const result = await screen.findByRole('region', { name: 'Prévia dos times' })
  expect(within(result).getAllByRole('article')).toHaveLength(3)
  expect(within(result).getAllByRole('listitem')).toHaveLength(14)
  expect(within(result).getByText(/precisa de 1 jogador/)).toBeInTheDocument()
  await user.click(screen.getAllByRole('checkbox')[0]!)
  expect(screen.queryByRole('region', { name: 'Prévia dos times' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Limpar seleção' }))
  expect(screen.getByText('0 jogadores selecionados')).toBeInTheDocument()
})
it('mostra reserva no próprio time e descarta resultado ao trocar configuração ou fechar', async () => {
  const user = userEvent.setup()
  render(<DrawPanel group={group} players={players.slice(0, 11)} />)
  await user.click(screen.getByRole('button', { name: 'Abrir sorteio' }))
  await user.click(screen.getByRole('button', { name: 'Selecionar todos' }))
  await user.click(screen.getByRole('button', { name: 'Sortear times' }))
  const result = await screen.findByRole('region', { name: 'Prévia dos times' })
  expect(within(result).getAllByText(/Reserva inicial/)).toHaveLength(1)
  expect(within(result).getByText(/Reserva inicial/).closest('article')).not.toBeNull()
  await user.selectOptions(screen.getByLabelText('Número de times'), '3')
  expect(screen.queryByRole('region', { name: 'Prévia dos times' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Fechar sorteio' }))
  await user.click(screen.getByRole('button', { name: 'Abrir sorteio' }))
  expect(screen.getByText('0 jogadores selecionados')).toBeInTheDocument()
})
it('reinicializa seleção quando o elenco ou grupo muda', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<DrawPanel group={group} players={players} />)
  await user.click(screen.getByRole('button', { name: 'Abrir sorteio' }))
  await user.click(screen.getByRole('button', { name: 'Selecionar todos' }))
  rerender(<DrawPanel group={group} players={players.map((p, i) => ({ ...p, active: i > 0 }))} />)
  expect(screen.getByText('0 jogadores selecionados')).toBeInTheDocument()
  expect(screen.getAllByRole('checkbox')).toHaveLength(13)
  rerender(<DrawPanel group={{ ...group, id: 'b' }} players={players} />)
  expect(screen.getByText(/Nenhum jogador ativo/)).toBeInTheDocument()
})
it('trata falha de aleatoriedade sem expor erro técnico e permite nova tentativa', async () => {
  const user = userEvent.setup()
  vi.spyOn(crypto, 'getRandomValues').mockImplementationOnce(() => { throw new Error('private detail') })
  render(<DrawPanel group={group} players={players} />)
  await user.click(screen.getByRole('button', { name: 'Abrir sorteio' }))
  await user.click(screen.getByRole('button', { name: 'Selecionar todos' }))
  await user.click(screen.getByRole('button', { name: 'Sortear times' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sortear')
  expect(screen.queryByText('private detail')).not.toBeInTheDocument()
  expect(screen.getByText('14 jogadores selecionados')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Sortear times' }))
  await waitFor(() => expect(screen.getByRole('region', { name: 'Prévia dos times' })).toBeInTheDocument())
})


it('expõe loading e bloqueia mudanças até concluir o cálculo', async () => {
  vi.useFakeTimers()
  try {
    render(<DrawPanel group={group} players={players} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir sorteio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sortear times' }))
    expect(screen.getByRole('button', { name: 'Sorteando…' })).toBeDisabled()
    expect(screen.getByLabelText('Número de times')).toBeDisabled()
    await act(() => vi.runAllTimersAsync())
    expect(screen.getByRole('region', { name: 'Prévia dos times' })).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
})

describe('fluxo de jogo da Fase 5', () => {
  afterEach(() => vi.restoreAllMocks())

  async function openParticipants(user: ReturnType<typeof userEvent.setup>, options: { teamCount?: '2' | '3'; name?: string } = {}) {
    render(<DrawPanel group={group} players={players} />)
    if (options.name) await user.type(screen.getByLabelText(/Nome/), options.name)
    if (options.teamCount) await user.selectOptions(screen.getByLabelText('Times'), options.teamCount)
    await user.click(screen.getByRole('button', { name: 'Selecionar participantes' }))
  }

  it('limita o fluxo a owner/admin', () => {
    render(<DrawPanel group={{ ...group, role: 'member' }} players={players} />)
    expect(screen.queryByRole('region', { name: 'Novo jogo' })).not.toBeInTheDocument()
  })

  it('configura jogo, seleciona ativos e mostra resultado 5/5/4 com aviso e goleiros', async () => {
    const user = userEvent.setup()
    await openParticipants(user, { teamCount: '3', name: 'Futebol quinta' })
    expect(screen.getByText('3 times · 5 em quadra por time')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    expect(screen.getByText('14 jogadores selecionados')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sortear times' }))
    const result = await screen.findByRole('region', { name: 'Resultado do sorteio' })
    expect(within(result).getByRole('heading', { name: 'Futebol quinta' })).toBeInTheDocument()
    expect(within(result).getAllByRole('article')).toHaveLength(3)
    expect(within(result).getAllByRole('listitem')).toHaveLength(14)
    expect(within(result).getByText(/precisa de 1 jogador/)).toBeInTheDocument()
    expect(within(result).getAllByText(/Goleiro/).length).toBeGreaterThan(0)
  })

  it('mantém dados para voltar e editar participantes ou configuração', async () => {
    const user = userEvent.setup()
    await openParticipants(user)
    await user.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    await user.click(screen.getByRole('button', { name: 'Sortear times' }))
    await screen.findByRole('region', { name: 'Resultado do sorteio' })
    await user.click(screen.getByRole('button', { name: 'Voltar aos participantes' }))
    expect(screen.getByText('14 jogadores selecionados')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('heading', { name: 'Configure a partida' })).toBeInTheDocument()
    expect(screen.getByText(/existe apenas nesta tela/)).toBeInTheDocument()
  })

  it('mostra estado vazio e trata falha de aleatoriedade sem detalhe técnico', async () => {
    const user = userEvent.setup()
    const empty = render(<DrawPanel group={group} players={[]} />)
    await user.click(screen.getByRole('button', { name: 'Selecionar participantes' }))
    expect(screen.getByText(/Nenhum jogador ativo disponível/)).toBeInTheDocument()
    empty.unmount()

    vi.spyOn(crypto, 'getRandomValues').mockImplementationOnce(() => { throw new Error('private detail') })
    await openParticipants(user)
    await user.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    await user.click(screen.getByRole('button', { name: 'Sortear times' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sortear')
    expect(screen.queryByText('private detail')).not.toBeInTheDocument()
  })
})
