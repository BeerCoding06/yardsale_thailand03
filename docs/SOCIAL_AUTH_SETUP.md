# Social authentication (Google, Facebook, LINE + email)

This project adds **Express routes under `/auth/*`** (not under `/api`) with **Passport** (Google, Facebook) and **manual OAuth2** for LINE. The Nuxt app proxies **`/auth/*`** to the same backend in development (Vite) and production (Nitro `server/routes/auth/[...path].ts`).

## 1. Database

Apply the updated schema (adds nullable `password_hash`, `avatar`, `auth_provider`, and table `user_oauth_identities`):

```bash
cd backend
npm install
npm run db:schema
```

## 2. Environment (backend)

**สำคัญ (Dokploy / Docker):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_*` ต้องอยู่ที่ **service ที่รัน Express (backend / `yardsale-api`)** เท่านั้น ไม่ใช่แค่ Nuxt frontend — ถ้าใส่เฉพาะในแอป Nuxt จะได้ `NOT_CONFIGURED` เสมอ

Copy `backend/.env.example` and set at minimum:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs access JWT (existing API). |
| `JWT_REFRESH_SECRET` | Signs refresh JWT (defaults to `JWT_SECRET` if unset). |
| `SESSION_SECRET` | Express session cookie for LINE `state` (defaults to `JWT_SECRET`). |
| `OAUTH_CALLBACK_BASE` | **Origin ของ URL ที่ Google จะ redirect กลับมา** (ไม่มี `/` ท้าย) เช่น `https://www.yardsaleth.com` หรือ `http://localhost:3000` ถ้า proxy `/auth` ผ่าน Nuxt — ระบบจะต่อ path เป็น `{base}/auth/google/callback` ให้เอง ถ้าคุณใส่ลงท้ายด้วย `/auth` โค้ดจะ **ตัด `/auth` ท้ายออกอัตโนมัติ** กันซ้ำเป็น `/auth/auth/...` |
| `OAUTH_FRONTEND_SUCCESS_URL` | Where users land after OAuth, e.g. `https://www.example.com/auth/callback` or `http://localhost:3000/auth/callback`. |
| `OAUTH_FRONTEND_FAILURE_URL` | Optional; same as success URL if omitted. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth 2.0 Web client. |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook Login app. |
| `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` | LINE Login channel. |

Frontend (optional):

| Variable | Purpose |
|----------|---------|
| `NUXT_PUBLIC_OAUTH_API_ORIGIN` | If the browser must open OAuth on another host (e.g. `https://api.example.com`). If empty, same-origin `/auth/...` is used (requires proxy). |

## 3. OAuth provider consoles

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create **OAuth client ID** (Web application).
2. **Authorized redirect URIs**: `{OAUTH_CALLBACK_BASE}/auth/google/callback`  
   Example: `http://localhost:3000/auth/google/callback` when using the Nuxt dev proxy, or `https://api.example.com/auth/google/callback` when the API handles TLS directly.
3. Scopes: `openid email profile` (Passport requests `profile` and `email`).

### Facebook

1. [Meta for Developers](https://developers.facebook.com/) → Create app → Facebook Login → Settings.
2. **Valid OAuth Redirect URIs**: `{OAUTH_CALLBACK_BASE}/auth/facebook/callback`.
3. Add permissions: `email`, `public_profile`.

### LINE

1. [LINE Developers Console](https://developers.line.biz/) → Channel → LINE Login.
2. **Callback URL**: `{OAUTH_CALLBACK_BASE}/auth/line/callback`.
3. Enable scopes: **OpenID**, **profile**, **email** (email is delivered in the `id_token` when configured).

## 4. API routes (Express)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/email/register` | `{ email, password, name? }` → `{ token, refreshToken, user }` |
| POST | `/auth/email/login` | `{ email` or `username`, `password` }` → same shape |
| POST | `/auth/refresh` | `{ refreshToken }` → new `{ token, refreshToken, user }` |
| POST | `/auth/logout` | Stateless hint for client to drop tokens |
| GET | `/auth/google` | Starts Google OAuth |
| GET | `/auth/google/callback` | Finishes Google → redirect to frontend with `?token=&refresh=` |
| GET | `/auth/facebook` | Starts Facebook OAuth |
| GET | `/auth/facebook/callback` | Finishes Facebook |
| GET | `/auth/line` | Starts LINE OAuth |
| GET | `/auth/line/callback` | Finishes LINE |

Existing JSON API remains under **`/api/*`** (e.g. `/api/login`, `/api/me`).

## 5. Linking accounts and duplicate email

- **Same provider + subject**: one row in `user_oauth_identities`; user is found by `(provider, provider_user_id)`.
- **Same email** as an existing email/password user: the next OAuth sign-in **links** a new row in `user_oauth_identities` to that user (no duplicate email).
- **LINE without email**: a stable synthetic email `line_{userId}@line.oauth.local` is used until an email is available from the ID token.

## 6. Refresh and logout

- **Refresh**: `POST /auth/refresh` with body `{ "refreshToken": "..." }`.
- **Logout**: clear `localStorage` (and any cookie you add later); `POST /auth/logout` is informational only unless you extend it with a token blocklist.

## 7. Docker / Dokploy

Uncomment and set the OAuth-related variables in `docker-compose.yml` for the `backend` service (or in the platform UI). Rebuild the backend image after `npm install` so `passport` and related packages are installed.

## 8. i18n and callback URL

`OAUTH_FRONTEND_SUCCESS_URL` should match the locale you use after login, for example:

- Thai (default, no prefix): `https://www.example.com/auth/callback`
- English: `https://www.example.com/en/auth/callback`

The callback page reads `token` and `refresh` from the query string, hydrates the session via `/api/me`, then redirects to the profile page.
