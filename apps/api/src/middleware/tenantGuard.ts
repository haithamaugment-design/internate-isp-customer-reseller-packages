import type { NextFunction, Request, Response } from "express";
import { prisma } from "../prisma/client";

/**
 * Resolves the set of organization ids the authenticated user may access.
 * ISP admins may access their own org and every descendant org (resellers).
 * Resellers access only their own org.
 */
export async function resolveOrgScope(organizationId: string): Promise<string[]> {
  const scope = new Set<string>();
  const pending = [organizationId];
  while (pending.length > 0) {
    const currentId = pending.pop()!;
    if (scope.has(currentId)) continue;
    const org = await prisma.organization.findUnique({ where: { id: currentId }, select: { id: true } });
    if (!org) continue;
    scope.add(org.id);
    const children = await prisma.organization.findMany({
      where: { parentOrgId: currentId },
      select: { id: true },
    });
    pending.push(...children.map((child: { id: string }) => child.id));
  }
  return [...scope];
}

export function tenantGuard(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.auth.organizationId && req.auth.role !== "PLATFORM_OWNER") {
    prisma.organization.findUnique({ where: { id: req.auth.organizationId }, select: { status: true } })
      .then((org: { status: string } | null) => {
        if (!org || org.status !== "ACTIVE") {
          res.status(403).json({ error: "Organization is not active" });
          return;
        }
        return resolveOrgScope(req.auth!.organizationId).then((orgIds) => {
          req.orgIds = orgIds;
          next();
        });
      })
      .catch(() => res.status(500).json({ error: "Failed to resolve tenant scope" }));
    return;
  }
  resolveOrgScope(req.auth.organizationId)
    .then((orgIds) => {
      req.orgIds = orgIds;
      next();
    })
    .catch(() => {
      res.status(500).json({ error: "Failed to resolve tenant scope" });
    });
}
