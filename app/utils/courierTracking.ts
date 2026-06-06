function normalizeCourierHint(name: string | null | undefined): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isThailandPostBarcode(tn: string): boolean {
  return /^[A-Z]{2}\d{9}TH$/i.test(tn);
}

function isFlashExpress(tn: string, hint: string): boolean {
  if (/^TH[A-Z0-9]{11,13}$/i.test(tn)) return true;
  return /\bflash\b|\bflashexpress\b|\bฟลาช\b/.test(hint);
}

function isJtExpress(tn: string, hint: string): boolean {
  if (/^JT[A-Z0-9]{10,18}$/i.test(tn)) return true;
  if (/^52\d{10,14}$/.test(tn)) return true;
  return /\bj\s*&?\s*t\b|\bjt\s*express\b|\bจิ\s*&?\s*ที\b|\bเจ\s*&?\s*ที\b/.test(hint);
}

function isKerryExpress(tn: string, hint: string): boolean {
  if (/^KEX[A-Z0-9]{8,20}$/i.test(tn)) return true;
  if (/^SHP[A-Z0-9]{10,16}$/i.test(tn)) return true;
  if (/^[A-Z]{4}\d{10}TH$/i.test(tn) && /\bkerry\b|\bkex\b/.test(hint)) return true;
  return /\bkerry\b|\bkex\b|\bkerry\s*express\b|\bเคอรี่\b/.test(hint);
}

function isDhlExpress(tn: string, hint: string): boolean {
  if (/^JD\d{18,22}$/i.test(tn)) return true;
  if (/^GM\d{10,}$/i.test(tn)) return true;
  if (/^\d{10,11}$/.test(tn) && /\bdhl\b/.test(hint)) return true;
  return /\bdhl\b|\bdhl\s*express\b/.test(hint);
}

function isFedEx(tn: string, hint: string): boolean {
  if (/^\d{12,15}$/.test(tn) && /\bfedex\b|\bfederal\s*express\b/.test(hint)) return true;
  return /\bfedex\b|\bfederal\s*express\b/.test(hint);
}

type TrackingProvider =
  | "thailand_post"
  | "scrape_flash"
  | "scrape_jt"
  | "scrape_kerry"
  | "17track"
  | "unknown";

function resolveTrackingProvider(trackingNumber: string, courierName?: string | null): {
  provider: TrackingProvider;
  carrierLabel?: string;
} {
  const tn = String(trackingNumber || "")
    .trim()
    .toUpperCase();
  const hint = normalizeCourierHint(courierName);
  if (!tn) return { provider: "unknown" };

  if (isThailandPostBarcode(tn)) return { provider: "thailand_post", carrierLabel: "Thailand Post" };
  if (isDhlExpress(tn, hint)) return { provider: "17track", carrierLabel: "DHL" };
  if (isFedEx(tn, hint)) return { provider: "17track", carrierLabel: "FedEx" };
  if (isFlashExpress(tn, hint)) return { provider: "scrape_flash", carrierLabel: "Flash Express" };
  if (isJtExpress(tn, hint)) return { provider: "scrape_jt", carrierLabel: "J&T Express" };
  if (isKerryExpress(tn, hint)) return { provider: "scrape_kerry", carrierLabel: "Kerry Express" };

  if (/\bflash\b|\bflashexpress\b/.test(hint)) return { provider: "scrape_flash", carrierLabel: "Flash Express" };
  if (/\bj\s*&?\s*t\b|\bjt\b/.test(hint)) return { provider: "scrape_jt", carrierLabel: "J&T Express" };
  if (/\bkerry\b|\bkex\b/.test(hint)) return { provider: "scrape_kerry", carrierLabel: "Kerry Express" };
  if (/\bdhl\b/.test(hint)) return { provider: "17track", carrierLabel: "DHL" };
  if (/\bfedex\b/.test(hint)) return { provider: "17track", carrierLabel: "FedEx" };

  return { provider: "unknown" };
}

/** Public tracking page URL for a carrier + tracking number. */
export function courierTrackingUrl(
  trackingNumber: string,
  courierName?: string | null
): string | null {
  const tn = encodeURIComponent(String(trackingNumber || "").trim());
  if (!tn) return null;
  const route = resolveTrackingProvider(trackingNumber, courierName);
  switch (route.provider) {
    case "thailand_post":
      return `https://track.thailandpost.co.th/?trackNumber=${tn}`;
    case "scrape_flash":
      return `https://www.flashexpress.co.th/tracking/?se=${tn}`;
    case "scrape_jt":
      return `https://jtexpress.co.th/track?billcode=${tn}`;
    case "scrape_kerry":
      return `https://th.kerryexpress.com/th/track/?track=${tn}`;
    case "17track":
      if (route.carrierLabel === "DHL") {
        return `https://www.dhl.com/th-th/home/tracking.html?tracking-id=${tn}&submit=1`;
      }
      if (route.carrierLabel === "FedEx") {
        return `https://www.fedex.com/fedextrack/?trknbr=${tn}`;
      }
      return null;
    default:
      return null;
  }
}
