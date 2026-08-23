import { Router, Request, Response, NextFunction } from "express";
import { ProductsService } from "./products.service";

const router = Router();
const service = new ProductsService();

// Categories
router.get("/categories", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await service.listCategories();
    res.json({ data: categories });
  } catch (err) { next(err); }
});

router.post("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await service.createCategory(req.body);
    res.json({ data: category });
  } catch (err) { next(err); }
});

router.put("/categories/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.createCategory(req.body);
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

router.delete("/categories/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteCategory(req.params.id);
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

// Products
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const all = req.query.all === "true";
    const categoryId = req.query.categoryId as string | undefined;
    const products = await service.listProducts(all ? false : true, categoryId);
    res.json({ data: products });
  } catch (err) { next(err); }
});

router.get("/featured", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await service.getFeatured();
    res.json({ data: products });
  } catch (err) { next(err); }
});

router.get("/:slug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await service.getProduct(req.params.slug);
    res.json({ data: product });
  } catch (err) { next(err); }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await service.createProduct(req.body);
    res.json({ data: product });
  } catch (err) { next(err); }
});

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.updateProduct(req.params.id, req.body);
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteProduct(req.params.id);
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

export default router;
