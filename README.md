# Blog Server

A unified Cloudflare Worker that combines admin and public blog API functionality.

## Features

- **Authentication**: JWT-based admin authentication
- **Admin API**: Post CRUD, comment deletion, image upload to R2
- **Public API**: Post listing/reading, comments, tags, sitemap
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 for images

## Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Run tests
npm run test

# Deploy
npm run deploy
```

## API Endpoints

### Authentication (Public)
- `POST /login` - Admin login
- `GET /session` - Validate JWT token (requires auth)

### Admin (Requires JWT)
- `POST /admin/posts` - Create post
- `PUT /admin/posts/:postId` - Update post
- `DELETE /admin/posts/:postId` - Delete post
- `DELETE /admin/comments/:commentId` - Delete comment
- `POST /admin/images` - Upload image

### Public
- `GET /posts` - List posts (paginated)
- `GET /posts/:slug` - Get single post
- `PATCH /posts/:postId/views` - Increment view count
- `GET /comments/:postId` - Get comments
- `POST /comments/:postId` - Create comment
- `GET /tags` - List active tags
- `GET /sitemap` - Get post slugs for SEO

## Configuration

### Environment Variables

Set via `wrangler secret put`:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Base64-encoded HMAC key (32 bytes min) |
| `PASSWORD_SALT` | Hex-encoded salt (16 bytes) |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | SHA-256 hash of password+salt |

### Bindings

Configured in `wrangler.jsonc`:
- `DB`: D1 database for posts, comments, tags
- `STORAGE`: R2 bucket for image uploads

## Development

```bash
# Install dependencies
npm install

# Run locally with wrangler
npm run dev

# Run unit tests
npm run test

# Type checking
npx tsc --noEmit
```

## Project Structure

```
src/
├── index.ts          # Main entry point
├── types.ts          # TypeScript types
├── auth/             # JWT & middleware
├── routes/           # API route handlers
├── services/         # Business logic
├── repositories/     # Data access layer
├── sql/              # SQL queries
└── utils/            # Utilities (errors, validation, logging)
```

## Database Schema

See `API_SPEC.md` for complete database schema documentation.

## API Documentation

See `API_SPEC.md` for complete API documentation.
