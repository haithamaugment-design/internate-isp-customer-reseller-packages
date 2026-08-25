"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth";
import { api } from "@/lib/api";

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  _count?: { posts: number };
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  published: boolean;
  author?: string;
  tags?: string;
  linkedProductIds?: string;
  category?: BlogCategory;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
}

type Tab = "posts" | "categories" | "ai-generate";

export default function AdminBlogPage() {
  const [user] = useState(() => getStoredUser());
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [editingCat, setEditingCat] = useState<BlogCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiForm, setAiForm] = useState({
    topic: "",
    routerModel: "",
    difficulty: "intermediate" as "beginner" | "intermediate" | "advanced",
    length: "medium" as "short" | "medium" | "long",
    category: "",
    published: false,
  });

  // Post form state
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    author: "",
    tags: "",
    categoryId: "",
    linkedProductIds: [] as string[],
    published: false,
  });

  // Category form state
  const [catForm, setCatForm] = useState({
    name: "",
    slug: "",
    description: "",
    parentId: "",
  });

  useEffect(() => {
    if (user && user.role !== "PLATFORM_OWNER") {
      router.push("/admin/dashboard");
      return;
    }
    loadData();
  }, [user, router]);

  async function loadData() {
    setLoading(true);
    try {
      const [postsData, catsData, prodsData] = await Promise.all([
        api.get<{ posts?: unknown[]; id: string }[] | { posts: unknown[] }>('/blog/posts?all=true').catch(() => []),
        api.get<{ categories?: unknown[]; id: string }[] | { categories: unknown[] }>('/blog/categories').catch(() => []),
        api.get<{ products?: unknown[]; id: string }[] | { products: unknown[] }>('/products?all=true').catch(() => []),
      ]);
      const postsList = Array.isArray(postsData) ? postsData : (postsData as { posts: unknown[] }).posts || [];
      setPosts(postsList as BlogPost[]);
      const catsList = Array.isArray(catsData) ? catsData : (catsData as { categories: unknown[] }).categories || [];
      setCategories(catsList as BlogCategory[]);
      const prodsList = Array.isArray(prodsData) ? prodsData : (prodsData as { products: unknown[] }).products || [];
      setProducts(prodsList as Product[]);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleSubmitPost(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = {
        ...form,
        slug: form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).join(",") : undefined,
        linkedProductIds: form.linkedProductIds.length > 0 ? form.linkedProductIds.join(",") : undefined,
        categoryId: form.categoryId || undefined,
      };

      if (editingPost) {
        await api.put(`/blog/posts/${editingPost.id}`, body);
      } else {
        await api.post('/blog/posts', body);
      }
      setShowForm(false);
      setEditingPost(null);
      resetPostForm();
      loadData();
    } catch {
      alert("Failed to save post");
    }
  }

  async function handleSubmitCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = {
        name: catForm.name.trim(),
        slug: catForm.slug || catForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        description: catForm.description || null,
        parentId: catForm.parentId || null,
      };

      if (editingCat) {
        await api.put(`/blog/categories/${editingCat.id}`, body);
      } else {
        await api.post('/blog/categories', body);
      }
      setShowCatForm(false);
      setEditingCat(null);
      resetCatForm();
      loadData();
    } catch (err: any) {
      const msg = err?.message || "Failed to save category";
      alert(msg);
    }
  }

  async function handleDeletePost(id: string) {
    if (!confirm("Delete this post?")) return;
    await api.del(`/blog/posts/${id}`);
    loadData();
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("Delete this category? Posts in it will become uncategorized.")) return;
    await api.del(`/blog/categories/${id}`);
    loadData();
  }

  async function handleTogglePublish(post: BlogPost) {
    await api.put(`/blog/posts/${post.id}`, { published: !post.published });
    loadData();
  }

  function resetPostForm() {
    setForm({ title: "", slug: "", excerpt: "", content: "", coverImage: "", author: "", tags: "", categoryId: "", linkedProductIds: [], published: false });
  }

  function resetCatForm() {
    setCatForm({ name: "", slug: "", description: "", parentId: "" });
  }

  function startEditPost(post: BlogPost) {
    setEditingPost(post);
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || "",
      content: post.content,
      coverImage: post.coverImage || "",
      author: post.author || "",
      tags: post.tags || "",
      categoryId: post.category?.id || "",
      linkedProductIds: post.linkedProductIds ? post.linkedProductIds.split(",").filter(Boolean) : [],
      published: post.published,
    });
    setShowForm(true);
  }

  function startEditCat(cat: BlogCategory) {
    setEditingCat(cat);
    setCatForm({ name: cat.name, slug: cat.slug, description: cat.description || "", parentId: "" });
    setShowCatForm(true);
  }

  async function handleAIGenerate(e: React.FormEvent) {
    e.preventDefault();
    setAiGenerating(true);
    try {
      const result = await api.post<any>('/blog/generate', {
        topic: aiForm.topic,
        routerModel: aiForm.routerModel || undefined,
        difficulty: aiForm.difficulty,
        length: aiForm.length,
        category: aiForm.category || undefined,
        published: aiForm.published,
      });
      setShowAIGenerate(false);
      setAiForm({ topic: "", routerModel: "", difficulty: "intermediate", length: "medium", category: "", published: false });
      alert(`Post generated: "${result.post?.title || result.article?.title}"`);
      loadData();
    } catch (err: any) {
      alert(`AI generation failed: ${err?.message || "Unknown error"}`);
    }
    setAiGenerating(false);
  }

  async function handleInitCategories() {
    try {
      await api.get('/blog/categories/ensure');
      alert("All default categories created!");
      loadData();
    } catch (err: any) {
      alert(`Failed: ${err?.message}`);
    }
  }

  async function handleGenerateSeries() {
    const model = prompt("Enter router model name (e.g., TP-Link Archer C7):");
    if (!model) return;
    setAiGenerating(true);
    try {
      const results = await api.post<any[]>('/blog/generate-series', { routerModel: model });
      alert(`Generated ${results.length} posts for "${model}"`);
      loadData();
    } catch (err: any) {
      alert(`Series generation failed: ${err?.message}`);
    }
    setAiGenerating(false);
  }

  const filteredPosts = posts.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (user?.role !== "PLATFORM_OWNER") return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Blog Management</h1>
          <p className="text-[var(--text-muted)] mt-1">Create posts, categories, and link to products</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--surface)] rounded-xl p-1 border border-[var(--border)]">
        {(["posts", "categories", "ai-generate"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setShowForm(false); setShowCatForm(false); setShowAIGenerate(false); }}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {t === "posts" ? `📝 Posts (${posts.length})` : t === "categories" ? `📂 Categories (${categories.length})` : "🤖 AI Generate"}
          </button>
        ))}
      </div>

      {/* POSTS TAB */}
      {tab === "posts" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <button
              onClick={() => { resetPostForm(); setEditingPost(null); setShowForm(true); }}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all"
            >
              + New Post
            </button>
          </div>

          {/* Post Form */}
          {showForm && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-[var(--text)]">{editingPost ? "Edit Post" : "New Post"}</h3>
              <form onSubmit={handleSubmitPost} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Title *</label>
                    <input type="text" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Slug</label>
                    <input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Excerpt</label>
                  <input type="text" value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Content * (Markdown)</label>
                  <textarea rows={10} required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-mono text-sm" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Cover Image URL</label>
                    <input type="text" value={form.coverImage} onChange={e => setForm({ ...form, coverImage: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Author</label>
                    <input type="text" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Tags (comma-separated)</label>
                    <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="mikrotik, tutorial, firmware" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Category</label>
                    <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]">
                      <option value="">No category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Link Products (Ctrl+Click to select multiple)</label>
                    <select multiple value={form.linkedProductIds} onChange={e => {
                      const vals = Array.from(e.target.selectedOptions, o => o.value);
                      setForm({ ...form, linkedProductIds: vals });
                    }} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] h-[88px]">
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.price.toLocaleString()} TZS</option>)}
                    </select>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Hold Ctrl/Cmd to select multiple</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="published" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]" />
                  <label htmlFor="published" className="text-sm text-[var(--text-muted)]">Publish immediately</label>
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="px-6 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all">
                    {editingPost ? "Update Post" : "Create Post"}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingPost(null); }} className="px-6 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-all">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Posts List */}
          {loading ? (
            <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">No posts yet. Create your first post!</div>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map(post => (
                <div key={post.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[var(--text)] truncate">{post.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${post.published ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                        {post.published ? "Published" : "Draft"}
                      </span>
                      {post.category && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)]">{post.category.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mt-1 line-clamp-1">{post.excerpt || post.content.slice(0, 100)}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                      <span>/blog/{post.slug}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      {post.linkedProductIds && <span className="text-[var(--accent)]">Linked to {post.linkedProductIds.split(",").length} product(s)</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleTogglePublish(post)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${post.published ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
                      {post.published ? "Unpublish" : "Publish"}
                    </button>
                    <button onClick={() => startEditPost(post)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all">
                      Edit
                    </button>
                    <button onClick={() => handleDeletePost(post.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CATEGORIES TAB */}
      {tab === "categories" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={handleInitCategories}
              className="px-4 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium hover:bg-emerald-500/25 transition-all"
            >
              ⚡ Init Default Categories
            </button>
            <button
              onClick={() => { resetCatForm(); setEditingCat(null); setShowCatForm(true); }}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all"
            >
              + New Category
            </button>
          </div>

          {showCatForm && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-[var(--text)]">{editingCat ? "Edit Category" : "New Category"}</h3>
              <form onSubmit={handleSubmitCategory} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Name *</label>
                    <input type="text" required value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Slug</label>
                    <input type="text" value={catForm.slug} onChange={e => setCatForm({ ...catForm, slug: e.target.value })} placeholder="auto-generated" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Description</label>
                  <input type="text" value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Parent Category <span className="text-xs opacity-60">(optional — leave as None for top-level)</span></label>
                  <select value={catForm.parentId} onChange={e => setCatForm({ ...catForm, parentId: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]">
                    <option value="">None (top-level)</option>
                    {categories.filter(c => !c.parentId && c.id !== editingCat?.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="px-6 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all">
                    {editingCat ? "Update Category" : "Create Category"}
                  </button>
                  <button type="button" onClick={() => { setShowCatForm(false); setEditingCat(null); }} className="px-6 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-all">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">No categories yet.</div>
          ) : (
            <div className="space-y-2">
              {categories.filter(c => !c.parentId).map(cat => (
                <div key={cat.id}>
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text)]">{cat.name}</span>
                        <span className="text-xs text-[var(--text-muted)]">/blog/{cat.slug}</span>
                      </div>
                      {cat.description && <p className="text-sm text-[var(--text-muted)] mt-1">{cat.description}</p>}
                      <span className="text-xs text-[var(--text-muted)]">{cat._count?.posts || 0} posts</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEditCat(cat)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20">Edit</button>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button>
                    </div>
                  </div>
                  {categories.filter(c => c.parentId === cat.id).map(sub => (
                    <div key={sub.id} className="ml-8 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between mt-2">
                      <div>
                        <span className="text-sm font-medium text-[var(--text)]">{sub.name}</span>
                        <span className="text-xs text-[var(--text-muted)] ml-2">({sub._count?.posts || 0} posts)</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEditCat(sub)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)]">Edit</button>
                        <button onClick={() => handleDeleteCategory(sub.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI GENERATE TAB */}
      {tab === "ai-generate" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">AI Blog Generator</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Generate blog posts about routers, OpenWRT, MikroTik, and reseller tips. The AI will automatically assign categories and suggest new ones.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleInitCategories}
                className="px-4 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium hover:bg-emerald-500/25 transition-all"
              >
                ⚡ Init Categories
              </button>
              <button
                onClick={handleGenerateSeries}
                disabled={aiGenerating}
                className="px-4 py-2 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-xl text-sm font-medium hover:bg-purple-500/25 transition-all disabled:opacity-50"
              >
                📚 Generate Series
              </button>
            </div>
          </div>

          {/* AI Generate Form */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
            <h3 className="font-semibold text-[var(--text)] mb-4">🤖 Generate a Blog Post</h3>
            <form onSubmit={handleAIGenerate} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Topic *</label>
                <input
                  type="text"
                  required
                  value={aiForm.topic}
                  onChange={e => setAiForm({ ...aiForm, topic: e.target.value })}
                  placeholder="e.g., How to Flash OpenWRT on TP-Link Archer C7"
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Router Model (optional)</label>
                  <input
                    type="text"
                    value={aiForm.routerModel}
                    onChange={e => setAiForm({ ...aiForm, routerModel: e.target.value })}
                    placeholder="e.g., TP-Link Archer C7, MikroTik hAP ac2"
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Category (optional — AI will suggest)</label>
                  <select
                    value={aiForm.category}
                    onChange={e => setAiForm({ ...aiForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]"
                  >
                    <option value="">Auto-detect from topic</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Difficulty</label>
                  <select
                    value={aiForm.difficulty}
                    onChange={e => setAiForm({ ...aiForm, difficulty: e.target.value as "beginner" | "intermediate" | "advanced" })}
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]"
                  >
                    <option value="beginner">🟢 Beginner — no experience needed</option>
                    <option value="intermediate">🟡 Intermediate — some networking knowledge</option>
                    <option value="advanced">🔴 Advanced — professional level</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Length</label>
                  <select
                    value={aiForm.length}
                    onChange={e => setAiForm({ ...aiForm, length: e.target.value as "short" | "medium" | "long" })}
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]"
                  >
                    <option value="short">Short — quick overview</option>
                    <option value="medium">Medium — detailed guide</option>
                    <option value="long">Long — comprehensive tutorial</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ai-published"
                  checked={aiForm.published}
                  onChange={e => setAiForm({ ...aiForm, published: e.target.checked })}
                  className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]"
                />
                <label htmlFor="ai-published" className="text-sm text-[var(--text-muted)]">Publish immediately after generation</label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={aiGenerating}
                  className="px-6 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {aiGenerating ? "⏳ Generating..." : "🤖 Generate Post"}
                </button>
              </div>
            </form>
          </div>

          {/* Tips */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4">
            <h4 className="font-medium text-purple-400 text-sm mb-2">💡 Tips for great AI-generated content:</h4>
            <ul className="text-xs text-[var(--text-muted)] space-y-1">
              <li>• Be specific in the topic — &quot;Flash OpenWRT on TP-Link Archer C7 v5&quot; is better than &quot;router setup&quot;</li>
              <li>• The AI will suggest new categories automatically (e.g., &quot;TP-Link Guides&quot;, &quot;CoovaChilli&quot;)</li>
              <li>• Generated content includes firmware download links, CLI commands, and TZS pricing</li>
              <li>• Use &quot;Generate Series&quot; to create a full guide set for any router model</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
