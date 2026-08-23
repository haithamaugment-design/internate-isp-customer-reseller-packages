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
  specs?: string;
  features?: string;
  stock: number;
  published: boolean;
  featured: boolean;
  linkedBlogIds?: string;
  category?: { id: string; name: string; slug: string };
  createdAt: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
}

/* Sample products for fallback */
const SAMPLE_PRODUCTS: Record<string, Product> = {
  "mikrotik-hex-lite-rb750gr3": {
    id: "sp1", slug: "mikrotik-hex-lite-rb750gr3",
    name: "MikroTik hEX lite (RB750Gr3)",
    description: "The hEX lite is the smallest MikroTik device with dual-core 880MHz CPU, 256MB RAM, five Gigabit Ethernet ports and a USB port. Perfect for small offices and new resellers who want enterprise-grade features at an affordable price.\n\nWhy resellers love it:\n- Runs RouterOS v7 with full hotspot support\n- Handles up to 50 concurrent users\n- Very low power consumption\n- Compact enough to fit anywhere",
    price: 250000, comparePrice: 300000,
    imageUrl: "https://images.unsplash.com/photo-1580894742597-87bc870ddb17?w=800&q=80",
    specs: "CPU: Dual-core 880MHz MT7621A\nRAM: 256MB\nStorage: 16MB flash\nEthernet: 5x Gigabit\nUSB: 1x USB 2.0\nDimensions: 113x89x28mm",
    features: "RouterOS v7,Hotspot Portal,Simple Queue,Firewall,VPN",
    stock: 25, published: true, featured: true,
    linkedBlogIds: "blogpost-002,blogpost-004",
    category: { id: "pc1", name: "Entry-Level", slug: "entry-level" }, createdAt: "2026-08-20T10:00:00Z",
  },
  "mikrotik-hex-refresh-rb760igs": {
    id: "sp2", slug: "mikrotik-hex-refresh-rb760igs",
    name: "MikroTik hEX refresh (RB760iGS)",
    description: "Compact five-port Gigabit Ethernet router with PoE output, SFP cage, and USB port. For resellers with 50-150 customers who need PoE support and more processing power.",
    price: 450000, comparePrice: 520000,
    imageUrl: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&q=80",
    specs: "CPU: Dual-core 880MHz MT7621A\nRAM: 256MB\nEthernet: 5x Gigabit (1x PoE out)\nSFP: 1x SFP cage\nUSB: 1x USB 2.0",
    features: "RouterOS v7,Hotspot Portal,Simple Queue,Firewall,VPN,POE Output",
    stock: 18, published: true, featured: true,
    linkedBlogIds: "blogpost-001,blogpost-002",
    category: { id: "pc2", name: "Mid-Range", slug: "mid-range" }, createdAt: "2026-08-18T10:00:00Z",
  },
  "mikrotik-rb4011": {
    id: "sp3", slug: "mikrotik-rb4011",
    name: "MikroTik RB4011iGS+5HacQ2HnD-IN",
    description: "Quad-core 1.4GHz, 1GB RAM, SFP+ 10G, 10x Gigabit, built-in WiFi. The workhorse for serious resellers. Handles 200+ concurrent users with room to grow.",
    price: 1200000, comparePrice: 1400000,
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
    specs: "CPU: Quad-core 1.4GHz Cortex A15\nRAM: 1GB DDR3\nEthernet: 10x Gigabit (1x PoE in)\nSFP+: 1x 10Gbps\nWiFi: Dual-band 802.11ac",
    features: "RouterOS v7,Hotspot Portal,Simple Queue,Firewall,VPN,WiFi AP,Dual-Band",
    stock: 8, published: true, featured: true,
    linkedBlogIds: "blogpost-001,blogpost-002,blogpost-004",
    category: { id: "pc3", name: "Enterprise", slug: "enterprise" }, createdAt: "2026-08-15T10:00:00Z",
  },
  "mikrotik-rb5009": {
    id: "sp4", slug: "mikrotik-rb5009",
    name: "MikroTik RB5009UG+S+IN",
    description: "Most powerful compact router. 2.5G + 10G SFP+, quad-core ARM, 1GB RAM. Handles 500+ concurrent users. Enterprise-grade for large-scale operations.",
    price: 2500000, comparePrice: 2900000,
    imageUrl: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80",
    specs: "CPU: Quad-core 1.4GHz ARM\nRAM: 1GB DDR3\nEthernet: 7x Gigabit + 1x 2.5G\nSFP+: 1x 10Gbps\nFull metal case",
    features: "RouterOS v7,Hotspot Portal,Simple Queue,Firewall,VPN,2.5G Ethernet,10G SFP+,Enterprise",
    stock: 5, published: true, featured: false,
    linkedBlogIds: "blogpost-002",
    category: { id: "pc3", name: "Enterprise", slug: "enterprise" }, createdAt: "2026-08-12T10:00:00Z",
  },
};

const SAMPLE_BLOG_POSTS: BlogPost[] = [
  { id: "bp1", title: "How to Set Up Your First WiFi Hotspot", slug: "setup-first-wifi-hotspot-netmaster", excerpt: "A complete guide to setting up your first hotspot.", coverImage: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80" },
  { id: "bp2", title: "MikroTik RouterOS v7: Beginner Guide", slug: "mikrotik-routeros-v7-beginner-guide", excerpt: "Understand RouterOS v7 basics.", coverImage: "https://images.unsplash.com/photo-1580894742597-87bc870ddb17?w=400&q=80" },
  { id: "bp3", title: "5 Pricing Strategies That Triple Revenue", slug: "pricing-strategies-triple-reseller-revenue", excerpt: "Proven pricing strategies for resellers.", coverImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80" },
  { id: "bp4", title: "How to Secure Your WiFi Network", slug: "secure-wifi-network-resellers-guide", excerpt: "Essential security measures.", coverImage: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=80" },
];

function parseSpecs(specs?: string): Record<string, string> {
  if (!specs) return {};
  const result: Record<string, string> = {};
  specs.split("\n").forEach(line => {
    const idx = line.indexOf(":");
    if (idx > 0) result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });
  return result;
}

export default function ProductContent({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [linkedBlogs, setLinkedBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const prod = await api.get<Product>(`/products/${slug}`);
        setProduct(prod);

        if (prod.linkedBlogIds) {
          const ids = prod.linkedBlogIds.split(",").filter(Boolean);
          if (ids.length > 0) {
            const posts = await api.get<BlogPost[]>("/blog/posts?all=true").catch(() => []);
            if (Array.isArray(posts)) {
              setLinkedBlogs(posts.filter((p: BlogPost) => ids.includes(p.id)));
            }
          }
        }
      } catch {
        // Use fallback data
        const fallback = SAMPLE_PRODUCTS[slug];
        if (fallback) {
          setProduct(fallback);
          if (fallback.linkedBlogIds) {
            const ids = fallback.linkedBlogIds.split(",").filter(Boolean);
            setLinkedBlogs(SAMPLE_BLOG_POSTS.filter(p => ids.includes(p.id)));
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-12 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--surface)] rounded w-1/3" />
          <div className="grid gap-8 md:grid-cols-2">
            <div className="h-80 bg-[var(--surface)] rounded-2xl" />
            <div className="space-y-4">
              <div className="h-6 bg-[var(--surface)] rounded w-3/4" />
              <div className="h-4 bg-[var(--surface)] rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="px-4 md:px-8 py-12 max-w-5xl mx-auto text-center">
        <p className="text-[var(--text-muted)] text-lg">Product not found</p>
        <Link href="/shop" className="text-[var(--accent)] mt-4 inline-block hover:underline">← Back to Shop</Link>
      </div>
    );
  }

  const specs = parseSpecs(product.specs);
  const features = product.features ? product.features.split(",").map(f => f.trim()).filter(Boolean) : [];

  return (
    <div className="min-h-screen">
      {/* Hero with product image */}
      {product.imageUrl && (
        <div className="relative h-64 md:h-80 overflow-hidden">
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/60 to-transparent" />
        </div>
      )}

      <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto -mt-16 relative z-10">
        <Link href="/shop" className="text-[var(--accent)] text-sm font-semibold mb-6 inline-block hover:underline">← Back to Shop</Link>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Details */}
          <div>
            {product.category && (
              <Link href={`/shop?category=${product.category.slug}`} className="inline-block px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold mb-3 hover:bg-[var(--accent)]/20 transition-all">
                {product.category.name}
              </Link>
            )}
            <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text)] mb-2">{product.name}</h1>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-bold text-[var(--accent)]">{(product.price / 100).toLocaleString()} TZS</span>
              {product.comparePrice && product.comparePrice > product.price && (
                <span className="text-lg text-[var(--text-muted)] line-through">{(product.comparePrice / 100).toLocaleString()} TZS</span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-6">
              {product.stock > 0 ? (
                <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-semibold">In Stock ({product.stock} available)</span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">Out of Stock</span>
              )}
              {product.featured && (
                <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold">Featured</span>
              )}
            </div>

            {product.stock > 0 && (
              <button className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-medium hover:opacity-90 transition-all">
                Contact to Purchase
              </button>
            )}
          </div>

          {/* Description */}
          <div>
            {product.description && (
              <div className="mb-6">
                <h2 className="text-lg font-bold text-[var(--text)] mb-3">Description</h2>
                <div className="text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap">{product.description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        {features.length > 0 && (
          <div className="mt-8 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
            <h2 className="text-lg font-bold text-[var(--text)] mb-3">Features</h2>
            <div className="flex flex-wrap gap-2">
              {features.map(f => (
                <span key={f} className="px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-sm">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Specs */}
        {Object.keys(specs).length > 0 && (
          <div className="mt-8 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
            <h2 className="text-lg font-bold text-[var(--text)] mb-4">Specifications</h2>
            <div className="space-y-2">
              {Object.entries(specs).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <span className="text-sm text-[var(--text-muted)]">{key}</span>
                  <span className="text-sm font-semibold text-[var(--text)]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Blog Posts */}
        {linkedBlogs.length > 0 && (
          <div className="mt-12 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
            <h2 className="text-xl font-bold text-[var(--text)] mb-4">Related Articles</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">Learn more about this product in our blog</p>
            <div className="grid gap-4 md:grid-cols-2">
              {linkedBlogs.map((blog) => (
                <Link key={blog.id} href={`/blog/${blog.slug}`} className="flex gap-4 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] transition-all group">
                  {blog.coverImage ? (
                    <img src={blog.coverImage} alt="" className="w-20 h-20 rounded-lg object-cover bg-[var(--surface)]" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] text-xs">📖</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">{blog.title}</h3>
                    <p className="text-sm text-[var(--text-muted)] line-clamp-2 mt-1">{blog.excerpt || "Read more..."}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
