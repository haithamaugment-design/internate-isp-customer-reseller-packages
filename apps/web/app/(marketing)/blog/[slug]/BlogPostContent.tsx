"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { RichContent, extractTOC, slugify } from "@/components/blog/RichContent";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  author?: string;
  tags?: string | string[];
  linkedProductIds?: string;
  published: boolean;
  category?: { id: string; name: string; slug: string };
  createdAt: string;
}

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  _count?: { posts: number };
}

interface BlogListItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  createdAt: string;
  category?: { name: string; slug: string };
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl?: string;
  description?: string;
}

/* Full sample blog posts for fallback */
const SAMPLE_POSTS: Record<string, BlogPost> = {
  "setup-first-wifi-hotspot-netmaster": {
    id: "sp1", slug: "setup-first-wifi-hotspot-netmaster",
    title: "How to Set Up Your First WiFi Hotspot with NetMaster",
    content: `## Getting Started with NetMaster\n\nSetting up your first WiFi hotspot has never been easier. In this guide, we walk you through the complete process from registering your reseller account to selling your first voucher.\n\n### Step 1: Create Your Account\n\nHead over to NetMaster and click Get Started Free. You will be up and running in less than 30 seconds.\n\n### Step 2: Create a Location\n\nEach physical office or coverage area is a Location. Navigate to Locations and click New Location. Give it a name and an address.\n\n### Step 3: Register Your Router\n\nGo to Routers and add your MikroTik device. Enter the router name and MAC address. The router must be on and reachable from the internet.\n\n### Step 4: Create a Package\n\nDefine what you sell - speed, data cap, and price. For example:\n- Basic: 5 Mbps, 5GB, 2,000 TZS/day\n- Premium: 10 Mbps, 15GB, 5,000 TZS/day\n- Unlimited: 20 Mbps, unlimited, 10,000 TZS/day\n\n### Step 5: Generate Vouchers\n\nGo to Vouchers and generate a batch. Choose the package, quantity, and expiry.\n\n### Step 6: Share the Hotspot Portal\n\nYour hotspot portal URL is /hotspot?id=LOCATION_ID. Customers open this, enter a voucher code, and they are online.\n\n## Tips for Success\n\n1. Start small - test with 5-10 vouchers before scaling\n2. Set expiry dates - vouchers that never expire create accounting headaches\n3. Monitor usage - check your dashboard daily to spot patterns\n4. Offer packages - bundled pricing converts better`,
    excerpt: "A complete step-by-step guide to setting up your first WiFi hotspot and selling vouchers in under 30 minutes.",
    coverImage: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80",
    published: true, author: "NetMaster Team", tags: "getting started,wifi hotspot,voucher",
    category: { id: "sc1", name: "Getting Started", slug: "getting-started" }, createdAt: "2026-08-20T10:00:00Z",
  },
  "mikrotik-routeros-v7-beginner-guide": {
    id: "sp2", slug: "mikrotik-routeros-v7-beginner-guide",
    title: "MikroTik RouterOS v7: The Complete Beginner Guide",
    content: `## Why MikroTik?\n\nMikroTik is the router of choice for ISP resellers across East Africa. Affordable hardware, powerful software, and a massive feature set.\n\n## What is RouterOS?\n\nRouterOS is the operating system that runs on MikroTik hardware. It controls WiFi hotspot portals, bandwidth limiting, VPN tunnels, firewall rules, and user authentication.\n\n## Key Concepts\n\n### The WinBox Interface\nWinBox is the desktop app for managing MikroTik routers.\n\n### Hotspot Setup\nThe Hotspot feature captures HTTP traffic, redirects to a login page, authenticates via voucher code, and applies bandwidth limits.\n\n### Simple Queues\nSimple Queues control bandwidth per user based on the package speed.\n\n### Firewall NAT\nNAT allows multiple customers to share one public IP address.\n\n## Common Issues\n- Customer cannot connect: Check hotspot is active\n- Speed too slow: Verify Simple Queue limits\n- Login page not showing: Check hotspot HTML directory`,
    excerpt: "Understand MikroTik RouterOS v7 from WinBox to hotspots, queues, and firewall rules.",
    coverImage: "https://images.unsplash.com/photo-1580894742597-87bc870ddb17?w=800&q=80",
    published: true, author: "NetMaster Team", tags: "mikrotik,routeros,v7,beginner",
    category: { id: "sc2", name: "MikroTik", slug: "mikrotik" }, createdAt: "2026-08-18T10:00:00Z",
  },
  "pricing-strategies-triple-reseller-revenue": {
    id: "sp3", slug: "pricing-strategies-triple-reseller-revenue",
    title: "5 Pricing Strategies That Triple Your Reseller Revenue",
    content: `## The Pricing Problem\n\nMost WiFi resellers leave money on the table. Pricing is a strategy, not an afterthought.\n\n## Strategy 1: Time-Bundled Pricing\n- 1 Day Pass: 1,500 TZS\n- 3 Day Pass: 3,500 TZS\n- 7 Day Pass: 6,500 TZS\n- 30 Day Pass: 20,000 TZS\n\n## Strategy 2: Speed Tiers\n- Basic: 5 Mbps at 2,000 TZS/day\n- Standard: 10 Mbps at 3,500 TZS/day\n- Premium: 20 Mbps at 6,000 TZS/day\n\n## Strategy 3: Off-Peak Discounts\nOffer lower prices during off-peak hours.\n\n## Strategy 4: Corporate Packages\nTarget small businesses with fixed monthly pricing.\n\n## Strategy 5: Voucher Reselling\nSell vouchers in bulk at a discount to shop owners.\n\n## Revenue Example\nWith 50 active customers, you can earn 5,100,000 TZS/month.`,
    excerpt: "Proven pricing strategies that WiFi resellers use to maximize revenue.",
    coverImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    published: true, author: "NetMaster Team", tags: "pricing,revenue,strategy,reseller",
    category: { id: "sc3", name: "Reseller Tips", slug: "reseller-tips" }, createdAt: "2026-08-15T10:00:00Z",
  },
};

const SAMPLE_PRODUCTS: Product[] = [
  { id: "sp1", name: "MikroTik hEX lite (RB750Gr3)", slug: "mikrotik-hex-lite-rb750gr3", price: 250000, imageUrl: "https://images.unsplash.com/photo-1580894742597-87bc870ddb17?w=600&q=80", description: "The smallest MikroTik router." },
  { id: "sp2", name: "MikroTik hEX refresh (RB760iGS)", slug: "mikrotik-hex-refresh-rb760igs", price: 450000, imageUrl: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=600&q=80", description: "Compact Gigabit router with PoE." },
];

export default function BlogPostContent({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [linkedProducts, setLinkedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [recentPosts, setRecentPosts] = useState<BlogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTocId, setActiveTocId] = useState<string>("");

  // Extract TOC from content
  const toc = useMemo(() => {
    if (!post?.content) return [];
    return extractTOC(post.content);
  }, [post?.content]);

  useEffect(() => {
    async function load() {
      try {
        const [postData, catsData, postsData] = await Promise.all([
          api.get<BlogPost>(`/blog/posts/${slug}`),
          api.get<{ data?: BlogCategory[] } | BlogCategory[]>("/blog/categories").catch(() => []),
          api.get<{ data?: BlogListItem[] } | BlogListItem[]>("/blog/posts").catch(() => []),
        ]);
        setPost(postData);

        // Fetch linked products
        if (postData.linkedProductIds) {
          const ids = postData.linkedProductIds.split(",").filter(Boolean);
          if (ids.length > 0) {
            const prods = await api.get<Product[]>("/products?all=true").catch(() => []);
            if (Array.isArray(prods)) setLinkedProducts(prods.filter((p) => ids.includes(p.id)));
          }
        }

        // Parse categories
        const catsList = Array.isArray(catsData) ? catsData : (catsData as any)?.data || [];
        setCategories(catsList);

        // Parse recent posts (exclude current)
        const postsList = Array.isArray(postsData) ? postsData : (postsData as any)?.data || [];
        setRecentPosts(postsList.filter((p: BlogListItem) => p.slug !== slug).slice(0, 5));
      } catch {
        // Fallback data
        const fallback = SAMPLE_POSTS[slug];
        if (fallback) {
          setPost(fallback);
          if (fallback.linkedProductIds) {
            const ids = fallback.linkedProductIds.split(",").filter(Boolean);
            setLinkedProducts(SAMPLE_PRODUCTS.filter((p) => ids.includes(p.id)));
          }
        }
        setRecentPosts(Object.values(SAMPLE_POSTS).filter((p) => p.slug !== slug).slice(0, 5));
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  // Track active TOC section on scroll
  useEffect(() => {
    if (toc.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveTocId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    for (const item of toc) {
      const el = document.getElementById(slugify(item.text));
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [toc]);

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-12 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--surface)] rounded w-1/3" />
          <div className="h-4 bg-[var(--surface)] rounded w-1/4" />
          <div className="h-64 bg-[var(--surface)] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="px-4 md:px-8 py-12 max-w-4xl mx-auto text-center">
        <p className="text-[var(--text-muted)] text-lg">Post not found</p>
        <Link href="/blog" className="text-[var(--accent)] mt-4 inline-block hover:underline">← Back to Blog</Link>
      </div>
    );
  }

  const tags = post.tags ? (Array.isArray(post.tags) ? post.tags : post.tags.split(",").map(t => t.trim())).filter(Boolean) : [];

  return (
    <div className="min-h-screen">
      {/* Hero with cover image */}
      {post.coverImage && (
        <div className="relative h-64 md:h-80 overflow-hidden">
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/60 to-transparent" />
        </div>
      )}

      <div className="px-4 md:px-8 py-8 max-w-[1400px] mx-auto -mt-16 relative z-10">
        <Link href="/blog" className="text-[var(--accent)] text-sm font-semibold mb-6 inline-block hover:underline">← Back to Blog</Link>

        {/* 3-column layout */}
        <div className="flex gap-8">
          {/* ═══ LEFT SIDEBAR — Table of Contents ═══ */}
          {toc.length > 0 && (
            <aside className="hidden xl:block w-64 flex-shrink-0">
              <div className="sticky top-24">
                <nav className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span>📑</span> On This Page
                  </h3>
                  <ul className="space-y-1">
                    {toc.map((item, i) => {
                      const id = slugify(item.text);
                      const isActive = activeTocId === id;
                      return (
                        <li key={i} style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
                          <a
                            href={`#${id}`}
                            className={`block text-[13px] py-1 rounded-md transition-all ${
                              isActive
                                ? "text-[var(--accent)] font-semibold bg-[var(--accent)]/5"
                                : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]"
                            }`}
                          >
                            {item.text}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                {/* Tags under TOC */}
                {tags.length > 0 && (
                  <div className="mt-4 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                    <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[11px] text-[var(--text-muted)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* ═══ CENTER — Article Content ═══ */}
          <main className="flex-1 min-w-0 max-w-3xl">
            {post.category && (
              <Link href={`/blog?category=${post.category.slug}`} className="inline-block px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold mb-3 hover:bg-[var(--accent)]/20 transition-all">
                {post.category.name}
              </Link>
            )}

            <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--text)] mb-3">{post.title}</h1>
            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] mb-6">
              {post.author && <span>By {post.author}</span>}
              <span>·</span>
              <span>{new Date(post.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
            </div>

            {post.excerpt && (
              <p className="text-lg text-[var(--text-muted)] mb-6 font-medium italic border-l-4 border-[var(--accent)] pl-4">{post.excerpt}</p>
            )}

            {/* Mobile TOC (shown below xl) */}
            {toc.length > 0 && (
              <nav className="xl:hidden mb-8 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                <h3 className="text-sm font-bold text-[var(--text)] mb-3 flex items-center gap-2">
                  <span>📑</span> Table of Contents
                </h3>
                <ul className="space-y-1.5">
                  {toc.map((item, i) => (
                    <li key={i} style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
                      <a href={`#${slugify(item.text)}`} className="text-sm text-[var(--accent)] hover:underline transition-colors">
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <article className="max-w-none mb-12">
              <RichContent content={post.content} showToc={false} />
            </article>

            {/* Linked Products */}
            {linkedProducts.length > 0 && (
              <div className="mt-12 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
                <h2 className="text-xl font-bold text-[var(--text)] mb-4">Related Products</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {linkedProducts.map((product) => (
                    <Link key={product.id} href={`/shop/${product.slug}`} className="flex gap-4 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] transition-all group">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-20 h-20 rounded-lg object-cover bg-[var(--surface)]" />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] text-xs">No img</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">{product.name}</h3>
                        <p className="text-sm text-[var(--text-muted)] line-clamp-2 mt-1">{product.description?.slice(0, 80)}</p>
                        <p className="text-sm font-bold text-[var(--accent)] mt-1">{product.price.toLocaleString()} TZS</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </main>

          {/* ═══ RIGHT SIDEBAR — Categories & Recent Posts ═══ */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              {/* Categories */}
              {categories.length > 0 && (
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">📂 Categories</h3>
                  <ul className="space-y-1">
                    {categories.map((cat) => (
                      <li key={cat.id}>
                        <Link
                          href={`/blog?category=${cat.slug}`}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                            post.category?.slug === cat.slug
                              ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold"
                              : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
                          }`}
                        >
                          <span>{cat.name}</span>
                          {cat._count && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--bg)] text-[var(--text-muted)]">
                              {cat._count.posts}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recent Posts */}
              {recentPosts.length > 0 && (
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">📰 Recent Posts</h3>
                  <div className="space-y-3">
                    {recentPosts.map((rp) => (
                      <Link key={rp.id} href={`/blog/${rp.slug}`} className="block group">
                        <div className="flex gap-3">
                          {rp.coverImage ? (
                            <img src={rp.coverImage} alt={rp.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] text-xs flex-shrink-0">📝</div>
                          )}
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors line-clamp-2 leading-tight">
                              {rp.title}
                            </h4>
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">
                              {new Date(rp.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              {rp.category && <> · {rp.category.name}</>}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 border border-[var(--accent)]/20">
                <h3 className="text-sm font-bold text-[var(--text)] mb-2">Start Your WiFi Business</h3>
                <p className="text-xs text-[var(--text-muted)] mb-3">Join hundreds of resellers using NetMaster to manage their WiFi hotspot business.</p>
                <Link href="/auth?returnTo=/reseller/dashboard" className="block text-center px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all">
                  Get Started Free
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
