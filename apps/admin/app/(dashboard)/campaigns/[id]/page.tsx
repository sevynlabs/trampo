import { CampaignDetail } from "@/features/campaigns/components/campaign-detail";

export const metadata = { title: "Campanha · Trampo Admin" };

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignDetail id={id} />;
}
