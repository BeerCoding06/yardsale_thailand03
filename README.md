# Yardsale Thailand

Nuxt3 e-commerce application with direct MySQL database access.

## Tech Stack

- Nuxt 3
- Vue 3
- MySQL (direct database access)
- TypeScript

## Setup

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Build
pnpm build

# Production
pnpm preview
```

## Environment Variables

### Database Configuration
- `DB_HOST` - Database host (default: 157.85.98.150:3306)
- `DB_NAME` - Database name (default: nuxtcommerce_db)
- `DB_USER` - Database user (default: root)
- `DB_PASSWORD` - Database password

### WordPress Configuration
- `WP_BASE_URL` - WordPress base URL (default: http://157.85.98.150:8080)
- `WP_BASIC_AUTH` - WordPress Basic Auth (base64 encoded username:password)
- `WP_CONSUMER_KEY` - WooCommerce Consumer Key (optional)
- `WP_CONSUMER_SECRET` - WooCommerce Consumer Secret (optional)

### Application Configuration
- `BASE_URL` - Base URL for the application

## WordPress API Endpoints

All WordPress API endpoints use the `WP_BASE_URL` from `.env` file. You can override it by setting the environment variable.

### Available Endpoints:
- `/api/wp-products` - Fetch products from WordPress REST API
- `/api/create-user` - Create WordPress user
- `/api/check-email` - Check if email exists in WordPress
- `/api/upload-image` - Upload image to WordPress media library
