import { useState, useEffect } from 'react'
import { isLocked, secondsUntilLock } from '@/lib/lock'

export function useLockStatus(year: number) {
  const [lockStatus, setLockStatus] = useState<{
    locked: boolean
    secondsUntilLock: number
  }>({ locked: false, secondsUntilLock: 0 })

  useEffect(() => {
    const updateStatus = () => {
      setLockStatus({
        locked: isLocked(year),
        secondsUntilLock: secondsUntilLock(year),
      })
    }

    updateStatus()

    // Update every second if not locked
    const interval = setInterval(() => {
      if (!isLocked(year)) {
        updateStatus()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [year])

  return lockStatus
}