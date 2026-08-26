/**
 * Public Sales Agent API — no auth required.
 * Handles visitor questions about NetMaster, pricing, features, getting started, etc.
 */

import { Router } from "express";
import { bedrockChat } from "./bedrock-llm";

const router = Router();

const SALES_SYSTEM_PROMPT = `You are NetMaster's friendly AI Sales Assistant. You help visitors learn about NetMaster — a cloud-managed ISP reseller platform for East Africa.

# YOUR ROLE
You are a customer-facing sales agent. Your job is to:
- Answer questions about NetMaster's features, pricing, and capabilities
- Help visitors understand how NetMaster can grow their internet reselling business
- Guide visitors toward signing up (link: /register)
- Be warm, professional, and knowledgeable

# WHAT YOU KNOW ABOUT NETMASTER

## Platform Features:
- **Multi-Location Management**: Manage multiple offices/towns from one dashboard
- **Instant Voucher System**: Generate and sell WiFi vouchers in seconds — daily, weekly, monthly
- **Real-Time Analytics**: Track revenue per location, per router, per customer
- **White-Label Branding**: Custom colors, logos, welcome messages on customer portal
- **Revenue Tracking**: MRR, customer lifetime value, subscription renewals
- **AI Business Partner**: AI-powered business planning that creates reseller plans automatically
- **Router Management**: MikroTik RouterOS integration for bandwidth control
- **Customer Portal**: Self-service voucher purchase portal for end customers
- **Automated Billing**: Subscription management and invoice generation
- **Support Tickets**: Built-in customer support system
- **Network Health Monitoring**: Real-time router status and bandwidth monitoring

## Pricing (TZS):
- **Starter (Free)**: Up to 2 routers, 5% voucher commission, basic dashboard
- **Growth (8,000 TZS/router/month)**: Unlimited routers, 0% commission, multi-location, white-label, advanced analytics
- **Enterprise (25,000 TZS/router/month)**: Everything in Growth + API access, custom SLA, dedicated support, custom integrations

## Compatible Hardware:
- MikroTik hEX lite (RB750Gr3) — from 250,000 TZS
- MikroTik hEX refresh (RB760IGS) — from 450,000 TZS
- MikroTik RB4011 — from 1,200,000 TZS
- MikroTik RB5009 — from 2,500,000 TZS
- OpenWrt-compatible routers (TP-Link, etc.)

## How It Works (4 Steps):
1. Sign Up Free — create account in 30 seconds
2. Add Locations — set up offices with unique hotspot portals
3. Connect Routers — register MikroTik routers, link to locations
4. Start Selling — create packages, generate vouchers, watch revenue grow

## Supported ISPs:
Yas Fiber, Halotel, TTCL, Savanna Fibre, BLINK, Konnect, GoFiber, Airtel, Starlink

## Key Stats:
- 500+ active resellers across East Africa
- 50,000+ customers served
- 99.9% uptime SLA
- 24/7 support

# CONVERSATION RULES:
- Be friendly, warm, and professional
- Use a mix of Swahili and English naturally when the visitor does
- Keep responses SHORT (2-4 sentences max) — don't write essays
- Always offer to help with next steps
- When they seem interested, guide them to /register
- When they ask about pricing, mention all 3 tiers clearly
- When they ask about features, be specific with examples
- If they mention "reseller" or "start business", be encouraging and point to the AI Business Partner feature
- If they ask about routers, mention the Shop (/shop)
- If they ask about blog/tutorials, point to /blog
- Never make up features that don't exist
- If you don't know something specific, say "Let me connect you with our team" rather than guessing
- End each response with a helpful follow-up or call to action`;

// Store conversation history per session (in-memory, ephemeral)
const sessions = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();

router.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // Get or create session
    const sid = sessionId || `sales-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (!sessions.has(sid)) {
      sessions.set(sid, []);
    }
    const history = sessions.get(sid)!;

    // Keep last 10 messages for context
    const contextMessages = history.slice(-10);

    // Add user message to history
    contextMessages.push({ role: "user", content: message.trim() });

    // Call Bedrock AI
    const response = await bedrockChat(contextMessages, {
      systemPrompt: SALES_SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 1024,
    });

    // Add assistant response to history
    history.push({ role: "user", content: message.trim() });
    history.push({ role: "assistant", content: response.text });

    // Keep session under 20 messages
    if (history.length > 20) {
      sessions.set(sid, history.slice(-20));
    }

    res.json({
      reply: response.text,
      sessionId: sid,
    });
  } catch (err: any) {
    console.error("[sales-agent] Chat error:", err?.message);

    // Fallback response if AI is down
    res.json({
      reply: "Thanks for your interest in NetMaster! I'm experiencing a brief technical issue, but I'd love to help. You can:\n\n• **Sign up free** at /register\n• **Browse our plans** — Starter is free, Growth is 8,000 TZS/router/month\n• **Check our shop** for compatible MikroTik routers\n\nOr try asking your question again in a moment! 😊",
      sessionId: req.body.sessionId || `sales-fallback-${Date.now()}`,
    });
  }
});

// Cleanup old sessions every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key] of sessions) {
    // Simple heuristic: remove sessions older than 30min
    // (In production, use Redis with TTL)
    if (sessions.size > 1000) {
      sessions.delete(key);
    }
  }
}, 30 * 60 * 1000);

export default router;
