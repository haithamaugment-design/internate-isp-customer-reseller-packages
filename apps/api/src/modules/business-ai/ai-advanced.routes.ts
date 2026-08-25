import { Router } from "express";
import { AIAdvancedController } from "./ai-advanced.controller";
import { authGuard } from "../../middleware/authGuard";
import { premiumGuard } from "../../middleware/premiumGuard";

const router = Router();
const controller = new AIAdvancedController();

// All routes require auth + premium subscription
router.use(authGuard);
router.use(premiumGuard);

router.get("/churn-prediction", (req, res, next) => controller.predictChurn(req, res, next));
router.get("/dynamic-pricing", (req, res, next) => controller.getDynamicPricing(req, res, next));
router.get("/network-health", (req, res, next) => controller.getNetworkHealth(req, res, next));
router.get("/support-insights", (req, res, next) => controller.getSupportInsights(req, res, next));
router.get("/revenue-forecast", (req, res, next) => controller.getRevenueForecast(req, res, next));
router.get("/growth-advice", (req, res, next) => controller.getGrowthAdvice(req, res, next));

export default router;
