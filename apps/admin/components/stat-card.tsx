"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type StatCardProps = {
  label: string;
  /** Pre-formatted display value (BRL, number, percent). */
  value: string | undefined;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  hint?: string;
  highlight?: boolean;
};

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
  highlight,
}: StatCardProps) {
  const body = (
    <Card className={highlight ? "border-primary/50" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {value === undefined ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}
