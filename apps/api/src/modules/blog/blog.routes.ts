import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../prisma/client";

const router = Router();

/** Map Prisma fields to frontend-friendly names */
function toFrontendPost(p: any) {
  return {
    ...p,
    coverImage: p.featuredImage || p.coverImage || null,
    linkedProductIds: p.productLinks?.map((l: any) => l.productId).join(",") || "",
  };
}

// Categories
router.get("/categories", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: true } } },
    });
    res.json({ data: categories });
  } catch (err) {
    console.error("GET /blog/categories error:", (err as Error)?.message?.substring(0, 200));
    res.json({ data: [] });
  }
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
  } catch (err: any) {
    console.error("POST /blog/categories error:", err?.code, err?.message?.substring(0, 300));
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
      include: { category: true, productLinks: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: posts.map(toFrontendPost) });
  } catch (err) {
    console.error("GET /blog/posts error:", (err as Error)?.message?.substring(0, 200));
    res.json({ data: [] });
  }
});

router.get("/posts/:idOrSlug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const param = req.params.idOrSlug;
    // Try by id first, then by slug
    let post = await prisma.blogPost.findUnique({
      where: { id: param },
      include: { category: true, productLinks: true },
    }).catch(() => null);
    if (!post) {
      post = await prisma.blogPost.findUnique({
        where: { slug: param },
        include: { category: true, productLinks: true },
      }).catch(() => null);
    }
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ data: toFrontendPost(post) });
  } catch (err) { next(err); }
});

router.post("/posts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, excerpt, author, categoryId, published, tags, linkedProductIds } = req.body;
    if (!title || !title.trim()) {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    if (!content || !content.trim()) {
      res.status(400).json({ error: "Content is required" });
      return;
    }
    const slug = (req.body.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const tagsArray = tags
      ? (typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : Array.isArray(tags) ? tags : [])
      : [];
    const post = await prisma.blogPost.create({
      data: {
        title: title.trim(),
        slug,
        content,
        excerpt: excerpt || null,
        featuredImage: req.body.coverImage || null,
        categoryId: categoryId || null,
        published: published ?? false,
        tags: tagsArray,
      },
      include: { productLinks: true },
    });
    // Save linked products
    if (linkedProductIds && typeof linkedProductIds === "string") {
      const ids = linkedProductIds.split(",").map((s: string) => s.trim()).filter(Boolean);
      for (const productId of ids) {
        await prisma.blogProductLink.upsert({
          where: { blogPostId_productId: { blogPostId: post.id, productId } },
          update: {},
          create: { blogPostId: post.id, productId },
        }).catch(() => {});
      }
    }
    res.json({ data: toFrontendPost(post) });
  } catch (err: any) {
    console.error("POST /blog/posts error:", err?.code, err?.message?.substring(0, 300));
    next(err);
  }
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
    // Update linked products
    if (req.body.linkedProductIds !== undefined) {
      // Delete existing links
      await prisma.blogProductLink.deleteMany({ where: { blogPostId: req.params.id } });
      // Create new links
      const ids = typeof req.body.linkedProductIds === "string"
        ? req.body.linkedProductIds.split(",").map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(req.body.linkedProductIds) ? req.body.linkedProductIds : [];
      for (const productId of ids) {
        await prisma.blogProductLink.create({
          data: { blogPostId: req.params.id, productId },
        }).catch(() => {});
      }
    }
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
