import DashboardClient from '@/components/dashboard/DashboardClient'

export default function Page({ params }: { params: { year: string } }) {
  return <DashboardClient year={params.year} />
}