import { Router } from "express";
import { FiberDetectionService } from "./fiber-detection.service";
import { authGuard } from "../../middleware/authGuard";
import { roleGuard } from "../../middleware/roleGuard";

const router = Router();
const service = new FiberDetectionService();

// Only requires auth + admin roles — no premium guard
router.use(authGuard);

// Detect fiber equipment from registered customers' device MACs
router.get("/fiber-detection", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "RESELLER"), async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await service.detectFiberFromCustomers(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

// Get potential fiber users (non-customers detected via WiFi scanning)
router.get("/potential-customers", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "RESELLER"), async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await service.getPotentialFiberUsers(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

// Fiber coverage summary
router.get("/fiber-coverage-summary", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "RESELLER"), async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await service.getFiberCoverageSummary(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

// Trigger WiFi scan on a router
router.post("/wifi-scan/:routerId", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "RESELLER"), async (req, res, next) => {
  try {
    const data = await service.scanForNearbyFiber(req.params.routerId);
    await service.saveScanResults(req.params.routerId, data);
    res.json({ data });
  } catch (err) { next(err); }
});

// Look up a MAC address in the OUI database
router.get("/mac-lookup/:mac", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "RESELLER"), async (req, res, next) => {
  try {
    const data = service.lookupMAC(req.params.mac);
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
