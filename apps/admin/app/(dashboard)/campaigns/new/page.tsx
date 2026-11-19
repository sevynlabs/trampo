import { PageHeader } from "@/components/ds/page-header";
import { CampaignForm } from "@/features/campaigns/components/campaign-form";

export const metadata = { title: "Nova campanha · Trampo Admin" };

export default function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "Campanhas", href: "/campaigns" }, { label: "Nova campanha" }]}
        title="Nova campanha"
        description="Defina o canal e o público, escreva a mensagem e crie o rascunho."
      />
      <CampaignForm />
    </div>
  );
}
