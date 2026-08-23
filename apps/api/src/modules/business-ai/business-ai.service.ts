import crypto from "crypto";
import { prisma } from "../../prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { AIEngine, type ConversationState } from "./ai-engine";
import { AnalyticsEngine, type SalesData } from "./analytics-engine";
import { AutomationEngine } from "./automation-engine";

const aiEngine = new AIEngine();

function generateVoucherCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += alphabet[crypto.randomInt(alphabet.length)];
  }
  return `${body.slice(0, 4)}-${body.slice(4)}`;
}

/** Check if an error indicates a missing table or schema mismatch */
function isMissingTable(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  // P2021 = table does not exist
  // P2022 = column does not exist
  // P2003 = foreign key constraint failed (parent table missing)
  // P2025 = record not found (can happen during cascading issues)
  if (["P2021", "P2022", "P2003"].includes(code || "")) return true;
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("does not exist") || msg.includes("relation does not exist") || msg.includes("column ")) return true;
  return false;
}

export interface CreateConversationInput {
  name?: string;
}

export interface SendMessageInput {
  conversationId: string;
  message: string;
}

export interface UpdatePlanInput {
  planId: string;
  name?: string;
  monthlyProfitTarget?: number;
  locationPlans?: any[];
}

export class BusinessAIService {
  /**
   * Start a new AI conversation
   */
  async startConversation(resellerId: string, input?: CreateConversationInput) {
    try {
      const plan = await prisma.businessPlan.create({
        data: {
          resellerId,
          name: input?.name || `Business Plan - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
          monthlyProfitTarget: 0,
          monthlyRevenueTarget: 0,
          totalCosts: 0,
          costs: {},
          locationPlans: [],
          status: "DRAFT",
        },
      });

      // Initial state
      const state: ConversationState = { step: 0, answers: {}, planGenerated: false };

      // Save state as the first message metadata
      await prisma.businessPlanMessage.create({
        data: {
          planId: plan.id,
          role: "system",
          content: JSON.stringify(state),
          metadata: { type: "state_init" },
        },
      });

      // Get the first AI question
      const { response, newState } = aiEngine.processMessage(state, "");

      // Save AI greeting
      await prisma.businessPlanMessage.create({
        data: {
          planId: plan.id,
          role: "assistant",
          content: response.message + (response.question ? "\n\n" + response.question : ""),
          metadata: { type: response.type, options: response.options || [] },
        },
      });

      // Save updated state
      await prisma.businessPlanMessage.create({
        data: {
          planId: plan.id,
          role: "system",
          content: JSON.stringify(newState),
          metadata: { type: "state_update" },
        },
      });

      return {
        plan,
        message: response.message + (response.question ? "\n\n" + response.question : ""),
        options: response.options,
        type: response.type,
      };
    } catch (err) {
      if (isMissingTable(err)) {
        throw new AppError(503, "Business AI tables not yet available. Please run database migrations.");
      }
      throw err;
    }
  }

  /**
   * Send a message in an existing conversation
   */
  async sendMessage(resellerId: string, input: SendMessageInput) {
    try {
      // Verify plan belongs to reseller
      const plan = await prisma.businessPlan.findFirst({
        where: { id: input.conversationId, resellerId },
      });
      if (!plan) throw new AppError(404, "Conversation not found");

      // Get last state from messages
      const lastStateMsg = await prisma.businessPlanMessage.findFirst({
        where: { planId: plan.id, role: "system" },
        orderBy: { createdAt: "desc" },
      });

      const state: ConversationState = lastStateMsg
        ? JSON.parse(lastStateMsg.content)
        : { step: 0, answers: {}, planGenerated: false };

      // Save user message
      await prisma.businessPlanMessage.create({
        data: {
          planId: plan.id,
          role: "user",
          content: input.message,
          metadata: { type: "user_input" },
        },
      });

      // Process with AI
      const { response, newState } = aiEngine.processMessage(state, input.message);

      // Save AI response
      await prisma.businessPlanMessage.create({
        data: {
          planId: plan.id,
          role: "assistant",
          content: response.message,
          metadata: {
            type: response.type,
            options: response.options || [],
            action: (response.metadata as any)?.action || null,
            plan: response.metadata && response.type === "plan" ? JSON.parse(JSON.stringify(response.metadata)) : null,
          },
        },
      });

      // Save updated state
      await prisma.businessPlanMessage.create({
        data: {
          planId: plan.id,
          role: "system",
          content: JSON.stringify(newState),
          metadata: { type: "state_update" },
        },
      });

      // If plan was generated, update the plan record
      if (response.type === "plan" && response.metadata) {
        const planData = response.metadata as any;
        await prisma.businessPlan.update({
          where: { id: plan.id },
          data: {
            name: plan.name,
            monthlyProfitTarget: planData.profitTarget || 0,
            monthlyRevenueTarget: planData.revenueTarget || 0,
            totalCosts: planData.totalCosts || 0,
            costs: planData.costs || {},
            locationPlans: planData.locationPlans || [],
          },
        });
      }

      return {
        message: response.message,
        options: response.options,
        type: response.type,
        metadata: response.metadata,
      };
    } catch (err) {
      if (isMissingTable(err)) {
        throw new AppError(503, "Business AI tables not yet available. Please run database migrations.");
      }
      throw err;
    }
  }

  /**
   * Apply a plan — create voucher batches based on the plan
   */
  async applyPlan(resellerId: string, planId: string) {
    try {
      const plan = await prisma.businessPlan.findFirst({
        where: { id: planId, resellerId },
      });
      if (!plan) throw new AppError(404, "Plan not found");

      if (plan.status === "ACTIVE") {
        throw new AppError(400, "Plan is already active");
      }

      // Mark plan as active
      await prisma.businessPlan.update({
        where: { id: planId },
        data: {
          status: "ACTIVE",
          activatedAt: new Date(),
        },
      });

      const locationPlans = plan.locationPlans as any[];
      const createdPackages: any[] = [];
      const createdVouchers: any[] = [];

      // Resolve locations by name to find their IDs and routers
      const locations = await prisma.location.findMany({
        where: { organizationId: resellerId },
        include: { routers: true },
      });

      for (const locPlan of locationPlans) {
        // Find matching location by name
        const location = locations.find(l => l.name.toLowerCase() === locPlan.name?.toLowerCase());

        // Create packages for this location
        for (const pkg of locPlan.packages || []) {
          const existingPkg = await prisma.package.findFirst({
            where: { organizationId: resellerId, name: pkg.name },
          });

          if (!existingPkg) {
            const createdPkg = await prisma.package.create({
              data: {
                organizationId: resellerId,
                name: pkg.name,
                priceCents: pkg.price || 0,
                speedMbps: 10,
                dataCapGb: null,
              },
            });
            createdPackages.push(createdPkg);
          }
        }

        // Generate voucher batch for this location
        const batchSize = locPlan.recommendedVoucherBatchSize || 50;
        const expiryDays = locPlan.voucherExpiryDays || 7;
        const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

        for (let i = 0; i < batchSize; i++) {
          const code = generateVoucherCode();
          try {
            const voucher = await prisma.voucher.create({
              data: {
                code,
                organizationId: resellerId,
                locationId: location?.id ?? null,
                dataGb: null,
                durationHours: expiryDays * 24,
                expiresAt,
              },
            });
            createdVouchers.push(voucher);
          } catch {
            // Duplicate code — skip and continue
          }
        }
      }

      return {
        plan,
        createdPackages,
        createdVouchers,
        message: `Plan "${plan.name}" is now active! Created ${createdPackages.length} packages and ${createdVouchers.length} vouchers across ${locationPlans.length} locations.`,
      };
    } catch (err) {
      if (isMissingTable(err)) {
        throw new AppError(503, "Business AI tables not yet available. Please run database migrations.");
      }
      throw err;
    }
  }

  /**
   * List all conversations for a reseller
   */
  async listConversations(resellerId: string) {
    try {
      return await prisma.businessPlan.findMany({
        where: { resellerId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    } catch (err) {
      if (isMissingTable(err)) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Get a single conversation with messages
   */
  async getConversation(resellerId: string, planId: string) {
    try {
      const plan = await prisma.businessPlan.findFirst({
        where: { id: planId, resellerId },
      });
      if (!plan) throw new AppError(404, "Conversation not found");

      const messages = await prisma.businessPlanMessage.findMany({
        where: { planId },
        orderBy: { createdAt: "asc" },
      });

      // Filter out system messages for the UI
      const visibleMessages = messages
        .filter((m: { role: string }) => m.role !== "system")
        .map((m: { id: string; role: string; content: string; metadata: unknown; createdAt: Date }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata,
          createdAt: m.createdAt,
        }));

      return { plan, messages: visibleMessages };
    } catch (err) {
      if (isMissingTable(err)) {
        throw new AppError(503, "Business AI tables not yet available. Please run database migrations.");
      }
      throw err;
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(resellerId: string, planId: string) {
    try {
      const plan = await prisma.businessPlan.findFirst({
        where: { id: planId, resellerId },
      });
      if (!plan) throw new AppError(404, "Conversation not found");

      // Delete messages first
      await prisma.businessPlanMessage.deleteMany({ where: { planId } });
      await prisma.businessPlan.delete({ where: { id: planId } });

      return { message: "Conversation deleted" };
    } catch (err) {
      if (isMissingTable(err)) {
        throw new AppError(503, "Business AI tables not yet available. Please run database migrations.");
      }
      throw err;
    }
  }

  /**
   * Get AI insights for the reseller
   */
  async getInsights(resellerId: string) {
    try {
      const analyticsEngine = new AnalyticsEngine();

      // Get active plan
      const activePlan = await prisma.businessPlan.findFirst({
        where: { resellerId, status: "ACTIVE" },
        orderBy: { activatedAt: "desc" },
      }).catch(() => null);

      // Get sales history from vouchers
      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId, status: "USED" },
        include: { location: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      type VoucherRow = { createdAt: Date; locationId: string | null; location?: { name: string } | null };
      const salesHistory: SalesData[] = (vouchers as VoucherRow[]).map((v) => ({
        date: v.createdAt.toISOString().split("T")[0],
        locationId: v.locationId || undefined,
        locationName: v.location?.name || undefined,
        voucherCount: 1,
        revenue: 0,
        customers: 1,
      }));

      const org = await prisma.organization.findFirst({
        where: { id: resellerId },
      });

      type LocationRow = { name: string; routers: { id: string }[] };
      const locations = await prisma.location.findMany({
        where: { organizationId: resellerId },
        include: { routers: { select: { id: true } } },
      }) as LocationRow[];
      const totalRouters = locations.reduce((sum: number, loc: LocationRow) => sum + loc.routers.length, 0);

      const locationData = locations.map((loc: LocationRow) => ({
        name: loc.name,
        routers: loc.routers.length,
        customers: 10,
      }));

      if (!activePlan) {
        return {
          insights: [{
            type: "suggestion" as const,
            title: "🚀 Start Your Business Plan",
            message: "You don't have an active business plan yet. Let me help you create one!",
            priority: "medium" as const,
          }],
          predictions: analyticsEngine.analyzeDemand(salesHistory, locationData),
          progress: null,
        };
      }

      const planData = {
        monthlyProfitTarget: activePlan.monthlyProfitTarget,
        monthlyRevenueTarget: activePlan.monthlyRevenueTarget,
        totalCosts: activePlan.totalCosts,
        locationPlans: (activePlan.locationPlans as any[]) || [],
      };

      const insights = analyticsEngine.generateInsights(
        salesHistory,
        planData,
        org?.subscriptionPlan || "free",
        totalRouters
      );

      const predictions = analyticsEngine.analyzeDemand(salesHistory, locationData);
      const progress = analyticsEngine.generateProgressReport(
        {
          name: activePlan.name,
          monthlyRevenueTarget: activePlan.monthlyRevenueTarget,
          locationPlans: planData.locationPlans,
          activatedAt: activePlan.activatedAt,
        },
        salesHistory
      );

      return { insights, predictions, progress };
    } catch (err) {
      if (isMissingTable(err)) {
        return {
          insights: [{
            type: "suggestion" as const,
            title: "🚀 Start Your Business Plan",
            message: "You don't have an active business plan yet. Let me help you create one!",
            priority: "medium" as const,
          }],
          predictions: [],
          progress: null,
        };
      }
      throw err;
    }
  }

  /**
   * Auto-adjust pricing based on sales data
   */
  async autoAdjustPricing(resellerId: string) {
    try {
      const automationEngine = new AutomationEngine();
      const analyticsEngine = new AnalyticsEngine();

      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId, status: "USED" },
        include: { location: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      const salesHistory: SalesData[] = vouchers.map((v) => ({
        date: v.createdAt.toISOString().split("T")[0],
        locationId: v.locationId || undefined,
        locationName: v.location?.name || undefined,
        voucherCount: 1,
        revenue: 0,
        customers: 1,
      }));

      const locations = await prisma.location.findMany({
        where: { organizationId: resellerId },
        include: { routers: { select: { id: true } } },
      });

      const locationData = locations.map((loc) => ({
        name: loc.name,
        routers: loc.routers.length,
        customers: 10,
      }));

      const predictions = analyticsEngine.analyzeDemand(salesHistory, locationData);

      // Get current packages
      const packages = await prisma.package.findMany({
        where: { organizationId: resellerId },
      });

      const currentPackages = packages.map((p) => ({
        name: p.name,
        price: p.priceCents,
        locationName: undefined,
      }));

      return automationEngine.autoAdjustPricing(salesHistory, predictions, currentPackages);
    } catch (err) {
      if (isMissingTable(err)) {
        return { adjustments: [], summary: "No data available for pricing adjustments yet." };
      }
      throw err;
    }
  }

  /**
   * Generate auto voucher batches
   */
  async generateVoucherBatches(resellerId: string, daysAhead: number = 7) {
    try {
      const automationEngine = new AutomationEngine();
      const analyticsEngine = new AnalyticsEngine();

      const activePlan = await prisma.businessPlan.findFirst({
        where: { resellerId, status: "ACTIVE" },
        orderBy: { activatedAt: "desc" },
      });

      if (!activePlan) {
        throw new AppError(400, "No active plan. Create and activate a plan first.");
      }

      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId, status: "USED" },
        include: { location: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      const salesHistory: SalesData[] = vouchers.map((v) => ({
        date: v.createdAt.toISOString().split("T")[0],
        locationId: v.locationId || undefined,
        locationName: v.location?.name || undefined,
        voucherCount: 1,
        revenue: 0,
        customers: 1,
      }));

      const locations = await prisma.location.findMany({
        where: { organizationId: resellerId },
        include: { routers: { select: { id: true } } },
      });

      const locationData = locations.map((loc) => ({
        name: loc.name,
        routers: loc.routers.length,
        customers: 10,
      }));

      const predictions = analyticsEngine.analyzeDemand(salesHistory, locationData);

      return automationEngine.generateVoucherBatches(
        {
          locationPlans: (activePlan.locationPlans as any[]) || [],
          salesStyle: "mixed",
        },
        predictions,
        daysAhead
      );
    } catch (err) {
      if (isMissingTable(err)) {
        return { batches: [], message: "Business plan data not available. Create a plan first." };
      }
      throw err;
    }
  }

  /**
   * Calculate ROI for new location expansion
   */
  async calculateExpansionROI(resellerId: string, newLocationName: string) {
    try {
      const automationEngine = new AutomationEngine();
      const analyticsEngine = new AnalyticsEngine();

      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId, status: "USED" },
        include: { location: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      const salesHistory: SalesData[] = vouchers.map((v) => ({
        date: v.createdAt.toISOString().split("T")[0],
        locationId: v.locationId || undefined,
        locationName: v.location?.name || undefined,
        voucherCount: 1,
        revenue: 0,
        customers: 1,
      }));

      const locations = await prisma.location.findMany({
        where: { organizationId: resellerId },
        include: { routers: { select: { id: true } } },
      });

      const locationData = locations.map((loc) => ({
        name: loc.name,
        routers: loc.routers.length,
        customers: 10,
      }));

      const predictions = analyticsEngine.analyzeDemand(salesHistory, locationData);

      const activePlan = await prisma.businessPlan.findFirst({
        where: { resellerId, status: "ACTIVE" },
      }).catch(() => null);

      const planData = {
        monthlyProfitTarget: activePlan?.monthlyProfitTarget || 100000,
        monthlyRevenueTarget: activePlan?.monthlyRevenueTarget || 150000,
        totalCosts: activePlan?.totalCosts || 25000,
      };

      // Get router options from shop
      const products = await prisma.product.findMany({
        where: { published: true },
        take: 10,
      });

      const routerOptions = products.map((p) => ({
        name: p.name,
        price: p.priceCents,
        features: (p.specs as any)?.features || ["Basic routing"],
      }));

      return automationEngine.calculateExpansionROI(
        newLocationName,
        predictions,
        planData,
        routerOptions
      );
    } catch (err) {
      if (isMissingTable(err)) {
        return { roi: null, message: "Insufficient data for ROI calculation. Add more sales data first." };
      }
      throw err;
    }
  }

  /**
   * Get load balancing recommendations
   */
  async getLoadBalancing(resellerId: string) {
    try {
      const automationEngine = new AutomationEngine();

      const locations = await prisma.location.findMany({
        where: { organizationId: resellerId },
        include: { routers: { select: { id: true } } },
      });

      // Get sales data per location
      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId, status: "USED" },
        include: { location: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const monthVouchers = vouchers.filter((v) => v.createdAt.toISOString() >= monthStart);

      const locationData = locations.map((loc) => {
        const locVouchers = monthVouchers.filter((v) => v.location?.name === loc.name);
        return {
          name: loc.name,
          routers: loc.routers.length,
          customers: locVouchers.length || 10,
          currentRevenue: locVouchers.length * 1500, // Estimate
          targetRevenue: 30000, // Default target
        };
      });

      return automationEngine.balanceLoad(locationData);
    } catch (err) {
      if (isMissingTable(err)) {
        return { recommendations: [], summary: "No location data available for load balancing." };
      }
      throw err;
    }
  }

  /**
   * Get demand predictions for a specific location
   */
  async getDemandPredictions(resellerId: string, locationName?: string) {
    try {
      const analyticsEngine = new AnalyticsEngine();

      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId, status: "USED" },
        include: { location: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      const salesHistory: SalesData[] = vouchers.map((v) => ({
        date: v.createdAt.toISOString().split("T")[0],
        locationId: v.locationId || undefined,
        locationName: v.location?.name || undefined,
        voucherCount: 1,
        revenue: 0,
        customers: 1,
      }));

      const locations = await prisma.location.findMany({
        where: { organizationId: resellerId },
        include: { routers: { select: { id: true } } },
      });

      const locationData = locations
        .filter((loc) => !locationName || loc.name === locationName)
        .map((loc) => ({
          name: loc.name,
          routers: loc.routers.length,
          customers: 10,
        }));

      return analyticsEngine.analyzeDemand(salesHistory, locationData);
    } catch (err) {
      if (isMissingTable(err)) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Get progress report for active plan
   */
  async getProgressReport(resellerId: string) {
    try {
      const analyticsEngine = new AnalyticsEngine();

      const activePlan = await prisma.businessPlan.findFirst({
        where: { resellerId, status: "ACTIVE" },
        orderBy: { activatedAt: "desc" },
      }).catch(() => null);

      if (!activePlan) {
        return null;
      }

      const vouchers = await prisma.voucher.findMany({
        where: { organizationId: resellerId, status: "USED" },
        include: { location: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      const salesHistory: SalesData[] = vouchers.map((v) => ({
        date: v.createdAt.toISOString().split("T")[0],
        locationId: v.locationId || undefined,
        locationName: v.location?.name || undefined,
        voucherCount: 1,
        revenue: 0,
        customers: 1,
      }));

      return analyticsEngine.generateProgressReport(
        {
          name: activePlan.name,
          monthlyRevenueTarget: activePlan.monthlyRevenueTarget,
          locationPlans: (activePlan.locationPlans as any[]) || [],
          activatedAt: activePlan.activatedAt,
        },
        salesHistory
      );
    } catch (err) {
      if (isMissingTable(err)) {
        return null;
      }
      throw err;
    }
  }
}
