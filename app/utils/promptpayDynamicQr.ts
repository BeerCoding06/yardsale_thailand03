/**
 * สร้าง data URL ของ QR พร้อมเพย์ (EMVCo) ฝั่ง client — ใช้เมื่อตั้ง NUXT_PUBLIC_PROMPTPAY_ID
 */
export async function buildPromptPayQrDataUrl(
  idRaw: string,
  options?: { amount?: number }
): Promise<string | null> {
  const id = String(idRaw || "")
    .replace(/[\s-]/g, "")
    .trim();
  if (!id) return null;

  try {
    const { default: generatePayload } = await import("promptpay-qr");
    const QRCode = await import("qrcode");

    const amt = options?.amount;
    const withAmount =
      amt != null && Number.isFinite(amt) && amt > 0 ? { amount: amt } : undefined;

    const payload = generatePayload(id, withAmount);

    return await QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch (err) {
    console.error("[promptpay] QR generation failed:", err);
    return null;
  }
}
