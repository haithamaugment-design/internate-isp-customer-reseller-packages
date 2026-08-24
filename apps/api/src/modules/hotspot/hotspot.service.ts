import { prisma } from "../../prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { RouterAdaptersService } from "../routerAdapters/routerAdapters.service";
import type { RedeemVoucherInput } from "./hotspot.dto";

const routerAdaptersService = new RouterAdaptersService();

export class HotspotService {
  private async resolveLocation(slug: string) {
    const location = await prisma.location.findUnique({
      where: { id: slug },
      include: {
        organization: { select: { id: true, name: true, type: true, status: true } },
        routers: { select: { id: true, name: true, status: true } },
      },
    });

    if (!location || location.organization.status !== "ACTIVE") {
      throw new AppError(404, "Hotspot not found");
    }

    return location;
  }

  async getHotspot(slug: string) {
    const location = await this.resolveLocation(slug);

    const now = new Date();
    const [vouchers, packages] = await Promise.all([
      prisma.voucher.findMany({
        where: {
          organizationId: location.organization.id,
          status: "UNUSED",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.package.findMany({
        where: { organizationId: location.organization.id },
        orderBy: { priceCents: "asc" },
        take: 50,
      }),
    ]);

    return {
      slug: location.id,
      locationName: location.name,
      organization: {
        id: location.organization.id,
        name: location.organization.name,
        type: location.organization.type,
      },
      router: location.routers[0]
        ? { id: location.routers[0].id, name: location.routers[0].name, status: location.routers[0].status }
        : null,
      vouchers: vouchers.map((voucher: { id: string; dataGb: number | null; durationHours: number | null; expiresAt: Date | null }) => ({
        id: voucher.id,
        dataGb: voucher.dataGb,
        durationHours: voucher.durationHours,
        expiresAt: voucher.expiresAt,
      })),
      packages: packages.map((pack: { id: string; name: string; speedMbps: number; dataCapGb: number | null; priceCents: number; currency: string }) => ({
        id: pack.id,
        name: pack.name,
        speedMbps: pack.speedMbps,
        dataCapGb: pack.dataCapGb,
        priceCents: pack.priceCents,
        currency: pack.currency,
      })),
    };
  }

  async redeem(slug: string, input: RedeemVoucherInput) {
    const location = await this.resolveLocation(slug);

    const voucher = await prisma.voucher.findUnique({ where: { code: input.code } });
    if (!voucher || voucher.organizationId !== location.organization.id) {
      throw new AppError(404, "Voucher not found");
    }
    if (voucher.status !== "UNUSED") {
      throw new AppError(409, "Voucher already redeemed");
    }
    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      throw new AppError(409, "Voucher expired");
    }

    const usedByCustomerId = input.deviceName ? `guest:${input.deviceName}` : "guest";
    const redeemed = await prisma.voucher.update({
      where: { id: voucher.id },
      data: { status: "USED", usedByCustomerId },
    });

    const router = location.routers[0];
    if (router) {
      try {
        await routerAdaptersService.createVoucher(
          router.id,
          { code: voucher.code, dataGb: voucher.dataGb ?? undefined, durationHours: voucher.durationHours ?? undefined },
          location.organization.id,
          null,
        );
      } catch (error) {
        console.warn("Unable to provision hotspot voucher on router", error);
      }
    }

    return {
      redeemed: true,
      code: redeemed.code,
      dataGb: redeemed.dataGb,
      durationHours: redeemed.durationHours,
      expiresAt: redeemed.expiresAt,
      locationName: location.name,
      message: "Voucher activated",
    };
  }
}
