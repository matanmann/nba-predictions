import AdminClient from "@/components/admin/AdminClient";

export default async function Page({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return <AdminClient year={+year} />;
}
