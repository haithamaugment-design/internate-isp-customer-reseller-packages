import { prisma } from "../../prisma/client";
import crypto from "crypto";

export interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  conversionRate: number;
  topReferrers: Array<{
    customerId: string;
    name: string;
    referrals: number;
    successful: number;
    reward: number;
  }>;
  referralCode: string;
  shareLink: string;
}

export interface ReferralInsight {
  type: "opportunity" | "warning" | "achievement" | "suggestion";
  title: string;
  message: string;
  action?: string;
  priority: "high" | "medium" | "low";
}

export interface ReferralReport {
  stats: ReferralStats;
  insights: ReferralInsight[];
  recommendations: string[];
  recentActivity: Array<{
    date: Date;
    action: string;
    details: string;
  }>;
}

export class ReferralService {
  /**
   * Generate or get a referral code for a customer
   */
  async getOrCreateReferralCode(customerId: string, resellerId: string): Promise<string> {
    // Check if customer already has a referral code in site_settings
    const settingKey = `referral_code_${customerId}`;
    const existing = await prisma.siteSetting.findUnique({ where: { key: settingKey } });

    if (existing) {
      return existing.value as string;
    }

    // Generate new code
    const code = `NM-${customerId.slice(0, 6).toUpperCase()}-${crypto.randomInt(1000, 9999)}`;

    await prisma.siteSetting.create({
      data: {
        key: settingKey,
        value: code,
      },
    });

    return code;
  }

  /**
   * Track a referral (customer A refers customer B)
   */
  async trackReferral(
    referrerId: string,
    referredId: string,
    resellerId: string
  ): Promise<{ success: boolean; message: string }> {
    // Check if already referred
    const settingKey = `referral_${referrerId}_${referredId}`;
    const existing = await prisma.siteSetting.findUnique({ where: { key: settingKey } });

    if (existing) {
      return { success: false, message: "This referral has already been tracked" };
    }

    // Track the referral
    await prisma.siteSetting.create({
      data: {
        key: settingKey,
        value: { referrerId, referredId, resellerId, status: "pending", createdAt: new Date().toISOString() },
      },
    });

    return { success: true, message: "Referral tracked successfully" };
  }

  /**
   * Mark a referral as successful (referred customer made first purchase)
   */
  async confirmReferral(referrerId: string, referredId: string): Promise<void> {
    const settingKey = `referral_${referrerId}_${referredId}`;
    const existing = await prisma.siteSetting.findUnique({ where: { key: settingKey } });

    if (existing) {
      const data = existing.value as any;
      await prisma.siteSetting.update({
        where: { key: settingKey },
        data: { value: { ...data, status: "confirmed", confirmedAt: new Date().toISOString() } },
      });
    }
  }

  /**
   * Get referral statistics for a reseller
   */
  async getReferralStats(resellerId: string): Promise<ReferralStats> {
    // Get all referral settings for this reseller
    const allSettings = await prisma.siteSetting.findMany();
    const referrals = allSettings
      .filter((s) => s.key.startsWith("referral_") && !s.key.startsWith("referral_code_"))
      .map((s) => s.value as any)
      .filter((v) => v?.resellerId === resellerId);

    const totalReferrals = referrals.length;
    const successfulReferrals = referrals.filter((r) => r.status === "confirmed").length;
    const pendingReferrals = referrals.filter((r) => r.status === "pending").length;
    const conversionRate = totalReferrals > 0 ? Math.round((successfulReferrals / totalReferrals) * 100) : 0;

    // Top referrers
    const referrerCounts = new Map<string, { referrals: number; successful: number }>();
    for (const r of referrals) {
      const existing = referrerCounts.get(r.referrerId) || { referrals: 0, successful: 0 };
      existing.referrals++;
      if (r.status === "confirmed") existing.successful++;
      referrerCounts.set(r.referrerId, existing);
    }

    // Get customer names for top referrers
    const topReferrerIds = [...referrerCounts.entries()]
      .sort((a, b) => b[1].referrals - a[1].referrals)
      .slice(0, 10)
      .map(([id]) => id);

    const topReferrerCustomers = topReferrerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: topReferrerIds } },
          select: { id: true, name: true },
        })
      : [];

    const customerNameMap = new Map(topReferrerCustomers.map((c) => [c.id, c.name]));

    const topReferrers = [...referrerCounts.entries()]
      .sort((a, b) => b[1].referrals - a[1].referrals)
      .slice(0, 10)
      .map(([id, data]) => ({
        customerId: id,
        name: customerNameMap.get(id) || "Unknown",
        referrals: data.referrals,
        successful: data.successful,
        reward: data.successful * 500, // 500 TZS per successful referral
      }));

    // Generate a default referral code for the reseller
    const defaultCode = `NETMASTER-${resellerId.slice(0, 4).toUpperCase()}`;

    return {
      totalReferrals,
      successfulReferrals,
      pendingReferrals,
      conversionRate,
      topReferrers,
      referralCode: defaultCode,
      shareLink: `https://netmaster.co.tz/ref/${defaultCode}`,
    };
  }

  /**
   * Generate referral insights and recommendations
   */
  async getReferralInsights(resellerId: string): Promise<ReferralInsight[]> {
    const stats = await this.getReferralStats(resellerId);
    const insights: ReferralInsight[] = [];

    if (stats.totalReferrals === 0) {
      insights.push({
        type: "suggestion",
        title: "🚀 Start Your Referral Program",
        message: "You haven't tracked any referrals yet. Ask your best customers to refer friends — offer them a 500 TZS reward for each successful referral.",
        priority: "high",
      });
    }

    if (stats.conversionRate < 30 && stats.totalReferrals > 5) {
      insights.push({
        type: "warning",
        title: "📉 Low Conversion Rate",
        message: `Only ${stats.conversionRate}% of referrals converted. Make sure referred customers get a warm welcome and first-purchase discount.`,
        action: "Send a personalized welcome message to pending referrals",
        priority: "high",
      });
    }

    if (stats.conversionRate >= 50 && stats.totalReferrals > 5) {
      insights.push({
        type: "achievement",
        title: "🎉 High Conversion Rate",
        message: `${stats.conversionRate}% conversion rate — your referral program is working well! Consider increasing the reward to accelerate growth.`,
        priority: "low",
      });
    }

    if (stats.topReferrers.length > 0) {
      const top = stats.topReferrers[0];
      insights.push({
        type: "suggestion",
        title: "⭐ Top Referrer Identified",
        message: `${top.name} has referred ${top.referrals} customers (${top.successful} confirmed). Consider offering them a loyalty bonus or VIP status.`,
        priority: "medium",
      });
    }

    if (stats.pendingReferrals > 3) {
      insights.push({
        type: "suggestion",
        title: "⏳ Follow Up on Pending Referrals",
        message: `${stats.pendingReferrals} referrals are pending. Contact these potential customers to convert them.`,
        action: "Send a WhatsApp message to pending referrals with a special offer",
        priority: "medium",
      });
    }

    return insights;
  }

  /**
   * Get full referral report
   */
  async getReferralReport(resellerId: string): Promise<ReferralReport> {
    const stats = await this.getReferralStats(resellerId);
    const insights = await this.getReferralInsights(resellerId);

    const recommendations: string[] = [];
    if (stats.totalReferrals === 0) {
      recommendations.push("Create referral cards with your unique code to hand out to customers.");
      recommendations.push("Offer 500 TZS credit for each successful referral to incentivize sharing.");
    }
    if (stats.conversionRate < 50) {
      recommendations.push("Send a follow-up message to pending referrals within 24 hours.");
      recommendations.push("Offer referred customers a 15% discount on their first voucher.");
    }
    if (stats.topReferrers.length > 0) {
      recommendations.push(`Reward your top referrer (${stats.topReferrers[0].name}) with a special bonus.`);
    }
    recommendations.push("Share your referral link on WhatsApp groups in your area.");
    recommendations.push("Print referral codes on receipts and business cards.");

    // Recent activity (from audit logs)
    const recentActivity = await prisma.auditLog.findMany({
      where: { entityType: "Customer", action: "CREATE" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }).then((logs) =>
      logs.map((log) => ({
        date: log.createdAt,
        action: "New customer onboarded",
        details: `Customer ${log.entityId} was added`,
      }))
    );

    return {
      stats,
      insights,
      recommendations,
      recentActivity,
    };
  }
}
