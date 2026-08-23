import { prisma } from "../../prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { slaFor } from "./sla";
type TicketStatus = "OPEN" | "IN_PROGRESS" | "PENDING_CUSTOMER" | "RESOLVED" | "CLOSED";
import type {
  AddCommentInput,
  CreateTicketInput,
  ListTicketsQuery,
  UpdateTicketInput,
} from "./tickets.dto";

const OPEN_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "PENDING_CUSTOMER"];

// Each resolver returns the owning organizationId if the entity is in scope, else null.
const ENTITY_SCOPES: Record<string, (id: string, orgIds: string[]) => Promise<string | null>> = {
  Customer: async (id, orgIds) => {
    const c = await prisma.customer.findFirst({
      where: { id, organizationId: { in: orgIds }, deletedAt: null },
      select: { organizationId: true },
    });
    return c?.organizationId ?? null;
  },
  Router: async (id, orgIds) => {
    const r = await prisma.router.findFirst({
      where: { id, location: { organizationId: { in: orgIds } } },
      select: { location: { select: { organizationId: true } } },
    });
    return r?.location?.organizationId ?? null;
  },
  Location: async (id, orgIds) => {
    const l = await prisma.location.findFirst({
      where: { id, organizationId: { in: orgIds } },
      select: { organizationId: true },
    });
    return l?.organizationId ?? null;
  },
  Package: async (id, orgIds) => {
    const p = await prisma.package.findFirst({
      where: { id, organizationId: { in: orgIds } },
      select: { organizationId: true },
    });
    return p?.organizationId ?? null;
  },
  Voucher: async (id, orgIds) => {
    const v = await prisma.voucher.findFirst({
      where: { id, organizationId: { in: orgIds } },
      select: { organizationId: true },
    });
    return v?.organizationId ?? null;
  },
};

export class TicketsService {
  async create(input: CreateTicketInput, orgIds: string[], actorId: string, actorOrgId: string) {
    let organizationId = actorOrgId;
    if (input.entityType && input.entityId) {
      const resolver = ENTITY_SCOPES[input.entityType];
      if (!resolver) throw new AppError(400, "Invalid entityType");
      const entityOrgId = await resolver(input.entityId, orgIds);
      if (!entityOrgId) throw new AppError(400, "Linked entity not found in your scope");
      organizationId = entityOrgId;
    }
    const ticket = await prisma.ticket.create({
      data: {
        subject: input.subject,
        description: input.description ?? null,
        priority: input.priority,
        source: "SUPPORT",
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        organizationId,
        requesterId: actorId,
        ...slaFor(input.priority),
        createdByUserId: actorId,
        updatedByUserId: actorId,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "CREATE",
        entityType: "Ticket",
        entityId: ticket.id,
        afterJson: { subject: ticket.subject, priority: ticket.priority, organizationId },
      },
    });
    return ticket;
  }

  async list(query: ListTicketsQuery, orgIds: string[]) {
    return prisma.ticket.findMany({
      where: {
        organizationId: { in: orgIds },
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
      },
      include: {
        assignee: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string, orgIds: string[]) {
    const ticket = await prisma.ticket.findFirst({
      where: { id, organizationId: { in: orgIds }, deletedAt: null },
      include: {
        assignee: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        comments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!ticket) throw new AppError(404, "Ticket not found");
    return ticket;
  }

  async update(id: string, input: UpdateTicketInput, orgIds: string[], actorId: string) {
    const existing = await prisma.ticket.findFirst({
      where: { id, organizationId: { in: orgIds }, deletedAt: null },
    });
    if (!existing) throw new AppError(404, "Ticket not found");
    const data: Record<string, unknown> = { ...input, updatedByUserId: actorId };
    if (input.priority && input.priority !== existing.priority) {
      Object.assign(data, slaFor(input.priority));
    }
    const updated = await prisma.ticket.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "UPDATE",
        entityType: "Ticket",
        entityId: id,
        beforeJson: { status: existing.status, priority: existing.priority },
        afterJson: { status: updated.status, priority: updated.priority },
      },
    });
    return updated;
  }

  async addComment(id: string, input: AddCommentInput, orgIds: string[], actorId: string, actorRole: string) {
    const ticket = await prisma.ticket.findFirst({
      where: { id, organizationId: { in: orgIds }, deletedAt: null },
    });
    if (!ticket) throw new AppError(404, "Ticket not found");
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        authorId: actorId,
        authorRole: actorRole,
        body: input.body,
        isInternal: input.isInternal,
      },
    });
    if (actorRole !== "CUSTOMER" && !input.isInternal && !ticket.firstResponseAt) {
      await prisma.ticket.update({
        where: { id },
        data: { firstResponseAt: new Date(), updatedByUserId: actorId },
      });
    }
    // Notify the customer about a non-internal agent reply on a customer-owned ticket.
    if (
      actorRole !== "CUSTOMER" &&
      !input.isInternal &&
      ticket.entityType === "Customer" &&
      ticket.entityId
    ) {
      await prisma.notification.create({
        data: {
          customerId: ticket.entityId,
          ticketId: ticket.id,
          kind: "TICKET_REPLY",
          title: `New reply on "${ticket.subject}"`,
          body: input.body.length > 240 ? `${input.body.slice(0, 240)}…` : input.body,
          createdByUserId: actorId,
        },
      });
    }
    await prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "COMMENT",
        entityType: "Ticket",
        entityId: id,
        afterJson: { commentId: comment.id, isInternal: comment.isInternal },
      },
    });
    return comment;
  }

  async assign(id: string, assigneeId: string | null, orgIds: string[], actorId: string) {
    const existing = await prisma.ticket.findFirst({
      where: { id, organizationId: { in: orgIds }, deletedAt: null },
    });
    if (!existing) throw new AppError(404, "Ticket not found");
    if (assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assigneeId, organizationId: { in: orgIds } },
        select: { id: true },
      });
      if (!assignee) throw new AppError(400, "Assignee not found in your scope");
    }
    const updated = await prisma.ticket.update({
      where: { id },
      data: { assigneeId, updatedByUserId: actorId, ...slaFor(existing.priority) },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "ASSIGN",
        entityType: "Ticket",
        entityId: id,
        beforeJson: { assigneeId: existing.assigneeId },
        afterJson: { assigneeId },
      },
    });
    return updated;
  }

  async dashboard(orgIds: string[], actorId: string) {
    const open = await prisma.ticket.count({
      where: { organizationId: { in: orgIds }, status: { in: OPEN_STATUSES }, deletedAt: null },
    });
    const atRisk = await prisma.ticket.count({
      where: { organizationId: { in: orgIds }, status: { in: OPEN_STATUSES }, slaResolveBy: { lt: new Date() }, deletedAt: null },
    });
    const myQueue = await prisma.ticket.count({
      where: { assigneeId: actorId, status: { in: OPEN_STATUSES }, deletedAt: null },
    });
    const byPriority = await prisma.ticket.groupBy({
      by: ["priority"],
      where: { organizationId: { in: orgIds }, status: { in: OPEN_STATUSES }, deletedAt: null },
      _count: { _all: true },
    });
    return { open, atRisk, myQueue, byPriority };
  }
}
