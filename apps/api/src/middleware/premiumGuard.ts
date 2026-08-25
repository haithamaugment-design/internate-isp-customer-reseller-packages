import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma/client";

/**
 * Premium guard — blocks access unless the user's organization
 * has a "growth" or "enterprise" subscription plan.
 *
 * Must be placed AFTER authGuard so req.auth is populated.
 */
export async function premiumGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const orgId = auth.organizationId || auth.id;
    const org = await prisma.organization.findFirst({
      where: { id: orgId },
      select: { subscriptionPlan: true },
    });

    const plan = org?.subscriptionPlan || "free";

    // Premium features available for growth and enterprise plans
    if (plan === "free") {
      return res.status(403).json({
        error: "Premium feature — upgrade to Growth or Enterprise plan",
        requiredPlan: "growth",
        currentPlan: plan,
        upgradeMessage: "AI-powered analytics and insights require a premium subscription. Contact your ISP admin to upgrade.",
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}
