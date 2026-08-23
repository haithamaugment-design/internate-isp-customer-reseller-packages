import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../prisma/client";

const router = Router();

// Categories
router.get("/categories", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: true } } },
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
    const category = await prisma.blogCategory.create({
      data: { name: name.trim(), slug, description: description || null, parentId: parentId || null },
    });
    res.json({ data: category });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      res.status(503).json({ error: "Blog categories table not found. Please run the database migration." });
      return;
    }
    next(err);
  }
});

router.delete("/categories/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.blogCategory.delete({ where: { id: req.params.id } });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

// Posts
router.get("/posts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const all = req.query.all === "true";
    const categoryId = req.query.categoryId as string | undefined;
    const posts = await prisma.blogPost.findMany({
      where: {
        ...(all ? {} : { published: true }),
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: posts });
  } catch { res.json({ data: [] }); }
});

router.get("/posts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      include: { category: true },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ data: post });
  } catch (err) { next(err); }
});

router.post("/posts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, excerpt, author, categoryId, published, tags, linkedProductIds } = req.body;
    const slug = (req.body.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        featuredImage: req.body.coverImage || null,
        categoryId: categoryId || null,
        published: published ?? false,
        tags: tags ? (typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()) : tags) : [],
      },
    });
    res.json({ data: post });
  } catch (err) { next(err); }
});

router.put("/posts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: Record<string, unknown> = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.content !== undefined) data.content = req.body.content;
    if (req.body.excerpt !== undefined) data.excerpt = req.body.excerpt;
    if (req.body.coverImage !== undefined) data.featuredImage = req.body.coverImage;
    if (req.body.categoryId !== undefined) data.categoryId = req.body.categoryId || null;
    if (req.body.published !== undefined) data.published = req.body.published;
    if (req.body.tags !== undefined) {
      data.tags = typeof req.body.tags === "string" ? req.body.tags.split(",").map((t: string) => t.trim()) : req.body.tags;
    }
    await prisma.blogPost.update({ where: { id: req.params.id }, data });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

router.delete("/posts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

export default router;
