import { prisma } from "../../prisma/client";
import { bedrockChat, isBedrockConfigured, type BedrockMessage } from "./bedrock-llm";

export interface TicketClassification {
  category: "technical" | "billing" | "sales" | "general";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  urgencyScore: number; // 0-1
  suggestedResponse?: string;
  autoResolvable: boolean;
  troubleshootingSteps?: string[];
}

export interface AutoResponse {
  ticketId: string;
  response: string;
  category: string;
  confidence: number;
  isAutoResolved: boolean;
}

// Common issue patterns for quick classification without AI
const ISSUE_PATTERNS = [
  {
    keywords: ["slow", "speed", "bandwidth", "lag", "buffering", "mbps", "kupungua"],
    category: "technical" as const,
    priority: "MEDIUM" as const,
    autoResponse: `Habari! Tumepokea tatizo lako la internet. Hii ndiyo hatua za kuchukua:

1. **Restart router yako** — ondoa umeme kwa sekunde 30, kisha uweke tena
2. **Ondoa devices zisizohitajika** — kama kuna devices nyingi zimeunganishwa, zondoa baadhi
3. **Angalia signal strength** — hakikisha unaWiFi nzuri karibu na router

Ikiwa tatizo linaendelea, tafadhali tujulishe na tutakusaidia haraka iwezekanavyo.`,
  },
  {
    keywords: ["no internet", "not working", "haifanyi", "haina internet", "offline", "disconnect", "imekataa"],
    category: "technical" as const,
    priority: "HIGH" as const,
    autoResponse: `Habari! Tatizo la internet limepokelewa. Fanya haya:

1. **Restart router** — ondoa power kwa sekunde 30
2. **Angalia cables** — hakikisha zote zimeunganishwa vizuri
3. **Angalia ISP status** — kuna mtu anajua kama ISP iko down?

Ikiwa baada ya restart bado haina internet, tafadhali tujulishe na tutawasiliana na ISP kwa niaba yako.`,
  },
  {
    keywords: ["payment", "billing", "bill", "lipa", "pesa", "malipo", "invoice", "bei"],
    category: "billing" as const,
    priority: "MEDIUM" as const,
    autoResponse: `Habari! Tatizo lako la malipo limepokelewa. Fanya haya:

1. **Angalia invoice yako** — katika sehemu ya Billing kwenye account yako
2. **Angalia muda wa malipo** — kuna tarehe ya mwisho ya kulipa?
3. **Wasiliana na support** — ikiwa una swali kuhusu bei au malipo

Tutakujibu haraka iwezekanavyo!`,
  },
  {
    keywords: ["upgrade", "package", "speed up", "boost", "ongeza", "bora zaidi"],
    category: "sales" as const,
    priority: "LOW" as const,
    autoResponse: `Habari! Asante kwa kufikiria kuupgrade! Fanya haya:

1. **Angalia packages zetu** — kwenye sehemu ya Billing kwenye account yako
2. **Chagua package unayopendelea** — kuna mbalimbali kulingana na mahitaji yako
3. **Wasiliana nasi** — tutakusaidia kuchagua bora zaidi

Tuko hapa kukusaidia!`,
  },
  {
    keywords: ["voucher", "code", "pin", "namba", "kuuza", "kununua"],
    category: "technical" as const,
    priority: "MEDIUM" as const,
    autoResponse: `Habari! Tatizo la voucher limepokelewa. Fanya haya:

1. **Angalia code vizuri** — hakikisha unaandika sawa (huru za herufi)
2. **Angalia muda** — voucher ina expiry date
3. **Piga mpya** — ikiwa haifanyi,omba voucher mpya kwa reseller wako

Ikiwa bado haifanyi, tafadhali tujulishe!`,
  },
];

const TICKET_AI_SYSTEM = `You are a NetMaster support AI agent for Tanzanian ISP resellers and their customers.

Your job is to:
1. Classify incoming support tickets into categories: technical, billing, sales, general
2. Suggest priority: LOW, MEDIUM, HIGH, URGENT
3. Generate helpful troubleshooting responses in Swahili (with some English technical terms)
4. Determine if the issue can be auto-resolved or needs human intervention

Classification rules:
- URGENT: Internet completely down, security issues, payment failures
- HIGH: Slow internet affecting multiple users, billing disputes
- MEDIUM: Voucher issues, single-user problems, upgrade requests
- LOW: General questions, feature requests, feedback

Response format (JSON only, no other text):
{
  "category": "technical|billing|sales|general",
  "priority": "LOW|MEDIUM|HIGH|URGENT",
  "urgencyScore": 0.0-1.0,
  "suggestedResponse": "Swahili response with troubleshooting steps",
  "autoResolvable": true/false,
  "troubleshootingSteps": ["step1", "step2"]
}`;

export class TicketAIService {
  /**
   * Classify a ticket and suggest response using pattern matching + AI
   */
  async classifyTicket(
    subject: string,
    description: string | null
  ): Promise<TicketClassification> {
    const text = `${subject} ${description || ""}`.toLowerCase();

    // First try pattern matching for speed
    for (const pattern of ISSUE_PATTERNS) {
      if (pattern.keywords.some((kw) => text.includes(kw))) {
        return {
          category: pattern.category,
          priority: pattern.priority,
          urgencyScore: (pattern.priority as string) === "URGENT" ? 1.0 : pattern.priority === "HIGH" ? 0.8 : pattern.priority === "MEDIUM" ? 0.5 : 0.2,
          suggestedResponse: pattern.autoResponse,
          autoResolvable: (pattern.priority as string) !== "URGENT",
          troubleshootingSteps: [],
        };
      }
    }

    // Fall back to AI classification if Bedrock is configured
    if (isBedrockConfigured()) {
      try {
        const response = await bedrockChat(
          [
            { role: "user", content: `Classify this support ticket:\n\nSubject: ${subject}\nDescription: ${description || "No description provided"}` },
          ],
          { systemPrompt: TICKET_AI_SYSTEM, maxTokens: 1024, temperature: 0.2 }
        );

        // Try to parse JSON from response
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            category: parsed.category || "general",
            priority: parsed.priority || "MEDIUM",
            urgencyScore: parsed.urgencyScore || 0.5,
            suggestedResponse: parsed.suggestedResponse,
            autoResolvable: parsed.autoResolvable ?? false,
            troubleshootingSteps: parsed.troubleshootingSteps || [],
          };
        }
      } catch (err) {
        console.error("[TicketAI] AI classification failed, falling back to defaults:", err);
      }
    }

    // Default classification
    return {
      category: "general",
      priority: "MEDIUM",
      urgencyScore: 0.5,
      suggestedResponse: `Habari! Tumepokea ombi lako la msaada. Tuko kwenye kikao chetu na tutakujibu haraka iwezekanavyo.\n\nTafadhali subiri kidogo na mtu atakwita.`,
      autoResolvable: false,
      troubleshootingSteps: [],
    };
  }

  /**
   * Auto-respond to a ticket if it's resolvable
   */
  async autoRespondToTicket(
    ticketId: string,
    subject: string,
    description: string | null,
    organizationId: string
  ): Promise<AutoResponse | null> {
    const classification = await this.classifyTicket(subject, description);

    if (!classification.autoResolvable || !classification.suggestedResponse) {
      return null;
    }

    // Create the auto-response comment
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        authorRole: "SYSTEM",
        body: `🤖 **AI Support Response**\n\n${classification.suggestedResponse}\n\n---\n*This response was generated automatically. If it didn't solve your issue, a support agent will follow up shortly.*`,
        isInternal: false,
      },
    });

    // Update ticket priority if needed
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        priority: classification.priority as any,
        firstResponseAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: "system:ticket-ai",
        action: "AUTO_RESPONSE",
        entityType: "Ticket",
        entityId: ticketId,
        afterJson: {
          commentId: comment.id,
          category: classification.category,
          confidence: classification.urgencyScore,
        },
      },
    });

    return {
      ticketId,
      response: classification.suggestedResponse,
      category: classification.category,
      confidence: classification.urgencyScore,
      isAutoResolved: classification.autoResolvable,
    };
  }

  /**
   * Get AI-generated response suggestion for a ticket (for agent review)
   */
  async suggestResponse(
    ticketId: string
  ): Promise<{ suggestion: string; category: string; confidence: number } | null> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        comments: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    if (!ticket) return null;

    const classification = await this.classifyTicket(
      ticket.subject,
      ticket.description
    );

    if (!isBedrockConfigured()) {
      return {
        suggestion: classification.suggestedResponse || "No suggestion available.",
        category: classification.category,
        confidence: classification.urgencyScore,
      };
    }

    try {
      // Build context from ticket and comments
      const conversationContext = ticket.comments
        .map((c: { authorRole: string; body: string }) => `${c.authorRole}: ${c.body}`)
        .join("\n");

      const response = await bedrockChat(
        [
          {
            role: "user",
            content: `Support ticket to respond to:

Subject: ${ticket.subject}
Description: ${ticket.description || "No description"}
Category: ${classification.category}
Priority: ${ticket.priority}

Conversation history:
${conversationContext || "No comments yet"}

Generate a helpful response in Swahili to resolve this ticket. Be concise and actionable.`,
          },
        ],
        {
          systemPrompt: "You are a NetMaster support agent responding to ISP customer tickets in Tanzania. Respond in Swahili with English technical terms where needed. Be helpful, concise, and actionable.",
          maxTokens: 1024,
          temperature: 0.3,
        }
      );

      return {
        suggestion: response.text,
        category: classification.category,
        confidence: classification.urgencyScore,
      };
    } catch (err) {
      console.error("[TicketAI] Suggestion generation failed:", err);
      return {
        suggestion: classification.suggestedResponse || "No suggestion available.",
        category: classification.category,
        confidence: classification.urgencyScore,
      };
    }
  }

  /**
   * Get ticket analytics — classification breakdown, auto-resolution stats
   */
  async getTicketAnalytics(orgIds: string[]): Promise<{
    totalTickets: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    autoResolved: number;
    avgResponseTime: number;
  }> {
    const tickets = await prisma.ticket.findMany({
      where: { organizationId: { in: orgIds }, deletedAt: null },
      select: {
        priority: true,
        source: true,
        firstResponseAt: true,
        createdAt: true,
        comments: {
          where: { authorRole: "SYSTEM" },
          select: { id: true },
        },
      },
    });

    const byCategory: Record<string, number> = { technical: 0, billing: 0, sales: 0, general: 0 };
    const byPriority: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    let autoResolved = 0;
    let totalResponseTime = 0;
    let respondedCount = 0;

    for (const ticket of tickets) {
      byPriority[ticket.priority] = (byPriority[ticket.priority] || 0) + 1;
      
      // Count auto-resolved (has SYSTEM comment as first response)
      if (ticket.comments.length > 0 && !ticket.firstResponseAt) {
        autoResolved++;
      }

      // Calculate response time
      if (ticket.firstResponseAt) {
        totalResponseTime += ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
        respondedCount++;
      }
    }

    // Categorize by source as proxy for category
    byCategory.technical = tickets.filter((t) => t.source === "CUSTOMER").length;
    byCategory.general = tickets.filter((t) => t.source === "SUPPORT").length;
    byCategory.sales = tickets.filter((t) => t.source === "RESELLER").length;

    return {
      totalTickets: tickets.length,
      byCategory,
      byPriority,
      autoResolved,
      avgResponseTime: respondedCount > 0 ? Math.round(totalResponseTime / respondedCount / 1000 / 60) : 0, // minutes
    };
  }
}
