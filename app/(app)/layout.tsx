"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/predict/2025"
              className="text-sm font-medium text-gray-900"
            >
              🏀 NBA 2025
            </Link>
            <Link
              href="/dashboard/2025"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Dashboard
            </Link>
          </div>
          <UserButton signInUrl="/sign-in" />
        </nav>
        <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
      </div>
    </QueryClientProvider>
  );
}