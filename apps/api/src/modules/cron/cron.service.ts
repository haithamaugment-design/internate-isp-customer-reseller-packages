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
        await prisma.$transaction(async (tx: typeof prisma) => {
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
   * Run all expiration checks and return a combined report.
   */
  async runAllChecks() {
    const [subscriptionResult, voucherResult] = await Promise.all([
      this.checkExpiredSubscriptions(),
      this.checkExpiredVouchers(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      subscriptions: subscriptionResult,
      vouchers: voucherResult,
    };
  }
}
