'use client'

import { useState, useEffect } from 'react'
import { usePrediction } from '@/hooks/usePrediction'
import { useLockStatus } from '@/hooks/useLockStatus'

// ─── Types ──────────────────────────────────────────────────

interface Team {
  id: string
  name: string
  abbr: string
  seed: number
  conference: string
  color: string
}

interface Series {
  id: string
  round: number
  conference: string
  label: string
  homeTeam: Team
  awayTeam: Team
}

interface SnackQuestion {
  id: number
  order: number
  question: string
}

interface GeneralQuestion {
  key: string
  label: string
  type: string
}

interface SeasonData {
  series: Series[]
  snackQuestions: SnackQuestion[]
  generalConfig: { questions: GeneralQuestion[] }
}

const LEADER_CATEGORIES = ['Points', 'Assists', 'Rebounds', 'Blocks', 'Steals'] as const

const TABS = ['Bracket', 'Leaders', 'General', 'Snacks'] as const
type Tab = typeof TABS[number]

// ─── Component ──────────────────────────────────────────────

export default function PredictClient({ year }: { year: number }) {
  const [activeTab, setActiveTab] = useState<Tab>('Bracket')
  const [seasonData, setSeasonData] = useState<SeasonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Prediction state
  const [seriesPreds, setSeriesPreds] = useState<Record<string, { winnerId: string; gameCount: number; leadingScorer: string }>>({})
  const [leaderPreds, setLeaderPreds] = useState<Record<string, string>>({})
  const [generalAnswers, setGeneralAnswers] = useState<Record<string, number>>({})
  const [snackAnswers, setSnackAnswers] = useState<Record<number, boolean>>({})

  const [submitStatus, setSubmitStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const lockStatus = useLockStatus(year)

  // Load season data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/seasons/${year}`)
        if (!res.ok) throw new Error('Failed to load season')
        const data = await res.json()
        setSeasonData(data)

        // Load existing predictions
        const predRes = await fetch(`/api/seasons/${year}/predictions`)
        if (predRes.ok) {
          const predData = await predRes.json()
          if (predData.prediction) {
            const p = predData.prediction
            // Restore series predictions
            const sp: Record<string, any> = {}
            for (const s of p.seriesPredictions ?? []) {
              sp[s.seriesId] = { winnerId: s.winnerId, gameCount: s.gameCount, leadingScorer: s.leadingScorer }
            }
            setSeriesPreds(sp)

            // Restore leader predictions
            const lp: Record<string, string> = {}
            for (const l of p.leaderPredictions ?? []) {
              lp[l.category] = l.playerName
            }
            setLeaderPreds(lp)

            // Restore general
            if (p.generalPrediction?.answers) {
              setGeneralAnswers(p.generalPrediction.answers)
            }

            // Restore snacks
            const sa: Record<number, boolean> = {}
            for (const a of p.snackAnswers ?? []) {
              sa[a.questionId] = a.answer
            }
            setSnackAnswers(sa)
          }
        }
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [year])

  // Submit handler
  async function handleSubmit() {
    if (!seasonData) return
    setSubmitStatus('saving')

    try {
      const res = await fetch(`/api/seasons/${year}/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesPredictions: Object.entries(seriesPreds).map(([seriesId, pred]) => ({
            seriesId,
            ...pred,
          })),
          leaderPredictions: leaderPreds,
          generalAnswers,
          snackAnswers: Object.entries(snackAnswers).map(([qId, answer]) => ({
            questionId: +qId,
            answer,
          })),
        }),
      })

      if (res.status === 423) {
        setSubmitStatus('error')
        setError('Predictions are locked!')
        return
      }
      if (!res.ok) throw new Error('Submit failed')
      setSubmitStatus('saved')
      setTimeout(() => setSubmitStatus('idle'), 2500)
    } catch {
      setSubmitStatus('error')
      setTimeout(() => setSubmitStatus('idle'), 3000)
    }
  }

  // Completeness check
  const seriesComplete = seasonData
    ? seasonData.series.every(s => {
        const p = seriesPreds[s.id]
        return p?.winnerId && p?.gameCount && p?.leadingScorer?.trim()
      })
    : false
  const leadersComplete = LEADER_CATEGORIES.every(c => leaderPreds[c]?.trim())
  const generalComplete = seasonData?.generalConfig?.questions
    ? seasonData.generalConfig.questions.every(q => generalAnswers[q.key] !== undefined)
    : false
  const snacksComplete = seasonData?.snackQuestions
    ? seasonData.snackQuestions.every(q => snackAnswers[q.id] !== undefined)
    : false
  const allComplete = seriesComplete && leadersComplete && generalComplete && snacksComplete

  const isLocked = lockStatus?.locked ?? false

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400">Loading predictions...</div>
      </div>
    )
  }

  if (error && !seasonData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-red-500">{error}</div>
      </div>
    )
  }

  if (!seasonData) return null

  return (
    <div className="max-w-2xl mx-auto pb-32">
      {/* Lock Banner */}
      {lockStatus && !isLocked && (
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700">Predictions lock at tip-off</span>
            <span className="text-sm font-mono font-semibold text-amber-800">
              {formatCountdown(lockStatus.secondsUntilLock)}
            </span>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <span className="text-sm font-medium text-red-700">
            Predictions are locked. View the dashboard to track your scores.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {TABS.map(tab => {
          const complete = tab === 'Bracket' ? seriesComplete
            : tab === 'Leaders' ? leadersComplete
            : tab === 'General' ? generalComplete
            : snacksComplete
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all relative ${
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {complete && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'Bracket' && (
        <BracketTab
          series={seasonData.series}
          predictions={seriesPreds}
          onChange={setSeriesPreds}
          locked={isLocked}
        />
      )}
      {activeTab === 'Leaders' && (
        <LeadersTab
          predictions={leaderPreds}
          onChange={setLeaderPreds}
          locked={isLocked}
        />
      )}
      {activeTab === 'General' && (
        <GeneralTab
          questions={seasonData.generalConfig?.questions ?? []}
          answers={generalAnswers}
          onChange={setGeneralAnswers}
          locked={isLocked}
        />
      )}
      {activeTab === 'Snacks' && (
        <SnacksTab
          questions={seasonData.snackQuestions}
          answers={snackAnswers}
          onChange={setSnackAnswers}
          locked={isLocked}
        />
      )}

      {/* Submit Button */}
      {!isLocked && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 p-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleSubmit}
              disabled={!allComplete || submitStatus === 'saving'}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                allComplete
                  ? submitStatus === 'saved'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitStatus === 'saving' ? 'Saving...'
                : submitStatus === 'saved' ? 'Saved!'
                : submitStatus === 'error' ? 'Error — try again'
                : !allComplete ? 'Complete all tabs to submit'
                : 'Submit predictions'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bracket Tab ──────────────────────────────────────────

function BracketTab({
  series,
  predictions,
  onChange,
  locked,
}: {
  series: Series[]
  predictions: Record<string, { winnerId: string; gameCount: number; leadingScorer: string }>
  onChange: (p: Record<string, any>) => void
  locked: boolean
}) {
  const eastSeries = series.filter(s => s.conference === 'E').sort((a, b) => a.label.localeCompare(b.label))
  const westSeries = series.filter(s => s.conference === 'W').sort((a, b) => a.label.localeCompare(b.label))

  function updateSeries(seriesId: string, field: string, value: any) {
    if (locked) return
    onChange({
      ...predictions,
      [seriesId]: {
        ...(predictions[seriesId] ?? { winnerId: '', gameCount: 0, leadingScorer: '' }),
        [field]: value,
      },
    })
  }

  return (
    <div className="space-y-8">
      {/* East */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">Eastern Conference</div>
        </div>
        <div className="space-y-4">
          {eastSeries.map(s => (
            <SeriesCard
              key={s.id}
              series={s}
              prediction={predictions[s.id]}
              onUpdate={(field, val) => updateSeries(s.id, field, val)}
              locked={locked}
            />
          ))}
        </div>
      </div>

      {/* West */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">Western Conference</div>
        </div>
        <div className="space-y-4">
          {westSeries.map(s => (
            <SeriesCard
              key={s.id}
              series={s}
              prediction={predictions[s.id]}
              onUpdate={(field, val) => updateSeries(s.id, field, val)}
              locked={locked}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SeriesCard({
  series,
  prediction,
  onUpdate,
  locked,
}: {
  series: Series
  prediction?: { winnerId: string; gameCount: number; leadingScorer: string }
  onUpdate: (field: string, val: any) => void
  locked: boolean
}) {
  const { homeTeam, awayTeam } = series
  const winnerId = prediction?.winnerId ?? ''

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Series label */}
      <div className="text-[11px] font-medium text-gray-400 tracking-wide">
        {series.label} · Round {series.round}
      </div>

      {/* Team picker */}
      <div className="grid grid-cols-2 gap-2">
        {[homeTeam, awayTeam].map(team => {
          const selected = winnerId === team.id
          return (
            <button
              key={team.id}
              onClick={() => !locked && onUpdate('winnerId', team.id)}
              disabled={locked}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                selected
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: team.color }}
              />
              <div className="text-left">
                <div className="text-sm font-medium">{team.abbr}</div>
                <div className={`text-[11px] ${selected ? 'text-gray-300' : 'text-gray-400'}`}>
                  #{team.seed} seed
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Game count */}
      <div>
        <div className="text-xs text-gray-500 mb-1.5">Games</div>
        <div className="flex gap-1.5">
          {[4, 5, 6, 7].map(g => (
            <button
              key={g}
              onClick={() => !locked && onUpdate('gameCount', g)}
              disabled={locked}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                prediction?.gameCount === g
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Leading scorer */}
      <div>
        <div className="text-xs text-gray-500 mb-1.5">Series leading scorer</div>
        <input
          type="text"
          placeholder="e.g. Jayson Tatum"
          value={prediction?.leadingScorer ?? ''}
          onChange={e => !locked && onUpdate('leadingScorer', e.target.value)}
          readOnly={locked}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-gray-400 placeholder:text-gray-300"
        />
      </div>
    </div>
  )
}

// ─── Leaders Tab ──────────────────────────────────────────

function LeadersTab({
  predictions,
  onChange,
  locked,
}: {
  predictions: Record<string, string>
  onChange: (p: Record<string, string>) => void
  locked: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">
        Playoff Statistical Leaders
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Predict who will lead the entire playoffs in each category (minimum 8 games played).
      </p>
      {LEADER_CATEGORIES.map(cat => (
        <div key={cat} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-400 mb-2">{cat} leader</div>
          <input
            type="text"
            placeholder={`e.g. ${cat === 'Points' ? 'Luka Dončić' : cat === 'Assists' ? 'Jalen Brunson' : cat === 'Rebounds' ? 'Anthony Davis' : cat === 'Blocks' ? 'Chet Holmgren' : 'Derrick White'}`}
            value={predictions[cat] ?? ''}
            onChange={e => !locked && onChange({ ...predictions, [cat]: e.target.value })}
            readOnly={locked}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-gray-400 placeholder:text-gray-300"
          />
        </div>
      ))}
    </div>
  )
}

// ─── General Tab ──────────────────────────────────────────

function GeneralTab({
  questions,
  answers,
  onChange,
  locked,
}: {
  questions: GeneralQuestion[]
  answers: Record<string, number>
  onChange: (a: Record<string, number>) => void
  locked: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">
        General Predictions
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Predict the exact number for each category across the entire playoffs.
      </p>
      {questions.map(q => (
        <div key={q.key} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-700 mb-3">{q.label}</div>
          <input
            type="number"
            min={0}
            max={999}
            placeholder="0"
            value={answers[q.key] ?? ''}
            onChange={e => !locked && onChange({ ...answers, [q.key]: +e.target.value })}
            readOnly={locked}
            className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-lg font-semibold text-center bg-gray-50 focus:outline-none focus:border-gray-400"
          />
        </div>
      ))}
    </div>
  )
}

// ─── Snacks Tab ──────────────────────────────────────────

function SnacksTab({
  questions,
  answers,
  onChange,
  locked,
}: {
  questions: SnackQuestion[]
  answers: Record<number, boolean>
  onChange: (a: Record<number, boolean>) => void
  locked: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">
        Yes / No Predictions
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Quick-fire predictions. 2 points each if you get it right.
      </p>
      {questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-700 mb-3">
            <span className="text-xs text-gray-400 mr-1.5">{i + 1}.</span>
            {q.question}
          </div>
          <div className="flex gap-2">
            {[true, false].map(val => {
              const selected = answers[q.id] === val
              return (
                <button
                  key={String(val)}
                  onClick={() => !locked && onChange({ ...answers, [q.id]: val })}
                  disabled={locked}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    selected
                      ? val
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {val ? 'Yes' : 'No'}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0:00'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}