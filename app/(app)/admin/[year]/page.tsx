import AdminClient from '@/components/admin/AdminClient'

export default function Page({ params }: { params: { year: string } }) {
  return <AdminClient year={params.year} />
}