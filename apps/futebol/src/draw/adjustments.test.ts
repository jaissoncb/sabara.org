import { describe, expect, it } from 'vitest'
import type { DrawPlayer } from './engine'
import { movePlayer, swapCourtStatus, swapPlayers, validateAdjustment, type AdjustmentState } from './adjustments'

const players = new Map<string, DrawPlayer>([
  ['g1', { id: 'g1', skillRating: 3, isGoalkeeper: true }],
  ['g2', { id: 'g2', skillRating: 3, isGoalkeeper: true }],
  ['a', { id: 'a', skillRating: 2, isGoalkeeper: false }],
  ['b', { id: 'b', skillRating: 3, isGoalkeeper: false }],
  ['c', { id: 'c', skillRating: 4, isGoalkeeper: false }],
  ['d', { id: 'd', skillRating: 5, isGoalkeeper: false }],
])
const state: AdjustmentState = { playersOnCourt: 2, teams: [
  { playerIds: ['g1', 'a', 'b'], reserveIds: ['b'] },
  { playerIds: ['g2', 'c', 'd'], reserveIds: ['d'] },
] }

describe('ajustes locais da Fase 6', () => {
  it('troca jogadores sem duplicar ou perder participantes e conserva tamanhos', () => {
    const result = swapPlayers(state, 0, 'a', 1, 'c', players)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.teams.flatMap((team) => team.playerIds).sort()).toEqual(['a', 'b', 'c', 'd', 'g1', 'g2'])
    expect(result.state.teams.map((team) => team.playerIds)).toEqual([['g1', 'c', 'b'], ['g2', 'a', 'd']])
  })

  it('rejeita movimentação simples que deixaria os tamanhos inválidos', () => {
    expect(movePlayer(state, 0, 'a', 1, players)).toEqual({ ok: false, message: 'O ajuste deixaria os times com tamanhos inválidos.' })
  })

  it('troca titular e reserva no próprio time, mantendo a quantidade em quadra', () => {
    const result = swapCourtStatus(state, 0, 'a', 'b', players)
    expect(result).toEqual({ ok: true, state: { playersOnCourt: 2, teams: [{ playerIds: ['g1', 'a', 'b'], reserveIds: ['a'] }, state.teams[1]] } })
  })

  it('não deixa um time com goleiro sem goleiro em quadra quando há alternativa', () => {
    expect(swapCourtStatus(state, 0, 'g1', 'b', players)).toEqual({ ok: false, message: 'Este time possui goleiro, então um goleiro precisa permanecer em quadra.' })
  })

  it('detecta reserva externa, duplicidade e contagem de quadra inválidas', () => {
    expect(validateAdjustment({ playersOnCourt: 2, teams: [{ playerIds: ['g1', 'a'], reserveIds: ['g2'] }, { playerIds: ['g2', 'b'], reserveIds: [] }] }, players)).toBe('A reserva precisa pertencer ao próprio time.')
    expect(validateAdjustment({ playersOnCourt: 2, teams: [{ playerIds: ['g1', 'a'], reserveIds: [] }, { playerIds: ['g1', 'b'], reserveIds: [] }] }, players)).toBe('Um jogador não pode estar em mais de um time.')
  })
})
