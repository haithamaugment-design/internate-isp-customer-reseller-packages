import { prisma } from "../../prisma/client";
import { AppError } from "../../middleware/errorHandler";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export class BlogService {
  // Categories
  async listCategories() {
    const categories = await prisma.$queryRawUnsafe(

      `SELECT c."id", c."name", c."slug", c."description", c."parentId",
              (SELECT COUNT(*)::int FROM "blog_posts" p WHERE p."categoryId" = c."id" AND p."published" = true) as "postCount"
       FROM "blog_categories" c
       WHERE c."parentId" IS NULL
       ORDER BY c."name" ASC`
    );

    // Get subcategories
    const subcategories = await prisma.$queryRawUnsafe(

      `SELECT c."id", c."name", c."slug", c."description", c."parentId",
              (SELECT COUNT(*)::int FROM "blog_posts" p WHERE p."categoryId" = c."id" AND p."published" = true) as "postCount"
       FROM "blog_categories" c
       WHERE c."parentId" IS NOT NULL
       ORDER BY c."name" ASC`
    );

    return [...(categories as { id: string; name: string; slug: string; description: string | null; parentId: string | null; postCount: bigint }[]), ...(subcategories as { id: string; name: string; slug: string; description: string | null; parentId: string | null; postCount: bigint }[])].map((c) => ({
      ...c,
      postCount: Number(c.postCount),
      _count: { posts: Number(c.postCount) },
    }));
  }

  async createCategory(data: { name: string; description?: string; parentId?: string }) {
    const id = `blogcat-${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "blog_categories" ("id", "name", "slug", "description", "parentId", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      id, data.name, slugify(data.name), data.description || null, data.parentId || null
    );
    return { id, name: data.name, slug: slugify(data.name) };
  }

  async deleteCategory(id: string) {
    await prisma.$executeRawUnsafe(`DELETE FROM "blog_categories" WHERE "id" = $1`, id);
  }

  // Posts
  async listPosts(published = true, categoryId?: string) {
    let query = `
      SELECT p."id", p."title", p."slug", p."content", p."excerpt", p."coverImage",
             p."author", p."tags", p."linkedProductIds", p."published", p."categoryId",
             p."createdAt" as "createdAt",
             c."id" as "catId", c."name" as "catName", c."slug" as "catSlug"
      FROM "blog_posts" p
      LEFT JOIN "blog_categories" c ON p."categoryId" = c."id"
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (published) {
      query += ` AND p."published" = true`;
    }
    if (categoryId) {
      query += ` AND p."categoryId" = $${paramIdx++}`;
      params.push(categoryId);
    }

    query += ` ORDER BY p."createdAt" DESC LIMIT 50`;

    const rows = await prisma.$queryRawUnsafe(query, ...params) as { id: string; title: string; slug: string; content: string; excerpt: string | null; coverImage: string | null; author: string | null; tags: string | null; linkedProductIds: string | null; published: boolean; categoryId: string | null; createdAt: Date; catId: string | null; catName: string | null; catSlug: string | null }[];

    return rows.map((r: { id: string; title: string; slug: string; content: string; excerpt: string | null; coverImage: string | null; author: string | null; tags: string | null; linkedProductIds: string | null; published: boolean; categoryId: string | null; createdAt: Date; catId: string | null; catName: string | null; catSlug: string | null }) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      content: r.content,
      excerpt: r.excerpt,
      coverImage: r.coverImage,
      author: r.author,
      tags: r.tags,
      linkedProductIds: r.linkedProductIds,
      published: r.published,
      categoryId: r.categoryId,
      createdAt: r.createdAt,
      category: r.catId ? { id: r.catId, name: r.catName!, slug: r.catSlug! } : null,
    }));
  }

  async getPost(slug: string) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT p."id", p."title", p."slug", p."content", p."excerpt", p."coverImage",
              p."author", p."tags", p."linkedProductIds", p."published", p."categoryId",
              p."createdAt" as "createdAt",
              c."id" as "catId", c."name" as "catName", c."slug" as "catSlug"
       FROM "blog_posts" p
       LEFT JOIN "blog_categories" c ON p."categoryId" = c."id"
       WHERE p."slug" = $1`,
      slug
    ) as { id: string; title: string; slug: string; content: string; excerpt: string | null; coverImage: string | null; author: string | null; tags: string | null; linkedProductIds: string | null; published: boolean; categoryId: string | null; createdAt: Date; catId: string | null; catName: string | null; catSlug: string | null }[];

    if (rows.length === 0) throw new AppError(404, "Post not found");
    const r = rows[0];

    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      content: r.content,
      excerpt: r.excerpt,
      coverImage: r.coverImage,
      author: r.author,
      tags: r.tags,
      linkedProductIds: r.linkedProductIds,
      published: r.published,
      categoryId: r.categoryId,
      createdAt: r.createdAt,
      category: r.catId ? { id: r.catId, name: r.catName!, slug: r.catSlug! } : null,
    };
  }

  async createPost(data: { title: string; content: string; excerpt?: string; coverImage?: string; author?: string; tags?: string; linkedProductIds?: string; categoryId?: string; published?: boolean }) {
    const id = `blogpost-${Date.now()}`;
    const slug = slugify(data.title);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "blog_posts" ("id", "title", "slug", "content", "excerpt", "coverImage", "author", "tags", "linkedProductIds", "categoryId", "published", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      id, data.title, slug, data.content, data.excerpt || null, data.coverImage || null,
      data.author || null, data.tags || null, data.linkedProductIds || null,
      data.categoryId || null, data.published ?? false
    );
    return { id, title: data.title, slug };
  }

  async updatePost(id: string, data: { title?: string; content?: string; excerpt?: string; coverImage?: string; author?: string; tags?: string; linkedProductIds?: string; categoryId?: string; published?: boolean }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const col = key === "linkedProductIds" ? "linkedProductIds" : key;
        fields.push(`"${col}" = $${paramIdx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    fields.push(`"updatedAt" = NOW()`);
    values.push(id);

    await prisma.$executeRawUnsafe(
      `UPDATE "blog_posts" SET ${fields.join(", ")} WHERE "id" = $${paramIdx}`,
      ...values
    );
  }

  async deletePost(id: string) {
    await prisma.$executeRawUnsafe(`DELETE FROM "blog_posts" WHERE "id" = $1`, id);
  }
}
