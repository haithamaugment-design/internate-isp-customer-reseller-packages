import { prisma } from "../../prisma/client";
import { AppError } from "../../middleware/errorHandler";
import type { CreateOrgInput, UpdateBrandingInput, UpdateOrgStatusInput } from "./organizations.dto";

export class OrganizationsService {
  async create(input: CreateOrgInput, actorUserId: string) {
    const org = await prisma.organization.create({
      data: {
        name: input.name,
        type: input.type,
        parentOrgId: input.parentOrgId,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: "CREATE",
        entityType: "Organization",
        entityId: org.id,
        afterJson: { name: org.name, type: org.type },
      },
    });
    return org;
  }

  async listByType(type: string | undefined, orgIds: string[]) {
    return prisma.organization.findMany({
      where: {
        id: { in: orgIds },
        ...(type ? { type: type as "ISP" | "RESELLER" } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listResellers(orgIds: string[]) {
    const resellers = await prisma.organization.findMany({
      where: {
        id: { in: orgIds },
        type: "RESELLER",
      },
      include: {
        _count: { select: { locations: true, customers: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return resellers;
  }

  async updateStatus(id: string, input: UpdateOrgStatusInput, actorUserId: string, orgIds?: string[]) {
    const before = await prisma.organization.findFirst({
      where: { id: { equals: id, ...(orgIds?.length ? { in: orgIds } : {}) } },
    });
    if (!before) throw new AppError(404, "Organization not found");
    const org = await prisma.organization.update({
      where: { id },
      data: { status: input.status, updatedByUserId: actorUserId },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: input.status === "SUSPENDED" ? "SUSPEND" : "APPROVE",
        entityType: "Organization",
        entityId: org.id,
        beforeJson: { status: before.status },
        afterJson: { status: org.status },
      },
    });
    return org;
  }

  async getHierarchy(rootOrgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: rootOrgId } });
    if (!org) throw new AppError(404, "Organization not found");
    const children = await prisma.organization.findMany({
      where: { parentOrgId: rootOrgId },
      include: { _count: { select: { locations: true, users: true } } },
    });
    return { org, children };
  }

  async overview(orgIds: string[]) {
    const [resellers, locations, routers, customers, activeCustomers] = await Promise.all([
      prisma.organization.count({ where: { id: { in: orgIds }, type: "RESELLER" } }),
      prisma.location.count({ where: { organizationId: { in: orgIds } } }),
      prisma.router.count({ where: { location: { organizationId: { in: orgIds } } } }),
      prisma.customer.count({ where: { organizationId: { in: orgIds }, deletedAt: null } }),
      prisma.customer.count({ where: { organizationId: { in: orgIds }, deletedAt: null, status: "ACTIVE" } }),
    ]);
    const mrr = await this.mrrCents(orgIds);
    return { resellers, locations, routers, customers, activeCustomers, mrrCents: mrr };
  }

  async mrrCents(orgIds: string[]) {
    const where =
      orgIds.length === 0
        ? { deletedAt: null, status: "ACTIVE" as const }
        : { organizationId: { in: orgIds }, deletedAt: null, status: "ACTIVE" as const };
    const subscriptions = await prisma.subscription.findMany({
      where: { customer: where },
      include: { package: true },
    });
    return subscriptions.reduce(
      (
        sum: number,
        subscription: { package: { priceCents: number } | null },
      ) => sum + (subscription.package?.priceCents ?? 0),
      0,
    );
  }

  async locationStats(organizationId: string) {
    const locations = await prisma.location.findMany({
      where: { organizationId },
      include: {
        routers: {
          include: {
            _count: { select: { customers: true } },
            customers: {
              where: { status: "ACTIVE", deletedAt: null },
              include: { subscription: { include: { package: true } } },
            },
          },
        },
        vouchers: {
          where: { status: "UNUSED" },
          select: { id: true },
        },
      },
    });

    return locations.map((loc: { id: string; name: string; address: string | null; routers: { status: string; _count: { customers: number }; customers: { subscription?: { package?: { priceCents: number } | null } | null }[] }[]; vouchers: { id: string }[] }) => {
      const totalRouters = loc.routers.length;
      const activeRouters = loc.routers.filter((r: { status: string }) => r.status === "ACTIVE").length;
      const totalCustomers = loc.routers.reduce((sum: number, r: { _count: { customers: number } }) => sum + r._count.customers, 0);
      const activeCustomers = loc.routers.reduce((sum: number, r: { customers: { subscription?: { package?: { priceCents: number } | null } | null }[] }) => sum + r.customers.length, 0);
      const mrrCents = loc.routers.reduce(
        (sum: number, r: { customers: { subscription?: { package?: { priceCents: number } | null } | null }[] }) => sum + r.customers.reduce((s: number, c: { subscription?: { package?: { priceCents: number } | null } | null }) => s + (c.subscription?.package?.priceCents ?? 0), 0),
        0,
      );
      const unusedVouchers = loc.vouchers.length;

      return {
        id: loc.id,
        name: loc.name,
        address: loc.address,
        totalRouters,
        activeRouters,
        totalCustomers,
        activeCustomers,
        mrrCents,
        unusedVouchers,
      };
    });
  }

  async updateBranding(organizationId: string, input: UpdateBrandingInput, actorUserId: string) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new AppError(404, "Organization not found");

    const existingBranding = (org.branding as Record<string, unknown>) ?? {};
    const branding = { ...existingBranding, ...input };

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: { branding, updatedByUserId: actorUserId },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: "UPDATE",
        entityType: "Organization",
        entityId: organizationId,
        afterJson: { branding },
      },
    });

    return updated;
  }

  async platformOverview() {
    const [isps, resellers, locations, routers, customers, activeCustomers, users, vouchers, mrr] =
      await Promise.all([
        prisma.organization.count({ where: { type: "ISP" } }),
        prisma.organization.count({ where: { type: "RESELLER" } }),
        prisma.location.count(),
        prisma.router.count(),
        prisma.customer.count({ where: { deletedAt: null } }),
        prisma.customer.count({ where: { deletedAt: null, status: "ACTIVE" } }),
        prisma.user.count(),
        prisma.voucher.count(),
        this.mrrCents([]),
      ]);
    return { isps, resellers, locations, routers, customers, activeCustomers, users, vouchers, mrrCents: mrr };
  }
}
