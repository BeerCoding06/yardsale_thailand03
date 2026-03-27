/**
 * เลขพร้อมเพย์: รองรับ 081... และรูปแบบ +66 / 66 มือถือไทย
 * (เลขนิติ 13 หลักส่งตรงได้ — ไลบรารีจะใช้ BOT_ID ถูกต้อง)
 */
export function normalizePromptPayId(idRaw: string): string {
  let s = String(idRaw || "").replace(/\D/g, "");
  /* +66 มือถือไทย → 0xxxxxxxxx (ไม่แตะเลขนิติ 13 หลักที่เหลือเป็น 11 หลักหลัง 66) */
  if (s.startsWith("66")) {
    const rest = s.slice(2);
    if (rest.length === 9 || rest.length === 10) {
      s = `0${rest}`;
    }
  }
  return s;
}

/**
 * สร้าง data URL ของ QR พร้อมเพย์ (EMVCo) ฝั่ง client — ใช้เมื่อตั้ง NUXT_PUBLIC_PROMPTPAY_ID
 *
 * หมายเหตุ: การฝังยอด (amount) ทำให้ payload เป็นโหมด Dynamic (POI 12) บางแอปธนาคารสแกนไม่ได้
 * — ถ้าสแกนไม่ผ่านให้ปิดการฝังยอด (NUXT_PUBLIC_PROMPTPAY_QR_INCLUDE_AMOUNT)
 */
export async function buildPromptPayQrDataUrl(
  idRaw: string,
  options?: { amount?: number }
): Promise<string | null> {
  const id = normalizePromptPayId(idRaw);
  if (!id) return null;

  try {
    const { default: generatePayload } = await import("promptpay-qr");
    const QRCode = await import("qrcode");

    const amt = options?.amount;
    const withAmount =
      amt != null && Number.isFinite(amt) && amt > 0 ? { amount: amt } : undefined;

    const payload = generatePayload(id, withAmount);

    return await QRCode.toDataURL(payload, {
      width: 320,
      margin: 3,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch (err) {
    console.error("[promptpay] QR generation failed:", err);
    return null;
  }
}
