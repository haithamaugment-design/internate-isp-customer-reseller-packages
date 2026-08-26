import { Router } from "express";
import { TicketsController } from "./tickets.controller";
import { authGuard } from "../../middleware/authGuard";
import { roleGuard } from "../../middleware/roleGuard";
import { tenantGuard } from "../../middleware/tenantGuard";

const router = Router();
const controller = new TicketsController();

router.use(authGuard, tenantGuard);

router.get("/dashboard", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "SUPPORT_AGENT"), controller.dashboard);
router.get("/", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "SUPPORT_AGENT"), controller.list);
router.post("/", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "SUPPORT_AGENT"), controller.create);
router.get("/:id", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "SUPPORT_AGENT"), controller.get);
router.patch("/:id", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "SUPPORT_AGENT"), controller.update);
router.post("/:id/comments", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "SUPPORT_AGENT"), controller.addComment);
router.post("/:id/assign", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "SUPPORT_AGENT"), controller.assign);

// AI-powered endpoints
router.get("/analytics", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "SUPPORT_AGENT"), controller.analytics);
router.get("/:id/suggest-response", roleGuard("PLATFORM_OWNER", "ISP_ADMIN", "SUPPORT_AGENT"), controller.suggestResponse);

export default router;
