# Deploy on Dokploy (Frontend + Backend + PostgreSQL)

This guide is specific to this repository and uses:
- `frontend`: Nuxt (`Dockerfile.prod`)
- `backend`: Express API (`backend/Dockerfile`)
- `postgres`: PostgreSQL 16

## 1) Files used

- `docker-compose.dokploy.yml`
- `Dockerfile.prod`
- `backend/Dockerfile`

## 2) Create app in Dokploy

1. Create a new **Docker Compose** application.
2. Connect your Git repository.
3. Set compose path to: `docker-compose.dokploy.yml`
4. Select branch (for example `main`).

## 3) Required environment variables

Set these in Dokploy app environment (do not commit secrets).

### Required secrets

```env
POSTGRES_PASSWORD=change-this-strong-password
JWT_SECRET=change-this-long-random-secret-at-least-32-chars
```

### Recommended app vars

```env
POSTGRES_DB=yardsale
POSTGRES_USER=yardsale
JWT_EXPIRES_IN=7d

# Public web URL
BASE_URL=https://www.your-domain.com

# Browser should call public API domain in production
NUXT_PUBLIC_CMS_API_BASE=https://api.your-domain.com/api
NUXT_PUBLIC_YARDSALE_BACKEND_ORIGIN=https://api.your-domain.com

# Add all domains that Nuxt Image is allowed to fetch
NUXT_IMAGE_DOMAINS=api.your-domain.com,www.your-domain.com

# Optional API CORS allowlist
CORS_ORIGINS=https://www.your-domain.com,https://your-domain.com
```

Notes:
- In production, avoid internal URLs for `NUXT_PUBLIC_*` variables.
- `DATABASE_URL` is built automatically inside compose from `POSTGRES_*`.

## 4) Domain routing in Dokploy

Recommended:
- Frontend service domain: `www.your-domain.com`
- Backend service domain: `api.your-domain.com`

Enable SSL (Let's Encrypt) for both.

## 5) First deploy order

1. Deploy stack.
2. Wait until `postgres`, `backend`, `frontend` are healthy.
3. Run database schema once in backend container:

```bash
npm run db:schema
```

4. Optional seed admin/demo data:

```bash
npm run db:seed
```

## 6) Post-deploy checks

Run from your machine:

```bash
curl -i https://api.your-domain.com/api/products
curl -i https://www.your-domain.com
```

Expected:
- API returns `200` with JSON.
- Frontend returns `200`.

Then test in browser:
- login
- my-orders
- my-products
- seller-orders
- add-to-cart / checkout

## 7) Troubleshooting

### `403` on `/seller-orders`
- Ensure token is valid and role is one of: `user`, `seller`, `admin`.
- Re-login to refresh JWT.

### Frontend cannot call backend (`Failed to fetch`)
- Check `NUXT_PUBLIC_CMS_API_BASE` points to public API URL.
- Check backend domain SSL and CORS (`CORS_ORIGINS`).

### Images not loading
- Ensure `NUXT_IMAGE_DOMAINS` includes backend image host.
- Ensure `NUXT_PUBLIC_YARDSALE_BACKEND_ORIGIN` is correct.

### DB connection errors
- Confirm `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`.
- Confirm `postgres` service is healthy before backend start.

## 8) Rollback

If new deploy fails:
1. Roll back to previous successful deployment in Dokploy.
2. Keep database volume unchanged.
3. Re-check changed env vars before redeploy.
