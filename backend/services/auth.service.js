import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import * as userModel from '../models/user.model.js';
import { pool } from '../models/db.js';

const SALT_ROUNDS = 12;

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export async function login({ login, password }) {
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error('[auth] database connection failed:', e?.message || e);
    throw new AppError(
      'Database unavailable — check DATABASE_URL and that PostgreSQL is running',
      503,
      'DB_CONNECTION'
    );
  }
  try {
    const user = await userModel.findUserByEmail(client, login);
    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    if (user.account_status === 'block' || user.account_status === 'pending') {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    const token = signToken({
      id: String(user.id),
      role: String(user.role),
      email: String(user.email),
    });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        username: user.email,
      },
    };
  } finally {
    client.release();
  }
}

export async function createUser(
  { email, password, name, role: rawRole, account_status: rawStatus },
  { allowStatusField = false } = {}
) {
  const client = await pool.connect();
  try {
    let role = rawRole || 'user';
    if (role === 'customer') role = 'user';
    if (await userModel.emailExists(client, email)) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    let accountStatus = 'public';
    if (
      allowStatusField &&
      rawStatus != null &&
      String(rawStatus).trim() !== '' &&
      ['public', 'pending', 'block'].includes(String(rawStatus))
    ) {
      accountStatus = String(rawStatus);
    }
    const row = await userModel.createUser(client, {
      email,
      passwordHash,
      name: name || '',
      role,
      accountStatus,
    });
    const token = signToken({ id: row.id, role: row.role, email: row.email });
    return {
      token,
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        username: row.email,
        account_status: row.account_status,
      },
    };
  } finally {
    client.release();
  }
}

export async function getMe(userId) {
  const client = await pool.connect();
  try {
    const user = await userModel.findUserById(client, userId);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        username: user.email,
        account_status: user.account_status,
      },
    };
  } finally {
    client.release();
  }
}

export async function checkEmail(email) {
  const client = await pool.connect();
  try {
    const exists = await userModel.emailExists(client, email);
    return { available: !exists, exists };
  } finally {
    client.release();
  }
}

export async function listUsersForAdmin({ limit, offset } = {}) {
  const client = await pool.connect();
  try {
    const users = await userModel.listUsers(client, { limit, offset });
    return { users };
  } finally {
    client.release();
  }
}

export async function adminUpdateUser(actorId, targetId, body) {
  const client = await pool.connect();
  try {
    let { email, name, role, account_status, password } = body;
    if (role === 'customer') role = 'user';

    const target = await userModel.findUserById(client, targetId);
    if (!target) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    if (String(actorId) === String(targetId)) {
      if (account_status === 'block' || account_status === 'pending') {
        throw new AppError('Cannot set your own account to pending or blocked', 400, 'FORBIDDEN_SELF');
      }
    }

    if (role !== undefined && role !== 'admin' && target.role === 'admin') {
      const admins = await userModel.countAdmins(client);
      if (admins <= 1) {
        throw new AppError('Cannot demote the last admin', 400, 'LAST_ADMIN');
      }
    }

    if (email !== undefined && email !== target.email) {
      if (await userModel.emailExists(client, email, targetId)) {
        throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
      }
    }

    const updates = {};
    if (email !== undefined) updates.email = email;
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (account_status !== undefined) updates.accountStatus = account_status;
    if (password) {
      updates.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const row = await userModel.updateUserById(client, targetId, updates);
    if (!row) {
      throw new AppError('No changes to apply', 400, 'NO_CHANGES');
    }

    return {
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        username: row.email,
        account_status: row.account_status,
        created_at: row.created_at,
      },
    };
  } finally {
    client.release();
  }
}

export async function adminDeleteUser(actorId, targetId) {
  if (String(actorId) === String(targetId)) {
    throw new AppError('Cannot delete your own account', 400, 'FORBIDDEN_SELF');
  }
  const client = await pool.connect();
  try {
    const target = await userModel.findUserById(client, targetId);
    if (!target) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    if (target.role === 'admin') {
      const admins = await userModel.countAdmins(client);
      if (admins <= 1) {
        throw new AppError('Cannot delete the last admin', 400, 'LAST_ADMIN');
      }
    }
    const orders = await userModel.countOrdersForUser(client, targetId);
    const products = await userModel.countProductsForSeller(client, targetId);
    if (orders > 0 || products > 0) {
      throw new AppError(
        'User has orders or listed products; remove or reassign them first',
        409,
        'USER_HAS_DATA'
      );
    }
    const ok = await userModel.deleteUserById(client, targetId);
    if (!ok) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    return { deleted: true };
  } finally {
    client.release();
  }
}
