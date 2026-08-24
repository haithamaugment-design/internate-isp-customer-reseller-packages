import bcrypt from "bcryptjs";
import { prisma } from "../../prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { slaFor } from "../tickets/sla";
type TicketStatus = "OPEN" | "IN_PROGRESS" | "PENDING_CUSTOMER" | "RESOLVED" | "CLOSED";
import type {
  CreateCustomerInput,
  CreateRequestInput,
  RedeemVoucherInput,
  UpdateCustomerInput,
  UpdateWifiInput,
} from "./customers.dto";

export class CustomersService {
  async create(input: CreateCustomerInput, organizationId: string, actorUserId: string) {
    const router = await prisma.router.findFirst({
      where: { id: input.routerId, location: { organizationId } },
    });
    if (!router) throw new AppError(400, "Router not found in your scope");

    const email = input.email ?? `${input.phone.replace(/\D/g, "")}@customer.netmaster.local`;
    const password = input.password ?? "changeme123";
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await prisma.$transaction(async (tx: typeof prisma) => {
      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) throw new AppError(409, "Customer email already exists");

      const customer = await tx.customer.create({
        data: {
          name: input.name,
          phone: input.phone,
          wifiSsid: input.wifiSsid ?? `${input.name.replace(/\s+/g, "")}_WiFi`,
          wifiPassword: input.wifiPassword ?? "changeme123",
          routerId: input.routerId,
          organizationId,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });

      await tx.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
          role: "CUSTOMER",
          organizationId,
          customerId: customer.id,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });

      if (input.packageId) {
        const pkg = await tx.package.findFirst({
          where: { id: input.packageId, organizationId: { in: [organizationId, ...(await this.parentOrgIds(organizationId))] } },
        });
        if (pkg) {
          await tx.subscription.create({
            data: {
              customerId: customer.id,
              packageId: pkg.id,
              createdByUserId: actorUserId,
              updatedByUserId: actorUserId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "CREATE",
          entityType: "Customer",
          entityId: customer.id,
          afterJson: { name: customer.name, phone: customer.phone, email },
        },
      });
      return customer;
    });
    return { customer: result, credentials: { email, password } };
  }

  async list(orgIds: string[]) {
    const customers = await prisma.customer.findMany({
      where: { organizationId: { in: orgIds }, deletedAt: null },
      include: {
        router: { select: { id: true, name: true } },
        subscription: { include: { package: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return customers;
  }

  async get(id: string, orgIds: string[]) {
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: { in: orgIds }, deletedAt: null },
      include: {
        router: { select: { id: true, name: true, macAddress: true } },
        subscription: { include: { package: true } },
        devices: true,
      },
    });
    if (!customer) throw new AppError(404, "Customer not found");
    return customer;
  }

  async update(id: string, input: UpdateCustomerInput, orgIds: string[], actorUserId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: { in: orgIds } },
    });
    if (!customer) throw new AppError(404, "Customer not found");

    const updated = await prisma.customer.update({
      where: { id },
      data: { ...input, updatedByUserId: actorUserId },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: "UPDATE",
        entityType: "Customer",
        entityId: id,
        beforeJson: { status: customer.status },
        afterJson: { status: updated.status },
      },
    });
    return updated;
  }

  async updateWifi(customerId: string, input: UpdateWifiInput) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new AppError(404, "Customer not found");
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { wifiSsid: input.wifiSsid, wifiPassword: input.wifiPassword },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: null,
        action: "UPDATE",
        entityType: "Customer",
        entityId: customerId,
        afterJson: { wifiSsid: input.wifiSsid },
      },
    });
    return updated;
  }

  async devices(customerId: string) {
    const devices = await prisma.device.findMany({ where: { customerId } });
    if (devices.length === 0) {
      // seed mock devices for demo experience
      return [
        { id: "mock-1", customerId, macAddress: "AA:11:22:33:44:55", deviceName: "Samsung Galaxy", lastSeenAt: new Date(Date.now() - 1000 * 60 * 5) },
        { id: "mock-2", customerId, macAddress: "BB:22:33:44:55:66", deviceName: "Laptop", lastSeenAt: new Date(Date.now() - 1000 * 60 * 20) },
        { id: "mock-3", customerId, macAddress: "CC:33:44:55:66:77", deviceName: "Smart TV", lastSeenAt: new Date(Date.now() - 1000 * 60 * 60) },
      ];
    }
    return devices;
  }

  async usage(customerId: string) {
    const records = await prisma.usageRecord.findMany({
      where: { customerId },
      orderBy: { day: "asc" },
      take: 30,
    });
    if (records.length === 0) {
      const now = new Date();
      return Array.from({ length: 14 }, (_, i) => {
        const day = new Date(now);
        day.setDate(day.getDate() - (13 - i));
        const base = (i * 7 + Math.floor(Math.random() * 12) + 8) * 1024 * 1024;
        return { id: `mock-${i}`, customerId, day, bytesUsed: BigInt(base) };
      });
    }
    return records;
  }

  async redeemVoucher(customerId: string, input: RedeemVoucherInput, actorUserId = "system") {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { subscription: true },
    });
    if (!customer) throw new AppError(404, "Customer not found");
    const voucher = await prisma.voucher.findFirst({
      where: { code: input.code.trim(), organizationId: customer.organizationId },
    });
    if (!voucher) throw new AppError(404, "Voucher not found");
    if (voucher.status === "USED") throw new AppError(409, "Voucher already used");
    if (voucher.status === "EXPIRED" || (voucher.expiresAt && voucher.expiresAt < new Date())) {
      throw new AppError(409, "Voucher has expired");
    }
    return prisma.$transaction(async (tx: typeof prisma) => {
      const updated = await tx.voucher.update({
        where: { id: voucher.id, status: "UNUSED" },
        data: { status: "USED", usedByCustomerId: customerId },
      });
      if (customer.subscription && voucher.durationHours) {
        const base = customer.subscription.renewsAt && customer.subscription.renewsAt > new Date()
          ? customer.subscription.renewsAt
          : new Date();
        const renewsAt = new Date(base.getTime() + voucher.durationHours * 60 * 60 * 1000);
        await tx.subscription.update({
          where: { customerId },
          data: { renewsAt, updatedByUserId: actorUserId },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "REDEEM",
          entityType: "Voucher",
          entityId: voucher.id,
          afterJson: { code: voucher.code, customerId, durationHours: voucher.durationHours, dataGb: voucher.dataGb },
        },
      });
      return updated;
    });
  }

  async createRequest(customerId: string, input: CreateRequestInput, actorUserId: string) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new AppError(404, "Customer not found");
    const priority = input.priority ?? "MEDIUM";
    const subject = input.subject?.trim() ||
      (input.type === "UPGRADE" ? "Package upgrade request" : "Support request");
    const description = input.description?.trim() ?? input.message ?? null;
    const ticket = await prisma.ticket.create({
      data: {
        subject,
        description,
        source: "CUSTOMER",
        entityType: "Customer",
        entityId: customer.id,
        organizationId: customer.organizationId,
        requesterId: actorUserId,
        priority,
        ...slaFor(priority),
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: "CREATE",
        entityType: "Ticket",
        entityId: ticket.id,
        afterJson: { subject: ticket.subject, source: "CUSTOMER", priority: ticket.priority },
      },
    });
    return ticket;
  }

  async listRequests(customerId: string) {
    return prisma.ticket.findMany({
      where: { entityType: "Customer", entityId: customerId, deletedAt: null },
      include: {
        comments: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getRequest(ticketId: string, customerId: string) {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        entityType: "Customer",
        entityId: customerId,
        deletedAt: null,
      },
      include: {
        comments: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!ticket) throw new AppError(404, "Request not found");
    return ticket;
  }

  async addRequestComment(
    ticketId: string,
    customerId: string,
    input: { body: string },
    actorUserId: string,
  ) {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        entityType: "Customer",
        entityId: customerId,
        deletedAt: null,
      },
    });
    if (!ticket) throw new AppError(404, "Request not found");
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        authorId: actorUserId,
        authorRole: "CUSTOMER",
        body: input.body,
        // Customer replies are never internal — force false to avoid accidental leakage.
        isInternal: false,
      },
    });
    // If the agent is waiting on the customer, the customer replying should move
    // the ticket back to IN_PROGRESS so it doesn't sit in PENDING_CUSTOMER forever.
    if (ticket.status === "PENDING_CUSTOMER") {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: "IN_PROGRESS", updatedByUserId: actorUserId },
      });
    }
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: "COMMENT",
        entityType: "Ticket",
        entityId: ticketId,
        afterJson: { commentId: comment.id, from: "CUSTOMER" },
      },
    });
    return comment;
  }

  async listAllRequests(orgIds: string[]) {
    return prisma.ticket.findMany({
      where: { organizationId: { in: orgIds }, deletedAt: null },
      include: {
        assignee: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        comments: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateRequest(id: string, status: TicketStatus, orgIds: string[], actorUserId: string) {
    const request = await prisma.ticket.findFirst({
      where: { id, organizationId: { in: orgIds }, deletedAt: null },
    });
    if (!request) throw new AppError(404, "Service request not found");
    const updated = await prisma.ticket.update({
      where: { id },
      data: { status, updatedByUserId: actorUserId },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: "UPDATE",
        entityType: "Ticket",
        entityId: id,
        beforeJson: { status: request.status },
        afterJson: { status },
      },
    });
    return updated;
  }

  private async parentOrgIds(organizationId: string): Promise<string[]> {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (org?.parentOrgId) return [org.parentOrgId];
    return [];
  }
}
