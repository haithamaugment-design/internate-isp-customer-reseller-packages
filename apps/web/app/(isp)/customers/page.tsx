"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { formatCents } from "@/lib/format";

interface Customer {
  id: string;
  name: string;
  phone: string;
  status: string;
  wifiSsid: string | null;
  router?: { id: string; name: string } | null;
  subscription?: {
    package?: { name: string; speedMbps: number; priceCents: number; currency: string } | null;
    startedAt: string;
    renewsAt: string | null;
  } | null;
}

export default function CustomersPage() {
  const { data, loading, error, reload } = useApi<Customer[]>("/customers");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);

  const customers = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.router?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, search, statusFilter]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const activeCount = customers.filter((c) => c.status === "ACTIVE").length;
  const suspendedCount = customers.filter((c) => c.status === "SUSPENDED").length;

  async function updateStatus(status: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await api.patch(`/customers/${selected.id}`, { status });
      setSelected(null);
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customers across all resellers · ${activeCount} active · ${suspendedCount} suspended`}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Field
            label=""
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or router…"
          />
        </div>
        <select
          className="h-[44px] px-3 rounded-md bg-white/70 border border-white/60 text-callout text-text-primary outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState label={search || statusFilter ? "No customers match your filters" : "No customers yet"} />
      ) : (
        <Card className="p-1">
          {filtered.map((c, i) => (
            <div key={c.id} className={i > 0 ? "hairline" : ""}>
              <ListRow
                title={c.name}
                subtitle={`${c.phone} · ${c.subscription?.package?.name ?? "No package"} · ${c.router?.name ?? "No router"}`}
                leading={
                  <div className="w-10 h-10 rounded-full bg-[rgba(64,200,224,0.15)] text-accent-teal flex items-center justify-center">
                    <Icon name="users" size={20} />
                  </div>
                }
                trailing={
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    <button
                      onClick={() => setSelected(c)}
                      className="text-text-tertiary hover:text-accent-blue"
                      aria-label="View details"
                    >
                      <Icon name="chevronRight" size={20} />
                    </button>
                  </div>
                }
                onClick={() => setSelected(c)}
              />
            </div>
          ))}
        </Card>
      )}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? "Customer"}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <StatusBadge status={selected.status} />
            </div>

            <div className="space-y-2">
              <div className="glass rounded-lg p-3">
                <p className="text-caption text-text-tertiary">Phone</p>
                <p className="text-body font-semibold">{selected.phone}</p>
              </div>
              <div className="glass rounded-lg p-3">
                <p className="text-caption text-text-tertiary">Router</p>
                <p className="text-body font-semibold">{selected.router?.name ?? "—"}</p>
              </div>
              <div className="glass rounded-lg p-3">
                <p className="text-caption text-text-tertiary">Package</p>
                <p className="text-body font-semibold">
                  {selected.subscription?.package?.name ?? "No package"}
                </p>
                {selected.subscription?.package && (
                  <p className="text-footnote text-text-secondary">
                    {selected.subscription.package.speedMbps} Mbps ·{" "}
                    {formatCents(selected.subscription.package.priceCents, selected.subscription.package.currency)}/mo
                  </p>
                )}
              </div>
              <div className="glass rounded-lg p-3">
                <p className="text-caption text-text-tertiary">WiFi SSID</p>
                <p className="text-body font-semibold">{selected.wifiSsid ?? "—"}</p>
              </div>
            </div>

            <div className="space-y-2">
              {selected.status !== "ACTIVE" && (
                <Button fullWidth onClick={() => updateStatus("ACTIVE")} disabled={busy}>
                  Reactivate customer
                </Button>
              )}
              {selected.status === "ACTIVE" && (
                <Button fullWidth variant="destructive" onClick={() => updateStatus("SUSPENDED")} disabled={busy}>
                  Suspend customer
                </Button>
              )}
              <Button fullWidth variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
