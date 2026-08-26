import { prisma } from "../../prisma/client";

export interface OnboardingStatus {
  customerId: string;
  customerName: string;
  daysSinceCreated: number;
  hasConnected: boolean;
  firstConnectionAt: Date | null;
  voucherRedeemed: boolean;
  welcomeSent: boolean;
  status: "new" | "connected" | "active" | "stale";
  nextAction: string;
  daysToConnect: number | null;
}

export interface OnboardingReport {
  customers: OnboardingStatus[];
  summary: {
    total: number;
    new: number;
    connected: number;
    active: number;
    stale: number;
  };
  recommendations: string[];
}

export class OnboardingService {
  async getOnboardingReport(resellerId: string): Promise<OnboardingReport> {
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all customers
    const customers = await prisma.customer.findMany({
      where: { organizationId: resellerId, deletedAt: null },
      include: {
        router: { select: { name: true } },
        subscription: { include: { package: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get voucher redemptions
    const customerIds = customers.map((c) => c.id);
    const vouchers = customerIds.length > 0
      ? await prisma.voucher.findMany({
          where: { usedByCustomerId: { in: customerIds } },
          select: { usedByCustomerId: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : [];

    // Get device activity
    const devices = customerIds.length > 0
      ? await prisma.device.findMany({
          where: { customerId: { in: customerIds } },
          select: { customerId: true, lastSeenAt: true },
        })
      : [];

    const customerStatuses: OnboardingStatus[] = customers.map((c) => {
      const daysSinceCreated = Math.floor(
        (now.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if customer has redeemed a voucher
      const customerVouchers = vouchers.filter((v) => v.usedByCustomerId === c.id);
      const voucherRedeemed = customerVouchers.length > 0;

      // Check first connection (first device activity)
      const customerDevices = devices.filter((d) => d.customerId === c.id);
      const firstConnectionAt = customerDevices.length > 0
        ? customerDevices.reduce((earliest, d) => {
            const seen = d.lastSeenAt ? new Date(d.lastSeenAt) : null;
            return seen && (!earliest || seen < earliest) ? seen : earliest;
          }, null as Date | null)
        : null;

      const hasConnected = firstConnectionAt !== null;
      const welcomeSent = customerVouchers.length > 0 || hasConnected;

      // Determine status
      let status: OnboardingStatus["status"] = "new";
      if (daysSinceCreated <= 2 && !hasConnected) status = "new";
      else if (hasConnected && voucherRedeemed) status = "active";
      else if (hasConnected && !voucherRedeemed) status = "connected";
      else if (daysSinceCreated > 2 && !hasConnected) status = "stale";

      // Next action
      let nextAction = "";
      let daysToConnect: number | null = null;

      if (status === "new") {
        nextAction = "Send welcome message with WiFi credentials and first-purchase discount";
        daysToConnect = 2;
      } else if (status === "connected" && !voucherRedeemed) {
        nextAction = "Customer connected but hasn't purchased voucher — offer first-purchase incentive";
      } else if (status === "stale") {
        nextAction = `Customer hasn't connected in ${daysSinceCreated} days — send re-engagement message`;
      } else if (status === "active") {
        nextAction = "Customer is active — monitor for retention";
      }

      return {
        customerId: c.id,
        customerName: c.name,
        daysSinceCreated,
        hasConnected,
        firstConnectionAt,
        voucherRedeemed,
        welcomeSent,
        status,
        nextAction,
        daysToConnect,
      };
    });

    // Summary
    const summary = {
      total: customerStatuses.length,
      new: customerStatuses.filter((c) => c.status === "new").length,
      connected: customerStatuses.filter((c) => c.status === "connected").length,
      active: customerStatuses.filter((c) => c.status === "active").length,
      stale: customerStatuses.filter((c) => c.status === "stale").length,
    };

    // Recommendations
    const recommendations: string[] = [];
    if (summary.new > 0) {
      recommendations.push(`🆕 ${summary.new} new customers need welcome messages. Send them WiFi credentials and a first-purchase discount (10-15% off).`);
    }
    if (summary.stale > 0) {
      recommendations.push(`⚠️ ${summary.stale} customers haven't connected after onboarding. Follow up with a call or WhatsApp message.`);
    }
    if (summary.connected > 0) {
      recommendations.push(`🔗 ${summary.connected} customers are connected but haven't purchased vouchers. Offer them a trial voucher or discount.`);
    }
    const connectRate = summary.total > 0
      ? Math.round(((summary.connected + summary.active) / summary.total) * 100)
      : 0;
    if (connectRate < 50) {
      recommendations.push(`📉 Only ${connectRate}% of customers have connected. Review your onboarding process — ensure WiFi credentials are clear.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("✅ All customers are onboarded and active. Great work!");
    }

    return {
      customers: customerStatuses,
      summary,
      recommendations,
    };
  }

  /**
   * Generate welcome message content for a customer
   */
  generateWelcomeMessage(customerName: string, wifiSsid: string, wifiPassword: string): string {
    return `🎉 Habari ${customerName}! Karibu kwenye mtandao wetu!

📱 **WiFi Credentials:**
SSID: ${wifiSsid}
Password: ${wifiPassword}

💡 **Jinsi ya kutumia:**
1. Unganisha na WiFi "${wifiSsid}"
2. Weka password: ${wifiPassword}
3. Anza kutumia internet!

🎫 **Offer ya kwanza:** Nunua voucher ya siku 1 kwa bei ya haraka na upate discount ya 10%!

Kwa maswali, wasiliana nasi. Tunakutakia uzoefu mzuri! 🚀`;
  }
}
