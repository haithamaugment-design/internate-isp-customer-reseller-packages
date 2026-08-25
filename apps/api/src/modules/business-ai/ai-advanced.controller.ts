import { Request, Response, NextFunction } from "express";
import { AIAdvancedService } from "./ai-advanced.service";

const service = new AIAdvancedService();

export class AIAdvancedController {
  async predictChurn(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.predictChurn(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getDynamicPricing(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.getDynamicPricing(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getNetworkHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.getNetworkHealth(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getSupportInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.getSupportInsights(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getRevenueForecast(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.getRevenueForecast(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getGrowthAdvice(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as any).auth;
      const result = await service.getGrowthAdvice(auth?.organizationId || auth?.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
