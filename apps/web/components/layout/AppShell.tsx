"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileTabBar, MobileTopBar } from "./MobileNav";
import { getStoredUser, dashboardPathFor } from "@/lib/auth";
import type { NavItem } from "./NavLink";

interface AppShellProps {
  items: NavItem[];
  accent: string;
  brand?: string;
  allowedRoles: string[];
  headerActions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ items, accent, brand = "NetMaster", allowedRoles, headerActions, children }: AppShellProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ role: string; name: string } | null>(null);
  const rolesSet = useMemo(() => new Set(allowedRoles), [allowedRoles.join(",")]);

  useEffect(() => {
    setMounted(true);
    const u = getStoredUser();
    setUser(u);
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    if (!rolesSet.has(user.role)) {
      router.replace(dashboardPathFor(user.role));
    }
  }, [mounted, user, rolesSet, router]);

  const roleLabel = user?.role?.toLowerCase().replace("_", " ") ?? "";

  return (
    <div className="min-h-screen">
      {mounted && user && rolesSet.has(user.role) && (
        <>
          <Sidebar brand={brand} items={items} accent={accent} userName={user.name} userRole={roleLabel} headerActions={headerActions} />
          <MobileTopBar brand={brand} accent={accent} userName={user.name} headerActions={headerActions} />
        </>
      )}
      <main className={mounted && user && rolesSet.has(user.role) ? "lg:ml-[260px] px-4 md:px-8 py-6 md:py-8 pb-24 lg:pb-8 max-w-6xl" : "px-4 md:px-8 py-6 md:py-8"}>
        {children}
      </main>
      {mounted && user && rolesSet.has(user.role) && (
        <MobileTabBar items={items} accent={accent} />
      )}
    </div>
  );
}
