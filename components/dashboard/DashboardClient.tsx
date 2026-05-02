'use client'

import { useState, useEffect } from 'react'
import { useDashboard } from '@/hooks/useDashboard'

interface Team { id: string; name: string; abbr: string; seed: number; color: string }
interface Series { id: string; round: number; conference: string; label: string; homeTeam: Team; awayTeam: Team; winnerId: string | null; gameCount: number | null; leadingScorer: string | null; isComplete: boolean }
interface Prediction { userId: string; userName: string; totalScore: number; seriesPredictions: { seriesId: string; winnerId: string; gameCount: number; leadingScorer: string; winnerScore: number; gamesScore: number; scorerScore: number; bonusApplied: boolean; totalScore: number }[]; leaderPredictions: { category: string; playerName: string; score: number }[]; generalPrediction: { answers: Record<string, number>; score: number } | null; snackAnswers: { questionId: number; answer: boolean; score: number }[] }
interface SeriesStat { seriesId: string; homeTeam: string; awayTeam: string; homeTeamColor: string; awayTeamColor: string; winPercentage: number; correctPredictions: number; totalPredictions: number; homePickCount: number; awayPickCount: number; majorityTeamAbbr: string; majorityPickPercentage: number; statusText: string; homeWins: number; awayWins: number; leadingScorer: string | null; currentTopScorer: string | null; currentTopScorerAvgPts: number | null }
interface SnackStat { questionId: number; question: string; result: boolean | null; accuracy: number | null; correctCount: number; totalCount: number; yesCount: number; noCount: number; missingCount: number; totalParticipants: number }
interface GeneralStat { key: string; label: string; result: number | null; accuracy: number | null; correctCount: number; totalCount: number; distribution: { value: number; count: number }[]; missingCount: number; totalParticipants: number }
interface MvpStat { role: string; label: string; leader: string | null; accuracy: number | null; correctCount: number; totalCount: number; totalParticipants: number; missingCount: number; distribution: { playerName: string; count: number }[] }
interface DashboardData { locked?: boolean; season?: { year: number; lockedAt: string }; series?: Series[]; playoffLeaders?: { category: string; playerName: string }[]; generalConfig?: { questions: { key: string; label: string }[]; results: Record<string, number> | null }; snackQuestions?: { id: number; question: string; result: boolean | null; order: number }[]; snackQuestionLookup?: Record<string, string>; predictions?: Prediction[]; seriesStats?: SeriesStat[]; snackStats?: SnackStat[]; generalStats?: GeneralStat[]; mvpStats?: MvpStat[] }

const MVP_CATEGORY_LABELS: Record<string, string> = {
  __mvp_east: 'East MVP',
  __mvp_west: 'West MVP',
  __mvp_finals: 'Finals MVP',
}

function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase()
}

function scorerAvatarUrl(name: string): string {
  const encoded = encodeURIComponent(name)
  return `https://ui-avatars.com/api/?name=${encoded}&background=0f172a&color=ffffff&size=64&bold=true`
}

const TEAM_LOGOS: Record<string, string> = {
  ATL: 'https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg',
  BOS: 'https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg',
  BKN: 'https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg',
  CHA: 'https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg',
  CHI: 'https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg',
  CLE: 'https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg',
  DAL: 'https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg',
  DEN: 'https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg',
  DET: 'https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg',
  GSW: 'https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg',
  HOU: 'https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg',
  IND: 'https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg',
  LAC: 'https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg',
  LAL: 'https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg',
  MEM: 'https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg',
  MIA: 'https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg',
  MIL: 'https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg',
  MIN: 'https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg',
  NOP: 'https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg',
  NYK: 'https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg',
  OKC: 'https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg',
  ORL: 'https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg',
  PHI: 'https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg',
  PHX: 'https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg',
  POR: 'https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg',
  SAC: 'https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg',
  SAS: 'https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg',
  TOR: 'https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg',
  UTA: 'https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg',
  WAS: 'https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg',
}

function teamLogoUrl(abbr: string): string {
  return TEAM_LOGOS[abbr] ?? 'https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg'
}

function isTBDTeam(homeTeamId: string, awayTeamId: string): boolean {
  return homeTeamId === awayTeamId
}

function getTBDLogoUrl(): string {
  return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2260%22 font-size=%2232%22 font-weight=%22bold%22 fill=%22%237c8591%22 text-anchor=%22middle%22%3ETBD%3C/text%3E%3C/svg%3E'
}

const TABS = ['Rankings', 'Statistics', 'Bracket', 'My picks', 'Deni tracker'] as const
type Tab = typeof TABS[number]

export default function DashboardClient({ year }: { year: string }) {
  const { data, isLoading } = useDashboard(+year)
  const [activeTab, setActiveTab] = useState<Tab>('Rankings')
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null)

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="text-sm text-gray-400">Loading dashboard...</div></div>
  if (!data || data.locked === false) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">Dashboard opens after lock</h2>
        <p className="text-sm text-gray-500">The dashboard opens once predictions are locked and the playoffs begin.</p>
      </div>
    )
  }
  const d = data as DashboardData

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{year} playoff dashboard</h1>
        <p className="text-xs text-gray-500 mt-1">{d.predictions?.length ?? 0} participants · {d.series?.filter(s => s.isComplete).length ?? 0}/{d.series?.length ?? 0} series complete</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'Rankings' && <RankingsView year={year} predictions={d.predictions ?? []} playoffLeaders={d.playoffLeaders ?? []} onSelectPrediction={setSelectedPrediction} />}
      {activeTab === 'Statistics' && <StatisticsView snackStats={d.snackStats ?? []} generalStats={d.generalStats ?? []} mvpStats={d.mvpStats ?? []} />}
      {activeTab === 'Bracket' && <BracketView series={d.series ?? []} seriesStats={d.seriesStats ?? []} />}
      {activeTab === 'My picks' && <MyPicksView predictions={d.predictions ?? []} series={d.series ?? []} playoffLeaders={d.playoffLeaders ?? []} generalConfig={d.generalConfig} snackQuestions={d.snackQuestions ?? []} />}
      {activeTab === 'Deni tracker' && <DeniTracker />}

      {selectedPrediction && (
        <PredictionDetailModal
          prediction={selectedPrediction}
          series={d.series ?? []}
          snackQuestions={d.snackQuestions ?? []}
          snackQuestionLookup={d.snackQuestionLookup ?? {}}
          generalConfig={d.generalConfig}
          onClose={() => setSelectedPrediction(null)}
        />
      )}
    </div>
  )
}

function RankingsView({ year, predictions, playoffLeaders, onSelectPrediction }: { year: string; predictions: Prediction[]; playoffLeaders: { category: string; playerName: string }[]; onSelectPrediction: (prediction: Prediction) => void }) {
  const sorted = [...predictions].sort((a, b) => b.totalScore - a.totalScore)
  const [isCapturing, setIsCapturing] = useState(false)

  async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    if (typeof canvas.toBlob === 'function') {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (blob) return blob
    }

    const dataUrl = canvas.toDataURL('image/png')
    const res = await fetch(dataUrl)
    return await res.blob()
  }

  function renderRankingsCanvas(rows: Prediction[]): HTMLCanvasElement {
    const width = 1080
    const rowHeight = 72
    const headerHeight = 110
    const footerHeight = 44
    const bodyHeight = Math.max(rows.length, 1) * rowHeight
    const height = headerHeight + bodyHeight + footerHeight

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context unavailable')

    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = '#0f172a'
    ctx.font = '700 42px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
    ctx.fillText(`NBA Playoffs ${year} Rankings`, 48, 62)

    ctx.fillStyle = '#64748b'
    ctx.font = '500 24px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
    ctx.fillText(`Updated from dashboard`, 48, 95)

    const medals = ['🥇', '🥈', '🥉']
    rows.forEach((p, i) => {
      const yTop = headerHeight + i * rowHeight
      const yMid = yTop + 45
      const isTop = i < 3

      ctx.fillStyle = isTop ? '#ffffff' : '#f1f5f9'
      roundRect(ctx, 24, yTop + 8, width - 48, rowHeight - 12, 14)
      ctx.fill()

      const rankLabel = medals[i] ?? String(i + 1)
      ctx.fillStyle = '#0f172a'
      ctx.font = '700 28px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      ctx.fillText(rankLabel, 52, yMid)

      ctx.fillStyle = '#1d4ed8'
      ctx.font = '700 26px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      ctx.fillText(p.userName.slice(0, 28), 120, yMid)

      const bracketPts = p.seriesPredictions.reduce((sum, sp) => sum + sp.totalScore, 0)
      const leaderPts = p.leaderPredictions.reduce((sum, lp) => sum + lp.score, 0)
      const genPts = p.generalPrediction?.score ?? 0
      const snackPts = p.snackAnswers.reduce((sum, sa) => sum + sa.score, 0)

      ctx.fillStyle = '#64748b'
      ctx.font = '500 18px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      ctx.fillText(`B:${bracketPts}  L:${leaderPts}  G:${genPts}  S:${snackPts}`, 120, yMid + 22)

      ctx.fillStyle = '#0f172a'
      ctx.font = '800 32px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      const scoreText = String(p.totalScore)
      const scoreWidth = ctx.measureText(scoreText).width
      ctx.fillText(scoreText, width - 60 - scoreWidth, yMid + 6)
    })

    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 18px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
    ctx.fillText('Shared from NBA predictions dashboard', 48, height - 16)

    return canvas
  }

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    const r = Math.min(radius, width / 2, height / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + width, y, x + width, y + height, r)
    ctx.arcTo(x + width, y + height, x, y + height, r)
    ctx.arcTo(x, y + height, x, y, r)
    ctx.arcTo(x, y, x + width, y, r)
    ctx.closePath()
  }

  async function handleShareRankings() {
    if (!sorted.length) return

    setIsCapturing(true)
    try {
      const canvas = renderRankingsCanvas(sorted)

      const blob = await canvasToBlob(canvas)
      if (!blob || blob.size === 0) throw new Error('Could not generate image')

      const file = new File([blob], `nba-rankings-${year}.png`, { type: 'image/png' })
      const shareTitle = `NBA Playoffs ${year} Rankings`
      const shareText = `Current rankings from the NBA predictions dashboard.`

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file],
        })
        return
      }

      const imageUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `nba-rankings-${year}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(imageUrl)

      const whatsappText = encodeURIComponent(`${shareTitle} - image downloaded, attach it in WhatsApp.`)
      window.open(`https://wa.me/?text=${whatsappText}`, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error('Failed to capture rankings:', error)
      window.alert('Could not generate rankings image. Please try again.')
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleShareRankings}
          disabled={isCapturing || sorted.length === 0}
          className="px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 disabled:opacity-50"
        >
          {isCapturing ? 'Preparing image...' : 'Share rankings'}
        </button>
      </div>

      {/* Rankings */}
      <div className="space-y-2 bg-white rounded-xl p-3 border border-gray-100">
        {sorted.map((p, i) => {
          const rank = i + 1
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
          const bracketPts = p.seriesPredictions.reduce((sum, sp) => sum + sp.totalScore, 0)
          const leaderPts = p.leaderPredictions.reduce((sum, lp) => sum + lp.score, 0)
          const genPts = p.generalPrediction?.score ?? 0
          const snackPts = p.snackAnswers.reduce((sum, sa) => sum + sa.score, 0)
          return (
            <button
              key={p.userId}
              type="button"
              onClick={() => onSelectPrediction(p)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all hover:border-blue-200 hover:bg-blue-50/40 ${rank <= 3 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg w-8 text-center">{medal ?? <span className="text-sm text-gray-400">{rank}</span>}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-700 truncate">{p.userName}</p>
                  <p className="text-[11px] text-gray-400">B:{bracketPts} · L:{leaderPts} · G:{genPts} · S:{snackPts}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 hidden sm:inline">View picks</span>
                <span className="text-lg font-bold text-gray-900">{p.totalScore}</span>
              </div>
            </button>
          )
        })}
        {sorted.length === 0 && <div className="text-center py-8 text-sm text-gray-400">No predictions yet.</div>}
      </div>

      {/* Stat Leaders Top 3 */}
      {playoffLeaders.length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Playoff stat leaders</div>
          <div className="space-y-3">
            {playoffLeaders.map(leader => (
              <div key={leader.category} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs font-medium text-gray-400 mb-2">{leader.category}</div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-yellow-500">🥇</span>
                  <span className="text-sm font-medium text-gray-800">{leader.playerName}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Top 3 updates as playoffs progress</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatisticsView({ snackStats, generalStats, mvpStats }: { snackStats: SnackStat[]; generalStats: GeneralStat[]; mvpStats: MvpStat[] }) {
  return (
    <div className="space-y-6">
      {/* Yes/No Questions Accuracy */}
      {snackStats.length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Yes/No Predictions</div>
          <div className="space-y-2">
            {snackStats.map(stat => (
              <div key={stat.questionId} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{stat.question}</span>
                  <span className="text-sm font-bold text-blue-600">{stat.accuracy !== null ? `${stat.accuracy}%` : 'Pending'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${stat.result === null ? 'bg-gray-100 text-gray-600' : stat.result ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {stat.result === null ? 'Pending' : stat.result ? 'Yes' : 'No'}
                  </span>
                  <span className="text-xs text-gray-500">{stat.correctCount}/{stat.totalCount}</span>
                </div>

                {/* Visual distribution bar */}
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden flex">
                    {stat.totalParticipants > 0 && (
                      <>
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${(stat.yesCount / stat.totalParticipants) * 100}%` }}
                        />
                        <div
                          className="h-full bg-red-500"
                          style={{ width: `${(stat.noCount / stat.totalParticipants) * 100}%` }}
                        />
                        <div
                          className="h-full bg-gray-300"
                          style={{ width: `${(stat.missingCount / stat.totalParticipants) * 100}%` }}
                        />
                      </>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-gray-500">
                    <span>Yes: {stat.yesCount}</span>
                    <span>No: {stat.noCount}</span>
                    <span>Pending: {stat.missingCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General Questions Accuracy */}
      {generalStats.length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">General Predictions</div>
          <div className="space-y-2">
            {generalStats.map(stat => (
              <div key={stat.key} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{stat.label}</span>
                  <span className="text-sm font-bold text-blue-600">{stat.accuracy !== null ? `${stat.accuracy}%` : 'Pending'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${stat.result !== null ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {stat.result !== null ? stat.result : 'Pending'}
                  </span>
                  <span className="text-xs text-gray-500">{stat.correctCount}/{stat.totalCount}</span>
                </div>

                {/* Distribution chart of user picks */}
                <div className="mt-3 space-y-1.5">
                  {stat.distribution.length === 0 ? (
                    <p className="text-[11px] text-gray-500">No picks yet</p>
                  ) : (
                    stat.distribution
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 6)
                      .map((bucket) => (
                        <div key={`${stat.key}-${bucket.value}`} className="flex items-center gap-2">
                          <span className="w-7 text-[11px] text-gray-600 text-right">{bucket.value}</span>
                          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${stat.totalCount > 0 ? (bucket.count / stat.totalCount) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="w-8 text-[11px] text-gray-500">{bucket.count}</span>
                        </div>
                      ))
                  )}
                  <div className="text-[11px] text-gray-500">Pending answers: {stat.missingCount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MVP Predictions Accuracy */}
      {mvpStats.length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">MVP Predictions</div>
          <div className="space-y-2">
            {mvpStats.map(stat => (
              <div key={stat.role} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{stat.label}</span>
                  <span className="text-sm font-bold text-blue-600">{stat.accuracy !== null ? `${stat.accuracy}%` : 'Pending'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${stat.leader ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                    {stat.leader ? `🥇 ${stat.leader}` : 'Pending'}
                  </span>
                  <span className="text-xs text-gray-500">{stat.correctCount}/{stat.totalCount}</span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {stat.distribution.length === 0 ? (
                    <p className="text-[11px] text-gray-500">No MVP picks yet</p>
                  ) : (
                    stat.distribution.slice(0, 5).map((bucket) => (
                      <div key={`${stat.role}-${bucket.playerName}`} className="flex items-center gap-2">
                        <span className="min-w-[110px] text-[11px] text-gray-600 truncate" title={bucket.playerName}>{bucket.playerName}</span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${stat.totalCount > 0 ? (bucket.count / stat.totalCount) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-8 text-[11px] text-gray-500">{bucket.count}</span>
                      </div>
                    ))
                  )}
                  <div className="text-[11px] text-gray-500">Pending picks: {stat.missingCount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


function BracketView({ series, seriesStats }: { series: Series[]; seriesStats: SeriesStat[] }) {
  const rounds = [1, 2, 3, 4]
  const roundNames: Record<number, string> = { 1: 'First round', 2: 'Conference semis', 3: 'Conference finals', 4: 'NBA Finals' }
  const seriesStatsMap = new Map(seriesStats.map(s => [s.seriesId, s]))
  const isTBD = (s: Series) => isTBDTeam(s.homeTeam.id, s.awayTeam.id)

  return (
    <div className="space-y-8">
      {rounds.map(round => {
        const rs = series.filter(s => s.round === round)
        if (!rs.length) return null
        return (
          <div key={round}>
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">{roundNames[round]}</div>
            <div className="space-y-3">
              {rs.map(s => {
                const stat = seriesStatsMap.get(s.id)
                const hasTBD = isTBD(s)
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-gray-400">{s.label}</span>
                      <div className="flex items-center gap-2">
                        {stat && !hasTBD && (
                          <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{stat.majorityPickPercentage}% picked {stat.majorityTeamAbbr}</span>
                        )}
                        {s.isComplete ? (
                          <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Final · {s.gameCount} games</span>
                        ) : hasTBD ? (
                          <span className="text-[11px] text-gray-400">Awaiting matchup</span>
                        ) : (
                          <span className="text-[11px] text-gray-400">In progress</span>
                        )}
                      </div>
                    </div>

                    <div className="mb-3 text-xs text-gray-600 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span>{hasTBD ? 'Matchup to be determined' : stat?.statusText ?? 'In progress'}</span>
                        {!hasTBD && (stat?.currentTopScorer || stat?.leadingScorer) && (
                          <span className="text-[11px] text-gray-500">
                            Top scorer: <span className="font-medium text-gray-700">{stat.currentTopScorer ?? stat.leadingScorer}</span>
                            {typeof stat?.currentTopScorerAvgPts === 'number' && (
                              <span className="text-gray-500"> ({stat.currentTopScorerAvgPts} PPG)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[s.homeTeam, s.awayTeam].map(team => {
                        const isWinner = s.winnerId === team.id
                        const teamWins = team.id === s.homeTeam.id ? stat?.homeWins : stat?.awayWins
                        return (
                          <div key={team.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isWinner ? 'bg-green-50 border border-green-200' : s.isComplete ? 'bg-gray-50 border border-gray-100 opacity-50' : 'bg-gray-50 border border-gray-100'}`}>
                            <img
                              src={hasTBD ? getTBDLogoUrl() : teamLogoUrl(team.abbr)}
                              alt={hasTBD ? 'TBD' : team.abbr}
                              className="w-4 h-4"
                            />
                            <span className={`text-sm font-medium ${isWinner ? 'text-green-800' : 'text-gray-600'}`}>{hasTBD ? 'TBD' : team.abbr}</span>
                            {!hasTBD && <span className="text-[11px] text-gray-400">#{team.seed}</span>}
                            {!hasTBD && typeof teamWins === 'number' && teamWins > 0 && (
                              <span className="ml-auto text-[11px] font-medium text-gray-500">{teamWins}W</span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {!hasTBD && stat && (
                      <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden flex">
                        <div className="h-full" style={{ backgroundColor: '#0072B2', width: `${stat.totalPredictions > 0 ? (stat.homePickCount / stat.totalPredictions) * 100 : 0}%` }} />
                        <div className="h-full" style={{ backgroundColor: '#E69F00', width: `${stat.totalPredictions > 0 ? (stat.awayPickCount / stat.totalPredictions) * 100 : 0}%` }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MyPicksView({ predictions, series, playoffLeaders, generalConfig, snackQuestions }: {
  predictions: Prediction[]; series: Series[]; playoffLeaders: { category: string; playerName: string }[]
  generalConfig?: { questions: { key: string; label: string }[]; results: Record<string, number> | null }
  snackQuestions: { id: number; question: string; result: boolean | null; order: number }[]
}) {
  const completedSeries = series.filter(s => s.isComplete)

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">{predictions.length} participants · {completedSeries.length}/{series.length} series complete</p>

      {completedSeries.length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Completed series</div>
          {completedSeries.map(s => {
            const winner = s.winnerId === s.homeTeam.id ? s.homeTeam : s.awayTeam
            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-gray-400">{s.label} · Round {s.round}</span>
                  <span className="text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Final · {s.gameCount} games</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: winner.color }} />
                  <span className="text-sm font-medium">{winner.abbr} wins</span>
                  {s.leadingScorer && <span className="text-xs text-gray-400 ml-2">Top scorer: {s.leadingScorer}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {playoffLeaders.length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Current stat leaders</div>
          {playoffLeaders.map(l => (
            <div key={l.category} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">{l.category}</span>
              <span className="text-sm font-medium text-gray-700">{l.playerName}</span>
            </div>
          ))}
        </div>
      )}

      {/* General results */}
      {generalConfig?.results && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">General stats</div>
          {generalConfig.questions.map(q => (
            <div key={q.key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">{q.label}</span>
              <span className="text-sm font-medium text-gray-700">{generalConfig.results?.[q.key] ?? '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Snack results */}
      {snackQuestions.some(q => q.result !== null) && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Yes/No results</div>
          {snackQuestions.filter(q => q.result !== null).map(q => (
            <div key={q.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">{q.question}</span>
              <span className={`text-sm font-medium ${q.result ? 'text-green-600' : 'text-red-600'}`}>{q.result ? 'Yes' : 'No'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface DeniGame { date: string; pts: number; reb: number; ast: number; min: string }
interface DeniTotals { ppg: number; rpg: number; apg: number; gamesPlayed: number }

function DeniTracker() {
  const [games, setGames] = useState<DeniGame[] | null>(null)
  const [totals, setTotals] = useState<DeniTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/deni-stats')
      .then(async r => {
        const data = await r.json()
        if (!r.ok || data.error) {
          setError(data.error || 'Failed to fetch stats')
          setGames([])
          setTotals(null)
        } else {
          setGames(data.games ?? [])
          setTotals(data.totals ?? null)
          setError(null)
        }
      })
      .catch(err => {
        setError(String(err))
        setGames([])
        setTotals(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const stats = totals
    ? [
        { label: 'PPG', value: String(totals.ppg) },
        { label: 'RPG', value: String(totals.rpg) },
        { label: 'APG', value: String(totals.apg) },
        { label: 'Games', value: String(totals.gamesPlayed) },
      ]
    : [
        { label: 'PPG', value: '—' },
        { label: 'RPG', value: '—' },
        { label: 'APG', value: '—' },
        { label: 'Games', value: '0' },
      ]

  return (
    <div className="space-y-6">
      {/* Deni card */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-5 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">8</div>
          <div>
            <h2 className="text-lg font-bold">Deni Avdija 🇮🇱</h2>
            <p className="text-blue-300 text-xs">Portland Trail Blazers · First NBA All-Star</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-[11px] text-gray-400">{s.label}</p>
              <p className="text-lg font-semibold mt-1">{loading ? '…' : s.value}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[11px] text-gray-400 mb-2">Playoff game log</p>
          {loading ? (
            <div className="text-sm text-gray-400 text-center py-4 bg-white/5 rounded-lg">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-400 text-center py-4 bg-red-900/20 rounded-lg">{error}</div>
          ) : !games || games.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-4 bg-white/5 rounded-lg">
              Playoff stats will appear here once games are played
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="pb-1 pr-3 font-medium">Date</th>
                    <th className="pb-1 px-2 font-medium text-center">MIN</th>
                    <th className="pb-1 px-2 font-medium text-center">PTS</th>
                    <th className="pb-1 px-2 font-medium text-center">REB</th>
                    <th className="pb-1 px-2 font-medium text-center">AST</th>
                  </tr>
                </thead>
                <tbody>
                  {[...games].reverse().map((g, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-1.5 pr-3 text-gray-300">{g.date.slice(5)}</td>
                      <td className="py-1.5 px-2 text-center text-gray-300">{g.min?.split(':')[0] ?? '—'}</td>
                      <td className="py-1.5 px-2 text-center font-semibold">{g.pts}</td>
                      <td className="py-1.5 px-2 text-center">{g.reb}</td>
                      <td className="py-1.5 px-2 text-center">{g.ast}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Season highlights */}
      <div>
        <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">2024-25 season highlights</div>
        <div className="space-y-2">
          {[
            { date: 'Jan 7', event: 'Season-high 41 points vs Rockets', emoji: '🔥' },
            { date: 'Feb 1', event: 'Named to first All-Star Game — first Israeli All-Star in NBA history', emoji: '⭐' },
            { date: 'Dec 29', event: 'Western Conference Player of the Week', emoji: '🏆' },
            { date: 'Season', event: 'Career-best 24.2 PPG, 6.9 RPG, 6.7 APG', emoji: '📊' },
          ].map((h, i) => (
            <div key={i} className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-3">
              <span className="text-lg">{h.emoji}</span>
              <div>
                <p className="text-sm font-medium text-gray-800">{h.event}</p>
                <p className="text-[11px] text-gray-400">{h.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PredictionDetailModal({ prediction, series, snackQuestions, snackQuestionLookup, generalConfig, onClose }: {
  prediction: Prediction
  series: Series[]
  snackQuestions: { id: number; question: string; result: boolean | null; order: number }[]
  snackQuestionLookup: Record<string, string>
  generalConfig?: { questions: { key: string; label: string }[]; results: Record<string, number> | null }
  onClose: () => void
}) {
  const seriesById = new Map(series.map((item) => [item.id, item]))
  const scoreBreakdown = {
    bracket: prediction.seriesPredictions.reduce((sum, item) => sum + item.totalScore, 0),
    leaders: prediction.leaderPredictions.reduce((sum, item) => sum + item.score, 0),
    general: prediction.generalPrediction?.score ?? 0,
    snacks: prediction.snackAnswers.reduce((sum, item) => sum + item.score, 0),
  }

  const regularLeaders = prediction.leaderPredictions.filter((item) => !MVP_CATEGORY_LABELS[item.category])
  const mvpPredictions = prediction.leaderPredictions.filter((item) => MVP_CATEGORY_LABELS[item.category])
  const groupedSnackAnswers = Array.from(
    prediction.snackAnswers.reduce((map, answer) => {
      const rawQuestion = snackQuestionLookup[String(answer.questionId)] ?? `Question ${answer.questionId}`
      const key = normalizeQuestion(rawQuestion)
      if (!map.has(key)) {
        map.set(key, { question: rawQuestion, answer: answer.answer, score: answer.score })
      }
      return map
    }, new Map<string, { question: string; answer: boolean; score: number }>()).values()
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-gray-200">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-blue-200">Prediction Detail</p>
            <h2 className="mt-1 text-2xl font-semibold">{prediction.userName}</h2>
            <p className="mt-1 text-sm text-blue-100">Full bracket, leaders, general picks and yes/no answers</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-blue-200">Total score</div>
              <div className="text-2xl font-bold">{prediction.totalScore}</div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20">
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-96px)] overflow-y-auto px-6 py-5 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Bracket', value: scoreBreakdown.bracket },
              { label: 'Leaders', value: scoreBreakdown.leaders },
              { label: 'General', value: scoreBreakdown.general },
              { label: 'Yes/No', value: scoreBreakdown.snacks },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-400">{item.label}</div>
                <div className="mt-1 text-xl font-semibold text-gray-900">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">Series Picks</div>
              <div className="space-y-2">
                {[...prediction.seriesPredictions]
                  .sort((a, b) => {
                    const seriesA = seriesById.get(a.seriesId)
                    const seriesB = seriesById.get(b.seriesId)
                    return (seriesA?.round ?? 99) - (seriesB?.round ?? 99) || a.seriesId.localeCompare(b.seriesId)
                  })
                  .map((item) => {
                    const matchup = seriesById.get(item.seriesId)
                    const isTBDMatchup = matchup ? isTBDTeam(matchup.homeTeam.id, matchup.awayTeam.id) : false
                    const winner = matchup
                      ? [matchup.homeTeam, matchup.awayTeam].find((team) => team.id === item.winnerId)
                      : null
                    return (
                      <div key={item.seriesId} className="rounded-2xl border border-gray-200 p-4 bg-white">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{matchup ? (isTBDMatchup ? 'TBD vs TBD' : `${matchup.homeTeam.abbr} vs ${matchup.awayTeam.abbr}`) : item.seriesId}</div>
                            <div className="text-xs text-gray-400">{matchup ? `${isTBDMatchup ? 'Awaiting matchup' : `Round ${matchup.round}`} · ${matchup.label}` : 'Series pick'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-blue-700">{isTBDMatchup ? 'TBD' : (winner?.abbr ?? item.winnerId)}</div>
                            <div className="text-xs text-gray-500">{isTBDMatchup ? 'awaiting teams' : `in ${item.gameCount} games`}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">Leading scorer: <span className="font-medium text-gray-700">{isTBDMatchup ? 'TBD' : item.leadingScorer}</span></div>
                      </div>
                    )
                  })}
              </div>
            </section>

            <section className="space-y-6">
              <div>
                <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Stat Leaders</div>
                <div className="space-y-2">
                  {regularLeaders.map((item) => (
                    <div key={item.category} className="flex items-center justify-between rounded-2xl border border-gray-200 p-3 bg-white">
                      <span className="text-sm text-gray-500">{item.category}</span>
                      <span className="text-sm font-medium text-gray-900">{item.playerName}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">MVP Picks</div>
                <div className="space-y-2">
                  {mvpPredictions.map((item) => (
                    <div key={item.category} className="flex items-center justify-between rounded-2xl border border-gray-200 p-3 bg-white">
                      <span className="text-sm text-gray-500">{MVP_CATEGORY_LABELS[item.category]}</span>
                      <span className="text-sm font-medium text-gray-900">{item.playerName}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">General Picks</div>
                <div className="space-y-2">
                  {(generalConfig?.questions ?? []).map((question) => (
                    <div key={question.key} className="flex items-center justify-between rounded-2xl border border-gray-200 p-3 bg-white">
                      <span className="text-sm text-gray-500">{question.label}</span>
                      <span className="text-sm font-medium text-gray-900">{prediction.generalPrediction?.answers?.[question.key] ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Yes/No Picks</div>
                <div className="space-y-2">
                  {groupedSnackAnswers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-400 bg-gray-50">No yes/no picks saved.</div>
                  ) : (
                    groupedSnackAnswers.map((item) => (
                      <div key={item.question} className="flex items-center justify-between rounded-2xl border border-gray-200 p-3 bg-white gap-3">
                        <span className="text-sm text-gray-500">{item.question}</span>
                        <span className={`text-sm font-medium ${item.answer ? 'text-green-700' : 'text-red-700'}`}>{item.answer ? 'Yes' : 'No'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}