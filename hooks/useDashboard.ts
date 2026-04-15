import { useState, useEffect } from 'react'

export function useDashboard(year: number) {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/seasons/${year}/dashboard`)
        if (!res.ok) throw new Error('Failed to load dashboard')
        const dashboardData = await res.json()
        setData(dashboardData)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboard()
  }, [year])

  return { data, isLoading, error }
}