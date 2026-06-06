function normalizeCourierHint(name: string | null | undefined): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isThailandPostBarcode(tn: string): boolean {
  return /^[A-Z]{2}\d{9}TH$/i.test(tn);
}

function carrierLabel(trackingNumber: string, courierName?: string | null): string | undefined {
  const tn = trackingNumber.trim().toUpperCase();
  const hint = normalizeCourierHint(courierName);
  if (isThailandPostBarcode(tn)) return "Thailand Post";
  if (/\bdhl\b/.test(hint) || /^JD\d{18,22}$/i.test(tn)) return "DHL";
  if (/\bfedex\b/.test(hint)) return "FedEx";
  if (/\bflash\b|\bflashexpress\b/.test(hint) || /^TH[A-Z0-9]{11,13}$/i.test(tn)) return "Flash Express";
  if (/\bj\s*&?\s*t\b|\bjt\b/.test(hint) || /^JT[A-Z0-9]{10,18}$/i.test(tn)) return "J&T Express";
  if (/\bkerry\b|\bkex\b/.test(hint) || /^KEX[A-Z0-9]{8,20}$/i.test(tn)) return "Kerry Express";
  return undefined;
}

/** Public tracking page URL for a carrier + tracking number. */
export function courierTrackingUrl(
  trackingNumber: string,
  courierName?: string | null
): string | null {
  const tn = encodeURIComponent(String(trackingNumber || "").trim());
  if (!tn) return null;

  const label = carrierLabel(trackingNumber, courierName);
  switch (label) {
    case "Thailand Post":
      return `https://track.thailandpost.co.th/?trackNumber=${tn}`;
    case "Flash Express":
      return `https://www.flashexpress.co.th/tracking/?se=${tn}`;
    case "J&T Express":
      return `https://jtexpress.co.th/track?billcode=${tn}`;
    case "Kerry Express":
      return `https://th.kerryexpress.com/th/track/?track=${tn}`;
    case "DHL":
      return `https://www.dhl.com/th-th/home/tracking.html?tracking-id=${tn}&submit=1`;
    case "FedEx":
      return `https://www.fedex.com/fedextrack/?trknbr=${tn}`;
    default:
      return `https://t.17track.net/en#nums=${tn}`;
  }
}
