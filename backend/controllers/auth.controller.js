import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as authService from '../services/auth.service.js';

export const login = asyncHandler(async (req, res) => {
  const loginId = req.body.email || req.body.username;
  const result = await authService.login({ login: loginId, password: req.body.password });
  sendSuccess(res, result);
});

export const createUser = asyncHandler(async (req, res) => {
  const name = req.body.name || req.body.username || '';
  const result = await authService.createUser({
    email: req.body.email,
    password: req.body.password,
    name,
    role: req.body.role,
  });
  sendSuccess(res, { ...result, id: result.user.id, message: 'User created' }, 201);
});

export const me = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user.id);
  sendSuccess(res, result);
});

export const checkEmail = asyncHandler(async (req, res) => {
  const result = await authService.checkEmail(req.body.email);
  sendSuccess(res, result);
});

export const adminListUsers = asyncHandler(async (req, res) => {
  const limit = req.query.limit;
  const offset = req.query.offset;
  const result = await authService.listUsersForAdmin({ limit, offset });
  sendSuccess(res, { success: true, ...result });
});
