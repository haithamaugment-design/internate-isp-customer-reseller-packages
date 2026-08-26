import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

const items = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/map", label: "Network Map", icon: "location" },
  { href: "/admin/isps", label: "ISPs", icon: "router" },
  { href: "/admin/blog", label: "Blog", icon: "dashboard" },
  { href: "/admin/products", label: "Products", icon: "dashboard" },
  { href: "/settings", label: "Settings", icon: "dashboard" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell items={items} accent="#0A84FF" brand="NetMaster" allowedRoles={["PLATFORM_OWNER"]}>
      {children}
    </AppShell>
  );
}
