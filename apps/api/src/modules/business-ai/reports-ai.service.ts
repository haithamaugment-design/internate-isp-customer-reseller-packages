import { prisma } from "../../prisma/client";

export interface EarningsBreakdown {
  location: string;
  voucherSales: number;
  estimatedRevenue: number;
  customerCount: number;
  topPackage: string;
}

export interface EarningsReport {
  period: string;
  totalRevenue: number;
  totalVoucherSales: number;
  avgDailyRevenue: number;
  topDay: { date: string; revenue: number };
  breakdown: EarningsBreakdown[];
  subscriptionCost: number;
  netEarnings: number;
  profitMargin: number;
  trends: {
    vsLastMonth: number; // percentage change
    bestLocation: string;
    worstLocation: string;
  };
  recommendations: string[];
  generatedAt: string;
}

export class ReportsAIService {
  async generateEarningsReport(resellerId: string): Promise<EarningsReport> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get org info for subscription cost
    const org = await prisma.organization.findFirst({ where: { id: resellerId } });

    // Get locations and routers
    const locations = await prisma.location.findMany({
      where: { organizationId: resellerId },
      include: {
        routers: {
          include: { _count: { select: { customers: true } } },
        },
      },
    });

    // Get vouchers for current month
    const vouchers = await prisma.voucher.findMany({
      where: {
        organizationId: resellerId,
        status: "USED",
        createdAt: { gte: monthStart },
      },
      include: { location: { select: { name: true } } },
    });

    // Get vouchers for last month (for comparison)
    const lastMonthVouchers = await prisma.voucher.findMany({
      where: {
        organizationId: resellerId,
        status: "USED",
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
    });

    // Calculate total revenue
    const avgPricePerVoucher = 1500; // Average TZS
    const totalRevenue = vouchers.length * avgPricePerVoucher;
    const lastMonthRevenue = lastMonthVouchers.length * avgPricePerVoucher;

    // Daily breakdown
    const byDay = new Map<string, number>();
    vouchers.forEach((v) => {
      const day = v.createdAt.toISOString().split("T")[0];
      byDay.set(day, (byDay.get(day) || 0) + 1);
    });

    const daysInMonth = now.getDate();
    const avgDailyRevenue = daysInMonth > 0 ? Math.round(totalRevenue / daysInMonth) : 0;

    let topDay = { date: "", revenue: 0 };
    for (const [date, count] of byDay) {
      const revenue = count * avgPricePerVoucher;
      if (revenue > topDay.revenue) {
        topDay = { date, revenue };
      }
    }

    // Location breakdown
    const totalRouters = locations.reduce((s, l) => s + l.routers.length, 0);
    const subscriptionPlan = org?.subscriptionPlan || "free";
    const subscriptionCost = subscriptionPlan === "enterprise"
      ? totalRouters * 25000
      : subscriptionPlan === "growth"
      ? totalRouters * 8000
      : 0;

    const breakdown: EarningsBreakdown[] = locations.map((loc) => {
      const locVouchers = vouchers.filter((v) => v.location?.name === loc.name);
      const customerCount = loc.routers.reduce((s: number, r: any) => s + (r._count?.customers || 0), 0);

      // Find top package for this location
      const packages = new Map<string, number>();
      locVouchers.forEach((v) => {
        // Vouchers don't directly link to packages, estimate
        packages.set("Daily Pass", (packages.get("Daily Pass") || 0) + 1);
      });
      const topPackage = "Daily Pass"; // Default

      return {
        location: loc.name,
        voucherSales: locVouchers.length,
        estimatedRevenue: locVouchers.length * avgPricePerVoucher,
        customerCount,
        topPackage,
      };
    }).sort((a, b) => b.estimatedRevenue - a.estimatedRevenue);

    const netEarnings = totalRevenue - subscriptionCost;
    const profitMargin = totalRevenue > 0 ? Math.round((netEarnings / totalRevenue) * 100) : 0;

    // Trends
    const vsLastMonth = lastMonthRevenue > 0
      ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 0;

    const bestLocation = breakdown.length > 0 ? breakdown[0].location : "N/A";
    const worstLocation = breakdown.length > 0 ? breakdown[breakdown.length - 1].location : "N/A";

    // Recommendations
    const recommendations: string[] = [];
    if (vsLastMonth < -10) {
      recommendations.push(`📉 Revenue dropped ${Math.abs(vsLastMonth)}% vs last month. Review marketing strategies and consider promotions.`);
    } else if (vsLastMonth > 10) {
      recommendations.push(`📈 Revenue grew ${vsLastMonth}% vs last month! Great momentum — consider expanding to new areas.`);
    }

    if (netEarnings < 0) {
      recommendations.push(`⚠️ Net earnings are negative after subscription costs. Consider upgrading your plan or reducing costs.`);
    }

    if (breakdown.length > 0) {
      const topLoc = breakdown[0];
      const bottomLoc = breakdown[breakdown.length - 1];
      if (topLoc.estimatedRevenue > bottomLoc.estimatedRevenue * 3) {
        recommendations.push(`💡 ${topLoc.location} is generating ${Math.round(topLoc.estimatedRevenue / bottomLoc.estimatedRevenue)}x more than ${bottomLoc.location}. Consider strategies to boost underperforming locations.`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ Earnings look healthy. Keep up the good work!");
    }

    return {
      period: `${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
      totalRevenue,
      totalVoucherSales: vouchers.length,
      avgDailyRevenue,
      topDay,
      breakdown,
      subscriptionCost,
      netEarnings,
      profitMargin,
      trends: {
        vsLastMonth,
        bestLocation,
        worstLocation,
      },
      recommendations,
      generatedAt: now.toISOString(),
    };
  }
}
