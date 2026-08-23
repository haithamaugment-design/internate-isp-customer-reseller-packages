"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  metadata?: any;
}

interface Plan {
  id: string;
  name: string;
  status: string;
  monthlyProfitTarget: number;
  monthlyRevenueTarget: number;
  totalCosts: number;
  costs: any;
  locationPlans: any[];
}

export default function AIBusinessPartnerPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await api.get<any[]>("/business-ai/conversations");
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  const startNewConversation = async () => {
    setLoading(true);
    try {
      const data = await api.post<any>("/business-ai/conversations", {
        name: `Business Plan - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
      });

      const newConv = {
        id: data.plan.id,
        name: data.plan.name,
        status: "DRAFT",
        createdAt: data.plan.createdAt,
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversation(data.plan.id);
      setMessages([
        { id: "welcome", role: "assistant", content: data.message, metadata: { options: data.options } },
      ]);
    } catch (err) {
      console.error("Failed to start conversation:", err);
    }
    setLoading(false);
  };

  const loadConversation = async (planId: string) => {
    try {
      const data = await api.get<any>(`/business-ai/conversations/${planId}`);
      setActiveConversation(planId);
      setCurrentPlan(data.plan);
      setMessages(data.messages);
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const sendMessage = async (message: string) => {
    if (!activeConversation || !message.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await api.post<any>("/business-ai/chat", {
        conversationId: activeConversation, message,
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        metadata: data.metadata,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Refresh plan data if plan was generated
      if (data.type === "plan" && data.metadata) {
        setCurrentPlan((prev) => ({
          ...prev!,
          monthlyProfitTarget: data.metadata.profitTarget,
          monthlyRevenueTarget: data.metadata.revenueTarget,
          totalCosts: data.metadata.totalCosts,
          costs: data.metadata.costs,
          locationPlans: data.metadata.locationPlans,
        }));
      }

      // Handle apply action
      if (data.metadata?.action === "apply_plan" && activeConversation) {
        await applyPlan(activeConversation);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => [
        ...prev,
        { id: "error", role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    }
    setLoading(false);
  };

  const applyPlan = async (planId: string) => {
    try {        const data = await api.post<any>(`/business-ai/plans/${planId}/apply`);
      setMessages((prev) => [
        ...prev,
        { id: "applied", role: "assistant", content: data.message },
      ]);
      loadConversations();
    } catch (err) {
      console.error("Failed to apply plan:", err);
    }
  };

  const deleteConversation = async (planId: string) => {
    try {        await api.del(`/business-ai/conversations/${planId}`);
      setConversations((prev) => prev.filter((c) => c.id !== planId));
      if (activeConversation === planId) {
        setActiveConversation(null);
        setMessages([]);
        setCurrentPlan(null);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const formatMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\n/g, "<br/>");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[var(--bg-base)] rounded-xl overflow-hidden border border-[var(--border-subtle)]">
      {/* Sidebar — Conversation List */}
      {showSidebar && (
        <div className="w-72 border-r border-[var(--border-subtle)] flex flex-col bg-[var(--bg-elevated)]">
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <button
              onClick={startNewConversation}
              className="w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #0066FF, #00C2FF)",
                color: "white",
              }}
              disabled={loading}
            >
              + Start New Plan
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                <div className="text-3xl mb-2">🤖</div>
                Start your first AI business plan
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                    activeConversation === conv.id
                      ? "bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30"
                      : "hover:bg-[var(--bg-surface)] border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {conv.name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        conv.status === "ACTIVE"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : conv.status === "COMPLETED"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {conv.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {new Date(conv.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-muted)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">
                🤖 AI Business Partner
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Your AI-powered profit planner and business advisor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/reseller/ai-business/insights")}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-all"
            >
              📊 Insights
            </button>
            <button
              onClick={() => router.push("/reseller/ai-business/automation")}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-all"
            >
              ⚙️ Automation
            </button>
            {currentPlan && currentPlan.status !== "ACTIVE" && currentPlan.monthlyProfitTarget > 0 && (
              <button
                onClick={() => applyPlan(currentPlan.id)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: "linear-gradient(135deg, #00C853, #00E676)",
                  color: "white",
                }}
              >
                ✅ Apply Plan
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                Welcome to AI Business Partner
              </h2>
              <p className="text-[var(--text-muted)] max-w-md mb-6">
                I&apos;ll help you create a profit plan for your internet business. Tell me your monthly
                profit goal and I&apos;ll calculate the optimal pricing, packages, and voucher strategy.
              </p>
              <button
                onClick={startNewConversation}
                className="px-6 py-3 rounded-lg font-semibold text-sm"
                style={{
                  background: "linear-gradient(135deg, #0066FF, #00C2FF)",
                  color: "white",
                }}
              >
                Start Planning →
              </button>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                    msg.role === "user"
                      ? "bg-[var(--accent-primary)] text-white"
                      : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-[10px]">
                        🤖
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-muted)]">
                        AI Business Partner
                      </span>
                    </div>
                  )}
                  <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                  />
                  {/* Option buttons */}
                  {msg.metadata?.options && msg.metadata.options.length > 0 && msg.role === "assistant" && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {msg.metadata.options.map((opt: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(opt)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-all"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Plan visualization */}
                  {msg.metadata?.plan && (
                    <PlanVisualization plan={msg.metadata.plan} />
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-[10px]">
                    🤖
                  </div>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {activeConversation && (
          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <div className="flex gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Type your message... (e.g., I want to make 100,000 TZS profit)"
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] text-sm"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="px-5 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                style={{
                  background: input.trim() ? "linear-gradient(135deg, #0066FF, #00C2FF)" : "var(--bg-surface)",
                  color: input.trim() ? "white" : "var(--text-muted)",
                }}
              >
                Send →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanVisualization({ plan }: { plan: any }) {
  return (
    <div className="mt-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📊</span>
        <span className="text-sm font-bold text-[var(--text-primary)]">Business Plan Summary</span>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="text-xs text-emerald-400 font-medium">Profit Target</div>
          <div className="text-lg font-bold text-emerald-400">
            {(plan.profitTarget || 0).toLocaleString()} TZS
          </div>
        </div>
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="text-xs text-blue-400 font-medium">Revenue Needed</div>
          <div className="text-lg font-bold text-blue-400">
            {(plan.revenueTarget || 0).toLocaleString()} TZS
          </div>
        </div>
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="text-xs text-red-400 font-medium">Total Costs</div>
          <div className="text-lg font-bold text-red-400">
            {(plan.totalCosts || 0).toLocaleString()} TZS
          </div>
        </div>
      </div>

      {/* Location Plans */}
      {plan.locationPlans && plan.locationPlans.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Location Plans
          </div>
          {plan.locationPlans.map((loc: any, i: number) => (
            <div key={i} className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  📍 {loc.name}
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  {loc.monthlyRevenueTarget?.toLocaleString()} TZS/mo
                </span>
              </div>
              <div className="space-y-1">
                {loc.packages?.map((pkg: any, j: number) => (
                  <div key={j} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">
                      {pkg.name} ({pkg.duration})
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {pkg.price?.toLocaleString()} TZS
                    </span>
                    <span className="text-[var(--text-muted)]">
                      Target: {pkg.targetSalesPerDay}/day
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
