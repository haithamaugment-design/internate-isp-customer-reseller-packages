"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface PricingAdjustment {
  locationName: string;
  packageName: string;
  currentPrice: number;
  suggestedPrice: number;
  reason: string;
  expectedImpact: string;
  confidence: number;
}

interface VoucherBatch {
  locationName: string;
  packageName: string;
  count: number;
  durationHours: number;
  expiresAt: string;
  price: number;
}

interface ExpansionROI {
  locationName: string;
  estimatedMonthlyRevenue: number;
  estimatedMonthlyCosts: number;
  estimatedMonthlyProfit: number;
  paybackDays: number;
  recommendedRouter: { name: string; price: number; features: string[] };
  riskLevel: "low" | "medium" | "high";
  reasoning: string;
}

interface LoadBalance {
  locationName: string;
  currentLoad: number;
  maxCapacity: number;
  suggestedAction: string;
  reasoning: string;
}

export default function AIAutomationPage() {
  const [activeTab, setActiveTab] = useState<"pricing" | "vouchers" | "expansion" | "loadbalance">("pricing");
  const [pricing, setPricing] = useState<PricingAdjustment[]>([]);
  const [vouchers, setVouchers] = useState<VoucherBatch[]>([]);
  const [roi, setRoi] = useState<ExpansionROI | null>(null);
  const [loadBalance, setLoadBalance] = useState<LoadBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expansionName, setExpansionName] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, v, lb] = await Promise.all([
        api.get<PricingAdjustment[]>("/business-ai/auto-pricing").catch(() => []),
        api.post<VoucherBatch[]>("/business-ai/generate-vouchers", { daysAhead: 7 }).catch(() => []),
        api.get<LoadBalance[]>("/business-ai/load-balancing").catch(() => []),
      ]);
      setPricing(p || []);
      setVouchers(v || []);
      setLoadBalance(lb || []);
    } catch (err) {
      console.error("Failed to load automation data:", err);
    }
    setLoading(false);
  };

  const calculateROI = async () => {
    if (!expansionName.trim()) return;
    setGenerating(true);
    try {
      const result = await api.post<ExpansionROI>("/business-ai/expansion-roi", {
        locationName: expansionName,
      });
      setRoi(result);
    } catch (err) {
      console.error("Failed to calculate ROI:", err);
    }
    setGenerating(false);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "add_router": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "promote": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "reduce_price": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "increase_price": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      default: return "text-[var(--text-muted)] bg-[var(--bg-surface)] border-[var(--border-subtle)]";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "add_router": return "🔌 Add Router";
      case "promote": return "📢 Promote";
      case "reduce_price": return "💰 Reduce Price";
      case "increase_price": return "📈 Increase Price";
      default: return "✅ Maintain";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "text-emerald-400 bg-emerald-500/10";
      case "medium": return "text-amber-400 bg-amber-500/10";
      case "high": return "text-red-400 bg-red-500/10";
      default: return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">⚙️</div>
          <p className="text-[var(--text-muted)]">Loading automation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">⚙️ AI Automation</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Auto-pricing, voucher generation, expansion planning, load balancing</p>
        </div>
        <button onClick={loadAll} className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]">🔄 Refresh</button>
      </div>

      <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-2 flex-wrap">
        {[
          { key: "pricing", label: "💰 Auto-Pricing" },
          { key: "vouchers", label: "🎫 Voucher Batches" },
          { key: "expansion", label: "🌍 Expansion ROI" },
          { key: "loadbalance", label: "⚖️ Load Balancing" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30" : "text-[var(--text-muted)] border border-transparent"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "pricing" && (
        <div className="space-y-4">
          {pricing.length === 0 ? (
            <div className="text-center py-12"><div className="text-5xl mb-4">💰</div><h3 className="text-lg font-semibold text-[var(--text-primary)]">No Pricing Suggestions Yet</h3><p className="text-[var(--text-muted)]">Start selling to get AI-powered pricing recommendations.</p></div>
          ) : (
            <div className="space-y-3">
              {pricing.map((p, i) => (
                <div key={i} className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  <div className="flex items-center justify-between mb-3">
                    <div><h3 className="font-bold text-[var(--text-primary)]">{p.packageName}</h3><p className="text-xs text-[var(--text-muted)]">{p.locationName}</p></div>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">{Math.round(p.confidence * 100)}% confidence</span>
                  </div>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="text-center"><div className="text-xs text-[var(--text-muted)]">Current</div><div className="text-lg font-bold text-[var(--text-primary)]">{p.currentPrice.toLocaleString()} TZS</div></div>
                    <div className="text-2xl text-[var(--text-muted)]">→</div>
                    <div className="text-center"><div className="text-xs text-[var(--text-muted)]">Suggested</div><div className="text-lg font-bold text-emerald-400">{p.suggestedPrice.toLocaleString()} TZS</div></div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{p.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "vouchers" && (
        <div className="space-y-4">
          {vouchers.length === 0 ? (
            <div className="text-center py-12"><div className="text-5xl mb-4">🎫</div><h3 className="text-lg font-semibold text-[var(--text-primary)]">No Voucher Batches Generated</h3><p className="text-[var(--text-muted)]">Create and activate a business plan to auto-generate vouchers.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {vouchers.map((v, i) => (
                <div key={i} className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-[var(--text-primary)] text-sm">{v.packageName}</h4>
                    <span className="text-xs text-[var(--text-muted)]">{v.locationName}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-xs text-[var(--text-muted)]">Count</div><div className="text-lg font-bold text-[var(--text-primary)]">{v.count}</div></div>
                    <div><div className="text-xs text-[var(--text-muted)]">Price</div><div className="text-lg font-bold text-emerald-400">{v.price.toLocaleString()}</div></div>
                    <div><div className="text-xs text-[var(--text-muted)]">Duration</div><div className="text-lg font-bold text-[var(--text-primary)]">{v.durationHours}h</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "expansion" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <h3 className="font-bold text-[var(--text-primary)] mb-3">🌍 Calculate ROI for New Location</h3>
            <div className="flex gap-3">
              <input value={expansionName} onChange={(e) => setExpansionName(e.target.value)} placeholder="Enter location name (e.g., Arusha Center)"
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm" />
              <button onClick={calculateROI} disabled={generating || !expansionName.trim()}
                className="px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: generating ? "var(--bg-surface)" : "linear-gradient(135deg, #0066FF, #00C2FF)" }}>
                {generating ? "Calculating..." : "Calculate ROI"}
              </button>
            </div>
          </div>
          {roi && (
            <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[var(--text-primary)] text-lg">📍 {roi.locationName}</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getRiskColor(roi.riskLevel)}`}>{roi.riskLevel} risk</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <div className="text-xs text-emerald-400">Est. Monthly Revenue</div>
                  <div className="text-xl font-bold text-emerald-400">{roi.estimatedMonthlyRevenue.toLocaleString()} TZS</div>
                </div>
                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                  <div className="text-xs text-red-400">Est. Monthly Costs</div>
                  <div className="text-xl font-bold text-red-400">{roi.estimatedMonthlyCosts.toLocaleString()} TZS</div>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
                  <div className="text-xs text-blue-400">Est. Monthly Profit</div>
                  <div className="text-xl font-bold text-blue-400">{roi.estimatedMonthlyProfit.toLocaleString()} TZS</div>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{roi.reasoning}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "loadbalance" && (
        <div className="space-y-4">
          {loadBalance.length === 0 ? (
            <div className="text-center py-12"><div className="text-5xl mb-4">⚖️</div><h3 className="text-lg font-semibold text-[var(--text-primary)]">No Locations to Balance</h3></div>
          ) : (
            <div className="space-y-3">
              {loadBalance.map((lb, i) => (
                <div key={i} className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-[var(--text-primary)]">📍 {lb.locationName}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getActionColor(lb.suggestedAction)}`}>{getActionLabel(lb.suggestedAction)}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{lb.reasoning}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
