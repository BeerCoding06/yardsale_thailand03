/**
 * บริบท iOS / PWA สำหรับ FCM Web Push
 * - iOS 16.4+ รองรับ Web Push หลัก ๆ เมื่อเปิดจากแอปที่เพิ่มไปหน้าจอโฮม (standalone)
 * - ในแท็บ Safari/Chrome บน iPhone ไม่ควรลงทะเบียน FCM (ไม่เสถียร / ไม่รองรับเส้นทางมาตรฐาน)
 */

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1) {
    return true;
  }
  return false;
}

/** เปิดจากไอคอนหน้าจอโฮม (PWA) */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  } catch {
    /* ignore */
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/** บน iPhone/iPad ในเบราว์เซอร์ — ไม่ลงทะเบียน FCM จนกว่าจะเป็น standalone */
export function iosFcmBlockedOutsideStandalone(): boolean {
  return isIOSDevice() && !isStandaloneDisplayMode();
}

/** Safari เดสก์ท็อป (ไม่รวม iOS) — มักต้องขอสิทธิ์หลัง user gesture */
export function isDesktopSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return false;
  if ((navigator.platform === "MacIntel" || navigator.platform === "MacPPC") && (navigator.maxTouchPoints ?? 0) > 1) {
    return false;
  }
  return /^((?!chrome|android|chromium|edg).)*safari/i.test(ua);
}
