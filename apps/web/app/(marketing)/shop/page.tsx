"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  comparePrice?: number;
  imageUrl?: string;
  stock: number;
  featured: boolean;
  category?: { name: string; slug: string } | null;
}

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
}

/* Fallback product images */
const ROUTER_IMAGES: Record<string, string> = {
  "hex": "https://images.unsplash.com/photo-1580894742597-87bc870ddb17?w=600&q=80",
  "rb": "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=600&q=80",
  "default": "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&q=80",
};

function getProductImage(product: Product): string {
  if (product.imageUrl) return product.imageUrl;
  const name = product.name.toLowerCase();
  if (name.includes("hex") || name.includes("lite")) return ROUTER_IMAGES.hex;
  if (name.includes("rb")) return ROUTER_IMAGES.rb;
  return ROUTER_IMAGES.default;
}

/* Sample data when DB is empty */
const SAMPLE_CATEGORIES: ProductCategory[] = [
  { id: "pc1", name: "Entry-Level", slug: "entry-level", _count: { products: 1 } },
  { id: "pc1a", name: "Indoor Routers", slug: "indoor-routers", _count: { products: 0 } },
  { id: "pc1b", name: "Outdoor Routers", slug: "outdoor-routers", _count: { products: 0 } },
  { id: "pc2", name: "Mid-Range", slug: "mid-range", _count: { products: 1 } },
  { id: "pc2a", name: "PoE Routers", slug: "poe-routers", _count: { products: 0 } },
  { id: "pc3", name: "Enterprise", slug: "enterprise", _count: { products: 2 } },
  { id: "pc4", name: "Accessories", slug: "accessories", _count: { products: 0 } },
];

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "sp1",
    name: "MikroTik hEX lite (RB750Gr3)",
    slug: "mikrotik-hex-lite-rb750gr3",
    description: "The smallest MikroTik router with dual-core 880MHz CPU, 256MB RAM, 5x Gigabit Ethernet. Perfect for small offices.",
    price: 250000,
    comparePrice: 300000,
    imageUrl: "https://images.unsplash.com/photo-1580894742597-87bc870ddb17?w=600&q=80",
    stock: 25,
    featured: true,
    category: { name: "Entry-Level", slug: "entry-level" },
  },
  {
    id: "sp2",
    name: "MikroTik hEX refresh (RB760iGS)",
    slug: "mikrotik-hex-refresh-rb760igs",
    description: "Compact Gigabit router with PoE output, SFP cage. For resellers with 50-150 customers.",
    price: 450000,
    comparePrice: 520000,
    imageUrl: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=600&q=80",
    stock: 18,
    featured: true,
    category: { name: "Mid-Range", slug: "mid-range" },
  },
  {
    id: "sp3",
    name: "MikroTik RB4011iGS+5HacQ2HnD-IN",
    slug: "mikrotik-rb4011",
    description: "Quad-core 1.4GHz, 1GB RAM, SFP+ 10G, 10x Gigabit, built-in WiFi. Handles 200+ users.",
    price: 1200000,
    comparePrice: 1400000,
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80",
    stock: 8,
    featured: true,
    category: { name: "Enterprise", slug: "enterprise" },
  },
  {
    id: "sp4",
    name: "MikroTik RB5009UG+S+IN",
    slug: "mikrotik-rb5009",
    description: "Most powerful compact router. 2.5G + 10G SFP+, quad-core ARM, 1GB RAM. 500+ concurrent users.",
    price: 2500000,
    comparePrice: 2900000,
    imageUrl: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&q=80",
    stock: 5,
    featured: false,
    category: { name: "Enterprise", slug: "enterprise" },
  },
];

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    // Show fallback data immediately so the page always has content
    setProducts(SAMPLE_PRODUCTS);
    setCategories(SAMPLE_CATEGORIES);
    setLoading(false);

    // Try to load real data from API in the background
    async function load() {
      try {
        const [prodsData, catsData] = await Promise.all([
          api.get<Product[]>("/products").catch(() => []),
          api.get<ProductCategory[]>("/products/categories").catch(() => []),
        ]);
        const prodsList = Array.isArray(prodsData) ? prodsData : [];
        const catsList = Array.isArray(catsData) ? catsData : [];
        if (prodsList.length > 0) setProducts(prodsList);
        if (catsList.length > 0) setCategories(catsList);
      } catch {
        // Keep fallback data
      }
    }
    load();
  }, []);

  const filtered = selectedCategory
    ? products.filter(p => p.category?.slug === selectedCategory)
    : products;

  const featured = filtered.filter(p => p.featured);
  const regular = filtered.filter(p => !p.featured);

  return (
    <div className="min-h-screen">
      {/* Hero Header with networking background */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1920&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628]/92 via-[#0d1f3c]/88 to-[#0a1628]/95" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center">
          <span className="text-sm font-semibold text-[var(--accent-green)] uppercase tracking-widest">Router Store</span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mt-3 mb-4">
            Compatible <span className="bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-teal)] bg-clip-text text-transparent">Hardware</span>
          </h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            MikroTik routers pre-configured for the NetMaster platform. Plug in and start selling.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--bg-base)] to-transparent" />
      </section>

      <div className="max-w-6xl mx-auto px-4 pb-20 -mt-6 relative z-10">
        {/* Category Filters */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10 justify-center">
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                !selectedCategory
                  ? "bg-[var(--accent-blue)] text-white shadow-md shadow-[var(--accent-blue)]/20"
                  : "glass text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              All Routers
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  selectedCategory === cat.slug
                    ? "bg-[var(--accent-blue)] text-white shadow-md shadow-[var(--accent-blue)]/20"
                    : "glass text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {cat.name}
                {cat._count ? ` · ${cat._count.products}` : ""}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse glass rounded-3xl overflow-hidden">
                <div className="h-56 bg-[var(--glass-surface-subtle)]" />
                <div className="p-6 space-y-3">
                  <div className="h-3 bg-[var(--glass-surface-subtle)] rounded-full w-1/4" />
                  <div className="h-5 bg-[var(--glass-surface-subtle)] rounded-full w-3/4" />
                  <div className="h-4 bg-[var(--glass-surface-subtle)] rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-[var(--glass-surface)] mx-auto flex items-center justify-center text-4xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No products yet</h3>
            <p className="text-[var(--text-secondary)]">Check back soon — we&apos;re adding new routers!</p>
          </div>
        ) : (
          <>
            {/* Featured Products */}
            {featured.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent-orange)]/15 flex items-center justify-center text-sm">⭐</div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Featured Routers</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {featured.map((product) => (
                    <Link key={product.id} href={`/shop/${product.slug}`}>
                      <div className="glass rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300 group grid sm:grid-cols-2">
                        <div className="h-48 sm:h-auto relative overflow-hidden">
                          <img
                            src={getProductImage(product)}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[var(--glass-surface)]/20 hidden sm:block" />
                          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-[var(--accent-orange)]/90 text-white text-[10px] font-bold uppercase">Featured</span>
                        </div>
                        <div className="p-6 flex flex-col justify-center">
                          {product.category && (
                            <span className="inline-flex self-start px-2.5 py-0.5 rounded-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-xs font-bold uppercase tracking-wider mb-3">
                              {product.category.name}
                            </span>
                          )}
                          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-blue)] transition-colors">
                            {product.name}
                          </h3>
                          <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
                            {product.description?.slice(0, 80) || ""}
                          </p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-teal)] bg-clip-text text-transparent">
                              {product.price.toLocaleString()} TZS
                            </span>
                            {product.comparePrice && product.comparePrice > product.price && (
                              <span className="text-sm text-[var(--text-tertiary)] line-through">{product.comparePrice.toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* All Products Grid */}
            {regular.length > 0 && (
              <div>
                {featured.length > 0 && (
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-blue)]/15 flex items-center justify-center text-sm">🛒</div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">All Routers</h2>
                  </div>
                )}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {regular.map((product) => (
                    <Link key={product.id} href={`/shop/${product.slug}`}>
                      <article className="glass rounded-2xl overflow-hidden hover:shadow-xl hover:scale-[1.01] transition-all duration-300 group h-full flex flex-col">
                        <div className="h-48 overflow-hidden relative">
                          <img
                            src={getProductImage(product)}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                          <div className="absolute top-3 right-3 flex gap-2">
                            {product.stock > 0 ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-green)]/90 text-white text-[10px] font-bold">IN STOCK</span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-red)]/90 text-white text-[10px] font-bold">OUT OF STOCK</span>
                            )}
                          </div>
                          {product.category && (
                            <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-bold">
                              {product.category.name}
                            </span>
                          )}
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-blue)] transition-colors line-clamp-2">
                            {product.name}
                          </h3>
                          <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-4 flex-1">
                            {product.description?.slice(0, 80) || ""}
                          </p>
                          <div className="flex items-center justify-between pt-3 border-t border-[var(--hairline)]">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-extrabold bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-teal)] bg-clip-text text-transparent">
                                {product.price.toLocaleString()} TZS
                              </span>
                              {product.comparePrice && product.comparePrice > product.price && (
                                <span className="text-xs text-[var(--text-tertiary)] line-through">{product.comparePrice.toLocaleString()}</span>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-[var(--accent-blue)] opacity-0 group-hover:opacity-100 transition-opacity">
                              View →
                            </span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Bottom CTA with image */}
        <div className="mt-16">
          <div className="relative rounded-3xl overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a1628]/90 via-[#0d1f3c]/85 to-[#0a1628]/90" />
            <div className="relative z-10 p-10 text-center">
              <h3 className="text-2xl font-extrabold text-white mb-3">
                Need a custom router configuration?
              </h3>
              <p className="text-white/60 mb-6 max-w-md mx-auto">
                Contact us for bulk orders, pre-configured devices, or enterprise deployments.
              </p>
              <Link
                href="/register"
                className="inline-flex px-8 py-3 rounded-2xl bg-[var(--grad-blue)] text-white font-bold shadow-lg shadow-[var(--accent-blue)]/30 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
              >
                Get in Touch
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
