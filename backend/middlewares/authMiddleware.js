import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../models/db.js';
import * as userModel from '../models/user.model.js';

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
  }
  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    return next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
  }

  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error('[auth] pool.connect failed', e?.code, e?.message);
    return next(
      new AppError('Service temporarily unavailable. Please try again.', 503, 'DB_UNAVAILABLE')
    );
  }
  try {
    const status = await userModel.getUserAccountStatus(client, payload.sub);
    if (status == null) {
      return next(new AppError('User not found', 401, 'UNAUTHORIZED'));
    }
    if (status === 'block' || status === 'pending') {
      return next(new AppError('Account is suspended or pending approval', 403, 'ACCOUNT_DISABLED'));
    }
  } catch (e) {
    if (e instanceof AppError) return next(e);
    console.error('[auth] getUserAccountStatus failed', e?.code, e?.message);
    return next(
      new AppError('Service temporarily unavailable. Please try again.', 503, 'DB_UNAVAILABLE')
    );
  } finally {
    client.release();
  }

  req.user = {
    id: payload.sub,
    role: payload.role,
    email: payload.email,
  };
  next();
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
  } catch {
    /* ignore */
  }
  next();
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }
    next();
  };
}
