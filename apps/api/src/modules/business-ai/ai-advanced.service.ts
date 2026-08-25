/**
 * AI Advanced Services — Premium features for Growth/Enterprise subscribers.
 * All features use DeepSeek via AWS Bedrock for intelligent analysis.
 */

import { prisma } from "../../prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { bedrockChat, isBedrockConfigured } from "./bedrock-llm";

type BedrockMessage = { role: "user" | "assistant" | "system"; content: string };

/** Check if an error indicates a missing table */
function isMissingTable(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (["P2021", "P2022", "P2003"].includes(code || "")) return true;
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("does not exist") || msg.includes("relation does not exist")) return true;
  return false;
}

/** Safe wrapper for Bedrock calls with fallback */
async function askAI(messages: BedrockMessage[], context: string): Promise<string> {
  if (!isBedrockConfigured()) {
    return `[AI unavailable — Bedrock not configured] ${context}`;
  }
  try {
    // bedrockChat only accepts user/assistant roles
    // Prepend system prompt to the first user message
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsgs = messages.filter((m) => m.role !== "system");
    const firstUser = userMsgs[0];
    if (systemMsg && firstUser) {
      userMsgs[0] = { role: "user", content: `${systemMsg.content}\n\n---\n\nUser data:\n${firstUser.content}` };
    }
    const response = await bedrockChat(userMsgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    return response.text;
  } catch (err) {
    console.error("AI advanced call failed:", err);
    return `[AI analysis failed] ${context}`;
  }
}

export class AIAdvancedService {
  // ═══════════════════════════════════════════════════════════════
  // 1. SMART CUSTOMER CHURN PREDICTION
  // ═══════════════════════════════════════════════════════════════

  async predictChurn(resellerId: string) {
    try {
      // Get all customers with their router info
      const customers = await prisma.customer.findMany({
        where: { organizationId: resellerId },
        include: {
          router: { select: { name: true, id: true } },
        },
      });

      // Get recent vouchers for these customers
      const customerIds = customers.map((c) => c.id);
      const recentVouchers = customerIds.length > 0
        ? await prisma.voucher.findMany({
            where: { organizationId: resellerId, usedByCustomerId: { in: customerIds } },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : [];

      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Analyze each customer's behavior
      const customerData = customers.map((c) => {
        const custVouchers = recentVouchers.filter((v) => v.usedByCustomerId === c.id);
        const lastVoucher = custVouchers[0];
        const lastPurchase = lastVoucher?.createdAt;
        const daysSinceLastPurchase = lastPurchase
          ? Math.floor((now.getTime() - new Date(lastPurchase).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const recentCount = custVouchers.filter(
          (v: any) => new Date(v.createdAt) > sevenDaysAgo
        ).length;

        return {
          name: c.name,
          status: c.status,
          daysSinceLastPurchase,
          recentVouchers: recentCount,
          totalVouchers: custVouchers.length,
          router: c.router?.name || "Unknown",
        };
      });

      // Build churn risk data for AI
      const churnData = customerData
        .map(
          (c) =>
            `- ${c.name}: status=${c.status}, days since last purchase=${c.daysSinceLastPurchase}, recent vouchers (7d)=${c.recentVouchers}, total=${c.totalVouchers}, router=${c.router}`
        )
        .join("\n");

      const aiPrompt: BedrockMessage[] = [
        {
          role: "system",
          content: `You are a customer churn prediction expert for a Tanzanian ISP reseller business. Analyze customer data and predict churn risk.

Respond in JSON format:
{
  "customers": [
    {
      "name": "customer name",
      "risk": "high|medium|low",
      "daysSinceLastPurchase": number,
      "reason": "brief reason in Swahili",
      "action": "recommended retention action in Swahili",
      "discountOffer": "suggested discount % or 0"
    }
  ],
  "summary": "overall churn risk summary in Swahili",
  "totalAtRisk": number,
  "estimatedRevenueAtRisk": "amount in TZS"
}

Rules:
- High risk: no purchase in 5+ days AND was previously active
- Medium risk: no purchase in 3-5 days
- Low risk: purchased within 3 days
- Always respond in Swahili with some English terms
- Be concise and actionable`,
        },
        {
          role: "user",
          content: `Customer data for churn analysis:\n\n${churnData}\n\nTotal customers: ${customers.length}`,
        },
      ];

      const aiResponse = await askAI(
        aiPrompt,
        `Found ${customers.length} customers. ${customerData.filter((c) => c.daysSinceLastPurchase > 5).length} may be at risk.`
      );

      // Try to parse AI response
      let analysis;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        analysis = null;
      }

      return {
        customers: customerData,
        aiAnalysis: analysis,
        rawResponse: aiResponse,
        stats: {
          total: customers.length,
          atRisk: customerData.filter((c) => c.daysSinceLastPurchase > 5).length,
          active: customerData.filter((c) => c.daysSinceLastPurchase <= 3).length,
        },
      };
    } catch (err) {
      if (isMissingTable(err)) {
        return { customers: [], aiAnalysis: null, rawResponse: "No customer data available", stats: { total: 0, atRisk: 0, active: 0 } };
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. DYNAMIC PRICING ENGINE
  // ═══════════════════════════════════════════════════════════════

  async getDynamicPricing(resellerId: string) {
    try {
      // Get current packages and voucher usage patterns
      const packages = await prisma.package.findMany({
        where: { organizationId: resellerId },
      });

      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      const now = new Date();
      const currentHour = now.getHours();
      const dayOfWeek = now.getDay(); // 0=Sun
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPeakHour = currentHour >= 17 && currentHour <= 22;

      // Analyze usage patterns
      const usageByHour = new Array(24).fill(0);
      const usageByDay = new Array(7).fill(0);
      vouchers.forEach((v) => {
        const d = new Date(v.createdAt);
        usageByHour[d.getHours()]++;
        usageByDay[d.getDay()]++;
      });

      const avgDailyUsage = vouchers.length / Math.max(1, 7);
      const peakHourUsage = Math.max(...usageByHour);

      const usageData = packages
        .map((p) => `- ${p.name}: price=${p.priceCents} TZS, speed=${p.speedMbps}Mbps`)
        .join("\n");

      const aiPrompt: BedrockMessage[] = [
        {
          role: "system",
          content: `You are a dynamic pricing expert for a Tanzanian ISP WiFi reseller. Analyze usage patterns and suggest optimal pricing.

Context:
- Current hour: ${currentHour}:00
- Is weekend: ${isWeekend}
- Is peak hour (5PM-10PM): ${isPeakHour}
- Average daily voucher usage: ${avgDailyUsage.toFixed(1)}
- Peak hour usage count: ${peakHourUsage}

Respond in JSON format:
{
  "recommendations": [
    {
      "packageName": "name",
      "currentPrice": number,
      "suggestedPrice": number,
      "change": "+/- percentage",
      "reason": "reason in Swahili",
      "timeRestriction": "when this price applies"
    }
  ],
  "peakStrategy": "pricing strategy for peak hours in Swahili",
  "offPeakStrategy": "pricing strategy for off-peak hours in Swahili",
  "weekendStrategy": "weekend pricing strategy in Swahili",
  "estimatedRevenueIncrease": "percentage increase estimate"
}

Rules:
- Peak hours (5PM-10PM): suggest 10-20% premium
- Off-peak (6AM-12PM): suggest 5-10% discount to fill bandwidth
- Weekends: higher demand, suggest 5-15% premium
- Tanzanian market context: typical daily voucher is 1,000-2,000 TZS
- Always respond in Swahili with English technical terms`,
        },
        {
          role: "user",
          content: `Current packages:\n${usageData}\n\nUsage pattern: ${JSON.stringify({ usageByHour: usageByHour.slice(0, 24), usageByDay })}`,
        },
      ];

      const aiResponse = await askAI(aiPrompt, `${packages.length} packages, ${vouchers.length} vouchers analyzed.`);

      let analysis;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        analysis = null;
      }

      return {
        currentPackages: packages,
        usagePatterns: { usageByHour, usageByDay, avgDailyUsage, peakHourUsage },
        context: { currentHour, isWeekend, isPeakHour },
        aiAnalysis: analysis,
        rawResponse: aiResponse,
      };
    } catch (err) {
      if (isMissingTable(err)) {
        return { currentPackages: [], usagePatterns: null, context: null, aiAnalysis: null, rawResponse: "No data available" };
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. NETWORK HEALTH AI
  // ═══════════════════════════════════════════════════════════════

  async getNetworkHealth(resellerId: string) {
    try {
      const locations = await prisma.location.findMany({
        where: { organizationId: resellerId },
        include: {
          routers: { include: { _count: { select: { customers: true } } } },
        },
      });

      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      // Get usage data per location
      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId, createdAt: { gte: new Date(monthStart) } },
        include: { location: { select: { name: true } } },
      });

      const networkData = locations.map((loc) => {
        const locVouchers = vouchers.filter((v) => v.location?.name === loc.name);          const totalCustomers = (loc as any).routers?.reduce((s: number, r: any) => s + (r._count?.customers || 0), 0) || 0;
        return {
          name: loc.name,
          routers: loc.routers.length,
          customers: totalCustomers,
          monthlyVouchers: locVouchers.length,
          estimatedBandwidth: loc.routers.length * 20,
          loadFactor: totalCustomers / Math.max(1, loc.routers.length * 15),
        };
      });

      const networkSummary = networkData
        .map(
          (n) =>
            `- ${n.name}: ${n.routers} routers, ${n.customers} customers, ${n.monthlyVouchers} vouchers this month, load factor=${(n.loadFactor * 100).toFixed(0)}%`
        )
        .join("\n");

      const aiPrompt: BedrockMessage[] = [
        {
          role: "system",
          content: `You are a network health monitoring expert for a Tanzanian ISP. Analyze router and customer data to predict issues.

Respond in JSON format:
{
  "status": "healthy|warning|critical",
  "locations": [
    {
      "name": "location name",
      "health": "good|warning|critical",
      "loadPercentage": number,
      "issue": "description of issue if any, in Swahili",
      "recommendation": "action to take, in Swahili"
    }
  ],
  "alerts": ["alert messages in Swahili"],
  "summary": "overall network health summary in Swahili"
}

Rules:
- Load > 80% = critical (needs more routers)
- Load 60-80% = warning (monitor closely)
- Load < 60% = good
- Suggest specific actions: add router, upgrade fiber, rebalance customers
- Respond in Swahili with English technical terms`,
        },
        {
          role: "user",
          content: `Network data:\n${networkSummary}\n\nTotal locations: ${locations.length}, Total routers: ${networkData.reduce((s, n) => s + n.routers, 0)}, Total customers: ${networkData.reduce((s, n) => s + n.customers, 0)}`,
        },
      ];

      const aiResponse = await askAI(aiPrompt, `${locations.length} locations with ${networkData.reduce((s, n) => s + n.routers, 0)} routers.`);

      let analysis;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        analysis = null;
      }

      return {
        locations: networkData,
        aiAnalysis: analysis,
        rawResponse: aiResponse,
        stats: {
          totalLocations: locations.length,
          totalRouters: networkData.reduce((s, n) => s + n.routers, 0),
          totalCustomers: networkData.reduce((s, n) => s + n.customers, 0),
          avgLoadFactor: networkData.reduce((s, n) => s + n.loadFactor, 0) / Math.max(1, networkData.length),
        },
      };
    } catch (err) {
      if (isMissingTable(err)) {
        return { locations: [], aiAnalysis: null, rawResponse: "No network data", stats: { totalLocations: 0, totalRouters: 0, totalCustomers: 0, avgLoadFactor: 0 } };
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. CUSTOMER SUPPORT AI AGENT
  // ═══════════════════════════════════════════════════════════════

  async getSupportInsights(resellerId: string) {
    try {
      // Get tickets if the table exists
      let tickets: any[] = [];
      try {
        tickets = await prisma.ticket.findMany({
          where: { organizationId: resellerId },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { _count: { select: { comments: true } } },
        });
      } catch {
        // Tickets table might not exist
      }

      const now = new Date();
      const openTickets = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
      const urgentTickets = tickets.filter((t) => t.priority === "URGENT" || t.priority === "HIGH");
      const recentTickets = tickets.filter(
        (t) => new Date(t.createdAt).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000
      );

      const ticketSummary = tickets
        .slice(0, 20)
        .map(
          (t) =>
            `- [${t.priority}] ${t.subject}: status=${t.status}, comments=${t._count?.comments || 0}, created=${new Date(t.createdAt).toLocaleDateString()}`
        )
        .join("\n");

      const aiPrompt: BedrockMessage[] = [
        {
          role: "system",
          content: `You are a customer support AI agent for a Tanzanian ISP reseller. Analyze support tickets and provide insights.

Respond in JSON format:
{
  "priorityActions": [
    {
      "ticket": "subject",
      "action": "what to do in Swahili",
      "autoResponse": "suggested auto-response in Swahili"
    }
  ],
  "commonIssues": [
    {
      "issue": "issue type",
      "count": number,
      "solution": "solution in Swahili"
    }
  ],
  "autoResponses": {
    "slowInternet": "response in Swahili",
    "noConnection": "response in Swahili",
    "billing": "response in Swahili",
    "general": "response in Swahili"
  },
  "summary": "support overview in Swahili"
}

Rules:
- Classify tickets by type: technical, billing, sales, general
- Suggest auto-responses for common issues in Swahili
- Prioritize urgent and high-priority tickets
- Be helpful and professional
- Respond in Swahili with English technical terms`,
        },
        {
          role: "user",
          content: `Ticket data:\n${ticketSummary || "No tickets yet"}\n\nOpen: ${openTickets.length}, Urgent: ${urgentTickets.length}, This week: ${recentTickets.length}`,
        },
      ];

      const aiResponse = await askAI(aiPrompt, `${tickets.length} total tickets, ${openTickets.length} open.`);

      let analysis;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        analysis = null;
      }

      return {
        tickets: tickets.slice(0, 20),
        aiAnalysis: analysis,
        rawResponse: aiResponse,
        stats: {
          total: tickets.length,
          open: openTickets.length,
          urgent: urgentTickets.length,
          thisWeek: recentTickets.length,
        },
      };
    } catch (err) {
      if (isMissingTable(err)) {
        return { tickets: [], aiAnalysis: null, rawResponse: "No support data available", stats: { total: 0, open: 0, urgent: 0, thisWeek: 0 } };
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. REVENUE FORECASTING & ALERTS
  // ═══════════════════════════════════════════════════════════════

  async getRevenueForecast(resellerId: string) {
    try {
      // Get active business plan
      const activePlan = await prisma.businessPlan.findFirst({
        where: { resellerId, status: "ACTIVE" },
        orderBy: { activatedAt: "desc" },
      });

      // Get voucher sales history (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: "asc" },
      });

      // Calculate daily revenue
      const dailyRevenue: Record<string, number> = {};
      vouchers.forEach((v) => {
        const day = new Date(v.createdAt).toISOString().split("T")[0];
        dailyRevenue[day] = (dailyRevenue[day] || 0) + 1;
      });

      const revenueDays = Object.entries(dailyRevenue).map(([date, count]) => ({
        date,
        voucherCount: count,
      }));

      const totalVouchers = vouchers.length;
      const avgDaily = totalVouchers / 30;
      const estimatedRevenue = totalVouchers * 1500; // avg 1500 TZS per voucher

      const targetRevenue = activePlan?.monthlyRevenueTarget || 0;
      const currentProgress = targetRevenue > 0 ? (estimatedRevenue / targetRevenue) * 100 : 0;

      const forecastData = revenueDays
        .slice(-14)
        .map((d) => `${d.date}: ${d.voucherCount} vouchers`)
        .join("\n");

      const aiPrompt: BedrockMessage[] = [
        {
          role: "system",
          content: `You are a revenue forecasting expert for a Tanzanian ISP reseller. Analyze sales data and predict future revenue.

Respond in JSON format:
{
  "forecast": {
    "next7Days": "predicted daily average in TZS",
    "next30Days": "predicted monthly total in TZS",
    "confidence": "high|medium|low",
    "trend": "growing|stable|declining"
  },
  "alerts": [
    {
      "type": "warning|danger|info",
      "message": "alert message in Swahili"
    }
  ],
  "recommendations": [
    "actionable recommendation in Swahili"
  ],
  "summary": "revenue forecast summary in Swahili"
}

Rules:
- If current pace < 70% of target, send warning alert
- If current pace < 50% of target, send danger alert
- Suggest specific actions to improve revenue
- Consider Tanzanian market patterns (pay day cycles, holidays)
- Respond in Swahili with English business terms`,
        },
        {
          role: "user",
          content: `Revenue data:
- Monthly target: ${targetRevenue.toLocaleString()} TZS
- Current estimated revenue: ${estimatedRevenue.toLocaleString()} TZS
- Progress: ${currentProgress.toFixed(1)}%
- Daily average: ${avgDaily.toFixed(1)} vouchers
- Last 14 days:\n${forecastData}`,
        },
      ];

      const aiResponse = await askAI(aiPrompt, `${totalVouchers} vouchers sold, ${currentProgress.toFixed(0)}% of target.`);

      let analysis;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        analysis = null;
      }

      return {
        plan: activePlan
          ? { name: activePlan.name, target: targetRevenue, status: activePlan.status }
          : null,
        salesData: { totalVouchers, avgDaily, estimatedRevenue, currentProgress },
        dailyRevenue: revenueDays,
        aiAnalysis: analysis,
        rawResponse: aiResponse,
      };
    } catch (err) {
      if (isMissingTable(err)) {
        return { plan: null, salesData: { totalVouchers: 0, avgDaily: 0, estimatedRevenue: 0, currentProgress: 0 }, dailyRevenue: [], aiAnalysis: null, rawResponse: "No revenue data" };
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. RESELLER GROWTH ADVISOR
  // ═══════════════════════════════════════════════════════════════

  async getGrowthAdvice(resellerId: string) {
    try {
      // Get comprehensive reseller data
      const org = await prisma.organization.findFirst({ where: { id: resellerId } });
      const locations = await prisma.location.findMany({
        where: { organizationId: resellerId },
        include: {
          routers: { include: { _count: { select: { customers: true } } } },
        },
      });

      const totalRouters = locations.reduce((s, l) => s + l.routers.length, 0);
      const totalCustomers = locations.reduce((s, l) => s + l.routers.reduce((rs: number, r: any) => rs + (r._count?.customers || 0), 0), 0);

      // Get voucher sales per location
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId, createdAt: { gte: thirtyDaysAgo } },
        include: { location: { select: { name: true } } },
      });

      const locationPerformance = locations.map((loc) => {
        const locVouchers = vouchers.filter((v) => v.location?.name === loc.name);          const totalCustomers = (loc as any).routers?.reduce((s: number, r: any) => s + (r._count?.customers || 0), 0) || 0;
        const revenue = locVouchers.length * 1500;
        return {
          name: loc.name,
          routers: loc.routers.length,
          customers: totalCustomers,
          monthlyVouchers: locVouchers.length,
          estimatedRevenue: revenue,
          revenuePerCustomer: totalCustomers > 0 ? revenue / totalCustomers : 0,
          customersPerRouter: loc.routers.length > 0 ? totalCustomers / loc.routers.length : 0,
        };
      });

      const perfData = locationPerformance
        .map(
          (l) =>
            `- ${l.name}: ${l.routers} routers, ${l.customers} customers, ${l.monthlyVouchers} vouchers, ~${l.estimatedRevenue.toLocaleString()} TZS revenue, ${l.revenuePerCustomer.toLocaleString()} TZS/customer, ${l.customersPerRouter.toFixed(1)} customers/router`
        )
        .join("\n");

      const aiPrompt: BedrockMessage[] = [
        {
          role: "system",
          content: `You are a business growth advisor for Tanzanian ISP resellers. Analyze performance and suggest expansion strategies.

Respond in JSON format:
{
  "performance": {
    "overallScore": "A|B|C|D",
    "strengths": ["strength in Swahili"],
    "weaknesses": ["weakness in Swahili"]
  },
  "locationAnalysis": [
    {
      "name": "location name",
      "rating": "star|good|average|poor",
      "insight": "insight in Swahili",
      "action": "recommended action in Swahili"
    }
  ],
  "expansionSuggestions": [
    {
      "suggestion": "expansion idea in Swahili",
      "estimatedImpact": "impact description in Swahili",
      "investment": "estimated cost in TZS"
    }
  ],
  "benchmarkComparison": "how this reseller compares to typical Tanzania resellers in Swahili",
  "summary": "growth summary in Swahili"
}

Rules:
- Compare to typical Tanzania ISP reseller benchmarks
- Top resellers: 30-50 customers per router, 200K+ TZS revenue per location
- Suggest specific locations for expansion
- Consider Tanzanian cities: Dar es Salaam, Arusha, Mwanza, Dodoma, Mbeya
- Respond in Swahili with English business terms`,
        },
        {
          role: "user",
          content: `Reseller: ${org?.name || "Unknown"} (${org?.subscriptionPlan || "free"} plan)
Plan: ${org?.subscriptionPlan || "free"}

Performance data:
${perfData}

Total: ${totalRouters} routers, ${totalCustomers} customers across ${locations.length} locations
Total estimated revenue: ~${locationPerformance.reduce((s, l) => s + l.estimatedRevenue, 0).toLocaleString()} TZS/month`,
        },
      ];

      const aiResponse = await askAI(aiPrompt, `${locations.length} locations, ${totalRouters} routers, ${totalCustomers} customers.`);

      let analysis;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        analysis = null;
      }

      return {
        reseller: { name: org?.name, plan: org?.subscriptionPlan },
        locations: locationPerformance,
        stats: { totalRouters, totalCustomers, totalLocations: locations.length },
        aiAnalysis: analysis,
        rawResponse: aiResponse,
      };
    } catch (err) {
      if (isMissingTable(err)) {
        return { reseller: null, locations: [], stats: { totalRouters: 0, totalCustomers: 0, totalLocations: 0 }, aiAnalysis: null, rawResponse: "No data available" };
      }
      throw err;
    }
  }
}
