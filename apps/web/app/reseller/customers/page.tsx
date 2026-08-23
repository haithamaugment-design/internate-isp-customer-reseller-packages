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

interface Customer {
  id: string;
  name: string;
  phone: string;
  status: string;
  router?: { name: string };
  subscription?: { package?: { name: string } } | null;
}

interface Router {
  id: string;
  name: string;
}

interface Pkg {
  id: string;
  name: string;
}

export default function CustomersPage() {
  const { data, loading, error, reload } = useApi<Customer[]>("/customers");
  const routers = useApi<Router[]>("/routers");
  const packages = useApi<Pkg[]>("/packages");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", routerId: "", packageId: "", status: "ACTIVE" });
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const customers = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.router?.name?.toLowerCase().includes(q),
    );
  }, [customers, search]);

  if (loading || routers.loading || packages.loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  async function createCustomer() {
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        ...(form.email ? { email: form.email } : {}),
        ...(form.password ? { password: form.password } : {}),
        routerId: form.routerId,
        ...(form.packageId ? { packageId: form.packageId } : {}),
      };
      if (editingId) await api.patch(`/customers/${editingId}`, { name: form.name, phone: form.phone, routerId: form.routerId, status: form.status });
      else {
        const result = await api.post<{ credentials?: { email: string; password: string } }>("/customers", payload);
        setCredentials(result.credentials ?? null);
      }
      setOpen(false);
      setEditingId(null);
      setForm({ name: "", phone: "", email: "", password: "", routerId: "", packageId: "", status: "ACTIVE" });
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Assign packages and routers to end customers"
        action={
          <Button onClick={() => setOpen(true)}>
            <Icon name="plus" size={18} />
            <span className="hidden sm:inline">New Customer</span>
          </Button>
        }
      />

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, or router…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-[44px] px-4 rounded-md bg-white/70 border border-white/60 text-callout text-text-primary outline-none focus:border-accent-blue focus:ring-4 focus:ring-accent-blue/15"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState label={search ? "No customers match your search" : "No customers yet"} />
      ) : (
        <Card className="p-1">
          {filtered.map((c, i) => (
            <div key={c.id} className={i > 0 ? "hairline" : ""}>
              <ListRow
                title={c.name}
                subtitle={`${c.phone} · ${c.subscription?.package?.name ?? "No package"} · ${c.router?.name ?? "—"}`}
                leading={
                  <div className="w-10 h-10 rounded-full bg-[rgba(10,132,255,0.15)] text-accent-blue flex items-center justify-center">
                    <Icon name="users" size={20} />
                  </div>
                }
                trailing={
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    <Button variant="ghost" size="md" onClick={() => {
                      setEditingId(c.id);
                      setForm({ name: c.name, phone: c.phone, email: "", password: "", routerId: "", packageId: "", status: c.status });
                      setOpen(true);
                    }}>Edit</Button>
                  </div>
                }
              />
            </div>
          ))}
        </Card>
      )}

      {credentials && (
        <Card className="mt-4 p-4 border border-accent-green/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-body font-semibold">Customer login created</p>
              <p className="text-footnote text-text-secondary mt-1">Share these temporary credentials with the customer.</p>
              <p className="text-footnote mt-3">Email: <span className="font-semibold">{credentials.email}</span></p>
              <p className="text-footnote">Password: <span className="font-semibold">{credentials.password}</span></p>
            </div>
            <Button variant="secondary" onClick={() => setCredentials(null)}>Dismiss</Button>
          </div>
        </Card>
      )}

      <Sheet open={open} onClose={() => { setOpen(false); setEditingId(null); }} title={editingId ? "Edit Customer" : "New Customer"}>
        <div className="space-y-4">
          <Field label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Mushi" />
          <Field label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="255712000000" />
          {!editingId && <>
            <Field label="Customer email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="customer@example.com" />
            <Field label="Temporary password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" />
          </>}
          <div>
            <label className="block text-footnote font-medium text-text-secondary mb-1.5">Router</label>
            <select
              className="w-full h-[44px] px-4 rounded-md bg-white/60 border border-white/60 text-body outline-none focus:focus-ring"
              value={form.routerId}
              onChange={(e) => setForm({ ...form, routerId: e.target.value })}
            >
              <option value="">Select router</option>
              {(routers.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-footnote font-medium text-text-secondary mb-1.5">Package</label>
            <select
              className="w-full h-[44px] px-4 rounded-md bg-white/60 border border-white/60 text-body outline-none focus:focus-ring"
              value={form.packageId}
              onChange={(e) => setForm({ ...form, packageId: e.target.value })}
            >
              <option value="">No package</option>
              {(packages.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {editingId && <div>
            <label className="block text-footnote font-medium text-text-secondary mb-1.5">Status</label>
            <select className="w-full h-[44px] px-4 rounded-md bg-white/60 border border-white/60 text-body outline-none" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="PENDING">Pending</option>
            </select>
          </div>}
          <Button fullWidth onClick={createCustomer} disabled={busy || !form.name || !form.phone || !form.routerId}>
            {editingId ? "Save Customer" : "Create Customer"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
