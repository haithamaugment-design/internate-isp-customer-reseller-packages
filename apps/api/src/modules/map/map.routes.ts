import { Router } from "express";
import { MapService } from "./map.service";
import { authGuard } from "../../middleware/authGuard";
import { roleGuard } from "../../middleware/roleGuard";

const router = Router();
const service = new MapService();

router.use(authGuard);

// Get all map data (admin/ISP only)
router.get("/", roleGuard("PLATFORM_OWNER", "ISP_ADMIN"), async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const orgId = auth.organizationId || auth.id;
    const data = await service.getMapData(orgId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// Get fiber coverage areas
router.get("/fiber-coverage", roleGuard("PLATFORM_OWNER", "ISP_ADMIN"), async (_req, res, next) => {
  try {
    const data = service.getFiberCoverageAreas();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
