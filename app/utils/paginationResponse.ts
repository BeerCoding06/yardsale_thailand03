/** ดึง meta จาก API ที่คืน pagination (Express / mock) */
export type PaginationMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export function pickPagination(payload: unknown): PaginationMeta | null {
  if (!payload || typeof payload !== "object") return null;
  const p = (payload as Record<string, unknown>).pagination;
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const page = Number(o.page);
  const page_size = Number(o.page_size ?? o.pageSize);
  const total = Number(o.total);
  const total_pages = Number(o.total_pages ?? o.totalPages);
  if (!Number.isFinite(page) || !Number.isFinite(page_size)) return null;
  return {
    page,
    page_size,
    total: Number.isFinite(total) ? total : 0,
    total_pages: Number.isFinite(total_pages) ? total_pages : 0,
  };
}

export function paginationQuery(page: number, q: string, pageSize = 20) {
  const query: Record<string, string | number> = {
    page,
    page_size: pageSize,
  };
  const s = String(q || "").trim();
  if (s) query.q = s;
  return query;
}
