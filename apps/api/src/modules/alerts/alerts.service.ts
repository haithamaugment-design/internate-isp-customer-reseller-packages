import { prisma } from "../../prisma/client";

export interface ExpiryAlert {
  id: string;
  code: string;
  expiresAt: Date;
  hoursUntilExpiry: number;
  locationName?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface AlertSummary {
  expiringIn24h: number;
  expiringIn48h: number;
  expiredToday: number;
  alerts: ExpiryAlert[];
}

export class AlertsService {
  /**
   * Get vouchers expiring soon for a reseller
   */
  async getExpiringVouchers(resellerId: string): Promise<AlertSummary> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [expiringIn24h, expiringIn48h, expiredToday] = await Promise.all([
      prisma.voucher.findMany({
        where: {
          organizationId: resellerId,
          status: "UNUSED",
          expiresAt: { not: null, gt: now, lte: in24h },
        },
        include: { location: { select: { name: true } } },
        orderBy: { expiresAt: "asc" },
      }),
      prisma.voucher.findMany({
        where: {
          organizationId: resellerId,
          status: "UNUSED",
          expiresAt: { not: null, gt: in24h, lte: in48h },
        },
        include: { location: { select: { name: true } } },
        orderBy: { expiresAt: "asc" },
      }),
      prisma.voucher.findMany({
        where: {
          organizationId: resellerId,
          status: "EXPIRED",
          expiresAt: { not: null, gte: todayStart, lte: now },
        },
        include: { location: { select: { name: true } } },
      }),
    ]);

    const formatAlert = (v: (typeof expiringIn24h)[0]): ExpiryAlert => ({
      id: v.id,
      code: v.code,
      expiresAt: v.expiresAt!,
      hoursUntilExpiry: Math.round((v.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60)),
      locationName: v.location?.name,
      customerName: undefined,
      customerPhone: undefined,
    });

    return {
      expiringIn24h: expiringIn24h.length,
      expiringIn48h: expiringIn48h.length,
      expiredToday: expiredToday.length,
      alerts: [
        ...expiringIn24h.map(formatAlert),
        ...expiringIn48h.map(formatAlert),
      ],
    };
  }

  /**
   * Check and create notifications for vouchers expiring within 24h
   * Called by cron job — creates notifications for resellers
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
        console.error(`[Alerts] Failed to create expiry notifications for org ${orgId}:`, err);
        errors++;
      }
    }

    return { notified, errors };
  }

  /**
   * Get alert statistics for the platform admin
   */
  async getPlatformAlertStats(): Promise<{
    totalExpiring24h: number;
    totalExpiring48h: number;
    totalExpiredToday: number;
    byReseller: Array<{ resellerId: string; resellerName: string; expiringCount: number }>;
  }> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [expiring24h, expiring48h, expiredToday] = await Promise.all([
      prisma.voucher.count({
        where: { status: "UNUSED", expiresAt: { not: null, gt: now, lte: in24h } },
      }),
      prisma.voucher.count({
        where: { status: "UNUSED", expiresAt: { not: null, gt: in24h, lte: in48h } },
      }),
      prisma.voucher.count({
        where: { status: "EXPIRED", expiresAt: { not: null, gte: todayStart, lte: now } },
      }),
    ]);

    // Top resellers with expiring vouchers
    const expiringByOrg = await prisma.voucher.groupBy({
      by: ["organizationId"],
      where: { status: "UNUSED", expiresAt: { not: null, gt: now, lte: in48h } },
      _count: { _all: true },
    });

    const orgIds = expiringByOrg.map((g) => g.organizationId);
    const orgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    });
    const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

    return {
      totalExpiring24h: expiring24h,
      totalExpiring48h: expiring48h,
      totalExpiredToday: expiredToday,
      byReseller: expiringByOrg
        .map((g) => ({
          resellerId: g.organizationId,
          resellerName: orgMap.get(g.organizationId) || "Unknown",
          expiringCount: g._count._all,
        }))
        .sort((a, b) => b.expiringCount - a.expiringCount)
        .slice(0, 10),
    };
  }
}
