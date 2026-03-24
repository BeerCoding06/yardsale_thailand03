import { authMiddleware, requireRoles } from './authMiddleware.js';

/**
 * Public may create only `user` role. Creating seller/admin requires JWT + admin.
 * Normalizes legacy `customer` → `user` before the controller runs.
 */
export function createUserAccess(req, res, next) {
  let role = req.body.role ?? 'user';
  if (role === 'customer') role = 'user';
  req.body.role = role;

  if (role === 'seller' || role === 'admin') {
    return authMiddleware(req, res, (err) => {
      if (err) return next(err);
      return requireRoles('admin')(req, res, next);
    });
  }
  next();
}
