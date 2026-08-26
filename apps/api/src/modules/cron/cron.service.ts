import { prisma } from "../../prisma/client";

export class CronService {
  /**
   * Check all active subscriptions past their renewsAt date.
   * Suspends the customer and marks the subscription as needing renewal.
   * Returns a summary of actions taken.
   */
  async checkExpiredSubscriptions() {
    const now = new Date();

    // Find active customers with subscriptions past their renewal date
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        renewsAt: { not: null, lt: now },
        customer: { status: "ACTIVE", deletedAt: null },
      },
      include: {
        customer: { select: { id: true, name: true, organizationId: true } },
        package: { select: { name: true } },
      },
    });

    const suspended: string[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const sub of expiredSubscriptions) {
      try {
        await prisma.$transaction(async (tx: any) => {
          // Suspend the customer
          await tx.customer.update({
            where: { id: sub.customerId },
            data: { status: "SUSPENDED", updatedByUserId: "system:cron" },
          });

          // Audit log
          await tx.auditLog.create({
            data: {
              actorUserId: "system:cron",
              action: "AUTO_SUSPEND",
              entityType: "Customer",
              entityId: sub.customerId,
              beforeJson: { status: "ACTIVE", reason: "subscription_expired" },
              afterJson: {
                status: "SUSPENDED",
                subscriptionId: sub.id,
                packageName: sub.package.name,
                renewsAt: sub.renewsAt?.toISOString(),
              },
            },
          });
        });

        suspended.push(sub.customerId);
      } catch (err) {
        errors.push({
          id: sub.customerId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return {
      checked: expiredSubscriptions.length,
      suspended: suspended.length,
      errors: errors.length,
      details: { suspended, errors },
    };
  }

  /**
   * Expire unused vouchers past their expiresAt date.
   * Returns a summary of actions taken.
   */
  async checkExpiredVouchers() {
    const now = new Date();

    const result = await prisma.voucher.updateMany({
      where: {
        status: "UNUSED",
        expiresAt: { not: null, lt: now },
      },
      data: {
        status: "EXPIRED",
        updatedByUserId: "system:cron",
      },
    });

    return {
      expired: result.count,
    };
  }

  /**
   * Run voucher expiry alert checks — creates notifications for resellers
   * when their unused vouchers are about to expire within 24 hours.
   */
  async runExpiryAlertChecks(): Promise<{ notified: number; errors: number }> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find all orgs with unused vouchers expiring soon
    const expiringVouchers = await prisma.voucher.findMany({
      where: {
        status: "UNUSED",
        expiresAt: { not: null, gt: now, lte: in24h },
      },
      include: {
        location: { select: { name: true, organizationId: true } },
      },
    });

    // Group by organization
    const byOrg = new Map<string, typeof expiringVouchers>();
    for (const v of expiringVouchers) {
      const orgId = v.organizationId;
      if (!byOrg.has(orgId)) byOrg.set(orgId, []);
      byOrg.get(orgId)!.push(v);
    }

    let notified = 0;
    let errors = 0;

    for (const [orgId, vouchers] of byOrg) {
      try {
        // Find reseller users in this org
        const resellerUsers = await prisma.user.findMany({
          where: { organizationId: orgId, role: "RESELLER" },
          select: { id: true },
        });

        const hoursUntil = Math.round(
          (vouchers[0].expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        // Create notification for each reseller user
        for (const user of resellerUsers) {
          // Check if we already notified this user recently (within 6 hours)
          const recentNotification = await prisma.notification.findFirst({
            where: {
              customerId: user.id,
              kind: "VOUCHER_EXPIRY",
              createdAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
            },
          });

          if (!recentNotification) {
            await prisma.notification.create({
              data: {
                customerId: user.id,
                kind: "VOUCHER_EXPIRY",
                title: `⚠️ ${vouchers.length} voucher${vouchers.length > 1 ? "s" : ""} expiring in ${hoursUntil}h`,
                body: `${vouchers.length} unused voucher${vouchers.length > 1 ? "s" : ""} will expire within ${hoursUntil} hours. ${vouchers[0].location?.name ? `Location: ${vouchers[0].location.name}.` : ""} Sell or reassign them before they expire.`,
              },
            });
            notified++;
          }
        }
      } catch (err) {
        console.error(`[Cron] Failed to create expiry notifications for org ${orgId}:`, err);
        errors++;
      }
    }

    return { notified, errors };
  }

  /**
   * Run all expiration checks and alert checks, return a combined report.
   */
  async runAllChecks() {
    const [subscriptionResult, voucherResult, alertResult] = await Promise.all([
      this.checkExpiredSubscriptions(),
      this.checkExpiredVouchers(),
      this.runExpiryAlertChecks(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      subscriptions: subscriptionResult,
      vouchers: voucherResult,
      alerts: alertResult,
    };
  }
}
