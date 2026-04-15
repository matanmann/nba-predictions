import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import GroupClient from '@/components/groups/GroupClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function GroupPage({ params }: PageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/auth/sign-in')

  const { id } = await params

  return <GroupClient groupId={id} />
}