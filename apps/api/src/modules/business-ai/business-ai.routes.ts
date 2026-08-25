import { Router } from "express";
import { BusinessAIController } from "./business-ai.controller";
import { authGuard } from "../../middleware/authGuard";
import { bedrockChat, isBedrockConfigured, getBedrockConfig } from "./bedrock-llm";

const router = Router();
const controller = new BusinessAIController();

router.use(authGuard);

router.post("/conversations", (req, res, next) => controller.startConversation(req, res, next));
router.get("/conversations", (req, res, next) => controller.listConversations(req, res, next));
router.get("/conversations/:planId", (req, res, next) => controller.getConversation(req, res, next));
router.delete("/conversations/:planId", (req, res, next) => controller.deleteConversation(req, res, next));
router.post("/chat", (req, res, next) => controller.sendMessage(req, res, next));
router.post("/plans/:planId/apply", (req, res, next) => controller.applyPlan(req, res, next));
router.get("/insights", (req, res, next) => controller.getInsights(req, res, next));
router.get("/predictions", (req, res, next) => controller.getDemandPredictions(req, res, next));
router.get("/progress", (req, res, next) => controller.getProgressReport(req, res, next));
router.get("/auto-pricing", (req, res, next) => controller.autoAdjustPricing(req, res, next));
router.post("/generate-vouchers", (req, res, next) => controller.generateVoucherBatches(req, res, next));
router.post("/expansion-roi", (req, res, next) => controller.calculateExpansionROI(req, res, next));
router.get("/load-balancing", (req, res, next) => controller.getLoadBalancing(req, res, next));

// Quick Bedrock connectivity test
router.get("/bedrock-test", async (_req, res) => {
  const config = getBedrockConfig();
  if (!config.configured) {
    return res.json({ ok: false, error: "Bedrock not configured — no AWS env vars found", config });
  }
  try {
    const response = await bedrockChat([{ role: "user", content: "Reply with exactly: OK" }]);
    res.json({ ok: true, config, response: response.text.slice(0, 200) });
  } catch (err: any) {
    res.json({ ok: false, error: err.message, name: err.name, config });
  }
});

export default router;
