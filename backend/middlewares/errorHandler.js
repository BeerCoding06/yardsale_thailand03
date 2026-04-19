import { config } from '../config/index.js';

export function errorHandler(err, req, res, next) {
  if (err?.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: { message: err.message, code: 'UPLOAD_ERROR' },
    });
  }
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  if (config.nodeEnv !== 'production' && err.stack) {
    console.error(err.stack);
  } else if (status >= 500) {
    /** production: ไม่ส่งรายละเอียดไป client แต่ log เต็มไว้ดูบนเซิร์ฟเวอร์ */
    console.error('[http]', status, code, message);
    if (err?.stack) console.error(err.stack);
  }

  res.status(status).json({
    success: false,
    error: {
      message: status === 500 && config.nodeEnv === 'production' ? 'Internal Server Error' : message,
      code,
    },
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { message: `Not found: ${req.method} ${req.path}`, code: 'NOT_FOUND' },
  });
}
