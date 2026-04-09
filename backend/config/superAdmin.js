/**
 * Super admin: บัญชีที่อีเมลตรงรายการนี้ — แก้ไขได้เฉพาะเมื่อล็อกอินเป็นบัญชีนั้นเอง
 * ผู้แอดมินคนอื่น PATCH/DELETE ไม่ได้
 *
 * ตั้งค่า: SUPER_ADMIN_EMAILS (คั่นด้วย comma) หรือใช้ค่าเริ่มต้นด้านล่าง
 */
const DEFAULT_SUPER_ADMIN = 'paradon.pokpingmaung@gmail.com';

function parseList(raw) {
  const s = raw != null && String(raw).trim() !== '' ? String(raw) : DEFAULT_SUPER_ADMIN;
  return s
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

const _set = new Set(parseList(process.env.SUPER_ADMIN_EMAILS));

export function getSuperAdminEmails() {
  return [..._set];
}

export function isSuperAdminEmail(email) {
  if (email == null || email === '') return false;
  return _set.has(String(email).trim().toLowerCase());
}
