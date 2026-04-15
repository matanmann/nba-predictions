import PredictClient from "@/components/predict/PredictClient";

export default async function Page({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return <PredictClient year={year} />;
}
