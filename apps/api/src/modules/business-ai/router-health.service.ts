import { prisma } from "../../prisma/client";

export interface RouterHealthStatus {
  id: string;
  name: string;
  macAddress: string;
  status: string;
  location: string;
  customerCount: number;
  maxCapacity: number;
  loadPercentage: number;
  health: "good" | "warning" | "critical";
  issues: string[];
  recommendations: string[];
  lastActivity: Date | null;
}

export interface HealthReport {
  routers: RouterHealthStatus[];
  summary: {
    totalRouters: number;
    healthy: number;
    warning: number;
    critical: number;
    totalCustomers: number;
    avgLoad: number;
  };
  alerts: string[];
  recommendations: string[];
}

export class RouterHealthService {
  async getHealthReport(resellerId: string): Promise<HealthReport> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all routers with customer counts
    const locations = await prisma.location.findMany({
      where: { organizationId: resellerId },
      include: {
        routers: {
          include: {
            customers: {
              select: { id: true, status: true, createdAt: true },
            },
          },
        },
      },
    });

    const allRouters = locations.flatMap((l) =>
      l.routers.map((r) => ({
        ...r,
        locationName: l.name,
        organizationId: resellerId,
      }))
    );

    // Get recent voucher activity per router
    const vouchers = await prisma.voucher.findMany({
      where: {
        organizationId: resellerId,
        createdAt: { gte: sevenDaysAgo },
      },
      select: { usedByCustomerId: true, createdAt: true },
    });

    // Get device activity
    const customerIds = allRouters.flatMap((r) => r.customers.map((c) => c.id));
    const devices = customerIds.length > 0
      ? await prisma.device.findMany({
          where: { customerId: { in: customerIds } },
          select: { customerId: true, lastSeenAt: true },
        })
      : [];

    const now30minAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const activeDevices = devices.filter(
      (d) => d.lastSeenAt && new Date(d.lastSeenAt) > now30minAgo
    );

    // Analyze each router
    const routers: RouterHealthStatus[] = allRouters.map((router) => {
      const customerCount = router.customers.length;
      const maxCapacity = 25; // Typical MikroTik capacity
      const loadPercentage = Math.round((customerCount / maxCapacity) * 100);

      // Health determination
      let health: "good" | "warning" | "critical" = "good";
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (loadPercentage >= 90) {
        health = "critical";
        issues.push("Router at near-maximum capacity");
        recommendations.push("Add a second router to this location or upgrade to a higher-capacity model");
      } else if (loadPercentage >= 70) {
        health = "warning";
        issues.push("Router approaching capacity limits");
        recommendations.push("Monitor closely and plan for capacity expansion");
      }

      if (router.status === "OFFLINE") {
        health = "critical";
        issues.push("Router is offline");
        recommendations.push("Check physical connections and power supply");
      } else if (router.status === "SUSPENDED") {
        health = "warning";
        issues.push("Router is suspended");
        recommendations.push("Verify subscription status and reactivate if needed");
      }

      // Check for inactive customers (no voucher activity in 7 days)
      const activeCustomerIds = new Set(
        vouchers
          .filter((v) => v.usedByCustomerId)
          .map((v) => v.usedByCustomerId)
      );
      const inactiveCustomers = router.customers.filter(
        (c) => !activeCustomerIds.has(c.id)
      ).length;

      if (inactiveCustomers > customerCount * 0.5 && customerCount > 0) {
        issues.push(`${inactiveCustomers} of ${customerCount} customers inactive for 7+ days`);
        recommendations.push("Run a customer engagement campaign — offer promotions to inactive users");
        if (health === "good") health = "warning";
      }

      // Check for devices that haven't been seen
      const routerDeviceCount = devices.filter(
        (d) => router.customers.some((c) => c.id === d.customerId)
      ).length;
      const routerActiveDevices = activeDevices.filter(
        (d) => router.customers.some((c) => c.id === d.customerId)
      ).length;

      // Get last activity
      const lastActivity = router.customers.length > 0
        ? router.customers.reduce((latest, c) => {
            const customerDevices = devices.filter((d) => d.customerId === c.id);
            const lastSeen = customerDevices.reduce(
              (max, d) => (d.lastSeenAt && new Date(d.lastSeenAt) > max ? new Date(d.lastSeenAt) : max),
              new Date(0)
            );
            return lastSeen > latest ? lastSeen : latest;
          }, new Date(0))
        : null;

      if (health === "good" && issues.length === 0) {
        recommendations.push("Router operating normally");
      }

      return {
        id: router.id,
        name: router.name,
        macAddress: router.macAddress,
        status: router.status,
        location: router.locationName,
        customerCount,
        maxCapacity,
        loadPercentage,
        health,
        issues,
        recommendations,
        lastActivity: lastActivity?.getTime() === 0 ? null : lastActivity,
      };
    });

    // Summary
    const healthy = routers.filter((r) => r.health === "good").length;
    const warning = routers.filter((r) => r.health === "warning").length;
    const critical = routers.filter((r) => r.health === "critical").length;
    const totalCustomers = routers.reduce((s, r) => s + r.customerCount, 0);
    const avgLoad = routers.length > 0
      ? Math.round(routers.reduce((s, r) => s + r.loadPercentage, 0) / routers.length)
      : 0;

    // Alerts
    const alerts: string[] = [];
    if (critical > 0) {
      alerts.push(`🔴 ${critical} router(s) in critical state — immediate attention needed`);
    }
    if (warning > 0) {
      alerts.push(`🟡 ${warning} router(s) need monitoring`);
    }
    if (avgLoad > 70) {
      alerts.push(`⚠️ Average network load is ${avgLoad}% — consider capacity expansion`);
    }

    // Recommendations
    const recommendations: string[] = [];
    if (critical > 0) {
      recommendations.push("Address critical routers immediately — check connections, power, and capacity");
    }
    if (routers.some((r) => r.loadPercentage >= 80)) {
      const overloaded = routers.filter((r) => r.loadPercentage >= 80);
      overloaded.forEach((r) => {
        recommendations.push(`${r.name} (${r.location}) at ${r.loadPercentage}% — add router or upgrade fiber`);
      });
    }
    if (routers.length < 3) {
      recommendations.push("Consider adding more routers to expand coverage and reduce individual load");
    }

    return {
      routers: routers.sort((a, b) => {
        const order = { critical: 0, warning: 1, good: 2 };
        return order[a.health] - order[b.health];
      }),
      summary: { totalRouters: routers.length, healthy, warning, critical, totalCustomers, avgLoad },
      alerts,
      recommendations,
    };
  }
}
