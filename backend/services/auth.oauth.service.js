import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../models/db.js';
import * as userModel from '../models/user.model.js';
import * as oauthIdentityModel from '../models/oauthIdentity.model.js';
import { signToken, login as emailPasswordLogin, createUser as createEmailUser } from './auth.service.js';

function buildPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    role: row.role,
    username: row.email,
    account_status: row.account_status,
    avatar: row.avatar || null,
    auth_provider: row.auth_provider || 'email',
  };
}

function signRefreshToken(userId) {
  return jwt.sign(
    { sub: String(userId), typ: 'refresh' },
    config.oauth.jwtRefreshSecret,
    { expiresIn: config.oauth.refreshExpiresIn }
  );
}

export function verifyRefreshTokenOrThrow(refreshToken) {
  try {
    const p = jwt.verify(refreshToken, config.oauth.jwtRefreshSecret);
    if (p.typ !== 'refresh' || !p.sub) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH');
    }
    return String(p.sub);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH');
  }
}

export async function issueAccessAndRefreshForUserId(userId) {
  const client = await pool.connect();
  try {
    const row = await userModel.findUserById(client, userId);
    if (!row) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    if (row.account_status === 'block' || row.account_status === 'pending') {
      throw new AppError('Account is suspended or pending approval', 403, 'ACCOUNT_DISABLED');
    }
    const accessToken = signToken({
      id: String(row.id),
      role: String(row.role),
      email: String(row.email),
    });
    const refreshToken = signRefreshToken(row.id);
    return {
      token: accessToken,
      refreshToken,
      user: buildPublicUser(row),
    };
  } finally {
    client.release();
  }
}

export async function issueAccessAndRefreshForRow(row) {
  if (!row) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  const accessToken = signToken({
    id: String(row.id),
    role: String(row.role),
    email: String(row.email),
  });
  const refreshToken = signRefreshToken(row.id);
  return {
    token: accessToken,
    refreshToken,
    user: buildPublicUser(row),
  };
}

function syntheticEmail(provider, subject) {
  const s = String(subject).replace(/[^a-zA-Z0-9._+-]/g, '_').slice(0, 120);
  return `${provider}_${s}@${provider}.oauth.local`;
}

/**
 * Find or create user from OAuth profile; link by (provider, subject) or same verified email.
 */
export async function findOrCreateOAuthUser({ provider, providerUserId, email, name, avatar }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let userId = await oauthIdentityModel.findUserIdByProviderSubject(
      client,
      provider,
      providerUserId
    );
    let row = null;
    if (userId) {
      row = await userModel.findUserById(client, userId);
    } else {
      const cleanEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
      const resolvedEmail = cleanEmail || syntheticEmail(provider, providerUserId);
      if (cleanEmail) {
        row = await userModel.findUserByEmail(client, cleanEmail);
      }
      if (row) {
        await oauthIdentityModel.upsertIdentity(client, row.id, provider, providerUserId);
        const patch = {};
        if (avatar && !row.avatar) patch.avatar = avatar;
        if (name && String(name).trim() && (!row.name || !String(row.name).trim())) {
          patch.name = String(name).trim();
        }
        if (Object.keys(patch).length) {
          const updated = await userModel.updateUserById(client, row.id, patch);
          if (updated) row = updated;
        }
      } else {
        row = await userModel.createUser(client, {
          email: resolvedEmail,
          passwordHash: null,
          name: (name && String(name).trim()) || resolvedEmail.split('@')[0] || 'User',
          role: 'user',
          accountStatus: 'public',
          authProvider: provider,
        });
        await oauthIdentityModel.upsertIdentity(client, row.id, provider, providerUserId);
        if (avatar) {
          const updated = await userModel.updateUserById(client, row.id, { avatar });
          if (updated) row = updated;
        }
      }
    }

    if (!row) {
      await client.query('ROLLBACK');
      throw new AppError('Could not resolve user', 500, 'OAUTH_USER_FAILED');
    }
    if (row.account_status === 'block' || row.account_status === 'pending') {
      await client.query('ROLLBACK');
      throw new AppError('Account is suspended or pending approval', 403, 'ACCOUNT_DISABLED');
    }

    if (avatar && !row.avatar) {
      const updated = await userModel.updateUserById(client, row.id, { avatar });
      if (updated) row = updated;
    }

    await client.query('COMMIT');
    return issueAccessAndRefreshForRow(row);
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function registerEmailWithRefresh({ email, password, name }) {
  const out = await createEmailUser(
    { email, password, name: name || '', role: 'user' },
    { allowStatusField: false }
  );
  const tokens = await issueAccessAndRefreshForUserId(out.user.id);
  return { ...tokens, user: { ...out.user, ...tokens.user } };
}

export async function loginEmailWithRefresh({ login, password }) {
  const out = await emailPasswordLogin({ login, password });
  const tokens = await issueAccessAndRefreshForUserId(out.user.id);
  return { ...tokens, user: { ...out.user, ...tokens.user } };
}

export async function refreshAccessToken(refreshToken) {
  const sub = verifyRefreshTokenOrThrow(refreshToken);
  return issueAccessAndRefreshForUserId(sub);
}
