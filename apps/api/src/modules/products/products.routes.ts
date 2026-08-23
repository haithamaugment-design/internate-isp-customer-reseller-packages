import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../prisma/client";

const router = Router();

// Categories
router.get("/categories", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    res.json({ data: categories });
  } catch { res.json({ data: [] }); }
});

router.post("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, parentId } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Category name is required" });
      return;
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const category = await prisma.productCategory.create({
      data: { name: name.trim(), slug, description: description || null, parentId: parentId || null },
    });
    res.json({ data: category });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      res.status(503).json({ error: "Product categories table not found. Please run the database migration." });
      return;
    }
    next(err);
  }
});

router.delete("/categories/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.productCategory.delete({ where: { id: req.params.id } });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

// Products
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const all = req.query.all === "true";
    const categoryId = req.query.categoryId as string | undefined;
    const products = await prisma.product.findMany({
      where: {
        ...(all ? {} : { published: true }),
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    res.json({ data: products });
  } catch { res.json({ data: [] }); }
});

router.get("/featured", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      where: { featured: true, published: true },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    });
    res.json({ data: products });
  } catch { res.json({ data: [] }); }
});

router.get("/:slug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: { category: true },
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ data: product });
  } catch (err) { next(err); }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, price, comparePrice, imageUrl, specs, features, stock, published, featured, categoryId } = req.body;
    const slug = (req.body.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description: description || null,
        priceCents: typeof price === "number" ? price : Math.round(parseFloat(price || "0") * 100),
        images: imageUrl ? [imageUrl] : [],
        categoryId: categoryId || null,
        specs: specs || null,
        stock: stock ?? 0,
        published: published ?? true,
        featured: featured ?? false,
      },
    });
    res.json({ data: product });
  } catch (err) { next(err); }
});

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: Record<string, unknown> = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.price !== undefined) {
      data.priceCents = typeof req.body.price === "number" ? req.body.price : Math.round(parseFloat(req.body.price || "0") * 100);
    }
    if (req.body.imageUrl !== undefined) data.images = req.body.imageUrl ? [req.body.imageUrl] : [];
    if (req.body.specs !== undefined) data.specs = req.body.specs;
    if (req.body.stock !== undefined) data.stock = parseInt(req.body.stock) || 0;
    if (req.body.published !== undefined) data.published = req.body.published;
    if (req.body.featured !== undefined) data.featured = req.body.featured;
    if (req.body.categoryId !== undefined) data.categoryId = req.body.categoryId || null;
    await prisma.product.update({ where: { id: req.params.id }, data });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

export default router;
