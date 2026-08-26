import { prisma } from "../../prisma/client";

export interface PerformanceScore {
  overall: number; // 0-100
  breakdown: {
    customerGrowth: number;
    revenuePerRouter: number;
    retentionRate: number;
    operationalEfficiency: number;
  };
}

export interface CoachingTip {
  area: string;
  tip: string;
  priority: "high" | "medium" | "low";
  estimatedImpact: string;
}

export interface BenchmarkComparison {
  metric: string;
  yours: number;
  industryAvg: number;
  topPerformer: number;
  status: "above" | "average" | "below";
}

export interface CoachingReport {
  performanceScore: PerformanceScore;
  tips: CoachingTip[];
  benchmarks: BenchmarkComparison[];
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
}

export class ResellerCoachingService {
  async getCoachingReport(resellerId: string): Promise<CoachingReport> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get reseller data
    const org = await prisma.organization.findFirst({ where: { id: resellerId } });
    const locations = await prisma.location.findMany({
      where: { organizationId: resellerId },
      include: {
        routers: { include: { _count: { select: { customers: true } } } },
      },
    });

    const totalRouters = locations.reduce((s, l) => s + l.routers.length, 0);
    const totalCustomers = locations.reduce(
      (s, l) => s + l.routers.reduce((rs: number, r: any) => rs + (r._count?.customers || 0), 0),
      0
    );

    // Get voucher sales
    const vouchers = await prisma.voucher.findMany({
      where: { organizationId: resellerId, status: "USED" },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const monthVouchers = vouchers.filter((v) => new Date(v.createdAt) > thirtyDaysAgo);
    const estimatedRevenue = monthVouchers.length * 1500;
    const revenuePerRouter = totalRouters > 0 ? estimatedRevenue / totalRouters : 0;
    const customersPerRouter = totalRouters > 0 ? totalCustomers / totalRouters : 0;

    // Calculate retention rate (customers with recent activity)
    const recentVouchers = new Set(monthVouchers.map((v) => v.usedByCustomerId).filter(Boolean));
    const retentionRate = totalCustomers > 0 ? recentVouchers.size / totalCustomers : 0;

    // Performance score
    const customerGrowthScore = Math.min(100, customersPerRouter * 3); // Target: 30+ per router = 100
    const revenueScore = Math.min(100, (revenuePerRouter / 300000) * 100); // Target: 300K per router = 100
    const retentionScore = Math.min(100, retentionRate * 120); // Target: 80% retention = 96
    const efficiencyScore = Math.min(100, (locations.length / Math.max(1, totalRouters)) * 50); // Target: 1 location per 2 routers

    const overall = Math.round(
      customerGrowthScore * 0.3 + revenueScore * 0.35 + retentionScore * 0.25 + efficiencyScore * 0.1
    );

    const grade: CoachingReport["grade"] =
      overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";

    // Benchmarks (typical Tanzania ISP reseller)
    const benchmarks: BenchmarkComparison[] = [
      {
        metric: "Customers per Router",
        yours: Math.round(customersPerRouter * 10) / 10,
        industryAvg: 15,
        topPerformer: 40,
        status: customersPerRouter >= 20 ? "above" : customersPerRouter >= 10 ? "average" : "below",
      },
      {
        metric: "Revenue per Router (TZS/month)",
        yours: Math.round(revenuePerRouter),
        industryAvg: 150000,
        topPerformer: 400000,
        status: revenuePerRouter >= 200000 ? "above" : revenuePerRouter >= 100000 ? "average" : "below",
      },
      {
        metric: "Retention Rate",
        yours: Math.round(retentionRate * 100),
        industryAvg: 60,
        topPerformer: 85,
        status: retentionRate >= 0.7 ? "above" : retentionRate >= 0.5 ? "average" : "below",
      },
      {
        metric: "Locations per Router",
        yours: Math.round((locations.length / Math.max(1, totalRouters)) * 10) / 10,
        industryAvg: 0.5,
        topPerformer: 1.0,
        status: locations.length / Math.max(1, totalRouters) >= 0.7 ? "above" : "average",
      },
    ];

    // Generate coaching tips based on weak areas
    const tips: CoachingTip[] = [];

    if (customersPerRouter < 15) {
      tips.push({
        area: "Customer Acquisition",
        tip: "Your routers have low customer density. Target high-traffic areas: hostels, markets, internet cafes. Offer first-week free trial to attract new customers.",
        priority: "high",
        estimatedImpact: "+5-10 customers per router within 30 days",
      });
    }

    if (revenuePerRouter < 150000) {
      tips.push({
        area: "Revenue Optimization",
        tip: "Consider upselling to higher packages. Customers on daily vouchers (1,000 TZS) could save money with weekly packages (5,000 TZS). Bundle offers: weekly + speed boost.",
        priority: "high",
        estimatedImpact: "+20-30% revenue per customer",
      });
    }

    if (retentionRate < 0.6) {
      tips.push({
        area: "Customer Retention",
        tip: "High churn detected. Send expiry reminders 24h before vouchers expire. Offer loyalty discounts: buy 6 weekly vouchers, get 1 free. Follow up with customers who haven't purchased in 5+ days.",
        priority: "high",
        estimatedImpact: "Reduce churn by 15-25%",
      });
    }

    if (locations.length < 2) {
      tips.push({
        area: "Expansion",
        tip: "You have only 1 location. Consider expanding to a second area. Top resellers average 3-5 locations. Look for areas with high student or business population.",
        priority: "medium",
        estimatedImpact: "+40-60% total revenue potential",
      });
    }

    if (totalRouters < 3) {
      tips.push({
        area: "Infrastructure",
        tip: "With few routers, you have limited reach. Consider adding routers in high-demand areas. Start with MikroTik hEX lite (250,000 TZS) for cost-effective expansion.",
        priority: "medium",
        estimatedImpact: "+30-50 customers per new router",
      });
    }

    tips.push({
      area: "Marketing",
      tip: "Use WhatsApp groups for each location to announce promotions and new vouchers. Word-of-mouth is the most effective marketing in Tanzania.",
      priority: "low",
      estimatedImpact: "+10-15% customer acquisition",
    });

    tips.push({
      area: "Operations",
      tip: "Track your daily sales manually or use the NetMaster dashboard. Know your peak hours and adjust pricing accordingly.",
      priority: "low",
      estimatedImpact: "Better operational decisions",
    });

    const summary = grade === "A" || grade === "B"
      ? `Great performance! You're operating above industry average. Focus on scaling and maintaining quality.`
      : grade === "C"
      ? `Solid foundation with room for improvement. Focus on the high-priority tips to reach the next level.`
      : `There's significant opportunity for growth. Start with customer acquisition and retention strategies.`;

    return {
      performanceScore: {
        overall,
        breakdown: {
          customerGrowth: Math.round(customerGrowthScore),
          revenuePerRouter: Math.round(revenueScore),
          retentionRate: Math.round(retentionScore),
          operationalEfficiency: Math.round(efficiencyScore),
        },
      },
      tips: tips.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }),
      benchmarks,
      grade,
      summary,
    };
  }
}
