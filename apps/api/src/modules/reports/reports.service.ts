import { prisma } from "../../prisma/client";

export class ReportsService {
  async auditLogs(orgIds: string[]) {
    const users = await prisma.user.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } });
    return prisma.auditLog.findMany({
      where: { actorUserId: { in: users.map((user: { id: string }) => user.id) } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async resellerSummary(orgIds: string[]) {
    const resellers = await prisma.organization.findMany({
      where: { id: { in: orgIds }, type: "RESELLER" },
      include: {
        customers: { select: { id: true, status: true } },
        locations: { select: { id: true } },
      },
    });
    return resellers.map((reseller: (typeof resellers)[number]) => ({
      id: reseller.id,
      name: reseller.name,
      status: reseller.status,
      customers: reseller.customers.length,
      activeCustomers: reseller.customers.filter((customer: { status: string }) => customer.status === "ACTIVE").length,
      locations: reseller.locations.length,
    }));
  }

  async packagePopularity(orgIds: string[]) {
    const subs = await prisma.subscription.findMany({
      where: { package: { organizationId: { in: orgIds } } },
      include: { package: true },
    });
    const map = new Map<string, { name: string; count: number }>();
    for (const s of subs) {
      const entry = map.get(s.packageId) ?? { name: s.package.name, count: 0 };
      entry.count += 1;
      map.set(s.packageId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  async earningsByReseller(orgIds: string[]) {
    const resellers = await prisma.organization.findMany({
      where: { id: { in: orgIds }, type: "RESELLER" },
      include: {
        customers: {
          where: { deletedAt: null, status: "ACTIVE" },
          include: { subscription: { include: { package: true } } },
        },
      },
    });
    return resellers.map((reseller: (typeof resellers)[number]) => {
      const monthly = reseller.customers.reduce(
        (
          sum: number,
          customer: { subscription: { package: { priceCents: number } | null } | null },
        ) => sum + (customer.subscription?.package?.priceCents ?? 0),
        0,
      );
      return {
        id: reseller.id,
        name: reseller.name,
        activeCustomers: reseller.customers.length,
        monthlyRevenueCents: monthly,
      };
    });
  }
}
