'use client'

import { useState } from 'react'
import { useDashboard } from '@/hooks/useDashboard'

interface Team { id: string; name: string; abbr: string; seed: number; color: string }
interface Series { id: string; round: number; conference: string; label: string; homeTeam: Team; awayTeam: Team; winnerId: string | null; gameCount: number | null; leadingScorer: string | null; isComplete: boolean }
interface Prediction { userId: string; userName: string; totalScore: number; seriesPredictions: { seriesId: string; winnerId: string; gameCount: number; leadingScorer: string; winnerScore: number; gamesScore: number; scorerScore: number; bonusApplied: boolean; totalScore: number }[]; leaderPredictions: { category: string; playerName: string; score: number }[]; generalPrediction: { answers: Record<string, number>; score: number } | null; snackAnswers: { questionId: number; answer: boolean; score: number }[] }
interface SeriesStat { seriesId: string; homeTeam: string; awayTeam: string; homeTeamColor: string; awayTeamColor: string; winPercentage: number; correctPredictions: number; totalPredictions: number }
interface SnackStat { questionId: number; question: string; result: boolean | null; accuracy: number | null; correctCount: number; totalCount: number }
interface GeneralStat { key: string; label: string; result: number | null; accuracy: number | null; correctCount: number; totalCount: number }
interface MvpStat { role: string; label: string; leader: string | null; accuracy: number; correctCount: number; totalCount: number }
interface DashboardData { locked?: boolean; season?: { year: number; lockedAt: string }; series?: Series[]; playoffLeaders?: { category: string; playerName: string }[]; generalConfig?: { questions: { key: string; label: string }[]; results: Record<string, number> | null }; snackQuestions?: { id: number; question: string; result: boolean | null; order: number }[]; predictions?: Prediction[]; seriesStats?: SeriesStat[]; snackStats?: SnackStat[]; generalStats?: GeneralStat[]; mvpStats?: MvpStat[] }

const TABS = ['Rankings', 'Statistics', 'Bracket', 'My picks', 'Deni tracker'] as const
type Tab = typeof TABS[number]

export default function DashboardClient({ year }: { year: string }) {
  const { data, isLoading } = useDashboard(+year)
  const [activeTab, setActiveTab] = useState<Tab>('Rankings')

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

      {activeTab === 'Rankings' && <RankingsView predictions={d.predictions ?? []} playoffLeaders={d.playoffLeaders ?? []} />}
      {activeTab === 'Statistics' && <StatisticsView series={d.series ?? []} seriesStats={d.seriesStats ?? []} snackStats={d.snackStats ?? []} generalStats={d.generalStats ?? []} mvpStats={d.mvpStats ?? []} />}
      {activeTab === 'Bracket' && <BracketView series={d.series ?? []} seriesStats={d.seriesStats ?? []} />}
      {activeTab === 'My picks' && <MyPicksView predictions={d.predictions ?? []} series={d.series ?? []} playoffLeaders={d.playoffLeaders ?? []} generalConfig={d.generalConfig} snackQuestions={d.snackQuestions ?? []} />}
      {activeTab === 'Deni tracker' && <DeniTracker />}
    </div>
  )
}

function RankingsView({ predictions, playoffLeaders }: { predictions: Prediction[]; playoffLeaders: { category: string; playerName: string }[] }) {
  const sorted = [...predictions].sort((a, b) => b.totalScore - a.totalScore)

  return (
    <div className="space-y-6">
      {/* Rankings */}
      <div className="space-y-2">
        {sorted.map((p, i) => {
          const rank = i + 1
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
          const bracketPts = p.seriesPredictions.reduce((sum, sp) => sum + sp.totalScore, 0)
          const leaderPts = p.leaderPredictions.reduce((sum, lp) => sum + lp.score, 0)
          const genPts = p.generalPrediction?.score ?? 0
          const snackPts = p.snackAnswers.reduce((sum, sa) => sum + sa.score, 0)
          return (
            <div key={p.userId} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${rank <= 3 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-3">
                <span className="text-lg w-8 text-center">{medal ?? <span className="text-sm text-gray-400">{rank}</span>}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.userName}</p>
                  <p className="text-[11px] text-gray-400">B:{bracketPts} · L:{leaderPts} · G:{genPts} · S:{snackPts}</p>
                </div>
              </div>
              <span className="text-lg font-bold text-gray-900">{p.totalScore}</span>
            </div>
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

function StatisticsView({ series, seriesStats, snackStats, generalStats, mvpStats }: { series: Series[]; seriesStats: SeriesStat[]; snackStats: SnackStat[]; generalStats: GeneralStat[]; mvpStats: MvpStat[] }) {
  const seriesStatsMap = new Map(seriesStats.map(s => [s.seriesId, s]))

  return (
    <div className="space-y-6">
      {/* Series Prediction Statistics */}
      {seriesStats.length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Series Predictions</div>
          <div className="space-y-3">
            {series.map(s => {
              const stat = seriesStatsMap.get(s.id)
              return (
                <div key={s.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">{s.homeTeam.abbr} vs {s.awayTeam.abbr}</span>
                      <span className="text-xs text-gray-400">{s.label}</span>
                    </div>
                    {stat && <span className="text-sm font-bold text-blue-600">{stat.winPercentage}%</span>}
                  </div>
                  {stat && <div className="text-xs text-gray-500">{stat.correctPredictions}/{stat.totalPredictions} correct</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Yes/No Questions Accuracy */}
      {snackStats.filter(s => s.result !== null).length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Yes/No Predictions</div>
          <div className="space-y-2">
            {snackStats.filter(s => s.result !== null).map(stat => (
              <div key={stat.questionId} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{stat.question}</span>
                  {stat.accuracy !== null && <span className="text-sm font-bold text-blue-600">{stat.accuracy}%</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${stat.result ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {stat.result ? 'Yes' : 'No'}
                  </span>
                  {stat.accuracy !== null && <span className="text-xs text-gray-500">{stat.correctCount}/{stat.totalCount}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General Questions Accuracy */}
      {generalStats.filter(s => s.result !== null).length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">General Predictions</div>
          <div className="space-y-2">
            {generalStats.filter(s => s.result !== null).map(stat => (
              <div key={stat.key} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{stat.label}</span>
                  {stat.accuracy !== null && <span className="text-sm font-bold text-blue-600">{stat.accuracy}%</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{stat.result}</span>
                  {stat.accuracy !== null && <span className="text-xs text-gray-500">{stat.correctCount}/{stat.totalCount}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MVP Predictions Accuracy */}
      {mvpStats.filter(m => m.leader).length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">MVP Predictions</div>
          <div className="space-y-2">
            {mvpStats.filter(m => m.leader).map(stat => (
              <div key={stat.role} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{stat.label}</span>
                  <span className="text-sm font-bold text-blue-600">{stat.accuracy}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">🥇 {stat.leader}</span>
                  <span className="text-xs text-gray-500">{stat.correctCount}/{stat.totalCount}</span>
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
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-gray-400">{s.label}</span>
                      <div className="flex items-center gap-2">
                        {stat && (
                          <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{stat.winPercentage}% correct</span>
                        )}
                        {s.isComplete ? (
                          <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Final · {s.gameCount} games</span>
                        ) : (
                          <span className="text-[11px] text-gray-400">In progress</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[s.homeTeam, s.awayTeam].map(team => {
                        const isWinner = s.winnerId === team.id
                        return (
                          <div key={team.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isWinner ? 'bg-green-50 border border-green-200' : s.isComplete ? 'bg-gray-50 border border-gray-100 opacity-50' : 'bg-gray-50 border border-gray-100'}`}>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                            <span className={`text-sm font-medium ${isWinner ? 'text-green-800' : 'text-gray-600'}`}>{team.abbr}</span>
                            <span className="text-[11px] text-gray-400">#{team.seed}</span>
                          </div>
                        )
                      })}
                    </div>
                    {s.isComplete && s.leadingScorer && (
                      <div className="mt-2 text-xs text-gray-500">Leading scorer: <span className="font-medium text-gray-700">{s.leadingScorer}</span></div>
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

function DeniTracker() {
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
          {[
            { label: 'PPG', value: '—' },
            { label: 'RPG', value: '—' },
            { label: 'APG', value: '—' },
            { label: 'Games', value: '0' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-[11px] text-gray-400">{s.label}</p>
              <p className="text-lg font-semibold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[11px] text-gray-400 mb-2">Playoff game log</p>
          <div className="text-sm text-gray-400 text-center py-4 bg-white/5 rounded-lg">
            Playoff stats will appear here once games are played
          </div>
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