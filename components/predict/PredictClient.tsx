'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useLockStatus } from '@/hooks/useLockStatus'

interface Team { id: string; name: string; abbr: string; seed: number; conference: string; color: string }
interface Series { id: string; round: number; conference: string; label: string; homeTeam: Team; awayTeam: Team }
interface SnackQuestion { id: number; order: number; question: string }
interface GeneralQuestion { key: string; label: string; type: string }
interface SeasonData { series: Series[]; snackQuestions: SnackQuestion[]; generalConfig: { questions: GeneralQuestion[] } }

const PLAYOFF_PLAYERS: Record<string, string[]> = {
  CLE: ['Donovan Mitchell','Darius Garland','Evan Mobley','Jarrett Allen','Max Strus','Caris LeVert','Isaac Okoro','Sam Merrill','Georges Niang','Dean Wade','Ty Jerome','Craig Porter Jr.','Tristan Thompson'],
  BOS: ['Jayson Tatum','Jaylen Brown','Derrick White','Jrue Holiday','Kristaps Porzingis','Payton Pritchard','Al Horford','Sam Hauser','Luke Kornet','Neemias Queta','Xavier Tillman','Oshae Brissett'],
  NYK: ['Jalen Brunson','Karl-Anthony Towns','Mikal Bridges','OG Anunoby','Josh Hart','Miles McBride','Mitchell Robinson','Precious Achiuwa','Cameron Payne','Donte DiVincenzo','Jericho Sims'],
  IND: ['Tyrese Haliburton','Pascal Siakam','Myles Turner','Andrew Nembhard','Bennedict Mathurin','Aaron Nesmith','T.J. McConnell','Obi Toppin','Isaiah Jackson','Jarace Walker','Ben Sheppard'],
  ORL: ['Paolo Banchero','Franz Wagner','Jalen Suggs','Wendell Carter Jr.','Jonathan Isaac','Kentavious Caldwell-Pope','Cole Anthony','Goga Bitadze','Moritz Wagner','Anthony Black','Jett Howard','Gary Harris'],
  MIL: ['Giannis Antetokounmpo','Damian Lillard','Khris Middleton','Brook Lopez','Bobby Portis','Pat Connaughton','AJ Green','Andre Jackson Jr.','Gary Trent Jr.','Taurean Prince','MarJon Beauchamp'],
  DET: ['Cade Cunningham','Jaden Ivey','Ausar Thompson','Jalen Duren','Malik Beasley','Tim Hardaway Jr.','Tobias Harris','Isaiah Stewart','Simone Fontecchio','Marcus Sasser','Ron Holland'],
  ATL: ['Trae Young','Jalen Johnson','De\'Andre Hunter','Clint Capela','Dyson Daniels','Bogdan Bogdanovic','Zaccharie Risacher','Larry Nance Jr.','Garrison Mathews','Kobe Bufkin','Onyeka Okongwu'],
  MIA: ['Jimmy Butler','Bam Adebayo','Tyler Herro','Terry Rozier','Jaime Jaquez Jr.','Duncan Robinson','Nikola Jovic','Kevin Love','Haywood Highsmith','Josh Richardson','Thomas Bryant'],
  CHI: ['Zach LaVine','Coby White','Nikola Vucevic','Patrick Williams','Ayo Dosunmu','Josh Giddey','Andre Drummond','Torrey Craig','Jevon Carter','Julian Phillips'],
  OKC: ['Shai Gilgeous-Alexander','Jalen Williams','Chet Holmgren','Lu Dort','Isaiah Hartenstein','Alex Caruso','Aaron Wiggins','Kenrich Williams','Isaiah Joe','Ousmane Dieng','Cason Wallace','Jaylin Williams'],
  HOU: ['Jalen Green','Alperen Sengun','Fred VanVleet','Jabari Smith Jr.','Dillon Brooks','Amen Thompson','Tari Eason','Steven Adams','Cam Whitmore','Jeff Green','Reed Sheppard'],
  GSW: ['Stephen Curry','Andrew Wiggins','Draymond Green','Jonathan Kuminga','Kevon Looney','Buddy Hield','Gary Payton II','Brandin Podziemski','Trayce Jackson-Davis','Moses Moody','Jimmy Butler'],
  MEM: ['Ja Morant','Desmond Bane','Jaren Jackson Jr.','Marcus Smart','Zach Edey','Luke Kennard','GG Jackson','Santi Aldama','John Konchar','Brandon Clarke','Scotty Pippen Jr.','Jake LaRavia'],
  DEN: ['Nikola Jokic','Jamal Murray','Michael Porter Jr.','Aaron Gordon','Christian Braun','Russell Westbrook','Peyton Watson','Julian Strawther','Dario Saric','Zeke Nnaji','DeAndre Jordan'],
  LAC: ['James Harden','Kawhi Leonard','Ivica Zubac','Norman Powell','Terance Mann','Derrick Jones Jr.','Amir Coffey','Bones Hyland','P.J. Tucker','Kris Dunn','Brandon Boston Jr.'],
  MIN: ['Anthony Edwards','Julius Randle','Rudy Gobert','Jaden McDaniels','Mike Conley','Naz Reid','Nickeil Alexander-Walker','Joe Ingles','Josh Minott','Rob Dillingham','Leonard Miller'],
  DAL: ['Luka Doncic','Kyrie Irving','P.J. Washington','Daniel Gafford','Dereck Lively II','Klay Thompson','Naji Marshall','Quentin Grimes','Dante Exum','Jaden Hardy','Dwight Powell'],
  PHX: ['Kevin Durant','Devin Booker','Bradley Beal','Jusuf Nurkic','Grayson Allen','Royce O\'Neale','Eric Gordon','Josh Okogie','Drew Eubanks','Bol Bol','Nassir Little'],
  SAC: ['De\'Aaron Fox','Domantas Sabonis','Keegan Murray','DeMar DeRozan','Malik Monk','Kevin Huerter','Trey Lyles','Keon Ellis','Alex Len','Colby Jones','Davion Mitchell'],
  NOP: ['Zion Williamson','Brandon Ingram','CJ McCollum','Trey Murphy III','Herb Jones','Jonas Valanciunas','Jose Alvarado','Dejounte Murray','Naji Marshall','Jordan Hawkins','Dyson Daniels'],
  LAL: ['LeBron James','Anthony Davis','Austin Reaves','D\'Angelo Russell','Rui Hachimura','Jarred Vanderbilt','Gabe Vincent','Christian Wood','Cam Reddish','Max Christie','Jalen Hood-Schifino'],
  POR: ['Deni Avdija','Anfernee Simons','Jerami Grant','Deandre Ayton','Shaedon Sharpe','Toumani Camara','Donovan Clingan','Robert Williams III','Scoot Henderson','Kris Murray','Dalano Banton','Matisse Thybulle'],
}

const LEADER_CATEGORIES = ['Points','Assists','Rebounds','Blocks','Steals'] as const
const ROUND_POINTS = [1, 2, 4, 8]
const TABS = ['Bracket','Leaders','General','Snacks'] as const
type Tab = typeof TABS[number]

interface BracketSeries { id: string; round: number; conference: string; label: string; homeTeam: Team | null; awayTeam: Team | null }

function buildFullBracket(r1Series: Series[], preds: Record<string, { winnerId: string; gameCount: number; leadingScorer: string }>) {
  const east = r1Series.filter(s => s.conference === 'E').sort((a, b) => a.label.localeCompare(b.label))
  const west = r1Series.filter(s => s.conference === 'W').sort((a, b) => a.label.localeCompare(b.label))
  const teamMap: Record<string, Team> = {}
  for (const s of r1Series) { teamMap[s.homeTeam.id] = s.homeTeam; teamMap[s.awayTeam.id] = s.awayTeam }
  const getWinner = (sid: string): Team | null => { const p = preds[sid]; return p?.winnerId ? (teamMap[p.winnerId] ?? null) : null }
  const yr = east[0]?.id?.split('-')[0] ?? '2025'
  const buildR2 = (conf: string, r1: BracketSeries[]): BracketSeries[] => [
    { id: `${yr}-${conf}_R2A`, round: 2, conference: conf, label: `${conf} Semi A`, homeTeam: getWinner(r1[0]?.id), awayTeam: getWinner(r1[3]?.id) },
    { id: `${yr}-${conf}_R2B`, round: 2, conference: conf, label: `${conf} Semi B`, homeTeam: getWinner(r1[1]?.id), awayTeam: getWinner(r1[2]?.id) },
  ]
  const eastR2 = buildR2('E', east as BracketSeries[])
  const westR2 = buildR2('W', west as BracketSeries[])
  const ecf: BracketSeries = { id: `${yr}-ECF`, round: 3, conference: 'E', label: 'East Finals', homeTeam: getWinner(eastR2[0].id), awayTeam: getWinner(eastR2[1].id) }
  const wcf: BracketSeries = { id: `${yr}-WCF`, round: 3, conference: 'W', label: 'West Finals', homeTeam: getWinner(westR2[0].id), awayTeam: getWinner(westR2[1].id) }
  const finals: BracketSeries = { id: `${yr}-Finals`, round: 4, conference: 'Finals', label: 'NBA Finals', homeTeam: getWinner(ecf.id), awayTeam: getWinner(wcf.id) }
  return {
    east: [...east.map(s => ({ ...s } as BracketSeries)), ...eastR2, ecf],
    west: [...west.map(s => ({ ...s } as BracketSeries)), ...westR2, wcf],
    finals: [finals],
  }
}

export default function PredictClient({ year }: { year: number }) {
  const [activeTab, setActiveTab] = useState<Tab>('Bracket')
  const [seasonData, setSeasonData] = useState<SeasonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bracketPreds, setBracketPreds] = useState<Record<string, { winnerId: string; gameCount: number; leadingScorer: string }>>({})
  const [leaderPreds, setLeaderPreds] = useState<Record<string, string>>({})
  const [generalAnswers, setGeneralAnswers] = useState<Record<string, number>>({})
  const [snackAnswers, setSnackAnswers] = useState<Record<number, boolean>>({})
  const [mvpPreds, setMvpPreds] = useState<Record<string, string>>({ eastMvp: '', westMvp: '', finalsMvp: '' })
  const [submitStatus, setSubmitStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle')
  const lockStatus = useLockStatus(year)

  const fullBracket = useMemo(() => {
    if (!seasonData) return { east: [], west: [], finals: [] }
    return buildFullBracket(seasonData.series, bracketPreds)
  }, [seasonData, bracketPreds])

  const allPlayers = useMemo(() => {
    const players: string[] = []; const seen = new Set<string>()
    if (!seasonData) return players
    for (const s of seasonData.series) {
      for (const team of [s.homeTeam, s.awayTeam]) {
        if (!seen.has(team.abbr)) { seen.add(team.abbr); players.push(...(PLAYOFF_PLAYERS[team.abbr] ?? [])) }
      }
    }
    return players.sort()
  }, [seasonData])

  // Players from East/West teams for MVP dropdowns
  const eastPlayers = useMemo(() => {
    if (!seasonData) return []
    const p: string[] = []; const seen = new Set<string>()
    for (const s of seasonData.series.filter(s => s.conference === 'E')) {
      for (const t of [s.homeTeam, s.awayTeam]) { if (!seen.has(t.abbr)) { seen.add(t.abbr); p.push(...(PLAYOFF_PLAYERS[t.abbr] ?? [])) } }
    }
    return p.sort()
  }, [seasonData])

  const westPlayers = useMemo(() => {
    if (!seasonData) return []
    const p: string[] = []; const seen = new Set<string>()
    for (const s of seasonData.series.filter(s => s.conference === 'W')) {
      for (const t of [s.homeTeam, s.awayTeam]) { if (!seen.has(t.abbr)) { seen.add(t.abbr); p.push(...(PLAYOFF_PLAYERS[t.abbr] ?? [])) } }
    }
    return p.sort()
  }, [seasonData])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/seasons/${year}`)
        if (!res.ok) throw new Error('Failed to load season')
        setSeasonData(await res.json())
        const predRes = await fetch(`/api/seasons/${year}/predictions`)
        if (predRes.ok) {
          const predData = await predRes.json()
          if (predData.prediction) {
            const p = predData.prediction
            const sp: Record<string, any> = {}
            for (const s of p.seriesPredictions ?? []) sp[s.seriesId] = { winnerId: s.winnerId, gameCount: s.gameCount, leadingScorer: s.leadingScorer }
            setBracketPreds(sp)
            const lp: Record<string, string> = {}
            for (const l of p.leaderPredictions ?? []) lp[l.category] = l.playerName
            setLeaderPreds(lp)
            if (p.generalPrediction?.answers) setGeneralAnswers(p.generalPrediction.answers)
            const sa: Record<number, boolean> = {}
            for (const a of p.snackAnswers ?? []) sa[a.questionId] = a.answer
            setSnackAnswers(sa)
          }
        }
      } catch (e: any) { setError(e.message) } finally { setLoading(false) }
    }
    load()
  }, [year])

  async function handleSubmit() {
    if (!seasonData) return
    setSubmitStatus('saving')
    try {
      const res = await fetch(`/api/seasons/${year}/predictions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesPredictions: Object.entries(bracketPreds).map(([seriesId, pred]) => ({ seriesId, ...pred })),
          leaderPredictions: { ...leaderPreds, ...mvpPreds }, generalAnswers,
          snackAnswers: Object.entries(snackAnswers).map(([qId, answer]) => ({ questionId: +qId, answer })),
        }),
      })
      if (res.status === 423) { setSubmitStatus('error'); setError('Predictions are locked!'); return }
      if (!res.ok) throw new Error('Submit failed')
      setSubmitStatus('saved'); setTimeout(() => setSubmitStatus('idle'), 2500)
    } catch { setSubmitStatus('error'); setTimeout(() => setSubmitStatus('idle'), 3000) }
  }

  const allBracketSeries = [...fullBracket.east, ...fullBracket.west, ...fullBracket.finals]
  const bracketComplete = allBracketSeries.length > 0 && allBracketSeries.every(s => {
    if (!s.homeTeam || !s.awayTeam) return false
    const p = bracketPreds[s.id]; return p?.winnerId && p?.gameCount && p?.leadingScorer?.trim()
  }) && mvpPreds.eastMvp?.trim() && mvpPreds.westMvp?.trim() && mvpPreds.finalsMvp?.trim()
  const leadersComplete = LEADER_CATEGORIES.every(c => leaderPreds[c]?.trim())
  const generalComplete = seasonData?.generalConfig?.questions ? seasonData.generalConfig.questions.every(q => generalAnswers[q.key] !== undefined) : false
  const snacksComplete = seasonData?.snackQuestions ? seasonData.snackQuestions.every(q => snackAnswers[q.id] !== undefined) : false
  const allComplete = bracketComplete && leadersComplete && generalComplete && snacksComplete
  const isLocked = lockStatus?.locked ?? false

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-sm text-gray-400 animate-pulse">Loading predictions...</div></div>
  if (error && !seasonData) return <div className="flex items-center justify-center py-20"><div className="text-sm text-red-500">{error}</div></div>
  if (!seasonData) return null

  return (
    <div className="max-w-3xl mx-auto pb-32">
      {/* Deni Header */}
      <div className="mb-6 rounded-2xl overflow-hidden bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">8</div>
          <div>
            <h1 className="text-white text-lg font-bold tracking-tight">NBA Playoff Predictions {year}</h1>
            <p className="text-blue-300 text-xs mt-0.5">Deni Avdija Edition 🇮🇱 · Portland Trail Blazers</p>
          </div>
        </div>
      </div>

      {lockStatus && !isLocked && (
        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-amber-700">Predictions lock at 10:00 PM</span>
          <span className="text-sm font-mono font-semibold text-amber-800">{formatCountdown(lockStatus.secondsUntilLock)}</span>
        </div>
      )}
      {isLocked && (
        <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <span className="text-sm font-medium text-red-700">Predictions are locked. View the dashboard to track scores.</span>
        </div>
      )}

      <div className="mb-5 flex justify-end">
        <a href={`/admin/${year}`} className="text-[11px] text-gray-400 hover:text-gray-600 underline">Admin panel →</a>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {TABS.map(tab => {
          const complete = tab === 'Bracket' ? bracketComplete : tab === 'Leaders' ? leadersComplete : tab === 'General' ? generalComplete : snacksComplete
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all relative ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab}{complete && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />}
            </button>
          )
        })}
      </div>

      {activeTab === 'Bracket' && <BracketTab bracket={fullBracket} predictions={bracketPreds} onChange={setBracketPreds} locked={isLocked} mvpPreds={mvpPreds} onMvpChange={setMvpPreds} eastPlayers={eastPlayers} westPlayers={westPlayers} allPlayers={allPlayers} />}
      {activeTab === 'Leaders' && <LeadersTab predictions={leaderPreds} onChange={setLeaderPreds} locked={isLocked} allPlayers={allPlayers} />}
      {activeTab === 'General' && <GeneralTab questions={seasonData.generalConfig?.questions ?? []} answers={generalAnswers} onChange={setGeneralAnswers} locked={isLocked} />}
      {activeTab === 'Snacks' && <SnacksTab questions={seasonData.snackQuestions} answers={snackAnswers} onChange={setSnackAnswers} locked={isLocked} />}

      {!isLocked && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 z-50">
          <div className="max-w-3xl mx-auto">
            <button onClick={handleSubmit} disabled={!allComplete || submitStatus === 'saving'}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${allComplete ? (submitStatus === 'saved' ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]') : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              {submitStatus === 'saving' ? 'Saving...' : submitStatus === 'saved' ? '✓ Saved!' : submitStatus === 'error' ? 'Error — try again' : !allComplete ? 'Complete all tabs to submit' : 'Submit predictions'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BracketTab({ bracket, predictions, onChange, locked, mvpPreds, onMvpChange, eastPlayers, westPlayers, allPlayers }: {
  bracket: { east: BracketSeries[]; west: BracketSeries[]; finals: BracketSeries[] }
  predictions: Record<string, { winnerId: string; gameCount: number; leadingScorer: string }>
  onChange: (p: Record<string, any>) => void; locked: boolean
  mvpPreds: Record<string, string>; onMvpChange: (p: Record<string, string>) => void
  eastPlayers: string[]; westPlayers: string[]; allPlayers: string[]
}) {
  const roundNames: Record<number, string> = { 1: 'Round 1', 2: 'Conf. semis', 3: 'Conf. finals', 4: 'NBA Finals' }

  function updateSeries(seriesId: string, field: string, value: any) {
    if (locked) return
    const current = predictions[seriesId] ?? { winnerId: '', gameCount: 0, leadingScorer: '' }
    onChange({ ...predictions, [seriesId]: { ...current, [field]: value } })
  }

  const renderConference = (label: string, series: BracketSeries[], mvpKey: string, mvpPlayers: string[]) => (
    <div className="mb-8">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-4">{label}</div>
      {[1, 2, 3].map(round => {
        const rs = series.filter(s => s.round === round)
        if (!rs.length) return null
        return (
          <div key={round} className="mb-6">
            <div className="text-[11px] font-semibold text-gray-500 mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-200" />{roundNames[round]}<div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="space-y-3">
              {rs.map(s => <SeriesCard key={s.id} series={s} prediction={predictions[s.id]} onUpdate={(f, v) => updateSeries(s.id, f, v)} locked={locked} />)}
            </div>
          </div>
        )
      })}
      {/* Conference MVP */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-amber-800">🏆 {label.replace(' Conference', '')} conference MVP</div>
          <span className="text-[10px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">10 pts</span>
        </div>
        <PlayerDropdown players={mvpPlayers} value={mvpPreds[mvpKey] ?? ''} onChange={val => !locked && onMvpChange({ ...mvpPreds, [mvpKey]: val })} disabled={locked} placeholder="Select MVP..." />
      </div>
    </div>
  )

  return (
    <div>
      {renderConference('Eastern Conference', bracket.east, 'eastMvp', eastPlayers)}
      {renderConference('Western Conference', bracket.west, 'westMvp', westPlayers)}
      {bracket.finals.length > 0 && (
        <div className="mb-8">
          <div className="text-[11px] font-semibold text-gray-500 mb-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-yellow-300" /><span className="text-yellow-600">🏆 NBA Finals</span><div className="h-px flex-1 bg-yellow-300" />
          </div>
          {bracket.finals.map(s => <SeriesCard key={s.id} series={s} prediction={predictions[s.id]} onUpdate={(f, v) => updateSeries(s.id, f, v)} locked={locked} />)}
          {/* Finals MVP */}
          <div className="bg-yellow-50 rounded-xl border border-yellow-300 p-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-yellow-800">🏆 Finals MVP</div>
              <span className="text-[10px] text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">15 pts</span>
            </div>
            <PlayerDropdown players={allPlayers} value={mvpPreds.finalsMvp ?? ''} onChange={val => !locked && onMvpChange({ ...mvpPreds, finalsMvp: val })} disabled={locked} placeholder="Select Finals MVP..." />
          </div>
        </div>
      )}
    </div>
  )
}

function SeriesCard({ series, prediction, onUpdate, locked }: {
  series: BracketSeries; prediction?: { winnerId: string; gameCount: number; leadingScorer: string }
  onUpdate: (field: string, val: any) => void; locked: boolean
}) {
  const { homeTeam, awayTeam } = series
  if (!homeTeam || !awayTeam) {
    return (
      <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4 text-center">
        <div className="text-xs text-gray-400">{series.label}</div>
        <div className="text-sm text-gray-500 mt-1">Pick winners above to unlock this matchup</div>
      </div>
    )
  }
  const winnerId = prediction?.winnerId ?? ''
  const m = ROUND_POINTS[(series.round - 1)] ?? 1
  const seriesPlayers = [...(PLAYOFF_PLAYERS[homeTeam.abbr] ?? []), ...(PLAYOFF_PLAYERS[awayTeam.abbr] ?? [])].sort()

  return (
    <div className={`bg-white rounded-xl border p-4 space-y-3 transition-all ${winnerId ? 'border-gray-200' : 'border-gray-200 border-dashed'}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium text-gray-400 tracking-wide">{series.label}</div>
        <div className="text-[10px] text-gray-400">Round {series.round} · {m}x multiplier</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[homeTeam, awayTeam].map(team => {
          const selected = winnerId === team.id
          return (
            <button key={team.id} onClick={() => !locked && onUpdate('winnerId', team.id)} disabled={locked}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${selected ? 'border-gray-900 bg-gray-900 text-white shadow-md' : 'border-gray-200 hover:border-gray-300 text-gray-700'} ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
              <div className="text-left">
                <div className="text-sm font-medium">{team.abbr}</div>
                <div className={`text-[11px] ${selected ? 'text-gray-300' : 'text-gray-400'}`}>#{team.seed}</div>
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">Winner</div>
        <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{3 * m} pts</span>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs text-gray-500">Games</div>
          <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{2 * m} pts</span>
        </div>
        <div className="flex gap-1.5">
          {[4,5,6,7].map(g => (
            <button key={g} onClick={() => !locked && onUpdate('gameCount', g)} disabled={locked}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${prediction?.gameCount === g ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'} ${locked ? 'cursor-default' : 'cursor-pointer'}`}>{g}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs text-gray-500">Series leading scorer</div>
          <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{1 * m} pts</span>
        </div>
        <PlayerDropdown players={seriesPlayers} value={prediction?.leadingScorer ?? ''} onChange={val => !locked && onUpdate('leadingScorer', val)} disabled={locked} placeholder="Select player..." />
      </div>
      <div className="text-[10px] text-center text-gray-400 pt-1 border-t border-gray-100">
        All 3 correct = 1.5x bonus → {Math.floor((3 + 2 + 1) * m * 1.5)} pts max
      </div>
    </div>
  )
}

function PlayerDropdown({ players, value, onChange, disabled, placeholder }: {
  players: string[]; value: string; onChange: (val: string) => void; disabled: boolean; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const filtered = search ? players.filter(p => p.toLowerCase().includes(search.toLowerCase())) : players
  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick); return () => document.removeEventListener('mousedown', onClick)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => !disabled && setOpen(!open)} disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg border text-left text-sm transition-all ${value ? 'border-gray-300 bg-white text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-400'} ${disabled ? 'cursor-default' : 'cursor-pointer hover:border-gray-300'}`}>
        {value || placeholder || 'Select...'}<span className="float-right text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input type="text" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} autoFocus className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">No players found</div>}
            {filtered.map(p => (
              <button key={p} onClick={() => { onChange(p); setOpen(false); setSearch('') }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${value === p ? 'bg-gray-100 font-medium' : ''}`}>{p}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LeadersTab({ predictions, onChange, locked, allPlayers }: {
  predictions: Record<string, string>; onChange: (p: Record<string, string>) => void; locked: boolean; allPlayers: string[]
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">Playoff statistical leaders</div>
      <p className="text-xs text-gray-500 mb-4">Predict who will lead the entire playoffs in each category (min 8 games).</p>
      {LEADER_CATEGORIES.map(cat => (
        <div key={cat} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-gray-400">{cat} leader</div>
            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">12 pts</span>
          </div>
          <PlayerDropdown players={allPlayers} value={predictions[cat] ?? ''} onChange={val => !locked && onChange({ ...predictions, [cat]: val })} disabled={locked} placeholder={`Select ${cat.toLowerCase()} leader...`} />
        </div>
      ))}
    </div>
  )
}

function GeneralTab({ questions, answers, onChange, locked }: {
  questions: GeneralQuestion[]; answers: Record<string, number>; onChange: (a: Record<string, number>) => void; locked: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">General predictions</div>
      <p className="text-xs text-gray-500 mb-4">Predict the exact number. Exact match required.</p>
      {questions.map(q => (
        <div key={q.key} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-700">{q.label}</div>
            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">6 pts</span>
          </div>
          <input type="number" min={0} max={999} placeholder="0" value={answers[q.key] ?? ''}
            onChange={e => !locked && onChange({ ...answers, [q.key]: +e.target.value })} readOnly={locked}
            className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-lg font-semibold text-center bg-gray-50 focus:outline-none focus:border-gray-400" />
        </div>
      ))}
    </div>
  )
}

function SnacksTab({ questions, answers, onChange, locked }: {
  questions: SnackQuestion[]; answers: Record<number, boolean>; onChange: (a: Record<number, boolean>) => void; locked: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">Yes / No predictions</div>
      <p className="text-xs text-gray-500 mb-4">Quick-fire predictions.</p>
      {questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-700"><span className="text-xs text-gray-400 mr-1.5">{i + 1}.</span>{q.question}</div>
            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">2 pts</span>
          </div>
          <div className="flex gap-2">
            {[true, false].map(val => (
              <button key={String(val)} onClick={() => !locked && onChange({ ...answers, [q.id]: val })} disabled={locked}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${answers[q.id] === val ? (val ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 text-gray-500 hover:bg-gray-200'} ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
                {val ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0:00'
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}