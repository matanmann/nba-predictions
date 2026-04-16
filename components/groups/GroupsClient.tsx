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

export default function GroupsClient() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [joinNickname, setJoinNickname] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups')
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups)
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    } catch {
      alert('Copy failed, please copy manually')
    }
  }

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim() || !nickname.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, nickname }),
      })

      if (res.ok) {
        const data = await res.json()
        setGroups(prev => [...prev, { ...data.group, memberCount: 1 }])
        setGroupName('')
        setNickname('')
        setShowCreate(false)
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create group')
      }
    } catch (error) {
      console.error('Failed to create group:', error)
      alert('Failed to create group')
    } finally {
      setCreating(false)
    }
  }

  const joinGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim() || !joinNickname.trim()) return

    setJoining(true)
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode, nickname: joinNickname }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.alreadyMember) {
          alert('You are already a member of this group')
        } else {
          alert(`Successfully joined ${data.group.name}!`)
          fetchGroups() // Refresh the groups list
        }
        setJoinCode('')
        setJoinNickname('')
        setShowJoin(false)
      } else {
        let errorMessage = 'Failed to join group'
        try {
          const text = await res.text()
          try {
            const error = JSON.parse(text)
            errorMessage = error.error || text || errorMessage
          } catch {
            errorMessage = text || `${res.status} ${res.statusText}`
          }
        } catch {
          errorMessage = `${res.status} ${res.statusText}`
        }
        alert(errorMessage)
      }
    } catch (error) {
      console.error('Failed to join group:', error)
      alert('Failed to join group')
    } finally {
      setJoining(false)
    }
  }

  const enterGroup = (groupId: string) => {
    router.push(`/groups/${groupId}`)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="text-sm text-gray-400">Loading groups...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Prediction Groups</h1>
        <p className="text-gray-600">Create or join groups to compete with friends in playoff predictions</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setShowCreate(true)}
          className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Create Group
        </button>
        <button
          onClick={() => setShowJoin(true)}
          className="flex-1 bg-gray-100 text-gray-900 py-3 px-4 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          Join Group
        </button>
      </div>

      {/* Groups List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Your Groups</h2>

        {groups.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No groups yet</h3>
            <p className="text-gray-500 mb-4">Create your first group or join an existing one</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                  <p className="text-sm text-gray-500">
                    {group.season.year} Season · {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Code: {group.code}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => enterGroup(group.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Enter
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(`${window.location.origin}/groups/${group.id}`)}
                    className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(group.code)}
                    className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Copy code
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Group</h3>
            <form onSubmit={createGroup}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Family Predictions 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Nickname</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. John"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 bg-gray-100 text-gray-900 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Join Group</h3>
            <form onSubmit={joinGroup}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Invite Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 7-character code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 uppercase"
                  maxLength={7}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Nickname</label>
                <input
                  type="text"
                  value={joinNickname}
                  onChange={(e) => setJoinNickname(e.target.value)}
                  placeholder="e.g. John"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowJoin(false)}
                  className="flex-1 bg-gray-100 text-gray-900 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {joining ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}