import PredictClient from "@/components/predict/PredictClient";

export default async function PredictPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  return <PredictClient year={+year} />;
}