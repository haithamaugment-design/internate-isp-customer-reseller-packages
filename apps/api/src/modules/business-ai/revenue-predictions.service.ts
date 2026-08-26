import { prisma } from "../../prisma/client";
import { AnalyticsEngine, type SalesData } from "./analytics-engine";

export interface DailyForecast {
  date: string;
  predicted: number;
  actual: number | null;
  confidence: number;
}

export interface RevenueForecast {
  planName: string;
  monthTarget: number;
  currentRevenue: number;
  projectedMonthEnd: number;
  daysRemaining: number;
  dailyRequired: number;
  currentDailyAvg: number;
  onTrack: boolean;
  gapPercent: number;
  dailyForecasts: DailyForecast[];
  recommendations: string[];
}

export interface SeasonalPattern {
  month: string;
  avgRevenue: number;
  trend: "up" | "down" | "stable";
}

export class RevenuePredictionsService {
  /**
   * Generate detailed revenue forecast for the current month
   */
  async generateForecast(resellerId: string): Promise<RevenueForecast | null> {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - dayOfMonth;

    // Get active plan
    const activePlan = await prisma.businessPlan.findFirst({
      where: { resellerId, status: "ACTIVE" },
      orderBy: { activatedAt: "desc" },
    }).catch(() => null);

    if (!activePlan) return null;

    // Get voucher sales history
    const vouchers = await prisma.voucher.findMany({
      where: { organizationId: resellerId, status: "USED" },
      include: { location: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthVouchers = vouchers.filter(
      (v) => v.createdAt.toISOString().split("T")[0] >= monthStart
    );

    // Current month revenue (estimated from voucher count)
    const currentRevenue = monthVouchers.length * 1500; // Average 1500 TZS per voucher

    // Daily averages
    const currentDailyAvg = dayOfMonth > 0 ? currentRevenue / dayOfMonth : 0;
    const dailyRequired = daysRemaining > 0 ? (activePlan.monthlyRevenueTarget - currentRevenue) / daysRemaining : 0;

    // Project month end
    const projectedMonthEnd = currentRevenue + currentDailyAvg * daysRemaining;

    // Gap analysis
    const gapPercent = activePlan.monthlyRevenueTarget > 0
      ? Math.round(((activePlan.monthlyRevenueTarget - projectedMonthEnd) / activePlan.monthlyRevenueTarget) * 100)
      : 0;

    // Generate daily forecasts
    const dailyForecasts = this.generateDailyForecasts(
      vouchers,
      monthStart,
      dayOfMonth,
      daysInMonth,
      currentDailyAvg,
      dailyRequired
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      currentRevenue,
      activePlan.monthlyRevenueTarget,
      currentDailyAvg,
      dailyRequired,
      daysRemaining,
      monthVouchers.length
    );

    return {
      planName: activePlan.name,
      monthTarget: activePlan.monthlyRevenueTarget,
      currentRevenue,
      projectedMonthEnd: Math.round(projectedMonthEnd),
      daysRemaining,
      dailyRequired: Math.round(dailyRequired),
      currentDailyAvg: Math.round(currentDailyAvg),
      onTrack: projectedMonthEnd >= activePlan.monthlyRevenueTarget * 0.9,
      gapPercent: Math.max(0, gapPercent),
      dailyForecasts,
      recommendations,
    };
  }

  /**
   * Get historical daily revenue for the current month
   */
  async getDailyRevenue(resellerId: string): Promise<Array<{ date: string; revenue: number; voucherCount: number }>> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const vouchers = await prisma.voucher.findMany({
      where: {
        organizationId: resellerId,
        status: "USED",
        createdAt: { gte: monthStart },
      },
      orderBy: { createdAt: "asc" },
    });

    const byDay = new Map<string, { revenue: number; count: number }>();
    for (const v of vouchers) {
      const date = v.createdAt.toISOString().split("T")[0];
      const existing = byDay.get(date) || { revenue: 0, count: 0 };
      existing.revenue += 1500; // Average price
      existing.count += 1;
      byDay.set(date, existing);
    }

    // Fill in missing days with 0
    const result: Array<{ date: string; revenue: number; voucherCount: number }> = [];
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const data = byDay.get(date);
      result.push({
        date,
        revenue: data?.revenue || 0,
        voucherCount: data?.count || 0,
      });
    }

    return result;
  }

  /**
   * Analyze seasonal patterns from historical data (last 6 months)
   */
  async getSeasonalPatterns(resellerId: string): Promise<SeasonalPattern[]> {
    const now = new Date();
    const patterns: SeasonalPattern[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthStart = monthDate.toISOString().split("T")[0];
      const monthEndStr = monthEnd.toISOString().split("T")[0];

      const vouchers = await prisma.voucher.findMany({
        where: {
          organizationId: resellerId,
          status: "USED",
          createdAt: { gte: monthDate, lte: monthEnd },
        },
      });

      const revenue = vouchers.length * 1500;
      const monthName = monthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

      // Compare with previous month
      let trend: "up" | "down" | "stable" = "stable";
      if (i < 5) {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth() - i, 0);
        const prevVouchers = await prisma.voucher.findMany({
          where: {
            organizationId: resellerId,
            status: "USED",
            createdAt: { gte: prevMonth, lte: prevMonthEnd },
          },
        });
        const prevRevenue = prevVouchers.length * 1500;
        if (revenue > prevRevenue * 1.1) trend = "up";
        else if (revenue < prevRevenue * 0.9) trend = "down";
      }

      patterns.push({
        month: monthName,
        avgRevenue: revenue,
        trend,
      });
    }

    return patterns;
  }

  private generateDailyForecasts(
    vouchers: any[],
    monthStart: string,
    dayOfMonth: number,
    daysInMonth: number,
    currentDailyAvg: number,
    requiredDaily: number
  ): DailyForecast[] {
    const forecasts: DailyForecast[] = [];
    const now = new Date();

    // Build actual daily data
    const byDay = new Map<string, number>();
    for (const v of vouchers) {
      const date = v.createdAt.toISOString().split("T")[0];
      if (date >= monthStart) {
        byDay.set(date, (byDay.get(date) || 0) + 1500);
      }
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const actual = d <= dayOfMonth ? (byDay.get(date) || 0) : null;

      // Predict future days using rolling average + trend
      let predicted = currentDailyAvg;
      if (d > dayOfMonth) {
        // Blend between current avg and required daily
        const daysIntoFuture = d - dayOfMonth;
        predicted = currentDailyAvg + (requiredDaily - currentDailyAvg) * Math.min(0.5, daysIntoFuture / daysInMonth);
      }

      forecasts.push({
        date,
        predicted: Math.round(predicted),
        actual,
        confidence: d <= dayOfMonth ? 1.0 : Math.max(0.3, 1.0 - (d - dayOfMonth) * 0.05),
      });
    }

    return forecasts;
  }

  private generateRecommendations(
    currentRevenue: number,
    target: number,
    dailyAvg: number,
    requiredDaily: number,
    daysRemaining: number,
    voucherCount: number
  ): string[] {
    const recommendations: string[] = [];
    const progress = target > 0 ? currentRevenue / target : 0;
    const dayProgress = new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

    if (progress < dayProgress * 0.7) {
      recommendations.push(`⚠️ You're at ${Math.round(progress * 100)}% of target but ${Math.round(dayProgress * 100)}% through the month. You need ${(target - currentRevenue).toLocaleString()} TZS in ${daysRemaining} days.`);
      recommendations.push(`💡 Consider running a promotion — offer 3-day vouchers at 15% off to boost volume.`);
    }

    if (requiredDaily > dailyAvg * 1.5) {
      recommendations.push(`📈 Required daily revenue (${requiredDaily.toLocaleString()} TZS) is ${Math.round((requiredDaily / dailyAvg - 1) * 100)}% above your current average. Consider expanding to new locations.`);
    }

    if (voucherCount < 10) {
      recommendations.push(`🎫 Low voucher activity this month (${voucherCount} sold). Review your marketing channels and customer reach.`);
    }

    if (progress >= dayProgress * 1.1) {
      recommendations.push(`🎉 Great! You're ahead of target. Consider saving excess revenue or investing in expansion.`);
    }

    if (recommendations.length === 0) {
      recommendations.push(`✅ You're on track to meet your revenue target. Keep up the good work!`);
    }

    return recommendations;
  }
}
