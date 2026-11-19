"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { UsersList } from "@/features/users/components/users-list";

export default function UsersPage() {
  return (
    <Suspense fallback={<LoadingState rows={8} />}>
      <UsersList />
    </Suspense>
  );
}
