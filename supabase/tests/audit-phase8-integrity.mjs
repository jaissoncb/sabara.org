/** Local-only reproduction of the Phase 8 release blocker. No schema change.
 * This probe asserts the OBSERVED gap, not the desired release contract.
 * It must be replaced by rejection regressions when an approved migration fixes it.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

function docker(args, input) {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, timeout: 30_000 })
  assert.equal(r.status, 0, r.stderr || r.error?.message)
  return r.stdout.trim()
}
const local = (value) => /^(unix:\/\/|npipe:\/\/)/.test(value)
assert.ok(!process.env.DOCKER_HOST || local(process.env.DOCKER_HOST), 'local Docker only')
assert.ok(local(docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'])), 'local Docker only')
const actor = randomUUID(), admin = randomUUID(), group = randomUUID(), match = randomUUID()
const players = [randomUUID(), randomUUID()]
const payload = { group_id: group, name: 'Integrity probe', match_date: '2026-01-02', match_time: null,
  team_count: 2, players_on_court: 1, participants: players.map((id) => ({ player_id: id,
    player_name_snapshot: 'Synthetic player', skill_rating_snapshot: 3, is_goalkeeper_snapshot: false })),
  teams: [{ team_index: 1, name: 'Azul' }, { team_index: 2, name: 'Vermelho' }],
  assignments: players.map((id, i) => ({ player_id: id, team_index: i + 1, starts_as_reserve: false, assignment_source: 'draw' })),
  draw_runs: [{ run_number: 1, seed: 'probe', algorithm_version: 'balanced-candidates-v1', balance_score: 0, accepted: true }],
}
const quote = (value) => "'" + value.replaceAll("'", "''") + "'"
const sql = `begin;
insert into auth.users(id,raw_user_meta_data) values ('${actor}','{}'),('${admin}','{}');
insert into public.groups(id,name,created_by) values ('${group}','Integrity probe','${actor}');
insert into public.group_members(group_id,user_id,role) values ('${group}','${actor}','owner'),('${group}','${admin}','admin');
insert into public.players(id,group_id,name,skill_rating) values ${players.map((id) => `('${id}','${group}','Synthetic player',3)`).join(',')};
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"${actor}","role":"authenticated"}',true);
select public.save_match_draw('${match}',${quote(JSON.stringify(payload))}::jsonb);
-- Admin, without the RPC, can invalidate an already accepted graph.
select set_config('request.jwt.claims','{"sub":"${admin}","role":"authenticated"}',true);
update public.team_assignments set starts_as_reserve=true where match_id='${match}';
update public.draw_runs set accepted=false where match_id='${match}';
insert into public.matches(group_id,match_date,status,created_by) values ('${group}','2026-01-02','drawn',auth.uid());
select 'GAP:' || jsonb_build_array(
 (select count(*) from public.team_assignments where match_id='${match}' and starts_as_reserve),
 (select count(*) from public.draw_runs where match_id='${match}' and accepted),
 (select count(*) from public.matches where group_id='${group}' and status='drawn'),
 (select count(*) from public.matches m where group_id='${group}' and not exists(select 1 from public.teams t where t.match_id=m.id)))::text;
rollback;`
const output = docker(['exec', '-i', 'supabase_db_sabara.org', 'psql', '-X', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], sql)
assert.ok(output.includes('GAP:[2, 0, 2, 1]'), 'reproduction changed; reassess the gap')
console.log('BLOCKER CONFIRMED locally: admin direct writes bypass starter/accepted/complete-drawn invariants. All fixtures rolled back; schema unchanged.')
