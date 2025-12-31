# Blog Server API Specification

**Base URL**: Configurable via Cloudflare Workers deployment

**Authentication**: JWT Bearer Token (required for all `/admin/*` endpoints)

---

## Table of Contents

- [Authentication](#authentication)
  - [POST /login](#post-login)
  - [GET /session](#get-session)
- [Posts Management (Admin)](#posts-management-admin)
  - [POST /admin/posts](#post-adminposts)
  - [PUT /admin/posts/:postId](#put-adminpostspostid)
  - [DELETE /admin/posts/:postId](#delete-adminpostspostid)
- [Comments Management (Admin)](#comments-management-admin)
  - [DELETE /admin/comments/:commentId](#delete-admincommentscommentid)
- [Image Upload (Admin)](#image-upload-admin)
  - [POST /admin/images](#post-adminimages)
- [Public Posts API](#public-posts-api)
  - [GET /posts](#get-posts)
  - [GET /posts/:slug](#get-postsslug)
  - [PATCH /posts/:postId/views](#patch-postspostidviews)
- [Public Comments API](#public-comments-api)
  - [GET /comments/:postId](#get-commentspostid)
  - [POST /comments/:postId](#post-commentspostid)
- [Public Tags API](#public-tags-api)
  - [GET /tags](#get-tags)
- [Sitemap](#sitemap)
  - [GET /sitemap](#get-sitemap)
- [Error Handling](#error-handling)
- [Data Models](#data-models)

---

## Authentication

### POST /login

Admin login endpoint that returns a JWT token.

**Endpoint**: `POST /login`

**Authentication**: None (public endpoint)

**Request Body**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 7200
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields
- `401 Unauthorized`: Invalid credentials

---

### GET /session

Validate current JWT token and check session validity.

**Endpoint**: `GET /session`

**Authentication**: Required (JWT Bearer Token)

**Success Response** (200 OK):
```json
{
  "valid": true,
  "userId": 1,
  "expiresAt": "2024-01-15T12:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token

---

## Posts Management (Admin)

### POST /admin/posts

Create a new blog post.

**Endpoint**: `POST /admin/posts`

**Authentication**: Required (JWT Bearer Token)

**Request Body**:
```json
{
  "title": "string (required)",
  "content": "string (required)",
  "summary": "string (required)",
  "slug": "string (optional)",
  "tags": ["string"] (optional),
  "state": "draft | published (required)"
}
```

**Success Response** (200 OK):
```json
{
  "id": 1,
  "slug": "my-blog-post",
  "title": "My Blog Post",
  "content": "Full post content...",
  "summary": "Brief summary",
  "tags": ["javascript", "web"],
  "state": "published",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "views": 0
}
```

---

### PUT /admin/posts/:postId

Update an existing blog post.

**Endpoint**: `PUT /admin/posts/:postId`

**Authentication**: Required (JWT Bearer Token)

**Success Response** (200 OK): Same as POST /admin/posts

**Error Responses**:
- `400 Bad Request`: Invalid post ID or validation error
- `404 Not Found`: Post not found

---

### DELETE /admin/posts/:postId

Delete a blog post.

**Endpoint**: `DELETE /admin/posts/:postId`

**Authentication**: Required (JWT Bearer Token)

**Success Response** (200 OK):
```json
{
  "deleted": true,
  "id": 1
}
```

---

## Comments Management (Admin)

### DELETE /admin/comments/:commentId

Delete a comment by UUID.

**Endpoint**: `DELETE /admin/comments/:commentId`

**Authentication**: Required (JWT Bearer Token)

**Success Response** (200 OK):
```json
{
  "deleted": true,
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Image Upload (Admin)

### POST /admin/images

Upload an image file to R2 storage.

**Endpoint**: `POST /admin/images`

**Authentication**: Required (JWT Bearer Token)

**Content-Type**: `multipart/form-data`

**File Constraints**:
- Allowed types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Maximum size: 5MB
- Storage path: `images/{year}/{month}/{uuid}.{extension}`

**Success Response** (200 OK):
```json
{
  "url": "https://cdn.example.com/images/2024/01/uuid.jpg",
  "key": "images/2024/01/uuid.jpg"
}
```

---

## Public Posts API

### GET /posts

Get paginated list of published posts.

**Endpoint**: `GET /posts`

**Query Parameters**:
- `tag` (string): Filter by tag name
- `page` (number): Page number (0-indexed, default: 0)
- `size` (number): Page size (default: 10, max: 100)
- `sort` (string): Sort parameter (e.g., "createdAt,desc")

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "slug": "my-blog-post",
        "title": "My Blog Post",
        "summary": "Brief summary",
        "tags": ["javascript", "web"],
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "views": 42
      }
    ],
    "totalElements": 42,
    "pageNumber": 0,
    "pageSize": 10
  },
  "error": null
}
```

---

### GET /posts/:slug

Get single post by slug or numeric ID.

**Endpoint**: `GET /posts/:slug`

**Note**: If a numeric ID is provided, returns 301 redirect to slug-based URL.

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "my-blog-post",
    "title": "My Blog Post",
    "content": "Full post content...",
    "summary": "Brief summary",
    "tags": ["javascript", "web"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "views": 42
  },
  "error": null
}
```

---

### PATCH /posts/:postId/views

Increment view count for a post.

**Endpoint**: `PATCH /posts/:postId/views`

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "views": 43
  },
  "error": null
}
```

---

## Public Comments API

### GET /comments/:postId

Get all comments for a post.

**Endpoint**: `GET /comments/:postId`

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "content": "Comment content",
      "authorName": "John Doe",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "postId": 1
    }
  ],
  "error": null
}
```

---

### POST /comments/:postId

Create a new comment on a post.

**Endpoint**: `POST /comments/:postId`

**Request Body**:
```json
{
  "content": "string (1-500 chars)",
  "author": "string (2-20 chars)"
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "content": "Comment content",
    "authorName": "John Doe",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "postId": 1
  },
  "error": null
}
```

---

## Public Tags API

### GET /tags

Get all active tags with post counts.

**Endpoint**: `GET /tags`

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "javascript",
      "postCount": 10,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "error": null
}
```

---

## Sitemap

### GET /sitemap

Get all published post slugs for SEO.

**Endpoint**: `GET /sitemap`

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": ["post-1", "post-2", "post-3"],
  "error": null
}
```

---

## Error Handling

### Standard Error Response Format

**Admin Endpoints**:
```json
{
  "error": "Error message description"
}
```

**Public Endpoints**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": 400,
    "message": "Error message description"
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 301 | Redirect (ID to slug) |
| 400 | Bad Request (validation errors) |
| 401 | Unauthorized (authentication required or failed) |
| 404 | Not Found (resource doesn't exist) |
| 500 | Internal Server Error |

### CORS

- **Allowed Origins**: Configurable via `ALLOWED_ORIGINS` environment variable
- **Allowed Methods**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
- **Allowed Headers**: `Content-Type`, `Authorization`

---

## Data Models

### Post

```typescript
interface Post {
  id: number;
  slug: string;
  title: string;
  content: string;
  summary: string | null;
  tags: string[];
  state: 'draft' | 'published';
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
  views: number;
}
```

### Comment

```typescript
interface Comment {
  id: string; // UUID
  content: string;
  authorName: string;
  createdAt: string;
  postId: number;
}
```

### Tag

```typescript
interface Tag {
  id: number;
  name: string;
  postCount: number;
  createdAt: string;
}
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_USERNAME` | Admin username for authentication | Required |
| `ADMIN_PASSWORD` | SHA-256 hashed admin password | Required |
| `PASSWORD_SALT` | Salt for password hashing | Required |
| `JWT_SECRET` | Secret key for JWT signing | Required |
| `JWT_EXPIRY` | JWT expiry time in seconds | 7200 |
| `ALLOWED_ORIGINS` | CORS allowed origins | `*` |
| `CDN_DOMAIN` | CDN domain for image URLs | Required |

---

## Database Schema

### posts

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| slug | TEXT | Unique URL slug |
| title | TEXT | Post title |
| content | TEXT | Full post content |
| summary | TEXT | Brief summary |
| state | TEXT | 'draft' or 'published' |
| created_at | TEXT | ISO 8601 timestamp |
| updated_at | TEXT | ISO 8601 timestamp |
| views | INTEGER | View count |

### tags

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | Unique tag name |
| created_at | TEXT | ISO 8601 timestamp |
| post_count | INTEGER | Number of associated posts |

### post_tags

| Column | Type | Description |
|--------|------|-------------|
| post_id | INTEGER | Foreign key to posts |
| tag_id | INTEGER | Foreign key to tags |

### comments

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| content | TEXT | Comment content |
| author_name | TEXT | Author display name |
| created_at | TEXT | ISO 8601 timestamp |
| post_id | INTEGER | Foreign key to posts |
