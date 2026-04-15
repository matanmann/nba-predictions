import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import GroupsClient from '@/components/groups/GroupsClient'

export default async function GroupsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/auth/sign-in')

  return <GroupsClient />
}