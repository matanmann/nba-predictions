'use client'

import { useState, useEffect } from 'react'
import { useDashboard } from '@/hooks/useDashboard'

interface Team {
  id: string
  name: string
  abbr: string
  seed: number
  color: string
}

interface Series {
  id: string
  round: number
  conference: string
  label: string
  homeTeam: Team
  awayTeam: Team
  winnerId: string | null
  gameCount: number | null
  leadingScorer: string | null
  isComplete: boolean
}

interface SeriesPrediction {
  seriesId: string
  winnerId: string
  gameCount: number
  leadingScorer: string
  winnerScore: number
  gamesScore: number
  scorerScore: number
  bonusApplied: boolean
  totalScore: number
}

interface Prediction {
  userId: string
  totalScore: number
  seriesPredictions: SeriesPrediction[]
  leaderPredictions: { category: string; playerName: string; score: number }[]
  generalPrediction: { answers: Record<string, number>; score: number } | null
  snackAnswers: { questionId: number; answer: boolean; score: number }[]
}

interface DashboardData {
  locked?: boolean
  season?: { year: number; lockedAt: string }
  series?: Series[]
  playoffLeaders?: { category: string; playerName: string }[]
  generalConfig?: { questions: { key: string; label: string }[]; results: Record<string, number> | null }
  snackQuestions?: { id: number; question: string; result: boolean | null; order: number }[]
  predictions?: Prediction[]
}

const TABS = ['Leaderboard', 'Series', 'My Picks'] as const
type Tab = typeof TABS[number]

export default function DashboardClient({ year }: { year: string }) {
  const { data, isLoading, error } = useDashboard(+year)
  const [activeTab, setActiveTab] = useState<Tab>('Leaderboard')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400">Loading dashboard...</div>
      </div>
    )
  }

  if (!data || data.locked === false) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">Dashboard locked until tip-off</h2>
        <p className="text-sm text-gray-500">
          The dashboard opens once predictions are locked and the playoffs begin.
        </p>
      </div>
    )
  }

  const dashData = data as DashboardData

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {year} Playoff Dashboard
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          {dashData.predictions?.length ?? 0} participants · Live scoring
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Leaderboard' && (
        <LeaderboardView predictions={dashData.predictions ?? []} />
      )}
      {activeTab === 'Series' && (
        <SeriesView series={dashData.series ?? []} />
      )}
      {activeTab === 'My Picks' && (
        <MyPicksView
          predictions={dashData.predictions ?? []}
          series={dashData.series ?? []}
          playoffLeaders={dashData.playoffLeaders ?? []}
          generalConfig={dashData.generalConfig}
          snackQuestions={dashData.snackQuestions ?? []}
        />
      )}
    </div>
  )
}

// ─── Leaderboard ──────────────────────────────────────────

function LeaderboardView({ predictions }: { predictions: Prediction[] }) {
  const sorted = [...predictions].sort((a, b) => b.totalScore - a.totalScore)

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        No predictions submitted yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map((p, i) => {
        const rank = i + 1
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
        return (
          <div
            key={p.userId}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              rank <= 3 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg w-8 text-center">
                {medal ?? <span className="text-sm text-gray-400">{rank}</span>}
              </span>
              <span className="text-sm font-medium text-gray-800">
                {p.userId}
              </span>
            </div>
            <span className="text-lg font-bold text-gray-900">{p.totalScore}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Series View ──────────────────────────────────────────

function SeriesView({ series }: { series: Series[] }) {
  const rounds = [1, 2, 3, 4]
  const roundNames: Record<number, string> = {
    1: 'First Round',
    2: 'Conference Semis',
    3: 'Conference Finals',
    4: 'NBA Finals',
  }

  return (
    <div className="space-y-8">
      {rounds.map(round => {
        const roundSeries = series.filter(s => s.round === round)
        if (roundSeries.length === 0) return null
        return (
          <div key={round}>
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
              {roundNames[round]}
            </div>
            <div className="space-y-3">
              {roundSeries.map(s => (
                <div
                  key={s.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-gray-400">{s.label}</span>
                    {s.isComplete ? (
                      <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        Final · {s.gameCount} games
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">In progress</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[s.homeTeam, s.awayTeam].map(team => {
                      const isWinner = s.winnerId === team.id
                      return (
                        <div
                          key={team.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                            isWinner
                              ? 'bg-green-50 border border-green-200'
                              : s.isComplete
                                ? 'bg-gray-50 border border-gray-100 opacity-50'
                                : 'bg-gray-50 border border-gray-100'
                          }`}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className={`text-sm font-medium ${isWinner ? 'text-green-800' : 'text-gray-600'}`}>
                            {team.abbr}
                          </span>
                          <span className="text-[11px] text-gray-400">#{team.seed}</span>
                        </div>
                      )
                    })}
                  </div>
                  {s.isComplete && s.leadingScorer && (
                    <div className="mt-2 text-xs text-gray-500">
                      Leading scorer: <span className="font-medium text-gray-700">{s.leadingScorer}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── My Picks View ──────────────────────────────────────────

function MyPicksView({
  predictions,
  series,
  playoffLeaders,
  generalConfig,
  snackQuestions,
}: {
  predictions: Prediction[]
  series: Series[]
  playoffLeaders: { category: string; playerName: string }[]
  generalConfig?: { questions: { key: string; label: string }[]; results: Record<string, number> | null }
  snackQuestions: { id: number; question: string; result: boolean | null; order: number }[]
}) {
  // For now, show a placeholder — in a real app you'd filter to the current user
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">
          Your detailed pick breakdown will appear here as series complete.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          {predictions.length} total participants · {series.filter(s => s.isComplete).length}/{series.length} series complete
        </p>
      </div>

      {/* Series scores summary */}
      {series.filter(s => s.isComplete).length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
            Completed Series
          </div>
          {series.filter(s => s.isComplete).map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.homeTeam.color }} />
                <span className="text-sm text-gray-700">
                  {s.homeTeam.abbr} vs {s.awayTeam.abbr}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {series.find(x => x.id === s.id)?.winnerId
                  ? `${s.winnerId === s.homeTeam.id ? s.homeTeam.abbr : s.awayTeam.abbr} in ${s.gameCount}`
                  : 'TBD'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Playoff Leaders */}
      {playoffLeaders.length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
            Current Playoff Leaders
          </div>
          {playoffLeaders.map(l => (
            <div key={l.category} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">{l.category}</span>
              <span className="text-sm font-medium text-gray-700">{l.playerName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}