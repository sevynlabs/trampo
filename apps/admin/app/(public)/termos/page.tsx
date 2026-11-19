import type { Metadata } from "next";
import { TERMS_SECTIONS } from "@trampo/contracts";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Termos de Uso · Trampo" };

export default function TermsPage() {
  return <LegalPage title="Termos de Uso" sections={TERMS_SECTIONS} />;
}
