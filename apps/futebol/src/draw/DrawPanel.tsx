import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { GroupWithRole, Player } from '../groups/group-service'
import { drawTeams, DrawInputError, type DrawResult } from './engine'

const TEAM_NAMES = ['Azul', 'Vermelho', 'Verde']

function LegacyDrawPanel({ group, players }: { group: GroupWithRole; players: Player[] }) {
  const [open, setOpen] = useState(false)
  if (group.role !== 'owner' && group.role !== 'admin') return null
  const eligible = players.filter((player) => player.active && player.group_id === group.id)
  return (
    <section className="panel draw-panel" aria-label="Sorteio de times">
      <h2>Sorteio de times</h2>
      <p>Prévia local com o elenco do grupo. O sorteio não será salvo.</p>
      <button type="button" className="quiet-action" onClick={() => setOpen(!open)}>{open ? 'Fechar sorteio' : 'Abrir sorteio'}</button>
      {open ? <DrawForm key={JSON.stringify([group.id, group.default_players_on_court, eligible])} players={eligible} playersOnCourt={group.default_players_on_court} /> : null}
    </section>
  )
}
void LegacyDrawPanel

export { GameFlow as DrawPanel } from './GameFlow'

function DrawForm({ players, playersOnCourt }: { players: Player[]; playersOnCourt: number }) {
  const [selected, setSelected] = useState<string[]>([])
  const [teamCount, setTeamCount] = useState(2)
  const [result, setResult] = useState<DrawResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  function changeSelection(ids: string[]) {
    setSelected(ids)
    setResult(null)
    setError(null)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setResult(null)
    setError(null)
    // Yield to paint the loading state before the bounded synchronous domain calculation.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    if (!mounted.current) return
    try {
      const seed = Array.from(crypto.getRandomValues(new Uint32Array(4)), (word) => word.toString(16).padStart(8, '0')).join('')
      setResult(drawTeams({
        players: players.filter((player) => selected.includes(player.id)).map((player) => ({
          id: player.id, skillRating: Number(player.skill_rating), isGoalkeeper: player.is_goalkeeper,
        })),
        teamCount, playersOnCourt, seed,
      }))
    } catch (cause) {
      setError(cause instanceof DrawInputError ? cause.message : 'Não foi possível sortear os times. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }
  if (players.length === 0) return <p className="empty-list">Nenhum jogador ativo disponível. Cadastre ou reative jogadores no elenco.</p>
  return (
    <>
      <form className="data-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
        <fieldset disabled={busy} className="draw-controls">
          <legend>Configurar sorteio</legend>
          <label>Número de times<select value={teamCount} onChange={(event) => { setTeamCount(Number(event.target.value)); setResult(null); setError(null) }}><option value={2}>2 times</option><option value={3}>3 times</option></select></label>
          <p>{playersOnCourt} em quadra por time · conforme os ajustes do grupo.</p>
          <div className="draw-actions">
            <button className="quiet-action" type="button" onClick={() => changeSelection(players.map((player) => player.id))}>Selecionar todos</button>
            <button className="quiet-action" type="button" onClick={() => changeSelection([])}>Limpar seleção</button>
          </div>
          <fieldset className="draw-controls">
            <legend>Jogadores disponíveis</legend>
            {players.map((player) => <label className="draw-player-option" key={player.id}>
              <input type="checkbox" checked={selected.includes(player.id)} onChange={(event) => changeSelection(event.target.checked ? [...selected, player.id] : selected.filter((id) => id !== player.id))} />
              <span>{player.nickname || player.name} · Nível {Number(player.skill_rating).toFixed(1)}{player.is_goalkeeper ? ' · Goleiro' : ''}</span>
            </label>)}
          </fieldset>
          <p aria-live="polite">{selected.length} jogadores selecionados</p>
          <p>Todos entram em um time. Times incompletos são permitidos; selecione pelo menos um jogador por time.</p>
          <button className="solid-action" type="submit" disabled={selected.length < teamCount || result !== null}>{busy ? 'Sorteando…' : 'Sortear times'}</button>
        </fieldset>
        {error ? <p className="form-status" role="alert">{error}</p> : null}
      </form>
      {result ? <section aria-label="Prévia dos times" aria-live="polite" className="draw-result">
        <h3>Times sorteados</h3>
        <p>Diferença entre médias: {result.balanceScore.toFixed(2)}. Quanto menor, mais próximos os níveis médios.</p>
        <div className="draw-teams">{result.teams.map((team, index) => <article className="draw-team" key={index}>
          <h3>Time {TEAM_NAMES[index]}</h3>
          <p>{team.playerIds.length} jogadores · Média {team.skillMean.toFixed(2)} · Soma {team.skillSum.toFixed(1)}</p>
          <p>{team.goalkeeperCount} goleiro(s)</p>
          {team.missingPlayers > 0 ? <p>{team.playerIds.length}/{playersOnCourt} — precisa de {team.missingPlayers} jogador(es) emprestado(s)</p> : null}
          <ul>{team.playerIds.map((id) => {
            const player = players.find((entry) => entry.id === id)!
            return <li key={id}>{player.nickname || player.name} · Nível {Number(player.skill_rating).toFixed(1)}{player.is_goalkeeper ? ' · Goleiro' : ''}{team.reserveIds.includes(id) ? ' · Reserva inicial' : ' · Em quadra'}</li>
          })}</ul>
        </article>)}</div>
        <p>Esta prévia é temporária. Fechar o sorteio ou mudar a seleção descarta o resultado.</p>
      </section> : null}
    </>
  )
}
