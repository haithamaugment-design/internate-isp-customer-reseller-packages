"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth";
import { api } from "@/lib/api";

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  _count?: { products: number };
}

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
  category?: ProductCategory;
  createdAt: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
}

type Tab = "products" | "categories";

export default function AdminProductsPage() {
  const [user] = useState(() => getStoredUser());
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCat, setEditingCat] = useState<ProductCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Product form state
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    price: "",
    comparePrice: "",
    imageUrl: "",
    specs: "",
    features: "",
    stock: "100",
    categoryId: "",
    linkedBlogIds: [] as string[],
    published: true,
    featured: false,
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
      const [prodsData, catsData, postsData] = await Promise.all([
        api.get<{ products?: unknown[]; id: string }[] | { products: unknown[] }>('/products?all=true').catch(() => []),
        api.get<{ categories?: unknown[]; id: string }[] | { categories: unknown[] }>('/products/categories').catch(() => []),
        api.get<{ posts?: unknown[]; id: string }[] | { posts: unknown[] }>('/blog/posts?all=true').catch(() => []),
      ]);
      const prodsList = Array.isArray(prodsData) ? prodsData : (prodsData as { products: unknown[] }).products || [];
      setProducts(prodsList as Product[]);
      const catsList = Array.isArray(catsData) ? catsData : (catsData as { categories: unknown[] }).categories || [];
      setCategories(catsList as ProductCategory[]);
      const postsList = Array.isArray(postsData) ? postsData : (postsData as { posts: unknown[] }).posts || [];
      setBlogPosts((postsList as { id: string; title: string; slug: string }[]).map((p) => ({ id: p.id, title: p.title, slug: p.slug })));
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleSubmitProduct(e: React.FormEvent) {
    e.preventDefault();
    try {
      const specsObj = form.specs ? form.specs.split("\n").filter(Boolean).reduce((acc, line) => {
        const [key, ...rest] = line.split(":");
        if (key) acc[key.trim()] = rest.join(":").trim();
        return acc;
      }, {} as Record<string, string>) : null;

      const body = {
        name: form.name.trim(),
        slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        description: form.description || null,
        price: Math.round(parseFloat(form.price)) || 0,
        comparePrice: form.comparePrice ? Math.round(parseFloat(form.comparePrice)) : undefined,
        imageUrl: form.imageUrl || null,
        specs: specsObj,
        stock: parseInt(form.stock) || 0,
        categoryId: form.categoryId || null,
        published: form.published,
        featured: form.featured,
        linkedBlogIds: form.linkedBlogIds.length > 0 ? form.linkedBlogIds.join(",") : undefined,
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, body);
      } else {
        await api.post('/products', body);
      }
      setShowForm(false);
      setEditingProduct(null);
      resetProductForm();
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to save product");
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
        await api.put(`/products/categories/${editingCat.id}`, body);
      } else {
        await api.post('/products/categories', body);
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

  async function handleDeleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    await api.del(`/products/${id}`);
    loadData();
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("Delete this category? Products in it will become uncategorized.")) return;
    await api.del(`/products/categories/${id}`);
    loadData();
  }

  function resetProductForm() {
    setForm({ name: "", slug: "", description: "", price: "", comparePrice: "", imageUrl: "", specs: "", features: "", stock: "100", categoryId: "", linkedBlogIds: [], published: true, featured: false });
  }

  function resetCatForm() {
    setCatForm({ name: "", slug: "", description: "", parentId: "" });
  }

  function startEditProduct(product: any) {
    setEditingProduct(product);
    const specsRaw = product.specs ? (typeof product.specs === "string" ? product.specs : Object.entries(product.specs).map(([k, v]) => `${k}: ${v}`).join("\n")) : "";
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      price: (product.price ?? 0).toString(),
      comparePrice: product.comparePrice ? product.comparePrice.toString() : "",
      imageUrl: (product as any).imageUrl || product.images?.[0] || "",
      specs: specsRaw,
      features: "",
      stock: (product.stock ?? 0).toString(),
      categoryId: product.category?.id || "",
      linkedBlogIds: product.linkedBlogIds ? product.linkedBlogIds.split(",").filter(Boolean) : [],
      published: product.published ?? true,
      featured: product.featured ?? false,
    });
    setShowForm(true);
  }

  function startEditCat(cat: ProductCategory) {
    setEditingCat(cat);
    setCatForm({ name: cat.name, slug: cat.slug, description: cat.description || "", parentId: "" });
    setShowCatForm(true);
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (user?.role !== "PLATFORM_OWNER") return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Product Management</h1>
          <p className="text-[var(--text-muted)] mt-1">Manage routers and products for your shop</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--surface)] rounded-xl p-1 border border-[var(--border)]">
        {(["products", "categories"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setShowForm(false); setShowCatForm(false); }}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {t === "products" ? `Products (${products.length})` : `Categories (${categories.length})`}
          </button>
        ))}
      </div>

      {/* PRODUCTS TAB */}
      {tab === "products" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              onClick={() => { resetProductForm(); setEditingProduct(null); setShowForm(true); }}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90"
            >
              + New Product
            </button>
          </div>

          {showForm && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-[var(--text)]">{editingProduct ? "Edit Product" : "New Product"}</h3>
              <form onSubmit={handleSubmitProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Name *</label>
                    <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Slug</label>
                    <input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Description</label>
                  <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Price (TZS) *</label>
                    <input type="number" required step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Compare Price (TZS)</label>
                    <input type="number" step="0.01" value={form.comparePrice} onChange={e => setForm({ ...form, comparePrice: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Stock</label>
                    <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Image URL</label>
                    <input type="text" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">Category</label>
                    <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]">
                      <option value="">No category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Specifications (one per line)</label>
                  <textarea rows={3} value={form.specs} onChange={e => setForm({ ...form, specs: e.target.value })} placeholder="Ethernet: 5x 10/100/1000&#10;CPU: 880MHz&#10;RAM: 512MB" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Features (comma-separated)</label>
                  <input type="text" value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} placeholder="RouterOS v7, PoE out, USB 3.0" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)]" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Link Blog Posts (Ctrl+Click to select multiple)</label>
                  <select multiple value={form.linkedBlogIds} onChange={e => {
                    const vals = Array.from(e.target.selectedOptions, o => o.value);
                    setForm({ ...form, linkedBlogIds: vals });
                  }} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] h-[88px]">
                    {blogPosts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Hold Ctrl/Cmd to select multiple — links will appear on the product page</p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} className="w-4 h-4 rounded accent-[var(--accent)]" />
                    <span className="text-sm text-[var(--text-muted)]">Published</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} className="w-4 h-4 rounded accent-[var(--accent)]" />
                    <span className="text-sm text-[var(--text-muted)]">Featured</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="px-6 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90">
                    {editingProduct ? "Update Product" : "Create Product"}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingProduct(null); }} className="px-6 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)]">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">No products yet.</div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product: any) => (
                <div key={product.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-16 h-16 rounded-xl object-cover bg-[var(--bg)]" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] text-xs">No img</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[var(--text)] truncate">{product.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${product.published ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                        {product.published ? "Live" : "Draft"}
                      </span>
                      {product.featured && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400">Featured</span>}
                      {product.category && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)]">{product.category.name}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <span className="font-semibold text-[var(--text)]">{((product as any).price ?? product.priceCents ?? 0).toLocaleString()} TZS</span>
                      <span className="text-[var(--text-muted)]">Stock: {product.stock}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditProduct(product)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)]">Edit</button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400">Delete</button>
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
          <div className="flex justify-end">
            <button onClick={() => { resetCatForm(); setEditingCat(null); setShowCatForm(true); }} className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90">
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
                  <button type="submit" className="px-6 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90">
                    {editingCat ? "Update Category" : "Create Category"}
                  </button>
                  <button type="button" onClick={() => { setShowCatForm(false); setEditingCat(null); }} className="px-6 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)]">Cancel</button>
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
                        <span className="text-xs text-[var(--text-muted)]">/shop/{cat.slug}</span>
                      </div>
                      {cat.description && <p className="text-sm text-[var(--text-muted)] mt-1">{cat.description}</p>}
                      <span className="text-xs text-[var(--text-muted)]">{cat._count?.products || 0} products</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEditCat(cat)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)]">Edit</button>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400">Delete</button>
                    </div>
                  </div>
                  {categories.filter(c => c.parentId === cat.id).map(sub => (
                    <div key={sub.id} className="ml-8 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between mt-2">
                      <div>
                        <span className="text-sm font-medium text-[var(--text)]">{sub.name}</span>
                        <span className="text-xs text-[var(--text-muted)] ml-2">({sub._count?.products || 0} products)</span>
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
    </div>
  );
}
