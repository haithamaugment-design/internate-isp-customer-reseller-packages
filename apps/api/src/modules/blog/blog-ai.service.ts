/**
 * AI Blog Generator — creates rich educational content about
 * routers, OpenWRT, MikroTik, and platform setup guides.
 *
 * Content is formatted as structured Markdown with:
 * - Table of contents
 * - Headers (H1-H4)
 * - Code blocks with syntax highlighting
 * - Step-by-step numbered instructions
 * - Resource links with descriptions
 * - Callout boxes (info, warning, tip)
 * - Tables for comparisons
 */

import { prisma } from "../../prisma/client";
import { bedrockChat, isBedrockConfigured } from "../business-ai/bedrock-llm";

// ═══════════════════════════════════════════════════════════════
// BLOG CATEGORIES — auto-created on first generation
// ═══════════════════════════════════════════════════════════════

export const BLOG_CATEGORIES = [
  { name: "Router Guides", slug: "router-guides", description: "Complete guides for setting up and configuring routers" },
  { name: "MikroTik", slug: "mikrotik", description: "MikroTik RouterOS setup, configuration, and troubleshooting" },
  { name: "OpenWRT", slug: "openwrt", description: "OpenWRT firmware flashing, configuration, and CoovaChilli setup" },
  { name: "Platform Setup", slug: "platform-setup", description: "How to connect your router to the NetMaster platform" },
  { name: "Reseller Tips", slug: "reseller-tips", description: "Business tips and strategies for WiFi resellers" },
  { name: "Network Security", slug: "network-security", description: "Security best practices for WiFi networks" },
  { name: "Getting Started", slug: "getting-started", description: "Beginner guides for new resellers" },
  { name: "Hardware Reviews", slug: "hardware-reviews", description: "Reviews and comparisons of router hardware" },
];

// ═══════════════════════════════════════════════════════════════
// ROUTER KNOWLEDGE BASE — used by AI for accurate content
// ═══════════════════════════════════════════════════════════════

const ROUTER_KNOWLEDGE = `
# Supported Routers

## MikroTik (Native Support)
- **hAP lite (RB750r2)**: Budget entry-level, 5 ports, 2.4GHz WiFi
- **hEX lite (RB750Gr3)**: Gigabit, no WiFi, great for backbone
- **hAP ax lite**: WiFi 6, budget-friendly, great for hotspots
- **hAP ax2**: WiFi 6, dual-band, 2.4GHz + 5GHz
- **hEX S (RB760iGS)**: Gigabit + SFP, PoE out
- **RB4011iGS+**: Quad-core, 10x Gigabit, WiFi optional
- **RB5009UG+S+IN**: Most powerful compact, SFP+, 2.5G
- ** Audience**: High-end WiFi 6, tri-band
- **hAP ac³**: Popular dual-band, 802.11ac

## OpenWRT-Compatible (Flash Required)
- **TP-Link Archer C7 (v2-v5)**: Very popular, 802.11ac, dual-band
- **TP-Link Archer C6 (v2-v4)**: Budget AC1200, great for OpenWRT
- **TP-Link WR841N (v9-v14)**: Ultra budget, 2.4GHz only
- **TP-Link WR941ND (v2-v6)**: Budget dual-antenna
- **GL.iNet GL-AR750S (Slate)**: Travel router, OpenWRT pre-installed
- **GL.iNet GL-MT300N (V2)**: Ultra compact travel router
- **ZBT WE826**: Popular OpenWRT platform
- **Xiaomi Mi Router 3G**: Budget, requires serial flashing
- **Netgear WNR2200**: Good OpenWRT support
- **Huawei WS5200**: Budget, OpenWRT support varies by version

## Routers That Do NOT Work
- Most ISP-provided routers (locked firmware)
- Apple AirPort (discontinued, no OpenWRT)
- Google Nest WiFi (closed ecosystem)
- Most mesh systems (proprietary protocols)
- Cheap unbranded routers (no community support)

## CoovaChilli (Captive Portal)
- CoovaChilli is a captive portal daemon for OpenWRT
- Provides voucher-based WiFi authentication
- Works with RADIUS servers for centralized auth
- Install via: \`opkg update && opkg install coovachilli\`
- Configuration: \`/etc/config/chilli\`
- Key settings:
  - \`HS_UAMSERVER\` — authentication server URL
  - \`HS_UAMPORT\` — authentication port
  - \`HS_UAMALLOW\` — allowed URLs before auth
  - \`HS_RADIUSSECRET\` — RADIUS shared secret

## NetMaster Platform Integration
- **MikroTik**: Direct API connection via RouterOS API
  - Enable API: \`/ip service set api address=0.0.0.0/0 port=8728\`
  - Create API user: \`/tool user add name=netmaster password=<secure> group=full\`
  - NetMaster connects via TCP to port 8728
- **OpenWRT + CoovaChilli**: RADIUS-based authentication
  - Configure CoovaChilli to use NetMaster RADIUS
  - NetMaster manages voucher codes and time limits
  - Portal redirect: \`/etc/config/chilli\` → \`HS_UAMSERVER=your-netmaster-domain\`
- **OpenWRT + NOGHotspot**: Alternative captive portal
  - Similar to CoovaChilli but lighter
  - Good for low-spec routers

## Firmware Resources
- **OpenWRT**: https://openwrt.org/toh/start
- **OpenWRT Firmware Selector**: https://firmware-selector.openwrt.org/
- **MikroTik Downloads**: https://mikrotik.com/download
- **CoovaChilli GitHub**: https://github.com/coova/coova-chilli
- **OpenWRT CoovaChilli Wiki**: https://openwrt.org/docs/guide-user/services/captive-portals/coova-chilli
`;

// ═══════════════════════════════════════════════════════════════
// CONTENT FORMAT INSTRUCTIONS — tells AI how to structure output
// ═══════════════════════════════════════════════════════════════

const FORMAT_INSTRUCTIONS = `
# OUTPUT FORMAT RULES — CRITICAL

You MUST format your content as structured Markdown that will render beautifully.
Every article MUST include these elements:

## 1. Table of Contents
Start the article with a table of contents:
\`\`\`
## Table of Contents
1. [Section Title](#section-slug)
2. [Section Title](#section-slug)
   - [Subsection](#subsection-slug)
\`\`\`

## 2. Headers
Use proper header hierarchy:
- \`#\` — Article title (only once)
- \`##\` — Main sections (Table of Contents links here)
- \`###\` — Subsections
- \`####\` — Sub-subsections

## 3. Code Blocks
Always use fenced code blocks with language hints:
\`\`\`
\`\`\`bash
opkg update && opkg install coovachilli
\`\`\`
\`\`\`
\`\`\`bash
/interface print
\`\`\`
\`\`\`
\`\`\`text
HS_UAMSERVER=your-server.com
HS_UAMPORT=3990
\`\`\`
\`\`\`

## 4. Step-by-Step Instructions
Use numbered lists for procedures:
\`\`\`
1. **Step Title**
   Description of what to do.

   \`\`\`bash
   command here
   \`\`\`

   > 💡 **Tip:** Helpful note here.

2. **Next Step**
   Continue with next instruction.
\`\`\`

## 5. Callout Boxes
Use blockquotes with emoji prefixes:
- \`> 💡 **Tip:**\` — Tips and tricks
- \`> ⚠️ **Warning:**\` — Warnings and cautions
- \`> ℹ️ **Note:**\` — Informational notes
- \`> 🚀 **Pro Tip:**\` — Advanced tips

## 6. Tables
Use Markdown tables for comparisons:
\`\`\`
| Feature | MikroTik hAP ax lite | TP-Link Archer C6 |
|---------|---------------------|-------------------|
| WiFi | 802.11ax (WiFi 6) | 802.11ac (WiFi 5) |
| Price | ~350,000 TZS | ~80,000 TZS |
| OpenWRT | No (RouterOS) | Yes |
\`\`\`

## 7. Resource Links
Always include clickable links with descriptions:
\`\`\`
- [OpenWRT Firmware Selector](https://firmware-selector.openwrt.org/) — Official firmware download tool
- [MikroTik Downloads](https://mikrotik.com/download) — Latest RouterOS versions
\`\`\`

## 8. Visual Separators
Use \`---\` between major sections for visual clarity.

## 9. Key Takeaways
End each article with a summary:
\`\`\`
## Key Takeaways
- ✅ Point 1
- ✅ Point 2
- ✅ Point 3
\`\`\`

## 10. Language
- Write in English with Swahili translations for key terms where helpful
- Be beginner-friendly but include advanced sections
- Use bold for important terms on first mention
- Keep paragraphs short (3-4 sentences max)
`;

// ═══════════════════════════════════════════════════════════════
// BLOG AI SERVICE
// ═══════════════════════════════════════════════════════════════

export class BlogAIService {
  /**
   * Ensure all blog categories exist
   */
  async ensureCategories(): Promise<Record<string, string>> {
    const categoryMap: Record<string, string> = {};

    for (const cat of BLOG_CATEGORIES) {
      const existing = await prisma.blogCategory.findFirst({ where: { slug: cat.slug } });
      if (existing) {
        categoryMap[cat.slug] = existing.id;
      } else {
        const created = await prisma.blogCategory.create({
          data: { name: cat.name, slug: cat.slug, description: cat.description },
        });
        categoryMap[cat.slug] = created.id;
      }
    }

    return categoryMap;
  }

  /**
   * Create a dynamic category from AI suggestion
   * Returns the category ID (creates if new, returns existing if duplicate)
   */
  async createDynamicCategory(name: string, description: string, parentId?: string): Promise<string> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Check if category already exists (by slug)
    const existing = await prisma.blogCategory.findFirst({ where: { slug } });
    if (existing) return existing.id;

    // Find parent if specified
    let resolvedParentId = parentId || null;
    if (parentId) {
      const parent = await prisma.blogCategory.findFirst({ where: { slug: parentId } });
      if (parent) resolvedParentId = parent.id;
    }

    const created = await prisma.blogCategory.create({
      data: { name, slug, description, parentId: resolvedParentId },
    });
    return created.id;
  }

  /**
   * Find the best matching category from existing ones
   */
  private async findBestCategory(topic: string, tags: string[]): Promise<string> {
    const allCategories = await prisma.blogCategory.findMany();
    const topicLower = topic.toLowerCase();
    const allTags = tags.map((t) => t.toLowerCase());

    // Score each category by name/slug match
    let bestId = "";
    let bestScore = 0;

    for (const cat of allCategories) {
      let score = 0;
      const catWords = cat.name.toLowerCase().split(/\s+/);
      const slugWords = cat.slug.split("-");

      // Exact name match
      if (topicLower.includes(cat.name.toLowerCase())) score += 10;

      // Slug word matches
      for (const word of slugWords) {
        if (word.length > 2 && topicLower.includes(word)) score += 3;
        for (const tag of allTags) {
          if (tag.includes(word) || word.includes(tag)) score += 2;
        }
      }

      // Name word matches
      for (const word of catWords) {
        if (word.length > 2 && topicLower.includes(word)) score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestId = cat.id;
      }
    }

    // Fallback to router-guides if no match
    if (!bestId || bestScore === 0) {
      const fallback = allCategories.find((c) => c.slug === "router-guides");
      bestId = fallback?.id || allCategories[0]?.id || "";
    }

    return bestId;
  }

  /**
   * Generate a blog post using AI
   */
  async generatePost(input: {
    topic: string;
    category?: string;
    routerModel?: string;
    difficulty?: "beginner" | "intermediate" | "advanced";
    length?: "short" | "medium" | "long";
  }) {
    if (!isBedrockConfigured()) {
      throw new Error("AI not configured — AWS Bedrock credentials missing");
    }

    const categories = await this.ensureCategories();
    const targetCategory = input.category || this.inferCategory(input.topic);

    const lengthMap = { short: "800-1200 words", medium: "1500-2500 words", long: "3000-5000 words" };
    const difficultyMap = {
      beginner: "absolute beginner, no prior experience assumed",
      intermediate: "some networking knowledge, familiar with basic concepts",
      advanced: "experienced user, include advanced configurations",
    };

    const systemPrompt = `You are a senior technical writer for NetMaster, an ISP reseller management platform in Tanzania. You write comprehensive, educational blog posts about routers, networking, OpenWRT, MikroTik, and WiFi reseller business topics.

# YOUR RULES
- You are a BLOG WRITER, not a business planner. Never refuse to write a blog post.
- Always write the complete article as requested. Never redirect to business planning.
- Write in English with Swahili translations for key business terms where helpful.
- Include real commands, real URLs, real pricing in TZS where applicable.
- Be beginner-friendly but include advanced sections.
- Keep paragraphs short (3-4 sentences max).

# ROUTER KNOWLEDGE BASE
${ROUTER_KNOWLEDGE}

# FORMAT INSTRUCTIONS
${FORMAT_INSTRUCTIONS}

## CATEGORY SUGGESTIONS RULES:
- Suggest 1-3 categories that best describe this article
- The FIRST category in the array (isPrimary: true) is the main category
- You may create NEW categories if the existing ones don't fit well
- For router-specific articles, create a category like "TP-Link Guides", "GL.iNet Guides", etc.
- For feature-specific articles, create categories like "CoovaChilli", "Hotspot Setup", "RADIUS Auth"
- For business articles, create categories like "Pricing Strategies", "Customer Management"
- Use existing categories (Router Guides, MikroTik, OpenWRT, Platform Setup, Reseller Tips, Network Security, Getting Started, Hardware Reviews) when they fit
- Only create new categories when the article clearly doesn't fit any existing one
- Parent categories: use "openwrt" as parentId for CoovaChilli/OpenWRT subtopics, "mikrotik" for RouterOS subtopics

You MUST return ONLY a JSON object with these fields:
{
  "title": "SEO-friendly title (50-70 chars)",
  "slug": "url-friendly-slug",
  "excerpt": "2-3 sentence summary for preview cards",
  "content": "FULL article content in formatted Markdown",
  "tags": ["tag1", "tag2", "tag3"],
  "coverImageDescription": "description for finding a cover image",
  "toc": ["Section 1", "Section 2", "Section 3"],
  "suggestedCategories": [
    {
      "name": "Category Name",
      "description": "What this category covers",
      "isPrimary": true,
      "parentId": null
    }
  ]
}

The "content" field MUST contain the FULL article with all formatting. Do NOT truncate or abbreviate.`;

    const userPrompt = `Write a blog post about: ${input.topic}

# Requirements
- Difficulty level: ${difficultyMap[input.difficulty || "intermediate"]}
- Article length: ${lengthMap[input.length || "medium"]}
${input.routerModel ? `- Focus router: ${input.routerModel}` : ""}
- Audience: WiFi resellers and internet entrepreneurs in Tanzania
- Return ONLY the JSON object, no other text.`;

    const tokenMap = { short: 4096, medium: 8192, long: 8192 };

    const response = await bedrockChat([{ role: "user", content: userPrompt }], {
      maxTokens: tokenMap[input.length || "medium"],
      temperature: 0.4,
      keepJson: true,
      systemPrompt,
    });
    const text = response.rawText;

    // Parse AI response — robust JSON extraction
    let article: Record<string, any> = {
      title: input.topic,
      slug: input.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      excerpt: text.substring(0, 200) + "...",
      content: text,
      tags: ["router", "guide", "netmaster"],
      coverImageDescription: input.topic,
      toc: [],
      suggestedCategories: [],
    };

    try {
      // Step 1: Try to extract from markdown code block first (```json ... ```)
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          const parsed = JSON.parse(codeBlockMatch[1].trim());
          article = { ...article, ...parsed };
        } catch { /* not valid JSON, try other methods */ }
      }

      // Step 2: If no code block found, try balanced brace matching
      if (!article.content || article.content === text) {
        // Find all complete JSON objects by tracking brace depth
        const jsonObjects: any[] = [];
        let depth = 0;
        let start = -1;
        for (let i = 0; i < text.length; i++) {
          if (text[i] === "{") {
            if (depth === 0) start = i;
            depth++;
          } else if (text[i] === "}") {
            depth--;
            if (depth === 0 && start !== -1) {
              try {
                const obj = JSON.parse(text.substring(start, i + 1));
                jsonObjects.push(obj);
              } catch { /* skip invalid */ }
              start = -1;
            }
          }
        }

        // Use the last JSON object that has 'content' or 'title' fields (the article)
        for (let i = jsonObjects.length - 1; i >= 0; i--) {
          if (jsonObjects[i].content || jsonObjects[i].title) {
            article = { ...article, ...jsonObjects[i] };
            break;
          }
        }
      }
    } catch {
      // Keep the fallback article from above
    }

    // Ensure suggestedCategories is always an array
    if (!Array.isArray(article.suggestedCategories)) {
      article.suggestedCategories = [];
    }

    // Process AI-suggested categories
    const suggestedCategories = article.suggestedCategories || [];
    const dynamicCategoryIds: string[] = [];

    for (const suggested of suggestedCategories) {
      try {
        const catId = await this.createDynamicCategory(
          suggested.name,
          suggested.description || `${suggested.name} articles`,
          suggested.parentId || undefined
        );
        dynamicCategoryIds.push(catId);
      } catch (err) {
        console.error("Failed to create dynamic category:", suggested.name, err);
      }
    }

    // Determine best category: user-specified > AI primary > keyword inference
    let finalCategoryId: string;
    if (input.category && categories[input.category]) {
      finalCategoryId = categories[input.category];
    } else if (dynamicCategoryIds.length > 0) {
      finalCategoryId = dynamicCategoryIds[0]; // Primary suggested category
    } else {
      finalCategoryId = categories[targetCategory] || categories["router-guides"];
    }

    return {
      ...article,
      categoryId: finalCategoryId,
      dynamicCategoryIds,
      suggestedCategories,
      categoryName: input.category || targetCategory,
    };
  }

  /**
   * Generate a post and save it to the database
   */
  async generateAndSave(input: {
    topic: string;
    category?: string;
    routerModel?: string;
    difficulty?: "beginner" | "intermediate" | "advanced";
    length?: "short" | "medium" | "long";
    published?: boolean;
  }) {
    const article = await this.generatePost(input) as any;

    const post = await prisma.blogPost.create({
      data: {
        title: article.title,
        slug: article.slug,
        content: article.content,
        excerpt: article.excerpt || null,
        featuredImage: null,
        categoryId: article.categoryId || null,
        published: input.published ?? false,
        tags: article.tags || [],
      },
    });

    // Fetch created categories for response
    const createdCategories = [];
    for (const catId of (article.dynamicCategoryIds || [])) {
      const cat = await prisma.blogCategory.findUnique({ where: { id: catId } });
      if (cat) createdCategories.push(cat);
    }

    return {
      post,
      article,
      categories: {
        assigned: article.categoryId,
        suggested: article.suggestedCategories || [],
        created: createdCategories,
      },
    };
  }

  /**
   * Generate multiple posts for a router model
   */
  async generateRouterSeries(routerModel: string) {
    const topics = [
      `${routerModel} Complete Setup Guide for NetMaster Platform`,
      `${routerModel} OpenWRT Firmware Flashing Step-by-Step`,
      `${routerModel} CoovaChilli Captive Portal Configuration`,
      `${routerModel} Network Security Hardening Guide`,
      `${routerModel} Performance Optimization Tips`,
    ];

    const results = [];
    for (const topic of topics) {
      try {
        const result = await this.generateAndSave({
          topic,
          routerModel,
          difficulty: "intermediate",
          length: "long",
          published: false,
        });
        results.push(result);
      } catch (err) {
        results.push({ error: (err as Error).message, topic });
      }
    }

    return results;
  }

  /**
   * Infer blog category from topic text
   */
  private inferCategory(topic: string): string {
    const lower = topic.toLowerCase();
    if (lower.includes("openwrt") || lower.includes("open-wrt") || lower.includes("coovachilli")) return "openwrt";
    if (lower.includes("mikrotik") || lower.includes("routeros")) return "mikrotik";
    if (lower.includes("security") || lower.includes("firewall")) return "network-security";
    if (lower.includes("setup") || lower.includes("connect") || lower.includes("platform")) return "platform-setup";
    if (lower.includes("reseller") || lower.includes("business") || lower.includes("pricing")) return "reseller-tips";
    if (lower.includes("getting started") || lower.includes("beginner") || lower.includes("new")) return "getting-started";
    if (lower.includes("review") || lower.includes("comparison") || lower.includes("vs")) return "hardware-reviews";
    return "router-guides";
  }
}
