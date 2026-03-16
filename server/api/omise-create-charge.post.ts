// server/api/omise-create-charge.post.ts
// สร้าง Omise Charge แบบ PromptPay (test) หลังสร้างออเดอร์แล้ว – คืน authorize_uri ให้ redirect ไปชำระ

const OMISE_API = 'https://api.omise.co';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) as { order_id: number; amount_thb: number; return_uri?: string };
    const order_id = body?.order_id;
    const amount_thb = Number(body?.amount_thb) || 0;
    const config = useRuntimeConfig();
    const secretKey = config.omiseSecretKey || process.env.OMISE_SECRET_KEY;
    const publicKey = config.omisePublicKey || process.env.OMISE_PUBLIC_KEY;

    if (!secretKey) {
      throw createError({
        statusCode: 500,
        message: 'OMISE_SECRET_KEY is not configured',
      });
    }
    if (!publicKey) {
      throw createError({
        statusCode: 500,
        message: 'OMISE_PUBLIC_KEY is not configured',
      });
    }
    if (!order_id || amount_thb < 1) {
      throw createError({
        statusCode: 400,
        message: 'order_id and amount_thb (min 1) are required',
      });
    }
    // ขั้นต่ำ PromptPay 20 บาท = 2000 satang
    const amount_satang = Math.round(amount_thb * 100);
    if (amount_satang < 2000) {
      throw createError({
        statusCode: 400,
        message: 'PromptPay minimum is 20 THB',
      });
    }

    const baseUrl = config.public?.baseUrl || 'https://www.yardsaleth.com';
    const return_uri = body.return_uri || `${baseUrl}/payment-successful?order_id=${order_id}`;

    const authSecret = Buffer.from(secretKey + ':', 'utf8').toString('base64');
    const authPublic = Buffer.from(publicKey + ':', 'utf8').toString('base64');

    // 1) Create Source (PromptPay) – ใช้ public key
    const sourceRes = await fetch(`${OMISE_API}/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + authPublic,
      },
      body: JSON.stringify({
        amount: amount_satang,
        currency: 'thb',
        type: 'promptpay',
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!sourceRes.ok) {
      const errText = await sourceRes.text();
      console.error('[omise-create-charge] Source error:', sourceRes.status, errText);
      throw createError({
        statusCode: 502,
        message: 'Omise source failed: ' + (JSON.parse(errText)?.message || errText),
      });
    }
    const source = await sourceRes.json();
    const sourceId = source.id;
    if (!sourceId) {
      throw createError({ statusCode: 502, message: 'Omise source missing id' });
    }

    // 2) Create Charge with source + metadata (order_id for webhook) – ใช้ secret key
    const chargeRes = await fetch(`${OMISE_API}/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + authSecret,
      },
      body: JSON.stringify({
        amount: amount_satang,
        currency: 'thb',
        source: sourceId,
        return_uri,
        metadata: { order_id: String(order_id) },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!chargeRes.ok) {
      const errText = await chargeRes.text();
      console.error('[omise-create-charge] Charge error:', chargeRes.status, errText);
      throw createError({
        statusCode: 502,
        message: 'Omise charge failed: ' + (JSON.parse(errText)?.message || errText),
      });
    }
    const charge = await chargeRes.json();
    const authorize_uri = charge.authorize_uri;
    const charge_id = charge.id;

    // ตอนสร้าง charge Omise คืน source แค่ id (string) ไม่ expand — ต้อง GET charge อีกครั้งเพื่อดึง source.scannable_code
    let qrImageUri: string | null = null;
    let scannableCodeRaw: string | null = typeof source.scannable_code === 'string' ? source.scannable_code : null;
    const sourceFromCharge = charge.source;
    const scannable = typeof sourceFromCharge === 'object' && sourceFromCharge?.scannable_code;
    if (scannable?.image?.download_uri) {
      qrImageUri = scannable.image.download_uri;
    }
    if (!qrImageUri && charge_id) {
      try {
        const getRes = await fetch(`${OMISE_API}/charges/${charge_id}?expand[]=source`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + authSecret },
          signal: AbortSignal.timeout(10000),
        });
        if (getRes.ok) {
          const fullCharge = await getRes.json();
          const fullSource = fullCharge.source;
          const fullScannable = typeof fullSource === 'object' && fullSource?.scannable_code;
          if (fullScannable?.image?.download_uri) {
            qrImageUri = fullScannable.image.download_uri;
          }
          if (!scannableCodeRaw && typeof fullScannable?.raw_data === 'string') {
            scannableCodeRaw = fullScannable.raw_data;
          }
        }
      } catch (e) {
        console.warn('[omise-create-charge] GET charge for QR failed:', (e as Error)?.message);
      }
    }

    return {
      success: true,
      charge_id,
      authorize_uri: authorize_uri || null,
      scannable_code: scannableCodeRaw || null,
      qr_image_uri: qrImageUri || null,
      amount_thb,
      order_id,
    };
  } catch (e: any) {
    if (e?.statusCode) throw e;
    console.error('[omise-create-charge] Error:', e?.message || e);
    throw createError({
      statusCode: 500,
      message: e?.message || 'Failed to create Omise charge',
    });
  }
});
