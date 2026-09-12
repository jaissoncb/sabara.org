import { useState, type FormEvent } from 'react'
import type { GroupWithRole, Player } from '../groups/group-service'
import { drawTeams, DrawInputError, type DrawResult } from './engine'

const TEAM_NAMES = ['Azul', 'Vermelho', 'Verde']
type GameStep = 'details' | 'participants' | 'result'
interface GameConfig { name: string; matchDate: string; matchTime: string; playersOnCourt: number; teamCount: number }

/** Phase 5 holds its game only in component state. Saving belongs to Phase 7. */
export function GameFlow({ group, players }: { group: GroupWithRole; players: Player[] }) {
  const [step, setStep] = useState<GameStep>('details')
  const [config, setConfig] = useState<GameConfig>({ name: '', matchDate: new Date().toISOString().slice(0, 10), matchTime: '', playersOnCourt: group.default_players_on_court, teamCount: 2 })
  const [selected, setSelected] = useState<string[]>([])
  const [result, setResult] = useState<DrawResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (group.role !== 'owner' && group.role !== 'admin') return null
  const eligible = players.filter((player) => player.active && player.group_id === group.id)

  function beginGame(next: GameConfig) { setConfig(next); setError(null); setResult(null); setStep('participants') }
  async function draw() {
    if (busy) return
    setBusy(true); setError(null)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    try {
      const seed = Array.from(crypto.getRandomValues(new Uint32Array(4)), (word) => word.toString(16).padStart(8, '0')).join('')
      setResult(drawTeams({ players: eligible.filter((p) => selected.includes(p.id)).map((p) => ({ id: p.id, skillRating: Number(p.skill_rating), isGoalkeeper: p.is_goalkeeper })), playersOnCourt: config.playersOnCourt, seed, teamCount: config.teamCount }))
      setStep('result')
    } catch (cause) { setError(cause instanceof DrawInputError ? cause.message : 'Não foi possível sortear os times. Tente novamente.') } finally { setBusy(false) }
  }
  return <section className="panel draw-panel" aria-label="Novo jogo">
    <div className="game-flow-heading"><div><p className="eyebrow">Novo jogo</p><h2>{step === 'details' ? 'Configure a partida' : step === 'participants' ? 'Quem vai jogar?' : 'Times sorteados'}</h2></div><p className="game-flow-step" aria-label={`Etapa ${step === 'details' ? 1 : step === 'participants' ? 2 : 3} de 3`}>{step === 'details' ? '1 de 3' : step === 'participants' ? '2 de 3' : '3 de 3'}</p></div>
    <p className="game-flow-note">O jogo existe apenas nesta tela até o fim desta fase.</p>
    {step === 'details' ? <Details initial={config} onContinue={beginGame} /> : null}
    {step === 'participants' ? <Participants busy={busy} config={config} error={error} players={eligible} selected={selected} onBack={() => { setError(null); setStep('details') }} onDraw={() => void draw()} onSelectedChange={(ids) => { setSelected(ids); setError(null) }} /> : null}
    {step === 'result' && result ? <Results config={config} players={eligible} result={result} onEditGame={() => setStep('details')} onEditParticipants={() => setStep('participants')} /> : null}
  </section>
}

function Details({ initial, onContinue }: { initial: GameConfig; onContinue: (value: GameConfig) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); onContinue({ name: stringValue(form, 'name'), matchDate: stringValue(form, 'matchDate'), matchTime: stringValue(form, 'matchTime'), playersOnCourt: Number(form.get('playersOnCourt')), teamCount: Number(form.get('teamCount')) }) }
  return <form className="data-form" onSubmit={submit}><label>Nome <span>(opcional)</span><input name="name" defaultValue={initial.name} maxLength={80} placeholder="Ex.: Futebol de quinta" /></label><div className="form-grid"><label>Data<input name="matchDate" type="date" defaultValue={initial.matchDate} required /></label><label>Horário <span>(opcional)</span><input name="matchTime" type="time" defaultValue={initial.matchTime} /></label></div><div className="form-grid"><label>Times<select name="teamCount" defaultValue={initial.teamCount}><option value={2}>2 times</option><option value={3}>3 times</option></select></label><label>Em quadra por time<input name="playersOnCourt" type="number" min="1" max="20" defaultValue={initial.playersOnCourt} required /></label></div><button className="solid-action" type="submit">Selecionar participantes</button></form>
}

function Participants({ busy, config, error, players, selected, onBack, onDraw, onSelectedChange }: { busy: boolean; config: GameConfig; error: string | null; players: Player[]; selected: string[]; onBack: () => void; onDraw: () => void; onSelectedChange: (ids: string[]) => void }) {
  if (players.length === 0) return <div className="empty-list"><p>Nenhum jogador ativo disponível.</p><span>Cadastre ou reative jogadores no elenco antes de criar o jogo.</span><button className="quiet-action" type="button" onClick={onBack}>Voltar à configuração</button></div>
  const toggle = (id: string, checked: boolean) => onSelectedChange(checked ? [...selected, id] : selected.filter((entry) => entry !== id))
  return <div className="game-participants"><p className="game-summary">{config.teamCount} times · {config.playersOnCourt} em quadra por time</p><div className="draw-actions"><button className="quiet-action" type="button" disabled={busy} onClick={() => onSelectedChange(players.map((p) => p.id))}>Selecionar todos</button><button className="quiet-action" type="button" disabled={busy} onClick={() => onSelectedChange([])}>Limpar seleção</button></div><fieldset className="draw-controls" disabled={busy}><legend>Jogadores ativos</legend>{players.map((p) => <label className="draw-player-option" key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={(event) => toggle(p.id, event.target.checked)} /><span>{p.nickname || p.name} · Nível {Number(p.skill_rating).toFixed(1)}{p.is_goalkeeper ? ' · Goleiro' : ''}</span></label>)}</fieldset><p aria-live="polite">{selected.length} jogadores selecionados</p><p>Todos os selecionados entram em um time. Times incompletos e reservas por time são permitidos.</p>{error ? <p className="form-status" role="alert">{error}</p> : null}<div className="game-flow-actions"><button className="quiet-action" type="button" disabled={busy} onClick={onBack}>Voltar</button><button className="solid-action" type="button" disabled={busy || selected.length < config.teamCount} onClick={onDraw}>{busy ? 'Sorteando…' : 'Sortear times'}</button></div></div>
}

function Results({ config, players, result, onEditGame, onEditParticipants }: { config: GameConfig; players: Player[]; result: DrawResult; onEditGame: () => void; onEditParticipants: () => void }) {
  return <section aria-label="Resultado do sorteio" aria-live="polite" className="draw-result"><div><h3>{config.name.trim() || 'Jogo sem nome'}</h3><p>{formatDate(config.matchDate)}{config.matchTime ? ` · ${config.matchTime}` : ''} · {config.teamCount} times</p></div><p>Diferença entre médias: {result.balanceScore.toFixed(2)}. Quanto menor, mais próximos os níveis médios.</p><div className="draw-teams">{result.teams.map((team, index) => <article className="draw-team" key={index}><h3>Time {TEAM_NAMES[index]}</h3><p>{team.playerIds.length} jogadores · Média {team.skillMean.toFixed(2)} · Soma {team.skillSum.toFixed(1)}</p><p>{team.goalkeeperCount} goleiro(s)</p>{team.missingPlayers > 0 ? <p className="team-warning">{team.playerIds.length}/{config.playersOnCourt} em quadra — precisa de {team.missingPlayers} jogador(es) emprestado(s)</p> : null}<ul>{team.playerIds.map((id) => { const player = players.find((entry) => entry.id === id)!; return <li key={id}>{player.nickname || player.name} · Nível {Number(player.skill_rating).toFixed(1)}{player.is_goalkeeper ? ' · Goleiro' : ''}{team.reserveIds.includes(id) ? ' · Reserva inicial' : ' · Em quadra'}</li> })}</ul></article>)}</div><p className="game-flow-note">Use “Voltar aos participantes” para corrigir presenças ou “Editar jogo” para alterar a configuração. O resultado não foi salvo.</p><div className="game-flow-actions"><button className="quiet-action" type="button" onClick={onEditGame}>Editar jogo</button><button className="solid-action" type="button" onClick={onEditParticipants}>Voltar aos participantes</button></div></section>
}

function stringValue(form: FormData, name: string): string { const value = form.get(name); return typeof value === 'string' ? value : '' }
function formatDate(value: string): string { if (!value) return 'Data não informada'; const [year, month, day] = value.split('-'); return `${day}/${month}/${year}` }
