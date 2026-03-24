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

export async function createUser({ email, password, name, role: rawRole }) {
  const client = await pool.connect();
  try {
    let role = rawRole || 'user';
    if (role === 'customer') role = 'user';
    if (await userModel.emailExists(client, email)) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const row = await userModel.createUser(client, {
      email,
      passwordHash,
      name: name || '',
      role,
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
