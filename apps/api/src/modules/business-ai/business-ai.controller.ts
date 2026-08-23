import { Request, Response, NextFunction } from "express";
import { BusinessAIService } from "./business-ai.service";

const service = new BusinessAIService();

export class BusinessAIController {
  async startConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.startConversation(auth?.organizationId || auth?.id, req.body);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.sendMessage(auth?.organizationId || auth?.id, req.body);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async applyPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const { planId } = req.params;
      const result = await service.applyPlan(auth?.organizationId || auth?.id, planId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async listConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.listConversations(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const { planId } = req.params;
      const result = await service.getConversation(auth?.organizationId || auth?.id, planId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async deleteConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const { planId } = req.params;
      const result = await service.deleteConversation(auth?.organizationId || auth?.id, planId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.getInsights(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getDemandPredictions(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const { location } = req.query;
      const result = await service.getDemandPredictions(auth?.organizationId || auth?.id, location as string | undefined);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getProgressReport(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.getProgressReport(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async autoAdjustPricing(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.autoAdjustPricing(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async generateVoucherBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const { daysAhead } = req.body || {};
      const result = await service.generateVoucherBatches(auth?.organizationId || auth?.id, daysAhead || 7);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async calculateExpansionROI(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const { locationName } = req.body;
      const result = await service.calculateExpansionROI(auth?.organizationId || auth?.id, locationName);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getLoadBalancing(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.getLoadBalancing(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
