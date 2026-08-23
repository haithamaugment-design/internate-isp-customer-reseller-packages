import { prisma } from "../../prisma/client";
import { AppError } from "../../middleware/errorHandler";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export class ProductsService {
  // Categories
  async listCategories() {
    const categories = await prisma.$queryRawUnsafe(

      `SELECT c."id", c."name", c."slug", c."description", c."parentId",
              (SELECT COUNT(*)::int FROM "products" p WHERE p."categoryId" = c."id" AND p."published" = true) as "productCount"
       FROM "product_categories" c
       WHERE c."parentId" IS NULL
       ORDER BY c."name" ASC`
    );

    const subcategories = await prisma.$queryRawUnsafe(

      `SELECT c."id", c."name", c."slug", c."description", c."parentId",
              (SELECT COUNT(*)::int FROM "products" p WHERE p."categoryId" = c."id" AND p."published" = true) as "productCount"
       FROM "product_categories" c
       WHERE c."parentId" IS NOT NULL
       ORDER BY c."name" ASC`
    );

    return [...(categories as { id: string; name: string; slug: string; description: string | null; parentId: string | null; productCount: bigint }[]), ...(subcategories as { id: string; name: string; slug: string; description: string | null; parentId: string | null; productCount: bigint }[])].map((c) => ({
      ...c,
      productCount: Number(c.productCount),
      _count: { products: Number(c.productCount) },
    }));
  }

  async createCategory(data: { name: string; description?: string; parentId?: string }) {
    const id = `prodcat-${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "product_categories" ("id", "name", "slug", "description", "parentId", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      id, data.name, slugify(data.name), data.description || null, data.parentId || null
    );
    return { id, name: data.name, slug: slugify(data.name) };
  }

  async deleteCategory(id: string) {
    await prisma.$executeRawUnsafe(`DELETE FROM "product_categories" WHERE "id" = $1`, id);
  }

  // Products
  async listProducts(published = true, categoryId?: string) {
    let query = `
      SELECT p."id", p."name", p."slug", p."description", p."price", p."comparePrice",
             p."imageUrl", p."specs", p."features", p."stock", p."published", p."featured",
             p."linkedBlogIds", p."categoryId", p."createdAt",
             c."id" as "catId", c."name" as "catName", c."slug" as "catSlug"
      FROM "products" p
      LEFT JOIN "product_categories" c ON p."categoryId" = c."id"
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

    query += ` ORDER BY p."featured" DESC, p."createdAt" DESC LIMIT 100`;

    const rows = await prisma.$queryRawUnsafe(query, ...params) as { id: string; name: string; slug: string; description: string | null; price: bigint; comparePrice: bigint | null; imageUrl: string | null; specs: string | null; features: string | null; stock: bigint; published: boolean; featured: boolean; linkedBlogIds: string | null; categoryId: string | null; createdAt: Date; catId: string | null; catName: string | null; catSlug: string | null }[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      price: Number(r.price),
      comparePrice: r.comparePrice ? Number(r.comparePrice) : null,
      imageUrl: r.imageUrl,
      specs: r.specs,
      features: r.features,
      stock: Number(r.stock),
      published: r.published,
      featured: r.featured,
      linkedBlogIds: r.linkedBlogIds,
      categoryId: r.categoryId,
      createdAt: r.createdAt,
      category: r.catId ? { id: r.catId, name: r.catName!, slug: r.catSlug! } : null,
    }));
  }

  async getFeatured() {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT p."id", p."name", p."slug", p."description", p."price", p."comparePrice",
              p."imageUrl", p."stock", p."published", p."featured",
              c."id" as "catId", c."name" as "catName", c."slug" as "catSlug"
       FROM "products" p
       LEFT JOIN "product_categories" c ON p."categoryId" = c."id"
       WHERE p."featured" = true AND p."published" = true
       ORDER BY p."createdAt" DESC LIMIT 6`
    ) as { id: string; name: string; slug: string; description: string | null; price: bigint; comparePrice: bigint | null; imageUrl: string | null; stock: bigint; published: boolean; featured: boolean; catId: string | null; catName: string | null; catSlug: string | null }[];

    return rows.map((r) => ({
      id: r.id, name: r.name, slug: r.slug, description: r.description,
      price: Number(r.price), comparePrice: r.comparePrice ? Number(r.comparePrice) : null,
      imageUrl: r.imageUrl, stock: Number(r.stock), published: r.published, featured: r.featured,
      category: r.catId ? { id: r.catId, name: r.catName!, slug: r.catSlug! } : null,
    }));
  }

  async getProduct(slug: string) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT p."id", p."name", p."slug", p."description", p."price", p."comparePrice",
              p."imageUrl", p."specs", p."features", p."stock", p."published", p."featured",
              p."linkedBlogIds", p."categoryId", p."createdAt",
              c."id" as "catId", c."name" as "catName", c."slug" as "catSlug"
       FROM "products" p
       LEFT JOIN "product_categories" c ON p."categoryId" = c."id"
       WHERE p."slug" = $1`,
      slug
    ) as { id: string; name: string; slug: string; description: string | null; price: bigint; comparePrice: bigint | null; imageUrl: string | null; specs: string | null; features: string | null; stock: bigint; published: boolean; featured: boolean; linkedBlogIds: string | null; categoryId: string | null; createdAt: Date; catId: string | null; catName: string | null; catSlug: string | null }[];

    if (rows.length === 0) throw new AppError(404, "Product not found");
    const r = rows[0];

    return {
      id: r.id, name: r.name, slug: r.slug, description: r.description,
      price: Number(r.price), comparePrice: r.comparePrice ? Number(r.comparePrice) : null,
      imageUrl: r.imageUrl, specs: r.specs, features: r.features,
      stock: Number(r.stock), published: r.published, featured: r.featured,
      linkedBlogIds: r.linkedBlogIds, categoryId: r.categoryId, createdAt: r.createdAt,
      category: r.catId ? { id: r.catId, name: r.catName!, slug: r.catSlug! } : null,
    };
  }

  async createProduct(data: { name: string; description?: string; price: number; comparePrice?: number; imageUrl?: string; specs?: string; features?: string; stock?: number; published?: boolean; featured?: boolean; linkedBlogIds?: string; categoryId?: string }) {
    const id = `product-${Date.now()}`;
    const slug = slugify(data.name);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "products" ("id", "name", "slug", "description", "price", "comparePrice", "imageUrl", "specs", "features", "stock", "published", "featured", "linkedBlogIds", "categoryId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
      id, data.name, slug, data.description || null, data.price, data.comparePrice || null,
      data.imageUrl || null, data.specs || null, data.features || null,
      data.stock ?? 0, data.published ?? true, data.featured ?? false,
      data.linkedBlogIds || null, data.categoryId || null
    );
    return { id, name: data.name, slug };
  }

  async updateProduct(id: string, data: { name?: string; description?: string; price?: number; comparePrice?: number; imageUrl?: string; specs?: string; features?: string; stock?: number; published?: boolean; featured?: boolean; linkedBlogIds?: string; categoryId?: string }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`"${key}" = $${paramIdx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    fields.push(`"updatedAt" = NOW()`);
    values.push(id);

    await prisma.$executeRawUnsafe(
      `UPDATE "products" SET ${fields.join(", ")} WHERE "id" = $${paramIdx}`,
      ...values
    );
  }

  async deleteProduct(id: string) {
    await prisma.$executeRawUnsafe(`DELETE FROM "products" WHERE "id" = $1`, id);
  }
}
