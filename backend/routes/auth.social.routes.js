import { Router } from 'express';
import crypto from 'crypto';
import passport from 'passport';
import { config } from '../config/index.js';
import {
  oauthFacebookConfigured,
  oauthGoogleConfigured,
  oauthLineConfigured,
} from '../config/passport.config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { validate } from '../middlewares/validate.js';
import {
  authEmailRegisterSchema,
  authEmailLoginBodySchema,
  authRefreshBodySchema,
} from '../validators/schemas.js';
import * as authOAuthService from '../services/auth.oauth.service.js';

const router = Router();

function redirectWithTokens(res, { token, refreshToken }) {
  const u = new URL(config.oauth.frontendSuccessUrl);
  u.searchParams.set('token', token);
  u.searchParams.set('refresh', refreshToken);
  res.redirect(u.toString());
}

function redirectOAuthFailure(res, message = '') {
  const raw = config.oauth.frontendFailureUrl || config.oauth.frontendSuccessUrl;
  const u = new URL(raw.split('#')[0]);
  u.searchParams.set('error', 'oauth_failed');
  if (message) u.searchParams.set('error_description', String(message).slice(0, 500));
  res.redirect(u.toString());
}

router.post(
  '/email/register',
  validate(authEmailRegisterSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;
    const out = await authOAuthService.registerEmailWithRefresh({ email, password, name });
    sendSuccess(res, out, 201);
  })
);

router.post(
  '/email/login',
  validate(authEmailLoginBodySchema),
  asyncHandler(async (req, res) => {
    const login = req.body.email || req.body.username;
    const out = await authOAuthService.loginEmailWithRefresh({
      login,
      password: req.body.password,
    });
    sendSuccess(res, out);
  })
);

router.post(
  '/refresh',
  validate(authRefreshBodySchema),
  asyncHandler(async (req, res) => {
    const out = await authOAuthService.refreshAccessToken(req.body.refreshToken);
    sendSuccess(res, out);
  })
);

router.post('/logout', (_req, res) => {
  sendSuccess(res, { ok: true, message: 'Client should discard tokens' });
});

router.get('/google', (req, res, next) => {
  if (!oauthGoogleConfigured()) {
    return sendError(res, 'Google OAuth not configured', 501, 'NOT_CONFIGURED');
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!oauthGoogleConfigured()) {
    return sendError(res, 'Google OAuth not configured', 501, 'NOT_CONFIGURED');
  }
  passport.authenticate('google', { session: false }, (err, tokens) => {
    if (err) return redirectOAuthFailure(res, err.message || 'google');
    if (!tokens?.token) return redirectOAuthFailure(res, 'auth_failed');
    redirectWithTokens(res, tokens);
  })(req, res, next);
});

router.get('/facebook', (req, res, next) => {
  if (!oauthFacebookConfigured()) {
    return sendError(res, 'Facebook OAuth not configured', 501, 'NOT_CONFIGURED');
  }
  passport.authenticate('facebook', {
    /* ห้ามขอแค่ email — Meta จะขึ้น Invalid Scopes; ต้องมี public_profile */
    scope: ['public_profile', 'email'],
    session: false,
  })(req, res, next);
});

router.get('/facebook/callback', (req, res, next) => {
  if (!oauthFacebookConfigured()) {
    return sendError(res, 'Facebook OAuth not configured', 501, 'NOT_CONFIGURED');
  }
  passport.authenticate('facebook', { session: false }, (err, tokens) => {
    if (err) return redirectOAuthFailure(res, err.message || 'facebook');
    if (!tokens?.token) return redirectOAuthFailure(res, 'auth_failed');
    redirectWithTokens(res, tokens);
  })(req, res, next);
});

router.get('/line', (req, res) => {
  if (!oauthLineConfigured()) {
    return sendError(res, 'LINE Login not configured', 501, 'NOT_CONFIGURED');
  }
  const state = crypto.randomBytes(24).toString('hex');
  req.session.lineOAuthState = state;
  const redirectUri = `${config.oauth.callbackBase.replace(/\/$/, '')}/auth/line/callback`;
  const url = new URL('https://access.line.me/oauth2/v2.1/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.oauth.line.channelId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'openid profile email');
  res.redirect(url.toString());
});

router.get('/line/callback', async (req, res) => {
  if (!oauthLineConfigured()) {
    return sendError(res, 'LINE Login not configured', 501, 'NOT_CONFIGURED');
  }
  const { code, state } = req.query;
  if (!code || typeof code !== 'string') {
    return redirectOAuthFailure(res, 'missing_code');
  }
  if (!state || state !== req.session.lineOAuthState) {
    return redirectOAuthFailure(res, 'invalid_state');
  }
  delete req.session.lineOAuthState;

  const redirectUri = `${config.oauth.callbackBase.replace(/\/$/, '')}/auth/line/callback`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: config.oauth.line.channelId,
    client_secret: config.oauth.line.channelSecret,
  });

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return redirectOAuthFailure(
        res,
        tokenJson.error_description || tokenJson.error || 'line_token'
      );
    }
    const accessToken = tokenJson.access_token;
    const pr = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await pr.json();
    if (!pr.ok || !profile.userId) {
      return redirectOAuthFailure(res, 'line_profile');
    }
    let emailFromId = null;
    if (tokenJson.id_token) {
      const parts = String(tokenJson.id_token).split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          if (payload.email) emailFromId = String(payload.email).toLowerCase();
        } catch {
          /* ignore */
        }
      }
    }
    const tokens = await authOAuthService.findOrCreateOAuthUser({
      provider: 'line',
      providerUserId: profile.userId,
      email: emailFromId,
      name: profile.displayName || '',
      avatar: profile.pictureUrl || null,
    });
    redirectWithTokens(res, tokens);
  } catch (e) {
    redirectOAuthFailure(res, e?.message || 'line');
  }
});

export default router;
