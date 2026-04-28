import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runFullSync, recalculateAllScores } from '@/lib/nba-sync'

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { year } = await request.json()

  if (!year) {
    return NextResponse.json({ error: 'Year is required' }, { status: 400 })
  }

  const season = await prisma.season.findUnique({
    where: { year: +year },
  })
  if (!season) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 })
  }

  try {
    const syncResult = await runFullSync(+year, season.id)
    const recalcCount = await recalculateAllScores(season.id)
    return NextResponse.json({ 
      success: true, 
      ...syncResult,
      recalculated: recalcCount 
    })
  } catch (err: any) {
    console.error('[admin/sync] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}