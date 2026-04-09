/**
 * @param {Record<string, unknown>} query — req.query
 * @param {{ defaultPageSize?: number, maxPageSize?: number }} [opts]
 */
export function parsePaginationQuery(query, { defaultPageSize = 20, maxPageSize = 100 } = {}) {
  const page = Math.max(1, parseInt(String(query?.page ?? '1'), 10) || 1);
  let pageSize = parseInt(String(query?.page_size ?? query?.pageSize ?? ''), 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  pageSize = Math.min(Math.max(pageSize, 1), maxPageSize);
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

/** ค่าสำหรับ ILIKE ... ESCAPE '\' */
export function ilikeContainsPattern(raw) {
  const s = String(raw ?? '').trim().slice(0, 200);
  if (!s) return null;
  const escaped = s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return `%${escaped}%`;
}

export function parseSearchQuery(query) {
  const q = query?.q ?? query?.search;
  if (q == null || q === '') return '';
  return String(q).trim().slice(0, 200);
}

export function paginationMeta({ page, pageSize, total }) {
  const t = Number(total) || 0;
  const ps = Number(pageSize) || 1;
  return {
    page,
    page_size: pageSize,
    total: t,
    total_pages: t === 0 ? 0 : Math.ceil(t / ps),
  };
}
