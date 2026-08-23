import { Router, Request, Response } from "express";
import { prisma } from "../../prisma/client";

const router = Router();

const STATEMENTS = [
  // Blog Categories
  `CREATE TABLE IF NOT EXISTS blog_categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    "parentId" TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // Blog Posts
  `CREATE TABLE IF NOT EXISTS blog_posts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    "featuredImage" TEXT,
    "categoryId" TEXT,
    "authorId" TEXT,
    published BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)`,

  // Product Categories
  `CREATE TABLE IF NOT EXISTS product_categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    "parentId" TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // Products
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    "shortDescription" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'TZS',
    images TEXT[] DEFAULT '{}',
    "categoryId" TEXT,
    specs JSONB,
    stock INTEGER NOT NULL DEFAULT 0,
    featured BOOLEAN NOT NULL DEFAULT false,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)`,

  // Blog-Product Links
  `CREATE TABLE IF NOT EXISTS blog_product_links (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "blogPostId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // Business Plans
  `CREATE TABLE IF NOT EXISTS business_plans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "resellerId" TEXT NOT NULL,
    name TEXT NOT NULL,
    "monthlyProfitTarget" INTEGER NOT NULL DEFAULT 0,
    "monthlyRevenueTarget" INTEGER NOT NULL DEFAULT 0,
    "totalCosts" INTEGER NOT NULL DEFAULT 0,
    costs JSONB NOT NULL DEFAULT '{}'::JSONB,
    "locationPlans" JSONB NOT NULL DEFAULT '[]'::JSONB,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ
  )`,

  `CREATE INDEX IF NOT EXISTS idx_business_plans_reseller_id ON business_plans("resellerId")`,

  // Business Plan Messages
  `CREATE TABLE IF NOT EXISTS business_plan_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    plan_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_bpm_plan_id ON business_plan_messages(plan_id)`,

  // Site Settings
  `CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

router.get("/migrate", async (_req: Request, res: Response) => {
  const results: string[] = [];
  for (const stmt of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      results.push(`✅ ${stmt.substring(0, 80).replace(/\n/g, " ")}...`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("already exists") || msg.includes("duplicate") || err?.code === "42710") {
        results.push(`⏭️ ${stmt.substring(0, 80).replace(/\n/g, " ")}... (exists)`);
      } else {
        results.push(`❌ ${msg} — ${stmt.substring(0, 80).replace(/\n/g, " ")}...`);
      }
    }
  }
  res.json({ status: "done", results });
});

export default router;
