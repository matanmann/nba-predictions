import PredictClient from "@/components/predict/PredictClient";

interface PageProps {
  params: Promise<{ year: string }>;
  searchParams: { group?: string | string[]; adminUserId?: string | string[] };
}

export default async function Page({ params, searchParams }: PageProps) {
  const { year } = await params;
  const group = Array.isArray(searchParams.group) ? searchParams.group[0] : searchParams.group;
  const adminUserId = Array.isArray(searchParams.adminUserId)
    ? searchParams.adminUserId[0]
    : searchParams.adminUserId;
  return <PredictClient year={+year} initialGroupId={group} initialAdminUserId={adminUserId} />;
}
