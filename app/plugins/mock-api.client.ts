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

/** ออเดอร์ที่ชำระสลิปแล้ว (mock) — ให้ get-order แสดงสถานะ paid */
const mockPaidOrderIds = new Set<string>();

function pickOrder(orderId: number) {
  const id = String(orderId);
  const paid = mockPaidOrderIds.has(id);
  const created = new Date(Date.now() - 86400000 * 2).toISOString();
  const tracking = paid ? `KEX${orderId}TH` : "";
  return {
    id: orderId,
    number: String(orderId),
    status: paid ? "paid" : "pending",
    total: "0",
    total_price: "0",
    date_created: created,
    shipping_status: paid ? "shipped" : "preparing",
    tracking_number: tracking,
    shipping_receipt_number: "",
    fulfillment_updated_at: paid ? created : null,
    courier_name: "Kerry Express",
    courier_logo_url: "",
    courier_tracking_url: paid
      ? `https://th.kerryexpress.com/th/track/?track=${encodeURIComponent(tracking)}`
      : "",
    billing: {
      email: "buyer@example.com",
      first_name: "Mock",
      last_name: "Buyer",
      phone: "0812345678",
      address_1: "123 Mock Road",
      address_2: "",
      city: "Bangkok",
      state: "",
      postcode: "10110",
      country: "TH",
    },
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
    account_status: "public",
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

function mockParseListPagination(query: URLSearchParams, defaultSize = 20, maxSize = 100) {
  const page = Math.max(1, parseInt(String(query.get("page") || "1"), 10) || 1);
  let ps = parseInt(String(query.get("page_size") || query.get("pageSize") || ""), 10);
  if (!Number.isFinite(ps) || ps < 1) ps = defaultSize;
  ps = Math.min(Math.max(ps, 1), maxSize);
  const q = String(query.get("q") || query.get("search") || "").trim().toLowerCase();
  return { page, pageSize: ps, q };
}

function mockPaginationMeta(page: number, pageSize: number, total: number) {
  const t = total;
  return {
    page,
    page_size: pageSize,
    total: t,
    total_pages: t === 0 ? 0 : Math.ceil(t / pageSize),
  };
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
      const loginId = String(body?.email || body?.username || "")
        .trim()
        .toLowerCase();
      const isDemoAdmin =
        (loginId === "admin" || loginId === "admin@demo.local") &&
        password === "admin123456";
      if (isDemoAdmin) {
        const adminRow = mockRegistryUsers.find(
          (u) => String(u.email).toLowerCase() === "admin@demo.local"
        );
        const st = adminRow?.account_status || "public";
        if (st === "block" || st === "pending") {
          return {
            success: false,
            error: { message: "Invalid credentials", code: "INVALID_CREDENTIALS" },
          };
        }
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
            account_status: st,
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
      let account_status = "public";
      const bt = mockBearerToken(opts);
      if (
        bt === "demo-admin-token" &&
        ["public", "pending", "block"].includes(String(body?.account_status || ""))
      ) {
        account_status = String(body.account_status);
      }
      const row = {
        id,
        email,
        name,
        role,
        account_status,
        created_at: new Date().toISOString(),
      };
      mockRegistryUsers = [row, ...mockRegistryUsers];
      return {
        success: true,
        data: {
          token: `mock-token-${id}`,
          user: { id, email, name, role, username: email, account_status },
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
      const bo = body as AnyObj;
      const bill = bo?.billing;
      return {
        success: true,
        order: {
          id,
          number: String(id),
          status: "pending",
          total: String(bo?.total || 0),
          billing_snapshot: bill,
          billing: bill
            ? {
                email: bill.email,
                first_name: bill.first_name || bill.firstName,
                last_name: bill.last_name || bill.lastName,
                phone: bill.phone,
                address_1: bill.address_1 || bill.address1,
                address_2: bill.address_2 || bill.address2,
                city: bill.city,
                state: bill.state,
                postcode: bill.postcode,
                country: bill.country || "TH",
              }
            : null,
          shipping_status: "pending",
        },
      };
    }
    const fulfillMatch = p.match(/^\/api\/seller-orders\/([^/]+)\/fulfillment$/);
    if (fulfillMatch && String(opts?.method || "GET").toUpperCase() === "PATCH") {
      const bo = (body as AnyObj) || {};
      const tn = String(bo.tracking_number ?? "").trim();
      const hasStatus = bo.shipping_status != null && String(bo.shipping_status).trim() !== "";
      let shipping_status = hasStatus ? String(bo.shipping_status).trim() : tn ? "shipped" : "pending";
      const courier =
        bo.courier_name != null && String(bo.courier_name).trim() !== ""
          ? String(bo.courier_name).trim()
          : tn
            ? "Mock Courier"
            : null;
      return {
        success: true,
        data: {
          order: {
            id: fulfillMatch[1],
            shipping_status,
            tracking_number: tn || null,
            shipping_receipt_number: bo.shipping_receipt_number || null,
            courier_name: courier,
            fulfillment_updated_at: new Date().toISOString(),
            status: "paid",
          },
        },
      };
    }
    if (p === "/api/payment/mock" && (opts?.method === "POST" || opts?.method === "post")) {
      const b = opts?.body;
      let orderId = "";
      let hasProof = false;
      if (b instanceof FormData) {
        orderId = String(b.get("order_id") || "");
        const slipData = String(b.get("slip_data") || "").trim();
        const slipUrl = String(b.get("slip_url") || "").trim();
        const slipFile = b.get("slip_image");
        hasProof = !!(slipData || slipUrl || (slipFile && typeof slipFile !== "string"));
      } else if (b && typeof b === "object") {
        const bo = b as AnyObj;
        orderId = String(bo.order_id || "");
        hasProof = !!(
          String(bo.slip_data || "").trim() ||
          String(bo.slip_url || "").trim()
        );
      }
      if (orderId && !hasProof) {
        return {
          success: false,
          error: {
            message: "Provide slip_data, slip_url, or slip_image",
            code: "PAYMENT_PROOF_REQUIRED",
          },
        };
      }
      if (orderId) mockPaidOrderIds.add(orderId);
      return {
        success: true,
        data: {
          success: true,
          order: {
            id: orderId,
            status: "paid",
            total_price: 0,
          },
          paid: true,
        },
      };
    }
    if (p === "/api/get-order") {
      const orderId = Number(query.get("order_id") || query.get("id") || 1);
      return { success: true, order: pickOrder(orderId) };
    }
    if (p === "/api/my-orders-jwt" || p === "/api/my-orders" || p === "/api/seller-orders") {
      const { page, pageSize, q } = mockParseListPagination(query);
      const orders: AnyObj[] = [];
      if (q) {
        /* mock ไม่มีออเดอร์ตัวอย่าง — ค้นหาแล้วว่าง */
      }
      const total = orders.length;
      const start = (page - 1) * pageSize;
      const slice = orders.slice(start, start + pageSize);
      return {
        success: true,
        orders: slice,
        pagination: mockPaginationMeta(page, pageSize, total),
      };
    }
    if (p === "/api/admin/users") {
      if (!mockBearerToken(opts)) {
        return {
          success: false,
          error: { message: "Unauthorized", code: "UNAUTHORIZED" },
        };
      }
      const { page, pageSize, q } = mockParseListPagination(query, 25, 100);
      let list = mockRegistryUsers.map((u) => ({
        ...u,
        account_status: u.account_status ?? "public",
      }));
      if (q) {
        list = list.filter(
          (u) =>
            String(u.email || "")
              .toLowerCase()
              .includes(q) ||
            String(u.name || "")
              .toLowerCase()
              .includes(q)
        );
      }
      const total = list.length;
      const start = (page - 1) * pageSize;
      const users = list.slice(start, start + pageSize);
      return {
        success: true,
        data: {
          success: true,
          users,
          pagination: mockPaginationMeta(page, pageSize, total),
        },
      };
    }
    const adminUserPath = p.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (adminUserPath) {
      const uid = adminUserPath[1];
      const method = String(opts?.method || "GET").toUpperCase();
      const token = mockBearerToken(opts);
      if (!token || token !== "demo-admin-token") {
        return {
          success: false,
          error: { message: "Forbidden", code: "FORBIDDEN" },
        };
      }
      const ix = mockRegistryUsers.findIndex((u) => String(u.id) === uid);
      if (ix === -1) {
        return {
          success: false,
          error: { message: "User not found", code: "NOT_FOUND" },
        };
      }
      if (method === "PATCH" || method === "PUT") {
        const cur = mockRegistryUsers[ix]!;
        const b = body as AnyObj;
        const nextRow: AnyObj = { ...cur };
        if (b.email != null && String(b.email).trim()) nextRow.email = String(b.email).trim().toLowerCase();
        if (b.name != null) nextRow.name = String(b.name);
        if (b.role != null) {
          let r = String(b.role);
          if (r === "customer") r = "user";
          nextRow.role = r;
        }
        if (b.account_status != null && ["public", "pending", "block"].includes(String(b.account_status))) {
          nextRow.account_status = String(b.account_status);
        }
        mockRegistryUsers = mockRegistryUsers.map((u, i) => (i === ix ? nextRow : u));
        const u = mockRegistryUsers[ix]!;
        return {
          success: true,
          data: {
            success: true,
            user: {
              id: u.id,
              email: u.email,
              name: u.name,
              role: u.role,
              username: u.email,
              account_status: u.account_status ?? "public",
              created_at: u.created_at,
            },
          },
        };
      }
      if (method === "DELETE") {
        if (uid === "00000000-0000-4000-8000-000000000001") {
          return {
            success: false,
            error: { message: "Cannot delete the last admin", code: "LAST_ADMIN" },
          };
        }
        mockRegistryUsers = mockRegistryUsers.filter((u) => String(u.id) !== uid);
        return {
          success: true,
          data: { success: true, deleted: true },
        };
      }
    }
    if (p === "/api/my-products") {
      const token = mockBearerToken(opts);
      const isAdmin = token === "demo-admin-token";
      const ownOnly =
        query.get("own_only") === "1" || query.get("own_only") === "true";
      const { page, pageSize, q } = mockParseListPagination(query, 20, 100);
      let list: AnyObj[] = [];
      if (isAdmin && !ownOnly) {
        list = mockCmsProducts.map((x) => ({ ...x }));
      } else if (ownOnly && isAdmin) {
        list = mockCmsProducts.filter((x) => x.seller_id === MOCK_SELLER).map((x) => ({ ...x }));
      }
      if (q) {
        list = list.filter((x) => String(x.name || "").toLowerCase().includes(q));
      }
      const total = list.length;
      const start = (page - 1) * pageSize;
      const products = list.slice(start, start + pageSize);
      return {
        success: true,
        count: products.length,
        products,
        pagination: mockPaginationMeta(page, pageSize, total),
      };
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

