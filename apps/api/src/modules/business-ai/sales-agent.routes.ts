/**
 * Public Sales Agent API — no auth required.
 * Uses the comprehensive sales brain + live blog/product data from the database.
 */

import { Router } from "express";
import { bedrockChat } from "./bedrock-llm";
import { SALES_BRAIN, buildDynamicContext, type ProductContext, type BlogPostContext } from "./sales-brain";

// Lazy-load prisma to avoid crash if DB is down
let prisma: any = null;
function getPrisma() {
  if (!prisma) {
    try {
      prisma = require("../../prisma/client").prisma;
    } catch {
      // DB unavailable — will use static brain only
    }
  }
  return prisma;
}

const router = Router();

// Cache for blog/product data (refresh every 10 minutes)
let cachedContext: string | null = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getFullSystemPrompt(): Promise<string> {
  const now = Date.now();

  // Return cached if fresh
  if (cachedContext && now - cacheTime < CACHE_TTL) {
    return cachedContext;
  }

  try {
    const db = getPrisma();
    if (db) {
      // Load blog posts and products with full specs from the database
      const [blogPosts, products] = await Promise.all([
        db.blogPost.findMany({
          where: { published: true },
          select: { title: true, excerpt: true, tags: true, content: true },
          orderBy: { createdAt: "desc" },
          take: 30,
        }).catch(() => []),
        db.product.findMany({
          where: { published: true },
          select: { name: true, priceCents: true, description: true, specs: true, slug: true },
          orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
          take: 20,
        }).catch(() => []),
      ]);

      const blogContext: BlogPostContext[] = blogPosts.map((p: any) => ({
        title: p.title,
        excerpt: p.excerpt,
        tags: p.tags,
      }));

      const productContext: ProductContext[] = products.map((p: any) => ({
        name: p.name,
        price: p.priceCents,
        description: p.description,
        specs: p.specs,
        slug: p.slug,
      }));

      cachedContext = buildDynamicContext(blogContext, productContext);
      cacheTime = now;
      return cachedContext;
    }
  } catch {
    // DB error — fall through to static brain
  }

  // Static fallback
  cachedContext = SALES_BRAIN;
  cacheTime = now;
  return SALES_BRAIN;
}

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

    // Keep last 12 messages for context
    const contextMessages = history.slice(-12);

    // Add user message to history
    contextMessages.push({ role: "user", content: message.trim() });

    // Get the full system prompt (brain + live data)
    const systemPrompt = await getFullSystemPrompt();

    // Call Bedrock AI with the comprehensive brain
    const response = await bedrockChat(contextMessages, {
      systemPrompt,
      temperature: 0.65, // Slightly higher for more natural conversation
      maxTokens: 1500,   // Keep responses focused
    });

    // Add assistant response to history
    history.push({ role: "user", content: message.trim() });
    history.push({ role: "assistant", content: response.text });

    // Keep session under 24 messages
    if (history.length > 24) {
      sessions.set(sid, history.slice(-24));
    }

    res.json({
      reply: response.text,
      sessionId: sid,
    });
  } catch (err: any) {
    console.error("[sales-agent] Chat error:", err?.message);

    // Fallback response if AI is down
    res.json({
      reply: getFallbackResponse(req.body.message || ""),
      sessionId: req.body.sessionId || `sales-fallback-${Date.now()}`,
    });
  }
});

// Endpoint to refresh the brain cache (admin use)
router.post("/refresh-brain", async (_req, res) => {
  cachedContext = null;
  cacheTime = 0;
  res.json({ message: "Brain cache cleared. Will refresh on next chat." });
});

function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("bei") || lower.includes("price") || lower.includes("cost") || lower.includes("pesa")) {
    return "💰 **Bei za NetMaster:**\n\n• **Starter**: BURE — hadi routers 2, 5% komisio\n• **Growth**: 8,000 TZS/router/mwezi — routers zisizo na kikomo, 0% komisio\n• **Enterprise**: 25,000 TZS/router/mwezi — API, SLA maalum\n\nUnaweza kuanza BURE kabisa. Bonyeza [Get Started](/register) ili kuunda account yako!";
  }

  if (lower.includes("router") || lower.includes("mikrotik") || lower.includes("openwrt") || lower.includes("tp-link")) {
    return "📡 **Routers za Kuanza:**\n\nTuna routers tofauti kulingana na bajeti yako. Angalia [Shop](/shop) kwa bei halisi na maelezo kamili ya kila router — ikiwa ni pamoja na uongozi wa OpenWRT na MikroTik.\n\nUnaweza kuanza na router ya bei nafuu na kukua biashara yako polepole.";
  }

  if (lower.includes("kuanza") || lower.includes("start") || lower.includes("how") || lower.includes("jinsi")) {
    return "🚀 **Jinsi ya Kuanza:**\n\n1. **Jisajili** — Bonyeza [Get Started](/register) na uunde account (30 sekunde)\n2. **Ongeza eneo** — Weka ofisi/yako\n3. **Unganisha router** — Weka MikroTik au OpenWRT router\n4. **Uuze vouchera** — Tengeneza na uuze!\n\nAI yetu itakusaidia kila hatua. Anza BURE leo!";
  }

  return "Asante kwa maswali yako! 😊\n\nMimi ni sales agent wa NetMaster. Ninaweza kukusaidia na:\n• 💰 **Bei na mipango** — Anza bure!\n• 📡 **Routers** — Chagua router sahihi\n• 🚀 **Jinsi ya kuanza** — Hatua kwa hatua\n• 🎯 **AI Business Partner** — AI inakupangia biashara\n\nNiulize chochote, au bonyeza [Get Started](/register) kuunda account yako leo!";
}

// Cleanup old sessions every 30 minutes
setInterval(() => {
  if (sessions.size > 500) {
    const keys = Array.from(sessions.keys());
    for (let i = 0; i < Math.floor(keys.length / 2); i++) {
      sessions.delete(keys[i]);
    }
  }
}, 30 * 60 * 1000);

export default router;
