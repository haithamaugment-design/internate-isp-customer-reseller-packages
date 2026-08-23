import { Router, Request, Response, NextFunction } from "express";
import { BlogService } from "./blog.service";

const router = Router();
const service = new BlogService();

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

// Posts
router.get("/posts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const all = req.query.all === "true";
    const categoryId = req.query.categoryId as string | undefined;
    const posts = await service.listPosts(all ? false : true, categoryId);
    res.json({ data: posts });
  } catch (err) { next(err); }
});

router.get("/posts/:slug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await service.getPost(req.params.slug);
    res.json({ data: post });
  } catch (err) { next(err); }
});

router.post("/posts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await service.createPost(req.body);
    res.json({ data: post });
  } catch (err) { next(err); }
});

router.put("/posts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.updatePost(req.params.id, req.body);
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

router.delete("/posts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deletePost(req.params.id);
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

export default router;
