/**
 * ลงทะเบียน Passport strategies (Google, Facebook) — โหลดครั้งเดียวตอน import
 * LINE ใช้ OAuth2 แบบ manual ใน routes/auth.social.routes.js
 */
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { config } from './index.js';
import * as authOAuthService from '../services/auth.oauth.service.js';

const cb = config.oauth.callbackBase.replace(/\/$/, '');

if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.oauth.google.clientId,
        clientSecret: config.oauth.google.clientSecret,
        callbackURL: `${cb}/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || null;
          const name = profile.displayName || profile.name?.givenName || '';
          const avatar = profile.photos?.[0]?.value || null;
          const tokens = await authOAuthService.findOrCreateOAuthUser({
            provider: 'google',
            providerUserId: profile.id,
            email,
            name,
            avatar,
          });
          done(null, tokens);
        } catch (e) {
          done(e);
        }
      }
    )
  );
}

if (config.oauth.facebook.appId && config.oauth.facebook.appSecret) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: config.oauth.facebook.appId,
        clientSecret: config.oauth.facebook.appSecret,
        callbackURL: `${cb}/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'emails', 'picture.type(large)'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || null;
          const name = profile.displayName || '';
          const avatar =
            profile.photos?.[0]?.value ||
            (profile._json?.picture?.data?.url ?? null);
          const tokens = await authOAuthService.findOrCreateOAuthUser({
            provider: 'facebook',
            providerUserId: profile.id,
            email,
            name,
            avatar,
          });
          done(null, tokens);
        } catch (e) {
          done(e);
        }
      }
    )
  );
}

export function oauthGoogleConfigured() {
  return !!(config.oauth.google.clientId && config.oauth.google.clientSecret);
}

export function oauthFacebookConfigured() {
  return !!(config.oauth.facebook.appId && config.oauth.facebook.appSecret);
}

export function oauthLineConfigured() {
  return !!(config.oauth.line.channelId && config.oauth.line.channelSecret);
}

const _gId = (process.env.GOOGLE_CLIENT_ID || '').trim();
const _gSec = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
if ((!_gId || !_gSec) && (_gId || _gSec)) {
  console.warn(
    '[oauth] Google: ตั้งค่าไม่ครบ — ต้องมีทั้ง GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET ใน **process ของ Express (backend)** แล้ว restart'
  );
}
