import { prisma } from "../../prisma/client";

export interface CustomerSegment {
  name: string;
  count: number;
  avgRevenue: number;
  avgDaysSinceLastPurchase: number;
  characteristics: string[];
  customers: Array<{
    id: string;
    name: string;
    phone: string;
    status: string;
    segment: string;
    daysSinceLastPurchase: number;
    totalVouchers: number;
    router: string;
  }>;
}

export interface SegmentationResult {
  segments: CustomerSegment[];
  summary: {
    totalCustomers: number;
    activeCustomers: number;
    atRiskCustomers: number;
    newCustomers: number;
  };
  recommendations: string[];
}

export class CustomerSegmentationService {
  async segmentCustomers(resellerId: string): Promise<SegmentationResult> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all customers with their data
    const customers = await prisma.customer.findMany({
      where: { organizationId: resellerId, deletedAt: null },
      include: {
        router: { select: { name: true } },
        subscription: { include: { package: true } },
      },
    });

    // Get voucher usage for each customer
    const customerIds = customers.map((c) => c.id);
    const vouchers = customerIds.length > 0
      ? await prisma.voucher.findMany({
          where: { organizationId: resellerId, usedByCustomerId: { in: customerIds } },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Analyze each customer
    const analyzed = customers.map((c) => {
      const custVouchers = vouchers.filter((v) => v.usedByCustomerId === c.id);
      const lastVoucher = custVouchers[0];
      const lastPurchase = lastVoucher?.createdAt;
      const daysSinceLastPurchase = lastPurchase
        ? Math.floor((now.getTime() - new Date(lastPurchase).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const recentVouchers = custVouchers.filter(
        (v) => new Date(v.createdAt) > sevenDaysAgo
      ).length;

      const monthlyVouchers = custVouchers.filter(
        (v) => new Date(v.createdAt) > thirtyDaysAgo
      ).length;

      // Calculate segment
      let segment = "new";
      if (c.status === "SUSPENDED") segment = "suspended";
      else if (daysSinceLastPurchase > 7 && monthlyVouchers > 0) segment = "at-risk";
      else if (daysSinceLastPurchase <= 3 && monthlyVouchers >= 8) segment = "power-user";
      else if (daysSinceLastPurchase <= 3 && monthlyVouchers >= 3) segment = "active";
      else if (daysSinceLastPurchase <= 7) segment = "regular";
      else if (monthlyVouchers === 0) segment = "inactive";
      else segment = "casual";

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        status: c.status,
        segment,
        daysSinceLastPurchase,
        totalVouchers: custVouchers.length,
        recentVouchers,
        monthlyVouchers,
        router: c.router?.name || "Unknown",
        package: c.subscription?.package?.name || "No package",
        monthlySpend: c.subscription?.package?.priceCents || 0,
      };
    });

    // Group into segments
    const segmentDefs: Record<string, { label: string; characteristics: string[] }> = {
      "power-user": {
        label: "⚡ Power Users",
        characteristics: ["High voucher usage (8+/month)", "Consistent daily buyers", "Highest revenue potential"],
      },
      active: {
        label: "🟢 Active",
        characteristics: ["Regular buyers (3-7/month)", "Reliable revenue stream", "Good retention"],
      },
      regular: {
        label: "🔵 Regular",
        characteristics: ["Occasional buyers", "Stable but could be encouraged to buy more"],
      },
      casual: {
        label: "🟡 Casual",
        characteristics: ["Infrequent purchases", "Weekend or special occasion buyers"],
      },
      "at-risk": {
        label: "🟠 At Risk",
        characteristics: ["Haven't bought in 7+ days", "Previously active", "Need retention action"],
      },
      new: {
        label: "🆕 New",
        characteristics: ["No purchase history yet", "Need onboarding follow-up"],
      },
      inactive: {
        label: "⚪ Inactive",
        characteristics: ["No voucher purchases", "May have churned", "Need re-engagement"],
      },
      suspended: {
        label: "🔴 Suspended",
        characteristics: ["Account suspended", "Subscription expired", "Need renewal outreach"],
      },
    };

    const segments: CustomerSegment[] = Object.entries(segmentDefs).map(([key, def]) => {
      const segCustomers = analyzed.filter((c) => c.segment === key);
      return {
        name: def.label,
        count: segCustomers.length,
        avgRevenue: segCustomers.length > 0
          ? Math.round(segCustomers.reduce((s, c) => s + c.monthlySpend, 0) / segCustomers.length)
          : 0,
        avgDaysSinceLastPurchase: segCustomers.length > 0
          ? Math.round(segCustomers.reduce((s, c) => s + c.daysSinceLastPurchase, 0) / segCustomers.length)
          : 0,
        characteristics: def.characteristics,
        customers: segCustomers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          status: c.status,
          segment: c.segment,
          daysSinceLastPurchase: c.daysSinceLastPurchase,
          totalVouchers: c.totalVouchers,
          router: c.router,
        })),
      };
    }).filter((s) => s.count > 0).sort((a, b) => {
      const order = ["power-user", "active", "regular", "casual", "at-risk", "new", "inactive", "suspended"];
      return order.indexOf(a.name.toLowerCase().replace(/[^\w-]/g, "")) - order.indexOf(b.name.toLowerCase().replace(/[^\w-]/g, ""));
    });

    const summary = {
      totalCustomers: customers.length,
      activeCustomers: analyzed.filter((c) => ["power-user", "active", "regular"].includes(c.segment)).length,
      atRiskCustomers: analyzed.filter((c) => c.segment === "at-risk").length,
      newCustomers: analyzed.filter((c) => c.segment === "new").length,
    };

    const recommendations: string[] = [];
    if (summary.atRiskCustomers > 0) {
      recommendations.push(`⚠️ ${summary.atRiskCustomers} customers at risk of churning. Consider sending retention offers (discounted weekly voucher or free speed boost).`);
    }
    if (summary.newCustomers > 0) {
      recommendations.push(`🆕 ${summary.newCustomers} new customers without purchases. Follow up with a welcome message and first-purchase discount.`);
    }
    const powerUsers = analyzed.filter((c) => c.segment === "power-user").length;
    if (powerUsers > 0) {
      recommendations.push(`⭐ ${powerUsers} power users generating the most revenue. Consider loyalty rewards to keep them engaged.`);
    }
    const inactive = analyzed.filter((c) => c.segment === "inactive").length;
    if (inactive > summary.totalCustomers * 0.3) {
      recommendations.push(`📉 ${inactive} customers (${Math.round(inactive / summary.totalCustomers * 100)}%) are inactive. Run a re-engagement campaign with special offers.`);
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ Customer health looks good. Keep monitoring segments weekly.");
    }

    return { segments, summary, recommendations };
  }
}
