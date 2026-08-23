"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Insight {
  type: "warning" | "opportunity" | "achievement" | "suggestion";
  title: string;
  message: string;
  action?: string;
  priority: "high" | "medium" | "low";
}

interface DemandPrediction {
  locationName: string;
  predictedDailySales: number;
  predictedRevenue: number;
  confidence: number;
  peakHours: number[];
  recommendedPrice: number;
  trend: "growing" | "stable" | "declining";
}

interface ProgressReport {
  planName: string;
  daysActive: number;
  totalDaysInMonth: number;
  actualRevenue: number;
  targetRevenue: number;
  progressPercent: number;
  onTrack: boolean;
  dailyAverage: number;
  requiredDaily: number;
  projectedMonthEnd: number;
  locationBreakdown: Array<{
    name: string;
    actual: number;
    target: number;
    percent: number;
  }>;
}

export default function AIInsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [predictions, setPredictions] = useState<DemandPrediction[]>([]);
  const [progress, setProgress] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "predictions" | "progress">("overview");

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const [insightsRes, predictionsRes, progressRes] = await Promise.all([
        api.get<{ insights: Insight[] }>("/business-ai/insights").catch(() => ({ insights: [] })),
        api.get<DemandPrediction[]>("/business-ai/predictions").catch(() => []),
        api.get<ProgressReport>("/business-ai/progress").catch(() => null),
      ]);
      setInsights(insightsRes?.insights || []);
      setPredictions(predictionsRes || []);
      setProgress(progressRes || null);
    } catch (err) {
      console.error("Failed to load insights:", err);
    }
    setLoading(false);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "warning": return "⚠️";
      case "opportunity": return "🌍";
      case "achievement": return "🎉";
      case "suggestion": return "💡";
      default: return "📊";
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case "warning": return "border-amber-500/30 bg-amber-500/5";
      case "opportunity": return "border-blue-500/30 bg-blue-500/5";
      case "achievement": return "border-emerald-500/30 bg-emerald-500/5";
      case "suggestion": return "border-purple-500/30 bg-purple-500/5";
      default: return "border-[var(--border-subtle)] bg-[var(--bg-elevated)]";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "growing": return "📈";
      case "declining": return "📉";
      default: return "➡️";
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "growing": return "text-emerald-400";
      case "declining": return "text-red-400";
      default: return "text-[var(--text-muted)]";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-[var(--text-muted)]">Analyzing your business data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">🧠 AI Business Insights</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Smart analysis of your internet business performance</p>
        </div>
        <button onClick={loadInsights} className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-all">🔄 Refresh</button>
      </div>

      <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-2">
        {[
          { key: "overview", label: "📊 Overview" },
          { key: "predictions", label: "📈 Demand Predictions" },
          { key: "progress", label: "🎯 Progress Tracker" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-4">
          {insights.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Insights Yet</h3>
              <p className="text-[var(--text-muted)] max-w-md mx-auto">Start selling vouchers to generate data. The AI will analyze your sales patterns and provide personalized insights.</p>
            </div>
          ) : (
            insights.map((insight, i) => (
              <div key={i} className={`p-5 rounded-xl border ${getInsightColor(insight.type)} transition-all hover:scale-[1.01]`}>
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{getInsightIcon(insight.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-[var(--text-primary)]">{insight.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${insight.priority === "high" ? "bg-red-500/20 text-red-400" : insight.priority === "medium" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
                        {insight.priority}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{insight.message}</p>
                    {insight.action && <p className="text-xs text-[var(--accent-primary)] mt-2 font-medium">💡 {insight.action}</p>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "predictions" && (
        <div className="space-y-4">
          {predictions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📈</div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Predictions Yet</h3>
              <p className="text-[var(--text-muted)] max-w-md mx-auto">Add locations and start selling to get demand predictions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {predictions.map((pred, i) => (
                <div key={i} className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[var(--text-primary)]">📍 {pred.locationName}</h3>
                    <span className={`text-sm font-semibold ${getTrendColor(pred.trend)}`}>{getTrendIcon(pred.trend)} {pred.trend}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-[var(--bg-surface)]">
                      <div className="text-xs text-[var(--text-muted)]">Daily Sales</div>
                      <div className="text-lg font-bold text-[var(--text-primary)]">{pred.predictedDailySales}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-surface)]">
                      <div className="text-xs text-[var(--text-muted)]">Daily Revenue</div>
                      <div className="text-lg font-bold text-emerald-400">{pred.predictedRevenue.toLocaleString()} TZS</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "progress" && (
        <div className="space-y-4">
          {!progress ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎯</div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Active Plan</h3>
              <p className="text-[var(--text-muted)] max-w-md mx-auto">Create and activate a business plan to track your progress.</p>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-lg">{progress.planName}</h3>
                  <p className="text-sm text-[var(--text-muted)]">Day {progress.daysActive} of {progress.totalDaysInMonth}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${progress.onTrack ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                  {progress.onTrack ? "✅ On Track" : "⚠️ Behind"}
                </div>
              </div>
              <div className="mb-4">
                <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                  <span>{progress.progressPercent}% complete</span>
                  <span>{progress.actualRevenue.toLocaleString()} / {progress.targetRevenue.toLocaleString()} TZS</span>
                </div>
                <div className="h-3 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, progress.progressPercent)}%`, background: progress.onTrack ? "linear-gradient(90deg, #00C853, #00E676)" : "linear-gradient(90deg, #FF453A, #FF6B62)" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
