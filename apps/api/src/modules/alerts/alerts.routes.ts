import { Router } from "express";
import { AlertsService } from "./alerts.service";
import { authGuard } from "../../middleware/authGuard";
import { roleGuard } from "../../middleware/roleGuard";
import { tenantGuard } from "../../middleware/tenantGuard";

const router = Router();
const service = new AlertsService();

router.use(authGuard, tenantGuard);

// Get expiring vouchers for the current reseller
router.get("/expiring", roleGuard("RESELLER", "ISP_ADMIN", "PLATFORM_OWNER"), async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const orgId = auth.organizationId || auth.id;
    const data = await service.getExpiringVouchers(orgId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// Platform-wide alert stats (admin only)
router.get("/platform-stats", roleGuard("PLATFORM_OWNER", "ISP_ADMIN"), async (req, res, next) => {
  try {
    const data = await service.getPlatformAlertStats();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// Manual trigger for expiry alert checks (admin/cron)
router.post("/run-checks", roleGuard("PLATFORM_OWNER"), async (_req, res, next) => {
  try {
    const result = await service.runExpiryAlertChecks();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
