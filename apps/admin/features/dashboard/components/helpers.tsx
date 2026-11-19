import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ds";
import { formatDayLabel } from "@/lib/format";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-06-22" → label according to the series granularity. */
export function bucketLabel(bucket: string, granularity: "day" | "week" | "month"): string {
  if (granularity === "month") {
    const [y, m] = bucket.split("-");
    return `${MONTHS[Number(m) - 1] ?? m}/${y.slice(2)}`;
  }
  return formatDayLabel(bucket);
}

/** Loading / error wrapper for a chart area inside a card. */
export function ChartBody({
  loading,
  error,
  onRetry,
  height = 220,
  children,
}: {
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  height?: number;
  children: React.ReactNode;
}) {
  if (loading) return <Skeleton className="w-full rounded-xl" style={{ height }} />;
  if (error) return <ErrorState description={error} onRetry={onRetry} className="py-8" />;
  return <>{children}</>;
}
