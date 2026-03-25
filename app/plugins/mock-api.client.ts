type AnyObj = Record<string, any>;

const categories = [
  { id: 1, databaseId: 1, name: "เสื้อผ้า", slug: "clothing", children: { nodes: [] } },
  { id: 2, databaseId: 2, name: "กระเป๋า", slug: "bags", children: { nodes: [] } },
  { id: 3, databaseId: 3, name: "ของใช้ในบ้าน", slug: "home", children: { nodes: [] } },
];

const products = [
  {
    id: "p-1001",
    databaseId: 1001,
    slug: "linen-shirt",
    sku: "YS-1001",
    name: "เสื้อผ้าฝ้ายลินิน",
    description: "<p>สินค้า mock สำหรับ UI</p>",
    regularPrice: "890",
    salePrice: "690",
    stockQuantity: 12,
    stockStatus: "IN_STOCK",
    image: { sourceUrl: "https://picsum.photos/seed/linen-shirt/800/1066" },
    galleryImages: { nodes: [{ sourceUrl: "https://picsum.photos/seed/linen-shirt/800/1066" }] },
    allPaStyle: { nodes: [{ name: "ลำลอง" }] },
    allPaColor: { nodes: [{ name: "ครีม" }] },
    productCategories: { nodes: [{ name: "เสื้อผ้า", slug: "clothing" }] },
    related: { nodes: [] },
    variations: { nodes: [] },
  },
  {
    id: "p-1002",
    databaseId: 1002,
    slug: "canvas-tote",
    sku: "YS-1002",
    name: "กระเป๋าผ้าแคนวาส",
    description: "<p>สินค้า mock สำหรับ UI</p>",
    regularPrice: "450",
    salePrice: null,
    stockQuantity: 30,
    stockStatus: "IN_STOCK",
    image: { sourceUrl: "https://picsum.photos/seed/canvas-tote/800/1066" },
    galleryImages: { nodes: [{ sourceUrl: "https://picsum.photos/seed/canvas-tote/800/1066" }] },
    allPaStyle: { nodes: [{ name: "ทำงาน" }] },
    allPaColor: { nodes: [{ name: "กรม" }] },
    productCategories: { nodes: [{ name: "กระเป๋า", slug: "bags" }] },
    related: { nodes: [] },
    variations: { nodes: [] },
  },
  {
    id: "p-1003",
    databaseId: 1003,
    slug: "ceramic-mug",
    sku: "YS-1003",
    name: "แก้วเซรามิก",
    description: "<p>สินค้า mock สำหรับ UI</p>",
    regularPrice: "120",
    salePrice: "89",
    stockQuantity: 2,
    stockStatus: "IN_STOCK",
    image: { sourceUrl: "https://picsum.photos/seed/ceramic-mug/800/1066" },
    galleryImages: { nodes: [{ sourceUrl: "https://picsum.photos/seed/ceramic-mug/800/1066" }] },
    allPaStyle: { nodes: [{ name: "วินเทจ" }] },
    allPaColor: { nodes: [] },
    productCategories: { nodes: [{ name: "ของใช้ในบ้าน", slug: "home" }] },
    related: { nodes: [] },
    variations: { nodes: [] },
  },
];

function parseUrl(input: any): URL | null {
  try {
    if (typeof input === "string") return new URL(input, window.location.origin);
    if (input instanceof URL) return input;
    return new URL(String(input), window.location.origin);
  } catch {
    return null;
  }
}

function filterProducts(search?: string, category?: string) {
  let out = [...products];
  if (search) {
    const q = search.toLowerCase();
    out = out.filter((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q) || p.sku.toLowerCase().includes(q));
  }
  if (category) {
    const q = category.toLowerCase();
    out = out.filter((p) => p.productCategories.nodes.some((c: AnyObj) => c.name.toLowerCase() === q || c.slug === q));
  }
  return out;
}

function pickOrder(orderId: number) {
  return {
    id: orderId,
    number: String(orderId),
    status: "processing",
    total: "0",
    line_items: [],
  };
}

/** รูปแบบเดียวกับ Yardsale Express — ใช้ในแอดมิน CRUD (my-products / create / update) */
const MOCK_CMS_A = "11111111-1111-4111-8111-111111111111";
const MOCK_CMS_B = "22222222-2222-4222-8222-222222222222";
const MOCK_SELLER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** Users สำหรับ mock: POST /api/create-user เพิ่มรายการ — GET /api/admin/users อ่านรายการเดียวกัน */
let mockRegistryUsers: AnyObj[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@demo.local",
    name: "Admin",
    role: "admin",
    created_at: new Date().toISOString(),
  },
];

let mockCmsProducts: AnyObj[] = [
  {
    id: MOCK_CMS_A,
    name: "Mock CMS Product A",
    description: "",
    price: 199.5,
    stock: 10,
    category_id: null,
    image_url: "https://picsum.photos/seed/cms-a/400/400",
    is_cancelled: false,
    listing_status: "published",
    created_at: new Date().toISOString(),
    seller_id: MOCK_SELLER,
  },
  {
    id: MOCK_CMS_B,
    name: "Mock CMS Product B",
    description: "",
    price: 49,
    stock: 3,
    category_id: null,
    image_url: null,
    is_cancelled: false,
    listing_status: "published",
    created_at: new Date().toISOString(),
    seller_id: MOCK_SELLER,
  },
];

function mockBearerToken(opts?: AnyObj): string {
  const h = opts?.headers?.Authorization || opts?.headers?.authorization;
  if (!h || typeof h !== "string") return "";
  return h.replace(/^Bearer\s+/i, "").trim();
}

function mockRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default defineNuxtPlugin(() => {
  const originalFetch = globalThis.$fetch;

  globalThis.$fetch = (async (request: any, opts?: AnyObj) => {
    const u = parseUrl(request);
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const isExternalAbsolute = !!u && !!currentOrigin && u.origin !== currentOrigin;
    // For CMS/backend absolute URLs (e.g. http://localhost:4000/api/*), bypass frontend mock.
    if (isExternalAbsolute) {
      return originalFetch(request, opts);
    }
    if (!u || !u.pathname.startsWith("/api/")) {
      return originalFetch(request, opts);
    }

    const p = u.pathname;
    const query = u.searchParams;
    const body = opts?.body ?? {};

    if (p === "/api/categories" || p === "/api/wp-categories") {
      return { productCategories: { nodes: categories } };
    }
    if (p === "/api/wp-tags") {
      return { productTags: { nodes: [{ id: 1, name: "มือสอง", slug: "used" }, { id: 2, name: "sale", slug: "sale" }] } };
    }
    if (p === "/api/products") {
      const nodes = filterProducts(String(query.get("search") || ""), String(query.get("category") || ""));
      return { products: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } };
    }
    if (p === "/api/search") {
      const nodes = filterProducts(String(query.get("search") || ""), "").slice(0, Number(query.get("limit") || 6));
      return { products: { nodes } };
    }
    if (p === "/api/product") {
      const id = Number(query.get("id") || 0);
      const slug = String(query.get("slug") || "");
      const sku = String(query.get("sku") || "");
      const product = products.find((x) => (id ? x.databaseId === id : true) && (slug ? x.slug === slug : true) && (sku ? x.sku === sku : true))
        || products.find((x) => x.databaseId === id || x.slug === slug || x.sku === sku)
        || null;
      return { product };
    }
    if (p === "/api/wp-post") {
      const id = Number(query.get("id") || 0);
      const product = products.find((x) => x.databaseId === id) || products[0];
      return { post: product, product };
    }
    const productByIdPath = p.match(/^\/api\/product\/([^/?]+)$/);
    if (productByIdPath) {
      const pid = productByIdPath[1];
      const row = mockCmsProducts.find((x) => x.id === pid);
      if (!row) {
        return { success: false, error: { message: "Product not found" } };
      }
      return { success: true, data: { product: row }, product: row };
    }
    if (p === "/api/login") {
      const username = String(body?.username || "demo");
      const password = String(body?.password || "");
      if (username === "admin" && password === "admin") {
        return {
          success: true,
          user: {
            id: 1,
            ID: 1,
            username: "admin",
            email: "admin@demo.local",
            token: "demo-admin-token",
            roles: ["admin"],
            role: "admin",
          },
        };
      }
      return {
        success: true,
        user: {
          id: 1,
          ID: 1,
          username,
          email: `${username}@demo.local`,
          token: "demo-token",
          roles: ["customer"],
        },
      };
    }
    if (p === "/api/me") {
      const id = Number(query.get("user_id") || query.get("id") || 1);
      return { success: true, user: { id, ID: id, username: `user-${id}`, email: `user${id}@demo.local`, roles: ["customer"] } };
    }
    if (p === "/api/check-email") return { available: true, exists: false };
    if (p === "/api/create-user") {
      const method = String(opts?.method || "GET").toUpperCase();
      if (method !== "POST") {
        return originalFetch(request, opts);
      }
      const email = String(body?.email || "").trim().toLowerCase();
      const password = String(body?.password || "");
      if (!email) {
        return {
          success: false,
          error: { message: "email is required", code: "VALIDATION_ERROR" },
        };
      }
      if (password.length < 8) {
        return {
          success: false,
          error: {
            message: "password length must be at least 8 characters long",
            code: "VALIDATION_ERROR",
          },
        };
      }
      let role = String(body?.role || "user");
      if (role === "customer") role = "user";
      const bearer = mockBearerToken(opts);
      if ((role === "seller" || role === "admin") && !bearer) {
        return {
          success: false,
          error: { message: "Unauthorized", code: "UNAUTHORIZED" },
        };
      }
      if (mockRegistryUsers.some((u) => String(u.email).toLowerCase() === email)) {
        return {
          success: false,
          error: { message: "Email already registered", code: "EMAIL_EXISTS" },
        };
      }
      const id = mockRandomId();
      const name =
        String(body?.name || body?.username || "").trim() || email.split("@")[0] || "User";
      const row = { id, email, name, role, created_at: new Date().toISOString() };
      mockRegistryUsers = [row, ...mockRegistryUsers];
      return {
        success: true,
        data: {
          token: `mock-token-${id}`,
          user: { id, email, name, role, username: email },
          id,
          message: "User created",
        },
      };
    }
    if (p === "/api/cart/add" && (opts?.method === "POST" || opts?.method === "post")) {
      const pid = Number(body?.productId);
      let prod = products.find((x) => x.databaseId === pid);
      if (!prod && body?.productId != null) {
        prod = mockCmsProducts.find(
          (x) => String(x.id) === String(body.productId)
        ) as AnyObj | undefined;
      }
      if (!prod) {
        return {
          addToCart: {
            cartItem: {
              key: `missing-${body?.productId}`,
              quantity: 1,
              product: {
                node: {
                  databaseId: pid || 0,
                  name: "Unknown",
                  regularPrice: "0",
                  salePrice: null,
                  stockQuantity: 0,
                  stockStatus: "OUT_OF_STOCK",
                },
              },
            },
          },
        };
      }
      const idKey = prod.databaseId ?? prod.id ?? pid;
      return {
        addToCart: {
          cartItem: {
            key: `mock-${idKey}`,
            quantity: 1,
            product: { node: { ...prod } },
          },
        },
      };
    }
    if (p === "/api/cart/update") return { success: true };
    if (p === "/api/refresh-cart-stock") {
      const items = Array.isArray(body?.items) ? body.items : [];
      const lines = items.map((i: AnyObj) => {
        const prod = products.find((x) => x.databaseId === Number(i.product_id));
        return {
          product_id: Number(i.product_id),
          variation_id: i.variation_id ? Number(i.variation_id) : undefined,
          quantity: Number(i.quantity || 1),
          name: prod?.name || `#${i.product_id}`,
          stockQuantity: prod?.stockQuantity ?? 0,
          stockStatus: (prod?.stockStatus || "IN_STOCK").toLowerCase() === "out_of_stock" ? "outofstock" : "instock",
        };
      });
      return { ok: true, lines, errors: [] };
    }
    if (p === "/api/check-cart-stock") {
      const items = Array.isArray(body?.items) ? body.items : [];
      const errors: AnyObj[] = [];
      for (const it of items) {
        const prod = products.find((x) => x.databaseId === Number(it.product_id));
        const sq = Number(prod?.stockQuantity ?? 0);
        const qty = Number(it.quantity || 1);
        if (qty > sq) errors.push({ product_id: Number(it.product_id), message: `สต็อกไม่พอ (มี ${sq}, สั่ง ${qty})` });
      }
      return { valid: errors.length === 0, errors };
    }
    if (p === "/api/get-customer-data") return { billing: null, customer: null };
    if (p === "/api/create-order") {
      const id = Math.floor(Date.now() / 1000);
      return { success: true, order: { id, number: String(id), status: "pending", total: String(body?.total || 0) } };
    }
    if (p === "/api/get-order") {
      const orderId = Number(query.get("order_id") || query.get("id") || 1);
      return { success: true, order: pickOrder(orderId) };
    }
    if (p === "/api/my-orders-jwt" || p === "/api/my-orders" || p === "/api/seller-orders") return { success: true, orders: [] };
    if (p === "/api/admin/users") {
      if (!mockBearerToken(opts)) {
        return {
          success: false,
          error: { message: "Unauthorized", code: "UNAUTHORIZED" },
        };
      }
      return {
        success: true,
        data: {
          success: true,
          users: mockRegistryUsers.map((u) => ({ ...u })),
        },
      };
    }
    if (p === "/api/my-products") {
      const token = mockBearerToken(opts);
      const isAdmin = token === "demo-admin-token";
      const ownOnly =
        query.get("own_only") === "1" || query.get("own_only") === "true";
      if (isAdmin && !ownOnly) {
        return {
          success: true,
          count: mockCmsProducts.length,
          products: mockCmsProducts.map((x) => ({ ...x })),
        };
      }
      if (ownOnly && isAdmin) {
        const mine = mockCmsProducts.filter((x) => x.seller_id === MOCK_SELLER);
        return {
          success: true,
          count: mine.length,
          products: mine.map((x) => ({ ...x })),
        };
      }
      return { success: true, count: 0, products: [] };
    }
    if (p === "/api/create-product" && (opts?.method === "POST" || opts?.method === "post")) {
      const row = {
        id: mockRandomId(),
        name: String(body?.name || "Untitled"),
        description: String(body?.description ?? ""),
        price: Number(body?.price) || 0,
        stock: (() => {
          const s = Number(body?.stock);
          return Number.isFinite(s) ? s : 0;
        })(),
        category_id: body?.category_id && body.category_id !== "" ? body.category_id : null,
        image_url: body?.image_url || null,
        is_cancelled: false,
        listing_status: "pending_review",
        created_at: new Date().toISOString(),
        seller_id: MOCK_SELLER,
      };
      mockCmsProducts.push(row);
      return { success: true, product: row };
    }
    if (p === "/api/update-product" && (opts?.method === "POST" || opts?.method === "post")) {
      const pid = String(body?.product_id || "");
      const ix = mockCmsProducts.findIndex((x) => x.id === pid);
      if (ix === -1) {
        return { success: false, error: { message: "Product not found" } };
      }
      const cur = mockCmsProducts[ix];
      const next = {
        ...cur,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.stock !== undefined ? { stock: body.stock } : {}),
        ...(body.category_id !== undefined
          ? { category_id: body.category_id && body.category_id !== "" ? body.category_id : null }
          : {}),
        ...(body.image_url !== undefined ? { image_url: body.image_url || null } : {}),
        ...(body.listing_status !== undefined
          ? { listing_status: body.listing_status }
          : {}),
      };
      mockCmsProducts[ix] = next;
      return { success: true, product: next };
    }
    if (
      (p === "/api/product/cancel" || p === "/api/cancel-product") &&
      (opts?.method === "POST" || opts?.method === "post")
    ) {
      const pid = String(body?.product_id || "");
      const row = mockCmsProducts.find((x) => x.id === pid);
      if (row) row.is_cancelled = true;
      return { success: true, product: row || null };
    }
    if (
      (p === "/api/product/restore" || p === "/api/restore-product") &&
      (opts?.method === "POST" || opts?.method === "post")
    ) {
      const pid = String(body?.product_id || "");
      const row = mockCmsProducts.find((x) => x.id === pid);
      if (row) row.is_cancelled = false;
      return { success: true, product: row || null };
    }
    if (p === "/api/cancel-order") return { success: true };
    if (p === "/api/upload-image") return { success: true, image: { sourceUrl: "https://picsum.photos/seed/upload/800/1066" } };
    if (p === "/api/upload-profile-picture" || p === "/api/update-profile") return { success: true };

    return {};
  }) as typeof globalThis.$fetch;
});

