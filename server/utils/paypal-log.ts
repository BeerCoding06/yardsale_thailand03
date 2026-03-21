/**
 * PayPal operational logs → stdout (Docker / Dokploy "Logs" tab)
 * ไม่ log secret / token / ร่างเต็มของ response จาก PayPal
 *
 * เปิดใน Dokploy: Environment → PAYPAL_LOG=1
 */

function paypalLogEnabled(): boolean {
  const v = String(process.env.PAYPAL_LOG || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

type PayPalLogFields = Record<string, string | number | boolean | null | undefined>;

export function paypalLogEvent(event: string, fields: PayPalLogFields = {}): void {
  if (!paypalLogEnabled()) return;
  const payload = {
    service: 'yardsale_paypal',
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  console.log(JSON.stringify(payload));
}

/** เรียกเมื่อเกิด error จาก PayPal / WP — แสดงใน Dokploy แม้ไม่เปิด PAYPAL_LOG (ระดับ error) */
export function paypalLogError(event: string, message: string, fields: PayPalLogFields = {}): void {
  const payload = {
    service: 'yardsale_paypal',
    level: 'error',
    event,
    message: message.slice(0, 500),
    ts: new Date().toISOString(),
    ...fields,
  };
  console.error(JSON.stringify(payload));
}

/** แจ้งเตือนที่ควรเห็นใน Dokploy แม้ไม่เปิด PAYPAL_LOG */
export function paypalLogWarn(event: string, message: string, fields: PayPalLogFields = {}): void {
  const payload = {
    service: 'yardsale_paypal',
    level: 'warn',
    event,
    message: message.slice(0, 500),
    ts: new Date().toISOString(),
    ...fields,
  };
  console.warn(JSON.stringify(payload));
}
