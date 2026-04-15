'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Group {
  id: string
  name: string
  code: string
  season: { year: number }
  memberCount: number
  createdBy: string
}

interface LeaderboardEntry {
  userId: string
  userName: string
  totalScore: number
  rank: number
}

export default function GroupClient({ groupId }: { groupId: string }) {
  const [group, setGroup] = useState<Group | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard'>('overview')
  const router = useRouter()

  useEffect(() => {
    fetchGroupData()
  }, [groupId])

  const fetchGroupData = async () => {
    try {
      // Fetch group details
      const groupRes = await fetch(`/api/groups/${groupId}`)
      if (groupRes.ok) {
        const groupData = await groupRes.json()
        setGroup(groupData.group)
      }

      // Fetch group leaderboard
      const leaderboardRes = await fetch(`/api/groups/${groupId}/leaderboard`)
      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json()
        setLeaderboard(leaderboardData.leaderboard)
      }
    } catch (error) {
      console.error('Failed to fetch group data:', error)
    } finally {
      setLoading(false)
    }
  }

  const goToPredictions = () => {
    router.push(`/predict/${group?.season.year}?group=${group?.id}`)
  }

  const goToDashboard = () => {
    router.push(`/dashboard/${group?.season.year}`)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="text-sm text-gray-400">Loading group...</div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="text-4xl mb-4">❌</div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">Group not found</h2>
        <p className="text-sm text-gray-500">This group may not exist or you may not have access.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Group Header */}
      <div className="mb-6 rounded-2xl overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">{group.name}</h1>
            <p className="text-blue-100">{group.season.year} NBA Playoffs</p>
            <p className="text-blue-100 text-sm mt-1">{group.memberCount} members</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-200">Invite Code</p>
            <p className="text-lg font-mono font-bold">{group.code}</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'overview'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'leaderboard'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Leaderboard
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={goToPredictions}
              className="bg-blue-600 text-white p-4 rounded-xl font-medium hover:bg-blue-700 transition-colors text-left"
            >
              <div className="text-lg mb-1">🎯</div>
              <div className="text-sm">Make Predictions</div>
            </button>
            <button
              onClick={goToDashboard}
              className="bg-green-600 text-white p-4 rounded-xl font-medium hover:bg-green-700 transition-colors text-left"
            >
              <div className="text-lg mb-1">📊</div>
              <div className="text-sm">View Results</div>
            </button>
          </div>

          {/* Group Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Group Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Season:</span>
                <span className="font-medium">{group.season.year} NBA Playoffs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Members:</span>
                <span className="font-medium">{group.memberCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Invite Code:</span>
                <span className="font-mono font-medium">{group.code}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Group Leaderboard</h3>

          {leaderboard.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <div className="text-3xl mb-2">🏆</div>
              <p className="text-gray-500">No predictions submitted yet</p>
              <p className="text-sm text-gray-400 mt-1">Be the first to make your picks!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                      index < 3 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-8 text-center">
                        {medal ?? <span className="text-sm text-gray-400">{entry.rank}</span>}
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {entry.userName}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{entry.totalScore}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}