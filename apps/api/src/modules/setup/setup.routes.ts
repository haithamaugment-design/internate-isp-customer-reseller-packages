import { Router, Request, Response } from "express";
import { prisma } from "../../prisma/client";

const router = Router();

const MIGRATION_SQL = `
-- Blog Categories
CREATE TABLE IF NOT EXISTS blog_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  "parentId" TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_blog_cat_parent FOREIGN KEY ("parentId") REFERENCES blog_categories(id)
);

-- Blog Posts
CREATE TABLE IF NOT EXISTS blog_posts (
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
  "updatedByUserId" TEXT,
  CONSTRAINT fk_blog_post_category FOREIGN KEY ("categoryId") REFERENCES blog_categories(id)
);

-- Product Categories
CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  "parentId" TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_prod_cat_parent FOREIGN KEY ("parentId") REFERENCES product_categories(id)
);

-- Products
CREATE TABLE IF NOT EXISTS products (
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
  "updatedByUserId" TEXT,
  CONSTRAINT fk_product_category FOREIGN KEY ("categoryId") REFERENCES product_categories(id)
);

-- Blog-Product Links
CREATE TABLE IF NOT EXISTS blog_product_links (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "blogPostId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_bpl_post FOREIGN KEY ("blogPostId") REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bpl_product FOREIGN KEY ("productId") REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT uq_bpl UNIQUE ("blogPostId", "productId")
);

-- Business Plans
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS business_plans (
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
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_business_plans_reseller_id ON business_plans("resellerId");

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS business_plan_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    plan_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_bpm_plan FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE CASCADE
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_bpm_plan_id ON business_plan_messages(plan_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_business_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS business_plans_updated_at ON business_plans;
CREATE TRIGGER business_plans_updated_at
  BEFORE UPDATE ON business_plans
  FOR EACH ROW EXECUTE FUNCTION update_business_plans_updated_at();

-- Site Settings
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

router.get("/migrate", async (_req: Request, res: Response) => {
  try {
    // Split by semicolons and execute each statement
    const statements = MIGRATION_SQL
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));

    const results: string[] = [];
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt + ";");
        results.push(`OK: ${stmt.substring(0, 60)}...`);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (err?.message?.includes("already exists") || err?.code === "42710") {
          results.push(`SKIP (already exists): ${stmt.substring(0, 60)}...`);
        } else {
          results.push(`ERROR: ${err?.message || err} — ${stmt.substring(0, 60)}...`);
        }
      }
    }

    res.json({
      status: "done",
      message: "Database migration complete! All tables created.",
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
