import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function Page({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return <DashboardClient year={year} />;
}
