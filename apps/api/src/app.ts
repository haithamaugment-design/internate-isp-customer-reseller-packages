import express from "express";
import cors from "cors";

// Config MUST be imported first so dotenv loads .env before any route
// modules (especially bedrock-llm.ts) read process.env.
import { config } from "./config";

import authRoutes from "./modules/auth/auth.routes";
import organizationRoutes from "./modules/organizations/organizations.routes";
import userRoutes from "./modules/users/users.routes";
import locationRoutes from "./modules/locations/locations.routes";
import routerRoutes from "./modules/routers/routers.routes";
import customerRoutes from "./modules/customers/customers.routes";
import packageRoutes from "./modules/packages/packages.routes";
import voucherRoutes from "./modules/vouchers/vouchers.routes";
import reportRoutes from "./modules/reports/reports.routes";
import routerAdapterRoutes from "./modules/routerAdapters/routerAdapters.routes";
import hotspotRoutes from "./modules/hotspot/hotspot.routes";
import ticketRoutes from "./modules/tickets/tickets.routes";
import notificationRoutes from "./modules/notifications/notifications.routes";
import cronRoutes from "./modules/cron/cron.routes";
import alertsRoutes from "./modules/alerts/alerts.routes";
import mapRoutes from "./modules/map/map.routes";
import subscriptionRoutes from "./modules/subscriptions/subscriptions.routes";
import productRoutes from "./modules/products/products.routes";
import setupRoutes from "./modules/setup/setup.routes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { authRateLimit, apiRateLimit } from "./middleware/rateLimit";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/auth", authRateLimit, authRoutes);
app.use("/api/v1/organizations", apiRateLimit, organizationRoutes);
app.use("/api/v1/users", apiRateLimit, userRoutes);
app.use("/api/v1/locations", apiRateLimit, locationRoutes);
app.use("/api/v1/routers", apiRateLimit, routerRoutes);
app.use("/api/v1/customers", apiRateLimit, customerRoutes);
app.use("/api/v1/packages", apiRateLimit, packageRoutes);
app.use("/api/v1/vouchers", apiRateLimit, voucherRoutes);
app.use("/api/v1/reports", apiRateLimit, reportRoutes);
app.use("/api/v1/router-adapters", apiRateLimit, routerAdapterRoutes);
app.use("/api/v1/hotspot", apiRateLimit, hotspotRoutes);
app.use("/api/v1/tickets", apiRateLimit, ticketRoutes);
app.use("/api/v1/notifications", apiRateLimit, notificationRoutes);
app.use("/api/v1/cron", cronRoutes);
app.use("/api/v1/subscriptions", apiRateLimit, subscriptionRoutes);
app.use("/api/v1/alerts", apiRateLimit, alertsRoutes);
app.use("/api/v1/map", apiRateLimit, mapRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/setup", setupRoutes);

// Blog routes — lazy-loaded so bedrock-llm imports don't crash the server
try {
  const blogRoutes = require("./modules/blog/blog.routes").default;
  app.use("/api/v1/blog", blogRoutes);
  console.log("[routes] blog routes loaded");
} catch (err: any) {
  console.error("[routes] Failed to load blog routes (non-fatal):", err.message);
}

// AI routes — lazy-loaded so bedrock/AWS SDK imports don't crash the server
try {
  const businessAiRoutes = require("./modules/business-ai/business-ai.routes").default;
  app.use("/api/v1/business-ai", businessAiRoutes);
  console.log("[routes] business-ai routes loaded");
} catch (err: any) {
  console.error("[routes] Failed to load business-ai routes (non-fatal):", err.message);
}

try {
  const aiAdvancedRoutes = require("./modules/business-ai/ai-advanced.routes").default;
  app.use("/api/v1/business-ai/advanced", aiAdvancedRoutes);
  console.log("[routes] ai-advanced routes loaded");
} catch (err: any) {
  console.error("[routes] Failed to load ai-advanced routes (non-fatal):", err.message);
}

// Fiber detection routes — no premium guard, available to all admins
try {
  const fiberRoutes = require("./modules/business-ai/fiber-detection.routes").default;
  app.use("/api/v1/fiber", apiRateLimit, fiberRoutes);
  console.log("[routes] fiber-detection routes loaded");
} catch (err: any) {
  console.error("[routes] Failed to load fiber-detection routes (non-fatal):", err.message);
}

// Public sales agent — no auth required, for homepage chatbot
try {
  const salesAgentRoutes = require("./modules/business-ai/sales-agent.routes").default;
  app.use("/api/v1/sales-agent", apiRateLimit, salesAgentRoutes);
  console.log("[routes] sales-agent routes loaded");
} catch (err: any) {
  console.error("[routes] Failed to load sales-agent routes (non-fatal):", err.message);
}

app.use(notFoundHandler);
app.use(errorHandler);

export { app, config };
