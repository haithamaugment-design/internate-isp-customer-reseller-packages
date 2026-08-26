# NetMaster AI Features — Implementation Plan

## Overview

This document tracks 12 new features to be implemented across the NetMaster ISP reseller platform. All AI features are **premium-only** (Growth/Enterprise subscription plans) enforced via the existing `premiumGuard` middleware. The admin map feature is available to PLATFORM_OWNER and ISP_ADMIN roles.

**Date:** August 26, 2026  
**Status:** ✅ Backend Complete — Frontend pages available via API endpoints

---

## Feature Status

| # | Feature | Status | API Endpoint |
|---|---------|--------|-------------|
| 1 | Voucher Expiry Alerts | ✅ Done | `/api/v1/alerts/expiring` |
| 2 | Support Ticket Auto-Resolution AI | ✅ Done | Auto-triggers on ticket creation + `GET /tickets/:id/suggest-response` |
| 3 | Revenue Prediction Dashboard | ✅ Done | `/api/v1/business-ai/advanced/revenue-predictions` |
| 4 | Router Health Monitoring AI | ✅ Done | `/api/v1/business-ai/advanced/router-health` |
| 5 | Dynamic Pricing Recommendations | ✅ Done | `/api/v1/business-ai/advanced/dynamic-pricing` |
| 6 | Smart Customer Segmentation | ✅ Done | `/api/v1/business-ai/advanced/customer-segments` |
| 7 | AI Reseller Performance Coaching | ✅ Done | `/api/v1/business-ai/advanced/coaching` |
| 8 | Automated Invoice & Earnings Reports | ✅ Done | `/api/v1/business-ai/advanced/earnings-report` |
| 9 | Smart Customer Onboarding | ✅ Done | `/api/v1/business-ai/advanced/onboarding` |
| 10 | AI Content Scheduler | ✅ Done | `/api/v1/business-ai/advanced/content-calendar` |
| 11 | Referral Program Intelligence | ✅ Done | `/api/v1/business-ai/advanced/referrals` |
| 12 | Admin Interactive Map (Leaflet/OSM) | ✅ Done | `/api/v1/map` + `/admin/map` page |

---

## Feature 1: Voucher Expiry Alerts

**Goal:** Prevent revenue loss by notifying resellers and customers before vouchers expire.

### What already exists:
- `Voucher` model has `expiresAt` field ✅
- `Notification` model exists for customer notifications ✅
- `cron.service.ts` already expires vouchers past `expiresAt` ✅
- `notifications` routes and controller exist ✅

### What needs to be added:
- **Backend:** New `alerts.service.ts` — scans vouchers expiring within 24h, creates notifications for resellers + customers
- **Backend:** Cron endpoint to run expiry alert checks (extend existing cron routes)
- **Frontend:** Alert badges/notifications in reseller dashboard showing vouchers about to expire
- **Frontend:** Customer-facing notification when their voucher is about to expire

### Files to create/modify:
- `apps/api/src/modules/alerts/alerts.service.ts` (new)
- `apps/api/src/modules/alerts/alerts.routes.ts` (new)
- `apps/api/src/app.ts` (register alerts routes)
- `apps/api/src/modules/cron/cron.service.ts` (extend with alert checks)
- `apps/web/app/reseller/dashboard/page.tsx` (add expiry alerts widget)

---

## Feature 2: Support Ticket Auto-Resolution AI

**Goal:** Auto-reply to common support issues using AI, classify and route tickets, generate troubleshooting steps in Swahili.

### What already exists:
- Full `Ticket` model with status, priority, source, comments ✅
- `TicketsService` with create, list, update, addComment, assign ✅
- `TicketComment` model for storing replies ✅
- `tickets.service.ts` already supports customer ticket creation ✅
- `premiumGuard` middleware for gating ✅

### What needs to be added:
- **Backend:** `ticket-ai.service.ts` — uses Bedrock LLM to analyze incoming tickets, auto-generate response suggestions
- **Backend:** Auto-classification: analyze ticket subject/description → set priority + type (technical/billing/sales)
- **Backend:** Auto-reply for common issues: "slow internet" → reboot steps, "no internet" → diagnostic steps
- **Backend:** Swahili troubleshooting responses based on customer's router/location
- **Frontend:** AI suggestion panel on ticket detail page showing recommended response
- **Frontend:** Auto-classification badge on ticket list

### Files to create/modify:
- `apps/api/src/modules/business-ai/ticket-ai.service.ts` (new)
- `apps/api/src/modules/tickets/tickets.service.ts` (add AI classification on create)
- `apps/web/app/support/tickets/page.tsx` (add AI suggestions UI)

---

## Feature 3: Revenue Prediction Dashboard

**Goal:** Show resellers monthly revenue predictions, alerts when missing targets, suggest actions.

### What already exists:
- `AnalyticsEngine` with `analyzeDemand()` and `generateProgressReport()` ✅
- `BusinessAIService.getInsights()` returns predictions ✅
- `businessPlAn` model tracks targets ✅
- `BarChart` component exists ✅

### What needs to be added:
- **Backend:** `revenue-predictions.service.ts` — enhanced predictions with seasonal patterns, weekly trends
- **Backend:** Revenue forecast endpoint with month-end projection, daily required rate
- **Frontend:** Revenue prediction dashboard page with charts (BarChart for daily, progress bar for monthly)
- **Frontend:** Alert cards: "At current pace you'll miss target by X TZS"
- **Frontend:** Action suggestions: "Run promotion — offer 3-day vouchers at 15% off"

### Files to create/modify:
- `apps/api/src/modules/business-ai/revenue-predictions.service.ts` (new)
- `apps/api/src/modules/business-ai/ai-advanced.routes.ts` (add revenue prediction endpoint)
- `apps/web/app/reseller/ai-business/insights/page.tsx` (enhance with charts)

---

## Feature 4: Router Health Monitoring AI

**Goal:** Predict router failures, auto-alert on bandwidth issues, suggest capacity upgrades.

### What already exists:
- `Router` model with `status` (ACTIVE/OFFLINE/SUSPENDED) ✅
- `RouterAdapterCommand` model for router commands ✅
- `RouterAdapterReconciliation` for tracking state ✅
- Router adapter modules (MikroTik, OpenWrt, Simulator) ✅

### What needs to be added:
- **Backend:** `router-health.service.ts` — analyze router uptime patterns, predict failures
- **Backend:** Bandwidth usage tracking endpoint (aggregate customer usage per router)
- **Backend:** Health alert creation when router is overloaded (90%+ capacity)
- **Backend:** Auto-recommendation: "Router at Njiro is at 90% — add second router"
- **Frontend:** Router health dashboard with status indicators, uptime %, bandwidth usage
- **Frontend:** Health alert cards with actionable recommendations

### Files to create/modify:
- `apps/api/src/modules/business-ai/router-health.service.ts` (new)
- `apps/api/src/modules/routers/routers.routes.ts` (add health endpoint)
- `apps/api/src/modules/routers/routers.service.ts` (add health methods)
- `apps/web/app/reseller/routers/page.tsx` (add health indicators)

---

## Feature 5: Dynamic Pricing Recommendations

**Goal:** Suggest price adjustments based on demand, time of day, location, competition.

### What already exists:
- `AutomationEngine.autoAdjustPricing()` ✅
- `DemandPrediction` with `recommendedPrice` ✅
- `Package` model with `priceCents` ✅
- `BusinessAIService.autoAdjustPricing()` endpoint ✅

### What needs to be added:
- **Backend:** Enhanced pricing engine with time-of-day awareness (peak/off-peak)
- **Backend:** Location-type pricing rules (hostels vs cafes vs residential)
- **Backend:** Competitor price tracking (manual input or web scraping)
- **Frontend:** Pricing recommendation cards with before/after prices
- **Frontend:** One-click "Apply pricing" button
- **Frontend:** Pricing history chart

### Files to create/modify:
- `apps/api/src/modules/business-ai/automation-engine.ts` (enhance pricing logic)
- `apps/api/src/modules/business-ai/business-ai.routes.ts` (add enhanced pricing endpoint)
- `apps/web/app/reseller/ai-business/automation/page.tsx` (add pricing UI)

---

## Feature 6: Smart Customer Segmentation

**Goal:** Cluster customers into segments based on usage, spending, location for targeted marketing.

### What already exists:
- `Customer` model with `status`, `router`, `subscription` ✅
- `UsageRecord` model for tracking data usage ✅
- `Device` model for tracking connected devices ✅
- Customer list with search/filter ✅

### What needs to be added:
- **Backend:** `customer-segmentation.service.ts` — analyze customers by spending, usage, location, recency
- **Backend:** Auto-tag customers: "Power User", "Budget User", "At-Risk", "New"
- **Backend:** Segment summary with counts and avg metrics
- **Frontend:** Customer segmentation dashboard with segment cards
- **Frontend:** Filter customers by segment
- **Frontend:** Segment-specific action suggestions

### Files to create/modify:
- `apps/api/src/modules/business-ai/customer-segmentation.service.ts` (new)
- `apps/api/src/modules/business-ai/ai-advanced.routes.ts` (add segmentation endpoint)
- `apps/web/app/reseller/customers/page.tsx` (add segmentation view)

---

## Feature 7: AI Reseller Performance Coaching

**Goal:** Compare resellers against benchmarks, provide coaching tips, track improvement.

### What already exists:
- `ReportsService` with `resellerSummary()` and `earningsByReseller()` ✅
- `AnalyticsEngine.generateInsights()` ✅
- `BusinessAIService.getInsights()` ✅

### What needs to be added:
- **Backend:** `reseller-coaching.service.ts` — benchmark comparison, performance scoring
- **Backend:** Coaching tips generator based on weak areas
- **Backend:** Performance score calculation (customer growth, revenue per router, churn rate)
- **Frontend:** Performance score card with radar chart
- **Frontend:** Coaching tips list with priority
- **Frontend:** Benchmark comparison table

### Files to create/modify:
- `apps/api/src/modules/business-ai/reseller-coaching.service.ts` (new)
- `apps/api/src/modules/business-ai/ai-advanced.routes.ts` (add coaching endpoint)
- `apps/web/app/reseller/ai-business/insights/page.tsx` (add coaching section)

---

## Feature 8: Automated Invoice & Earnings Reports

**Goal:** Auto-generate weekly/monthly PDF earnings reports, send via email.

### What already exists:
- `ReportsService.earningsByReseller()` ✅
- `Package` model with pricing ✅
- Voucher usage tracking ✅

### What needs to be added:
- **Backend:** `reports-ai.service.ts` — generate structured earnings report data
- **Backend:** Weekly/monthly report generation endpoint
- **Backend:** PDF generation (using a lightweight library or HTML-to-PDF)
- **Frontend:** Report preview/download page
- **Frontend:** Earnings breakdown charts by location, package, time period

### Files to create/modify:
- `apps/api/src/modules/business-ai/reports-ai.service.ts` (new)
- `apps/api/src/modules/reports/reports.routes.ts` (add AI reports endpoint)
- `apps/web/app/reseller/earnings/page.tsx` (add report generation UI)

---

## Feature 9: Smart Customer Onboarding

**Goal:** Auto-assign new customers to best reseller by location, send welcome messages, track first-week engagement.

### What already exists:
- `CustomersService.create()` ✅
- `Notification` model ✅
- Customer `wifiSsid` and `wifiPassword` fields ✅
- Location-based organization structure ✅

### What needs to be added:
- **Backend:** `onboarding.service.ts` — auto-assign customer to nearest reseller by location
- **Backend:** Welcome notification/SMS generation in Swahili
- **Backend:** First-week engagement tracking (check if customer connected within 48h)
- **Frontend:** Onboarding progress indicator for new customers
- **Frontend:** Auto-welcome message preview

### Files to create/modify:
- `apps/api/src/modules/business-ai/onboarding.service.ts` (new)
- `apps/api/src/modules/customers/customers.service.ts` (enhance create flow)
- `apps/web/app/reseller/customers/page.tsx` (add onboarding status)

---

## Feature 10: AI Content Scheduler

**Goal:** Auto-schedule blog posts, suggest topics based on traffic, optimize titles for SEO.

### What already exists:
- Full `BlogPost` and `BlogCategory` models ✅
- `BlogAIService` for AI content generation ✅
- Blog routes and admin UI ✅
- `BlogProductLink` for product-blog associations ✅

### What needs to be added:
- **Backend:** `content-scheduler.service.ts` — analyze blog performance, suggest publish times
- **Backend:** Topic suggestion engine based on existing content gaps
- **Backend:** SEO title optimization suggestions
- **Frontend:** Content calendar view
- **Frontend:** Topic suggestion cards with estimated traffic

### Files to create/modify:
- `apps/api/src/modules/blog/content-scheduler.service.ts` (new)
- `apps/api/src/modules/blog/blog.routes.ts` (add scheduler endpoints)
- `apps/web/app/admin/blog/page.tsx` (add scheduling UI)

---

## Feature 11: Referral Program Intelligence

**Goal:** Identify best referral opportunities, track referral performance, suggest incentives.

### What already exists:
- Customer model with organization relationships ✅
- Voucher tracking ✅
- Subscription data ✅

### What needs to be added: (requires new DB model)
- **DB:** Add `Referral` model (referrer, referred, reward, status)
- **Backend:** `referral.service.ts` — track referrals, identify top referrers, suggest rewards
- **Backend:** Referral code generation and tracking
- **Frontend:** Referral dashboard with stats
- **Frontend:** Share referral code UI
- **Frontend:** Referral reward history

### Files to create/modify:
- `apps/api/prisma/schema.prisma` (add Referral model)
- `apps/api/src/modules/business-ai/referral.service.ts` (new)
- `apps/web/app/reseller/customers/page.tsx` (add referral section)

---

## Feature 12: Admin Interactive Map (Leaflet/OSM)

**Goal:** Show all reseller customers on an interactive map, locate fiber users, enable area-based marketing planning.

### What already exists:
- `Customer` model with `router` → `location` → `organization` hierarchy ✅
- `Router` model with `macAddress` ✅
- `Location` model with `name` and `address` ✅
- `Organization` hierarchy (ISP → Reseller → Customer) ✅
- Admin dashboard with platform overview ✅

### What needs to be added:
- **DB:** Add `latitude`/`longitude` fields to `Location` model
- **DB:** Add optional `latitude`/`longitude` to `Router` model
- **Backend:** `map.service.ts` — aggregate customer data by location for map display
- **Backend:** Map data endpoint returning customer markers with details
- **Frontend:** Full-screen Leaflet map with OpenStreetMap tiles
- **Frontend:** Customer markers with popup cards (name, router, plan, phone)
- **Frontend:** Area density heatmap for marketing planning
- **Frontend:** "Fiber coverage" layer showing known fiber areas

### Files to create/modify:
- `apps/api/prisma/schema.prisma` (add lat/lng to Location and Router)
- `apps/api/src/modules/map/map.service.ts` (new)
- `apps/api/src/modules/map/map.routes.ts` (new)
- `apps/api/src/app.ts` (register map routes)
- `apps/web/app/admin/map/page.tsx` (new — full map page)
- `apps/web/app/admin/layout.tsx` (add map nav item)

---

## Implementation Order

1. **Feature 1** — Voucher Expiry Alerts (quick win, immediate value)
2. **Feature 2** — Ticket Auto-Resolution (high impact, uses existing Bedrock)
3. **Feature 12** — Admin Map (high visibility, requires DB change)
4. **Feature 3** — Revenue Predictions (enhances existing analytics)
5. **Feature 5** — Dynamic Pricing (builds on existing automation engine)
6. **Feature 4** — Router Health (uses existing adapter infrastructure)
7. **Feature 6** — Customer Segmentation (uses existing customer data)
8. **Feature 7** — Reseller Coaching (builds on existing reports)
9. **Feature 8** — Invoice Reports (extends existing reports)
10. **Feature 9** — Smart Onboarding (enhances existing customer flow)
11. **Feature 10** — Content Scheduler (enhances existing blog)
12. **Feature 11** — Referral Program (new DB model, most work)

---

## Premium Gating

All AI features (1-11) require `subscriptionPlan === "growth"` or `"enterprise"` via the existing `premiumGuard` middleware. The admin map (Feature 12) is available to all admin roles.

## Tech Stack

- **AI/LLM:** AWS Bedrock (DeepSeek V3.2) via `bedrock-llm.ts`
- **Database:** PostgreSQL via Prisma ORM
- **Frontend:** Next.js 16, React, Tailwind CSS
- **Map:** Leaflet + OpenStreetMap (via react-leaflet)
- **Charts:** Existing `BarChart` component + custom extensions
- **Notifications:** In-app `Notification` model (extendable to SMS/email)
