"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/lib/useApi";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { formatCents } from "@/lib/format";
import { BarChart } from "@/components/charts/BarChart";

interface Customer {
  id: string;
  name: string;
  phone: string;
  status: string;
  subscription?: {
    package?: { name: string; priceCents: number; currency: string; speedMbps: number } | null;
    startedAt: string;
    renewsAt: string | null;
  } | null;
}

interface Earning {
  id: string;
  name: string;
  activeCustomers: number;
  monthlyRevenueCents: number;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => String(row[h] ?? "").replace(/"/g, '""')).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EarningsPage() {
  const customers = useApi<Customer[]>("/customers");
  const earnings = useApi<Earning[]>("/reports/earnings");
  const [search, setSearch] = useState("");

  const allCustomers = useMemo(() => customers.data ?? [], [customers.data]);
  const myEarning = useMemo(() => (earnings.data ?? [])[0], [earnings.data]);

  const activeCustomers = useMemo(() => allCustomers.filter((c) => c.status === "ACTIVE"), [allCustomers]);
  const suspendedCustomers = useMemo(() => allCustomers.filter((c) => c.status === "SUSPENDED"), [allCustomers]);

  // Revenue per package
  const revenueByPackage = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const c of activeCustomers) {
      const pkg = c.subscription?.package;
      if (!pkg) continue;
      const key = pkg.name;
      const entry = map.get(key) ?? { name: pkg.name, count: 0, revenue: 0 };
      entry.count++;
      entry.revenue += pkg.priceCents;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [activeCustomers]);

  const filtered = useMemo(() => {
    if (!search) return allCustomers;
    const q = search.toLowerCase();
    return allCustomers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [allCustomers, search]);

  if (customers.loading || earnings.loading) return <LoadingState />;
  if (customers.error || earnings.error)
    return <ErrorState message={customers.error ?? earnings.error ?? "Error"} />;

  const totalMRR = myEarning?.monthlyRevenueCents ?? 0;
  const avgPerCustomer = activeCustomers.length > 0 ? Math.round(totalMRR / activeCustomers.length) : 0;

  return (
    <div>
      <PageHeader
        title="Earnings"
        subtitle="Revenue tracking and customer breakdown"
        action={
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(
                "earnings.csv",
                allCustomers.map((c) => ({
                  name: c.name,
                  phone: c.phone,
                  status: c.status,
                  package: c.subscription?.package?.name ?? "No package",
                  monthlyRevenue: c.subscription?.package?.priceCents ?? 0,
                  renewsAt: c.subscription?.renewsAt ?? "",
                })),
              )
            }
          >
            <Icon name="chart" size={16} />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Card className="p-4">
          <p className="text-caption text-text-tertiary">Monthly Revenue</p>
          <p className="text-title-1 font-bold text-accent-green">{formatCents(totalMRR)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-caption text-text-tertiary">Active Customers</p>
          <p className="text-title-1 font-bold">{activeCustomers.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-caption text-text-tertiary">Avg per Customer</p>
          <p className="text-title-1 font-bold">{formatCents(avgPerCustomer)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-caption text-text-tertiary">Suspended</p>
          <p className="text-title-1 font-bold text-accent-red">{suspendedCustomers.length}</p>
        </Card>
      </div>

      {/* Revenue by Package Chart */}
      {revenueByPackage.length > 0 && (
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="chart" size={18} className="text-accent-green" />
            <h2 className="text-title-3 font-semibold">Revenue by Package</h2>
          </div>
          <BarChart
            accent="#30D158"
            data={revenueByPackage.map((p) => ({ label: p.name, value: p.revenue }))}
            formatValue={(v) => formatCents(v)}
          />
          <div className="mt-3 space-y-1">
            {revenueByPackage.map((p) => (
              <div key={p.name} className="flex justify-between text-footnote text-text-secondary">
                <span>{p.name} ({p.count} customers)</span>
                <span className="font-semibold">{formatCents(p.revenue)}/mo</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Customer List */}
      <Card className="p-5 mb-4">
        <input
          type="text"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-[44px] px-4 rounded-md bg-white/70 border border-white/60 text-callout text-text-primary outline-none focus:border-accent-blue focus:ring-4 focus:ring-accent-blue/15 mb-4"
        />

        {filtered.length === 0 ? (
          <EmptyState label={search ? "No customers match" : "No customers yet"} />
        ) : (
          <div className="space-y-0">
            {filtered.map((c, i) => (
              <div key={c.id} className={i > 0 ? "hairline" : ""}>
                <ListRow
                  title={c.name}
                  subtitle={`${c.phone} · ${c.subscription?.package?.name ?? "No package"}`}
                  leading={
                    <div className="w-10 h-10 rounded-full bg-[rgba(48,209,88,0.15)] text-accent-green flex items-center justify-center">
                      <Icon name="users" size={20} />
                    </div>
                  }
                  trailing={
                    <div className="text-right">
                      <p className="text-body font-semibold text-accent-green">
                        {c.subscription?.package ? formatCents(c.subscription.package.priceCents) : "—"}
                      </p>
                      <StatusBadge status={c.status} />
                    </div>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
