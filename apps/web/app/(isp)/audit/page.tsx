"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/lib/useApi";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
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

export default function AuditPage() {
  const { data, loading, error, reload } = useApi<AuditLog[]>("/reports/audit-logs");
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const logs = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (entityFilter && l.entityType !== entityFilter) return false;
      if (actionFilter && l.action !== actionFilter) return false;
      return true;
    });
  }, [logs, entityFilter, actionFilter]);

  const entityTypes = useMemo(() => [...new Set(logs.map((l) => l.entityType))].sort(), [logs]);
  const actions = useMemo(() => [...new Set(logs.map((l) => l.action))].sort(), [logs]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle={`${logs.length} recorded actions`}
        action={
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(
                "audit-logs.csv",
                filtered.map((l) => ({
                  action: l.action,
                  entityType: l.entityType,
                  entityId: l.entityId,
                  createdAt: l.createdAt,
                })),
              )
            }
          >
            <Icon name="chart" size={16} />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          className="h-[44px] px-3 rounded-md bg-white/70 border border-white/60 text-callout text-text-primary outline-none"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
        >
          <option value="">All entities</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="h-[44px] px-3 rounded-md bg-white/70 border border-white/60 text-callout text-text-primary outline-none"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState label="No audit logs match" />
      ) : (
        <Card className="p-1">
          {filtered.map((log, i) => (
            <div key={log.id} className={i > 0 ? "hairline" : ""}>
              <ListRow
                title={`${log.action} ${log.entityType}`}
                subtitle={`ID: ${log.entityId.slice(0, 8)}… · ${new Date(log.createdAt).toLocaleString()}`}
                leading={
                  <div className="w-10 h-10 rounded-full bg-[rgba(255,159,10,0.15)] text-accent-orange flex items-center justify-center">
                    <Icon name="chart" size={20} />
                  </div>
                }
              />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
