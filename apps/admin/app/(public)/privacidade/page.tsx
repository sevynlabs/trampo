import type { Metadata } from "next";
import { PRIVACY_SECTIONS } from "@trampo/contracts";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Política de Privacidade · Trampo" };

export default function PrivacyPage() {
  return <LegalPage title="Política de Privacidade" sections={PRIVACY_SECTIONS} />;
}
