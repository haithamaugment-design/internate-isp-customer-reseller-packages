import { prisma } from "../../prisma/client";

export interface ScheduledPost {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: Date | null;
  suggestedPublishTime: Date;
  category: string;
  estimatedTraffic: "high" | "medium" | "low";
}

export interface ContentCalendar {
  upcoming: ScheduledPost[];
  recentlyPublished: ScheduledPost[];
  topicSuggestions: Array<{
    topic: string;
    category: string;
    estimatedTraffic: "high" | "medium" | "low";
    reason: string;
  }>;
  stats: {
    totalPosts: number;
    publishedPosts: number;
    draftPosts: number;
    avgPublishFrequency: string;
  };
  seoSuggestions: Array<{
    postId: string;
    currentTitle: string;
    suggestedTitle: string;
    reason: string;
  }>;
}

// ISP/Router-related topic suggestions based on what drives traffic
const TOPIC_SUGGESTIONS = [
  { topic: "How to Set Up MikroTik hEX Lite for WiFi Hotspot", category: "Router Guides", estimatedTraffic: "high" as const, reason: "MikroTik is the most popular router for ISP resellers in Tanzania" },
  { topic: "OpenWrt Installation Guide for TP-Link Archer C1200", category: "Router Guides", estimatedTraffic: "high" as const, reason: "TP-Link is affordable and widely available, OpenWrt guide is highly searched" },
  { topic: "How to Configure CoovaChili on OpenWrt for Hotspot Management", category: "Hotspot Setup", estimatedTraffic: "high" as const, reason: "CoovaChili is the standard captive portal for WiFi hotspots" },
  { topic: "MikroTik vs OpenWrt: Which is Better for ISP Reselling?", category: "Router Comparison", estimatedTraffic: "medium" as const, reason: "Comparison content attracts decision-makers researching their options" },
  { topic: "How to Set Up User Manager on MikroTik for Voucher System", category: "Hotspot Setup", estimatedTraffic: "high" as const, reason: "User Manager is MikroTik's built-in RADIUS for hotspot auth" },
  { topic: "Best Fiber ISPs for Resellers in Tanzania (2026 Comparison)", category: "ISP Business", estimatedTraffic: "high" as const, reason: "ISP comparison content has high search volume in Tanzania" },
  { topic: "How to Price WiFi Vouchers for Maximum Profit in Tanzania", category: "Business Tips", estimatedTraffic: "medium" as const, reason: "Pricing strategy is a top concern for new resellers" },
  { topic: "Setting Up a WiFi Hotspot Business in Dar es Salaam: Step by Step", category: "Business Guide", estimatedTraffic: "high" as const, reason: "Location-specific guides attract local entrepreneurs" },
  { topic: "How to Monitor Bandwidth Usage on MikroTik Router", category: "Router Guides", estimatedTraffic: "medium" as const, reason: "Bandwidth monitoring is essential for managing hotspots" },
  { topic: "TP-Link vs MikroTik for Budget WiFi Hotspot Setup", category: "Router Comparison", estimatedTraffic: "medium" as const, reason: "Budget routers are popular among new resellers" },
  { topic: "How to Set Up Multiple SSIDs on MikroTik for Different Speed Tiers", category: "Advanced Setup", estimatedTraffic: "medium" as const, reason: "Multi-tier pricing is how resellers maximize revenue" },
  { topic: "Captive Portal Design Best Practices for ISP Hotspots", category: "Hotspot Setup", estimatedTraffic: "medium" as const, reason: "Portal design affects customer conversion rates" },
  { topic: "How to Use NetMaster to Manage Your ISP Reseller Business", category: "Platform Guide", estimatedTraffic: "high" as const, reason: "Platform-specific content drives user acquisition" },
  { topic: "Common MikroTik Router Problems and How to Fix Them", category: "Troubleshooting", estimatedTraffic: "high" as const, reason: "Troubleshooting content has consistent search traffic" },
  { topic: "How to Scale Your WiFi Reseller Business from 1 to 50 Customers", category: "Business Tips", estimatedTraffic: "medium" as const, reason: "Growth guides attract ambitious resellers" },
];

export class ContentSchedulerService {
  async getContentCalendar(): Promise<ContentCalendar> {
    const now = new Date();

    // Get all blog posts
    const posts = await prisma.blogPost.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    // Get categories
    const categories = await prisma.blogCategory.findMany();

    const published = posts.filter((p) => p.published);
    const drafts = posts.filter((p) => !p.published);

    // Calculate average publish frequency
    let avgFrequency = "No posts yet";
    if (published.length >= 2) {
      const sorted = [...published].sort(
        (a, b) => (a.publishedAt?.getTime() || 0) - (b.publishedAt?.getTime() || 0)
      );
      const totalDays =
        (sorted[sorted.length - 1].publishedAt!.getTime() - sorted[0].publishedAt!.getTime()) /
        (1000 * 60 * 60 * 24);
      const avgDaysBetween = totalDays / (sorted.length - 1);
      avgFrequency = avgDaysBetween <= 1 ? "Daily" : avgDaysBetween <= 7 ? "Weekly" : avgDaysBetween <= 14 ? "Bi-weekly" : "Monthly";
    }

    // Suggest publish times (best times for Tanzanian audience: 8-10 AM, 6-8 PM)
    const upcoming = drafts.slice(0, 5).map((post, i) => {
      const suggestedDate = new Date(now);
      suggestedDate.setDate(suggestedDate.getDate() + i + 1);
      suggestedDate.setHours(i % 2 === 0 ? 9 : 18, 0, 0, 0); // Alternate morning/evening

      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        status: "draft",
        publishedAt: null,
        suggestedPublishTime: suggestedDate,
        category: post.category?.name || "Uncategorized",
        estimatedTraffic: this.estimateTraffic(post.title),
      };
    });

    const recentlyPublished = published.slice(0, 5).map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: "published",
      publishedAt: post.publishedAt,
      suggestedPublishTime: post.publishedAt!,
      category: post.category?.name || "Uncategorized",
      estimatedTraffic: this.estimateTraffic(post.title),
    }));

    // SEO suggestions for existing posts
    const seoSuggestions = posts.slice(0, 10).map((post) => ({
      postId: post.id,
      currentTitle: post.title,
      suggestedTitle: this.optimizeTitle(post.title),
      reason: this.getSeoReason(post.title),
    }));

    // Filter topic suggestions based on existing content
    const existingTitles = posts.map((p) => p.title.toLowerCase());
    const topicSuggestions = TOPIC_SUGGESTIONS.filter(
      (s) => !existingTitles.some((t) => t.includes(s.topic.toLowerCase().slice(0, 20)))
    ).slice(0, 8);

    return {
      upcoming,
      recentlyPublished,
      topicSuggestions,
      stats: {
        totalPosts: posts.length,
        publishedPosts: published.length,
        draftPosts: drafts.length,
        avgPublishFrequency: avgFrequency,
      },
      seoSuggestions,
    };
  }

  private estimateTraffic(title: string): "high" | "medium" | "low" {
    const lower = title.toLowerCase();
    if (lower.includes("how to") || lower.includes("guide") || lower.includes("comparison") || lower.includes("best")) return "high";
    if (lower.includes("setup") || lower.includes("configure") || lower.includes("fix")) return "medium";
    return "low";
  }

  private optimizeTitle(title: string): string {
    // Add SEO-friendly prefix/suffix
    if (title.toLowerCase().includes("how to")) return title;
    if (title.toLowerCase().includes("guide")) return title;
    // Suggest adding year and location
    const hasYear = /\d{4}/.test(title);
    if (!hasYear) return `${title} (2026 Guide)`;
    return title;
  }

  private getSeoReason(title: string): string {
    const lower = title.toLowerCase();
    if (!lower.includes("how to") && !lower.includes("guide")) return "Add 'How to' or 'Guide' for better search visibility";
    if (!/\d{4}/.test(title)) return "Add the current year (2026) to appear more relevant in search results";
    if (title.length < 30) return "Title is too short — aim for 50-60 characters for optimal SEO";
    if (title.length > 70) return "Title is too long — keep under 60 characters to avoid truncation in search results";
    return "Title looks good — consider adding a location (e.g., 'Tanzania' or 'Dar es Salaam') for local SEO";
  }
}
