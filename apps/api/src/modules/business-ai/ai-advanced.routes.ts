import { Router } from "express";
import { AIAdvancedController } from "./ai-advanced.controller";
import { authGuard } from "../../middleware/authGuard";
import { premiumGuard } from "../../middleware/premiumGuard";
import { RevenuePredictionsService } from "./revenue-predictions.service";
import { CustomerSegmentationService } from "./customer-segmentation.service";
import { ResellerCoachingService } from "./reseller-coaching.service";
import { RouterHealthService } from "./router-health.service";
import { ReportsAIService } from "./reports-ai.service";
import { OnboardingService } from "./onboarding.service";
import { ContentSchedulerService } from "../blog/content-scheduler.service";
import { ReferralService } from "./referral.service";
import { FiberDetectionService } from "./fiber-detection.service";

const router = Router();
const controller = new AIAdvancedController();
const revenueService = new RevenuePredictionsService();
const segmentationService = new CustomerSegmentationService();
const coachingService = new ResellerCoachingService();
const routerHealthService = new RouterHealthService();
const reportsAIService = new ReportsAIService();
const onboardingService = new OnboardingService();
const contentSchedulerService = new ContentSchedulerService();
const referralService = new ReferralService();
const fiberDetectionService = new FiberDetectionService();

// All routes require auth + premium subscription
router.use(authGuard);
router.use(premiumGuard);

router.get("/churn-prediction", (req, res, next) => controller.predictChurn(req, res, next));
router.get("/dynamic-pricing", (req, res, next) => controller.getDynamicPricing(req, res, next));
router.get("/network-health", (req, res, next) => controller.getNetworkHealth(req, res, next));
router.get("/support-insights", (req, res, next) => controller.getSupportInsights(req, res, next));
router.get("/revenue-forecast", (req, res, next) => controller.getRevenueForecast(req, res, next));
router.get("/growth-advice", (req, res, next) => controller.getGrowthAdvice(req, res, next));

// Enhanced revenue predictions (Feature 3)
router.get("/revenue-predictions", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await revenueService.generateForecast(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/daily-revenue", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await revenueService.getDailyRevenue(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/seasonal-patterns", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await revenueService.getSeasonalPatterns(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

// Smart customer segmentation (Feature 6)
router.get("/customer-segments", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await segmentationService.segmentCustomers(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

// Reseller performance coaching (Feature 7)
router.get("/coaching", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await coachingService.getCoachingReport(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

// Router health monitoring (Feature 4)
router.get("/router-health", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await routerHealthService.getHealthReport(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

// Automated invoice reports (Feature 8)
router.get("/earnings-report", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await reportsAIService.generateEarningsReport(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

// Smart customer onboarding (Feature 9)
router.get("/onboarding", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await onboardingService.getOnboardingReport(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

// AI content scheduler (Feature 10 — no premium guard, admin only)
router.get("/content-calendar", async (req, res, next) => {
  try {
    const data = await contentSchedulerService.getContentCalendar();
    res.json({ data });
  } catch (err) { next(err); }
});

// Referral program intelligence (Feature 11)
router.get("/referrals", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await referralService.getReferralReport(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/referrals/stats", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await referralService.getReferralStats(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

// Fiber Detection — MAC OUI + WiFi Scanning
router.get("/fiber-detection", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await fiberDetectionService.detectFiberFromCustomers(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/potential-customers", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await fiberDetectionService.getPotentialFiberUsers(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/fiber-coverage-summary", async (req, res, next) => {
  try {
    const auth = (req as any).auth;
    const data = await fiberDetectionService.getFiberCoverageSummary(auth?.organizationId || auth?.id);
    res.json({ data });
  } catch (err) { next(err); }
});

router.post("/wifi-scan/:routerId", async (req, res, next) => {
  try {
    const data = await fiberDetectionService.scanForNearbyFiber(req.params.routerId);
    await fiberDetectionService.saveScanResults(req.params.routerId, data);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/mac-lookup/:mac", async (req, res, next) => {
  try {
    const data = fiberDetectionService.lookupMAC(req.params.mac);
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
