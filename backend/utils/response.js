export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

/** GET ออเดอร์ — กัน CDN/พร็อกซีแคช body เก่า (ชำระแล้วแต่ get-order ยัง pending) */
export function sendSuccessNoStore(res, data, status = 200) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  return res.status(status).json({ success: true, data });
}

export function sendError(res, message, status = 400, code = 'ERROR') {
  return res.status(status).json({
    success: false,
    error: { message, code },
  });
}
