/**
 * แมปสินค้าจาก Yardsale Express (PostgreSQL) → รูปแบบใกล้เคียง WooCommerce ที่ UI เดิมใช้
 */
import { useRuntimeConfig } from "nuxt/app";
import {
  cmsEndpointFromPublic,
  hasRemoteCmsApi,
  unwrapYardsaleResponse as unwrapYardsaleData,
} from "~/utils/cmsApiEndpoint";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidString(s: string | undefined | null): boolean {
  return !!s && UUID_RE.test(String(s));
}

export function unwrapYardsaleResponse(res: unknown): any {
  return unwrapYardsaleData(res);
}

/**
 * หน้าร้าน (ลิสต์ / รายละเอียด / ค้นหา): แสดงเฉพาะสินค้าที่ listing_status เผยแพร่
 * ไม่มีฟิลด์ = legacy หรือ mock WooCommerce → ถือว่าแสดงได้
 */
export function isStorefrontPublishedProduct(
  product: Record<string, unknown> | null | undefined
): boolean {
  if (!product || typeof product !== "object") return false;
  const ls = product.listing_status;
  if (ls === undefined || ls === null || ls === "") return true;
  return ls === "published";
}

export function useStorefrontCatalog() {
  const config = useRuntimeConfig();
  const pub = config.public as { cmsApiBase?: string; baseUrl?: string };
  const hasRemoteApi = hasRemoteCmsApi(pub);
  function endpoint(path: string): string {
    return cmsEndpointFromPublic(pub, path, import.meta.client);
  }

  /**
   * GET/POST ไป Yardsale API แล้วแกะ envelope { success, data } อัตโนมัติ
   * @param path เช่น `products`, `get-order/:id` (ไม่มี leading /)
   */
  async function fetchYardsale(path: string, init?: Record<string, unknown>) {
    const p = String(path || "").replace(/^\//, "");
    const method = String((init as { method?: string })?.method || "GET").toUpperCase();
    const raw = await $fetch(endpoint(p), {
      ...(init as object),
      ...(method === "GET" ? { cache: "no-store" as RequestCache } : {}),
    } as any);
    return unwrapYardsaleData(raw) ?? raw;
  }

  function backendOrigin(): string {
    const raw = String(
      (config.public as { cmsApiBase?: string }).cmsApiBase || ""
    ).trim();
    if (/^https?:\/\//i.test(raw)) {
      return raw.replace(/\/api\/?$/i, "").replace(/\/$/, "") || "";
    }
    const explicit = String(
      (config.public as { yardsaleBackendOrigin?: string })
        .yardsaleBackendOrigin || ""
    ).trim();
    if (explicit) return explicit.replace(/\/$/, "");
    /** cmsApiBase แบบ `/yardsale-api` — รูป `/uploads` มักโยงผ่าน proxy ที่โฮสต์เดียวกับ Nuxt */
    if (
      import.meta.client &&
      typeof window !== "undefined" &&
      raw.startsWith("/")
    ) {
      return window.location.origin;
    }
    return "http://127.0.0.1:4000";
  }

  function resolveMediaUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    const u = String(url).trim();
    if (!u) return undefined;
    if (u.startsWith("//")) return `https:${u}`;
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("/")) return `${backendOrigin()}${u}`;
    return u;
  }

  function slugifyName(name: string): string {
    const s = String(name || "item").trim().toLowerCase();
    const out = s
      .replace(/[^a-z0-9\u0E00-\u0E7F]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    return out || "item";
  }

  function mapApiProductRow(row: Record<string, unknown> | null | undefined) {
    if (!row || typeof row !== "object") return row;
    const id = row.id as string;
    const img = resolveMediaUrl((row.image_url as string) || null);
    const rawGallery = Array.isArray(row.image_urls) ? row.image_urls : [];
    const galleryNodes = rawGallery
      .map((u) => resolveMediaUrl(String(u || '').trim()))
      .filter(Boolean)
      .map((sourceUrl) => ({ sourceUrl }));
    if (img && !galleryNodes.some((x) => x.sourceUrl === img)) {
      galleryNodes.unshift({ sourceUrl: img });
    }
    const priceNum = Number(row.price);
    const priceStr = Number.isFinite(priceNum) ? priceNum.toFixed(2) : "0";
    const regularNum = Number(row.regular_price ?? row.price);
    const saleCandidate =
      row.sale_price != null && row.sale_price !== ""
        ? Number(row.sale_price)
        : NaN;
    const hasSale =
      Number.isFinite(saleCandidate) &&
      saleCandidate > 0 &&
      Number.isFinite(regularNum) &&
      saleCandidate < regularNum;
    const regularPriceStr = Number.isFinite(regularNum)
      ? regularNum.toFixed(2)
      : priceStr;
    const salePriceStr = hasSale ? saleCandidate.toFixed(2) : null;
    const stock = Number(row.stock);
    const stockOk = Number.isFinite(stock) && stock > 0;
    const cancelled = row.is_cancelled === true;

    return {
      ...row,
      id,
      databaseId: id,
      sku: `YS-${String(id).replace(/-/g, "").slice(0, 12)}`,
      slug: slugifyName(String(row.name || "item")),
      name: row.name,
      description: row.description || "",
      regularPrice: regularPriceStr,
      salePrice: salePriceStr as string | null,
      stockQuantity: Number.isFinite(stock) ? stock : 0,
      stockStatus:
        !cancelled && stockOk ? "IN_STOCK" : "OUT_OF_STOCK",
      status: cancelled ? "cancelled" : "publish",
      image: img ? { sourceUrl: img } : galleryNodes[0],
      galleryImages: { nodes: galleryNodes },
      productTypes: { nodes: [] as unknown[] },
      variations: { nodes: [] as unknown[] },
      related: { nodes: [] as unknown[] },
      allPaStyle: { nodes: [] as unknown[] },
      allPaColor: { nodes: [] as unknown[] },
      productCategories: {
        nodes: row.category_name
          ? [
              {
                name: row.category_name,
                slug: row.category_slug || "",
              },
            ]
          : [],
      },
      __fromApi: true,
    };
  }

  /** path ภายในเว็บ (ยังไม่ผ่าน localePath) */
  function storefrontProductPath(product: {
    __fromApi?: boolean;
    databaseId?: string;
    id?: string;
    slug?: string;
    sku?: string;
  }): string {
    const id = product?.databaseId ?? product?.id;
    if (product?.__fromApi || isUuidString(String(id))) {
      return `/product/${id}`;
    }
    const skuPart = (product?.sku || "").split("-")[0] || product?.slug || "";
    return `/product/${product?.slug}-${skuPart}`;
  }

  return {
    hasRemoteApi,
    endpoint,
    fetchYardsale,
    unwrapYardsaleResponse,
    resolveMediaUrl,
    mapApiProductRow,
    backendOrigin,
    isUuidString,
    storefrontProductPath,
    isStorefrontPublishedProduct,
  };
}
