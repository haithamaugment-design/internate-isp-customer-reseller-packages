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
import subscriptionRoutes from "./modules/subscriptions/subscriptions.routes";
import blogRoutes from "./modules/blog/blog.routes";
import productRoutes from "./modules/products/products.routes";
import businessAiRoutes from "./modules/business-ai/business-ai.routes";
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
app.use("/api/v1/blog", blogRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/business-ai", businessAiRoutes);
app.use("/api/v1/setup", setupRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export { app, config };
