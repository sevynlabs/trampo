import { TRPCProvider } from "@/lib/trpc-provider";
import { AppShell } from "@/components/ds";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <AppShell>{children}</AppShell>
    </TRPCProvider>
  );
}
