"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface SalesChatbotProps {
  apiBase?: string;
}

const QUICK_ACTIONS = [
  { label: "How do I start?", icon: "🚀", message: "How do I start an internet reselling business?" },
  { label: "Show me cheap routers", icon: "📡", message: "What routers can I use that cost under 100,000 TZS?" },
  { label: "Pricing plans", icon: "💰", message: "What are the pricing plans?" },
  { label: "AI Business Partner", icon: "🤖", message: "Tell me about the AI Business Partner feature" },
  { label: "OpenWRT setup", icon: "🔧", message: "Can I use TP-Link routers with OpenWRT?" },
  { label: "Success stories", icon: "📈", message: "How much money can I make as a reseller?" },
];

export default function SalesChatbot({ apiBase = "" }: SalesChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Habari! 👋 Welcome to NetMaster — your internet business partner.\n\nI'm here to help you:\n\n🚀 **Start a WiFi reselling business** with as little as 50,000 TZS\n💰 **Find the cheapest routers** that work with our platform\n🤖 **Discover the AI Business Partner** that plans your business for you\n\nWhat would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(false);
    setShowQuickActions(false);

    try {
      setIsLoading(true);
      const res = await fetch(`${apiBase}/api/v1/sales-agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          sessionId,
        }),
      });

      const data = await res.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || "Sorry, I couldn't process that. Please try again.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "I'm having trouble connecting right now. But here's what I can tell you:\n\n• **Start free** — No upfront cost\n• **Cheap routers** — From 30,000 TZS\n• **AI-powered business planning**\n\nTry visiting our [pricing page](/#pricing) or [register here](/register)!",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const renderMessageContent = (content: string) => {
    let html = content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n- /g, "\n• ")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#0A84FF;text-decoration:underline" target="_blank" rel="noopener">$1</a>');

    return html;
  };

  // Inline styles to guarantee colors render regardless of CSS variable issues
  const darkText: React.CSSProperties = { color: "#1a1a1a" };
  const medText: React.CSSProperties = { color: "#374151" };
  const lightText: React.CSSProperties = { color: "#888" };

  return (
    <>
      {/* ═══ FLOATING BUTTON ═══ */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110"
        style={isOpen ? { background: "#ffffff", border: "1px solid #e5e7eb", color: "#374151" } : { background: "linear-gradient(135deg, #0A84FF, #BF5AF2)", color: "#ffffff" }}
        aria-label={isOpen ? "Close chat" : "Chat with sales assistant"}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white animate-pulse" style={{ background: "#30D158" }} />
        )}
      </button>

      {/* ═══ CHAT WINDOW ═══ */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-[9998] w-[400px] max-w-[calc(100vw-48px)] h-[560px] max-h-[calc(100vh-140px)] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{ background: "#f0f2f5", border: "1px solid #d1d5db" }}
        >
          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{ background: "linear-gradient(135deg, #0A84FF, #BF5AF2)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.2)" }}>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="white" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h.01M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h.01M20 12h.01M6.34 17.66l-2.83 2.83M19.07 4.93l-2.83 2.83" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm">NetMaster Sales</h3>
              <p className="text-xs flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#30D158" }} />
                AI-Powered • Online now
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium shrink-0" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              Knowledge-Powered
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed text-white shadow-md" style={{ background: "linear-gradient(135deg, #0A84FF, #0A84FF)" }}>
                    <div dangerouslySetInnerHTML={{ __html: renderMessageContent(msg.content) }} />
                  </div>
                ) : (
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed shadow-sm" style={{ background: "#ffffff", border: "1px solid #e5e7eb", color: "#1a1a1a" }}>
                    <div dangerouslySetInnerHTML={{ __html: renderMessageContent(msg.content) }} />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md px-4 py-3 shadow-sm" style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#0A84FF", animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#0A84FF", animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#0A84FF", animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs" style={{ color: "#888" }}>Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {showQuickActions && messages.length <= 2 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2 shrink-0">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setShowQuickActions(false);
                    sendMessage(action.message);
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                  style={{ background: "#ffffff", border: "1px solid #e5e7eb", color: "#374151" }}
                >
                  {action.icon} {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="px-4 pb-4 pt-2 shrink-0">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about routers, pricing, features..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "#1a1a1a" }}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shrink-0"
                style={{ background: "linear-gradient(135deg, #0A84FF, #0A84FF)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-center text-[10px] mt-2" style={{ color: "#999" }}>
              Powered by NetMaster AI • Knows all our features & routers
            </p>
          </div>
        </div>
      )}
    </>
  );
}
