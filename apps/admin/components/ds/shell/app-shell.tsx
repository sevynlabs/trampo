"use client";

import { Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * Global admin layout: fixed dark sidebar (desktop) / drawer (mobile),
 * sticky topbar, scrollable content area capped for readability.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar reads the URL (period) → needs a Suspense boundary */}
          <Suspense fallback={<div className="h-16 border-b bg-card" />}>
            <Topbar />
          </Suspense>
          <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1440px] space-y-6">{children}</div>
          </main>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
