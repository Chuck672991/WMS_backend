# Smart Wedding Management System — Backend Technical Documentation

**Purpose of this document:** This is the single source of truth for backend development of the Smart Wedding Management System mobile application. It is written for direct consumption by a backend engineer or a Claude Code agent. Every module below is self-contained — implement in any order, but respect the dependency notes at the top of each module.

**Source of truth for features:** This document is derived from the *Smart Wedding App Solution* (frontend/UX specification), which defines the following core screens: Onboarding, Home Dashboard, Vendor Management, Guest & RSVP, Budget Tracker, and Event Timeline.

---

## 1. System Overview

The Smart Wedding Management System is a **single mobile application shared by a couple and their family members** to centrally manage:

- Vendors (booking, payment status, contacts)
- Guests (list, RSVP, seating)
- Budget (category-wise tracking, advance/balance)
- Event Timeline (multi-function schedule: Dholki, Mayun, Mehndi, Baraat, Walima, etc.)
- Tasks & Reminders
- Dashboard (aggregated progress view)

It is a **multi-user, single-tenant-per-wedding** system: every wedding is its own workspace ("Wedding Project"), and multiple users (couple + family members) share access to that one workspace with different permission levels.

---

## 2. Database Choice & Justification

### Recommendation: **PostgreSQL** (primary) + **Redis** (cache/session/queue)

This is not a default choice — it is justified against the actual data shape below.

| Factor | Analysis | Verdict |
|---|---|---|
| **Relationships** | Data is heavily relational: a Wedding has many Guests, Vendors, Budget Items, Events; Guests belong to Events (many-to-many via RSVP); Users belong to Weddings via a join table with roles. This is a classic relational graph, not document-shaped. | Favors SQL |
| **Query complexity** | Dashboard requires aggregations (SUM of budget items by category, COUNT of guests by RSVP status, join across vendors+payments). SQL aggregate functions and joins handle this natively and efficiently. | Favors SQL |
| **Transactional integrity** | Budget entries (advance paid, balance due) and vendor payments must never be lost or double-counted — this needs ACID guarantees. | Favors SQL |
| **Scalability** | Each wedding is a bounded, small dataset (hundreds of guests, dozens of vendors/budget lines, single-digit events). This is NOT a big-data problem — it's many small, well-structured tenants. PostgreSQL handles millions of small tenants easily with proper indexing (`wedding_id` on every table). | PostgreSQL scales horizontally later via read replicas or sharding by `wedding_id` if needed |
| **Future AI features** | AI features (e.g., budget optimization suggestions, vendor recommendations) need structured historical data to reason over — relational data is easier to feed into analytics/ML pipelines than unstructured documents. PostgreSQL also supports `pgvector` if embeddings/semantic search are added later (e.g., "find vendors similar to X"). | PostgreSQL extensible |
| **Analytics/Reporting** | Category-wise spend reports, guest RSVP funnels, vendor payment summaries — all are classic OLAP-style aggregate queries. SQL is purpose-built for this. | Favors SQL |
| **Cost & maintainability** | PostgreSQL is open-source, has mature hosting options (Supabase, RDS, Neon, Railway), and every ORM (Prisma, TypeORM, Sequelize) has first-class support — lowering long-term maintenance cost. | Favors PostgreSQL |
| **Why not MongoDB** | MongoDB would force denormalization (e.g., embedding guests inside a wedding document) which breaks down fast once guest lists grow past a few hundred and need independent querying, pagination, and updates. Multi-document transactions in Mongo are possible but more awkward than native SQL transactions for financial data like budget/payments. | Rejected for this use case |
| **Why Redis alongside** | Not a primary store — used for: session/refresh-token storage, rate-limiting counters, caching dashboard aggregates (recomputing SUM/COUNT on every dashboard load is wasteful), and as the backing store for the background job queue (BullMQ). | Supporting role only |

**Conclusion:** PostgreSQL as the system of record, Redis for caching, sessions, and queues. This combination is standard, well-documented, cost-effective, and matches the relational, transactional, and aggregation-heavy nature of wedding planning data.

---

## 3. Recommended Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js (TypeScript) | Matches mobile team's JS ecosystem; huge library support |
| Framework | NestJS | Enforces modular architecture (matches the module-per-feature requirement below) out of the box, built-in DI, guards, pipes |
| ORM | Prisma | Type-safe, excellent PostgreSQL support, easy migrations |
| Database | PostgreSQL 15+ | See justification above |
| Cache/Queue | Redis + BullMQ | Sessions, rate limiting, background jobs (reminders, notifications) |
| Auth | JWT (access + refresh) + Passport.js (Google OAuth strategy) | Industry standard, stateless, scalable |
| File Storage | S3-compatible (AWS S3 / Cloudflare R2) | Vendor images, guest import files, profile photos |
| Realtime (optional, future) | WebSockets (Socket.io) via NestJS Gateway | For live dashboard sync across family members |
| Validation | class-validator + class-transformer (DTOs) | Native to NestJS |
| API Docs | Swagger/OpenAPI (auto-generated from NestJS decorators) | Always in sync with code |
| Testing | Jest | Unit + integration tests |

---

## 4. Professional Folder Structure

```
backend/
├── src/
│   ├── main.ts                          # App bootstrap
│   ├── app.module.ts                    # Root module — imports all feature modules
│   │
│   ├── config/                          # Environment & app configuration
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── jwt.config.ts
│   │   ├── s3.config.ts
│   │   └── app.config.ts
│   │
│   ├── common/                          # Shared, cross-module code
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts # Global error formatter
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── wedding-access.guard.ts  # Ensures user belongs to :weddingId
│   │   ├── interceptors/
│   │   │   ├── response.interceptor.ts  # Wraps all responses in standard envelope
│   │   │   └── logging.interceptor.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   ├── middleware/
│   │   │   └── request-id.middleware.ts
│   │   ├── constants/
│   │   │   ├── roles.constant.ts
│   │   │   └── error-codes.constant.ts
│   │   └── types/
│   │       └── pagination.types.ts
│   │
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── schema.prisma            # Full DB schema (all models)
│   │   │   ├── migrations/
│   │   │   └── seed.ts                  # Seed script
│   │   └── prisma.service.ts            # Injectable Prisma client wrapper
│   │
│   ├── modules/                         # ⭐ Every feature is an isolated module
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── jwt-refresh.strategy.ts
│   │   │   │   └── google.strategy.ts
│   │   │   ├── dto/
│   │   │   │   ├── register.dto.ts
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── forgot-password.dto.ts
│   │   │   │   └── reset-password.dto.ts
│   │   │   └── auth.repository.ts
│   │   │
│   │   ├── users/
│   │   ├── weddings/                    # Wedding "workspace" module
│   │   ├── vendors/
│   │   ├── guests/
│   │   ├── budget/
│   │   ├── events/                      # Timeline / functions module
│   │   ├── tasks/
│   │   ├── notifications/
│   │   ├── dashboard/
│   │   ├── uploads/
│   │   └── ai/                          # Future AI module (reserved)
│   │
│   ├── jobs/                            # Background jobs (BullMQ processors)
│   │   ├── reminder.processor.ts
│   │   ├── notification.processor.ts
│   │   └── queue.module.ts
│   │
│   ├── websockets/                      # Future realtime sync
│   │   └── wedding.gateway.ts
│   │
│   └── utils/
│       ├── hash.util.ts
│       ├── token.util.ts
│       └── date.util.ts
│
├── test/
│   ├── unit/                            # Mirrors src/modules structure
│   └── e2e/
│
├── .env.example
├── docker-compose.yml                   # postgres + redis for local dev
├── package.json
└── tsconfig.json
```

Each module folder under `modules/` follows the **same internal pattern**:

```
modules/<feature>/
├── <feature>.module.ts       # NestJS module wiring
├── <feature>.controller.ts   # Route definitions only — no business logic
├── <feature>.service.ts      # Business logic
├── <feature>.repository.ts   # Prisma queries isolated here
├── dto/                      # Request/response validation shapes
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── query-<feature>.dto.ts
└── entities/ (optional)       # Response shape typing if not using Prisma types directly
```

This isolation means **two engineers can work on `vendors` and `budget` simultaneously with zero merge conflicts**, since neither touches the other's controller/service/repository files.

---

## 5. Standard API Conventions (apply to every module below)

### 5.1 Base URL & Versioning
```
https://api.smartwedding.app/v1/...
```
All routes are prefixed `/v1`. Breaking changes ship as `/v2` — old version stays live during migration window.

### 5.2 Standard Response Envelope

**Success:**
```json
{
  "success": true,
  "data": { },
  "meta": {
    "timestamp": "2026-07-23T10:00:00Z",
    "requestId": "uuid"
  }
}
```

**Paginated success:**
```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 143,
      "totalPages": 8
    },
    "timestamp": "2026-07-23T10:00:00Z",
    "requestId": "uuid"
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Guest name is required.",
    "details": [
      { "field": "name", "message": "Name must not be empty" }
    ]
  },
  "meta": {
    "timestamp": "2026-07-23T10:00:00Z",
    "requestId": "uuid"
  }
}
```

### 5.3 Standard HTTP Status Codes

| Code | Meaning | Used for |
|---|---|---|
| 200 | OK | Successful GET/PATCH/PUT/DELETE |
| 201 | Created | Successful POST creating a resource |
| 204 | No Content | Successful DELETE with no body |
| 400 | Bad Request | Validation errors |
| 401 | Unauthorized | Missing/invalid/expired token |
| 403 | Forbidden | Valid token, insufficient role/permission |
| 404 | Not Found | Resource doesn't exist or not in user's wedding |
| 409 | Conflict | Duplicate resource (e.g., email already registered) |
| 422 | Unprocessable Entity | Semantically invalid (e.g., RSVP date after wedding date) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled exception |

### 5.4 Standard Error Codes (used in `error.code`)

```
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
DUPLICATE_RESOURCE
TOKEN_EXPIRED
TOKEN_INVALID
RATE_LIMITED
INTERNAL_ERROR
WEDDING_ACCESS_DENIED
```

### 5.5 Pagination (query params — applies to every list endpoint)

```
GET /v1/guests?page=1&limit=20&sortBy=createdAt&sortOrder=desc&search=ali&status=confirmed
```

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | 1 | 1-indexed |
| `limit` | number | 20 | Max 100 |
| `sortBy` | string | `createdAt` | Whitelisted per-module (documented per module) |
| `sortOrder` | `asc`\|`desc` | `desc` | |
| `search` | string | — | Free-text search, module-specific fields |
| (module-specific filters) | — | — | Documented per module |

### 5.6 Authentication Header (all protected routes)

```
Authorization: Bearer <access_token>
```

### 5.7 Wedding Context Header/Param

Since every resource belongs to a specific wedding workspace, every protected route (except auth and user profile) is scoped under:

```
/v1/weddings/:weddingId/<resource>
```

The `WeddingAccessGuard` (see folder structure) verifies the authenticated user is a member of `:weddingId` before the controller executes. This is the **single most important guard in the system** — it prevents cross-tenant data leakage.

---

*Continue to Module 02: Authentication & Authorization*
# Module 02: Authentication & Authorization

**Dependency:** None — build this first. Every other module depends on the guards produced here.

---

## Overview

Handles user registration, login (email/password + Google OAuth), password recovery, token refresh, logout, and session management. Produces the `JwtAuthGuard` and `RolesGuard` used by every other module.

## Business Logic

- A user can register with email + password, OR sign in via Google (which auto-creates an account on first login).
- Passwords are never stored in plaintext — hashed with **bcrypt** (cost factor 12).
- On successful login, the system issues an **access token** (short-lived, 15 min) and a **refresh token** (long-lived, 30 days, stored hashed in DB for revocation support).
- Refresh tokens are single-use and rotated on every refresh (old one is invalidated, new one issued) — this detects token theft.
- A user is not tied to one wedding — they can belong to multiple weddings (e.g., a parent helping plan two children's weddings) via the `WeddingMember` join table (see Module 03).
- Roles are **scoped per wedding**, not global. The same user can be `owner` of Wedding A and `family_member` of Wedding B.

## Database Models

```prisma
model User {
  id                String    @id @default(uuid())
  email             String    @unique
  passwordHash      String?   // null if Google-only account
  fullName          String
  phone             String?
  profileImageUrl   String?
  googleId          String?   @unique
  authProvider      AuthProvider @default(EMAIL)
  isEmailVerified   Boolean   @default(false)
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime? // soft delete

  refreshTokens     RefreshToken[]
  weddingMemberships WeddingMember[]
  passwordResets    PasswordReset[]

  @@index([email])
  @@map("users")
}

enum AuthProvider {
  EMAIL
  GOOGLE
}

model RefreshToken {
  id          String   @id @default(uuid())
  userId      String
  tokenHash   String   // bcrypt hash of the actual refresh token
  deviceInfo  String?  // user-agent / device label
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

model PasswordReset {
  id          String   @id @default(uuid())
  userId      String
  tokenHash   String
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_resets")
}
```

## Relationships
- `User` 1 — N `RefreshToken` (cascade delete)
- `User` 1 — N `PasswordReset` (cascade delete)
- `User` N — N `Wedding` (via `WeddingMember`, see Module 03)

---

## API Endpoints

### 2.1 Register (Email/Password)

```
POST /v1/auth/register
Auth required: No
```

**Request Body:**
```json
{
  "fullName": "Ayesha Khan",
  "email": "ayesha@example.com",
  "password": "SecurePass123!",
  "phone": "+923001234567"
}
```

**Validation Rules:**
- `fullName`: required, 2–100 chars
- `email`: required, valid email format, must not already exist (soft-deleted accounts count as existing)
- `password`: required, min 8 chars, at least 1 uppercase, 1 number
- `phone`: optional, E.164 format

**Success Response `201`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "Ayesha Khan",
      "email": "ayesha@example.com",
      "isEmailVerified": false
    },
    "accessToken": "jwt...",
    "refreshToken": "jwt..."
  }
}
```

**Error Responses:**
- `409 DUPLICATE_RESOURCE` — email already registered
- `400 VALIDATION_ERROR` — invalid field(s)

---

### 2.2 Login (Email/Password)

```
POST /v1/auth/login
Auth required: No
```

**Request Body:**
```json
{ "email": "ayesha@example.com", "password": "SecurePass123!" }
```

**Success Response `200`:** same shape as register.

**Error Responses:**
- `401 UNAUTHORIZED` — wrong email/password (generic message — do not reveal which field was wrong)
- `403 FORBIDDEN` — account deactivated (`isActive: false`)

---

### 2.3 Google Login

```
POST /v1/auth/google
Auth required: No
```

**Request Body:**
```json
{ "idToken": "google-id-token-from-mobile-sdk" }
```

**Business Logic:**
1. Verify `idToken` with Google's public keys.
2. Extract `email`, `googleId`, `fullName`, `profileImageUrl`.
3. If a user with this `googleId` exists → log them in.
4. Else if a user with this `email` exists (registered via email/password) → link `googleId` to that account.
5. Else → create a new user with `authProvider: GOOGLE`, `isEmailVerified: true` (Google emails are pre-verified).

**Success Response `200`:** same shape as register/login.

**Error Responses:**
- `401 UNAUTHORIZED` — invalid/expired Google token

---

### 2.4 Forgot Password

```
POST /v1/auth/forgot-password
Auth required: No
```

**Request Body:**
```json
{ "email": "ayesha@example.com" }
```

**Business Logic:**
- Always return `200` regardless of whether the email exists (prevents email enumeration).
- If the user exists: generate a random token, store its bcrypt hash in `PasswordReset` with 1-hour expiry, email the **plain** token as a link: `https://app.smartwedding.app/reset-password?token=xxx&email=xxx`.

**Success Response `200`:**
```json
{ "success": true, "data": { "message": "If this email exists, a reset link has been sent." } }
```

---

### 2.5 Reset Password

```
POST /v1/auth/reset-password
Auth required: No
```

**Request Body:**
```json
{ "email": "ayesha@example.com", "token": "plain-token-from-email", "newPassword": "NewSecurePass123!" }
```

**Validation Rules:**
- Token must match a non-expired, non-used `PasswordReset` record for that email (compare hash).
- `newPassword`: same rules as registration.

**Business Logic:**
- On success: hash new password, update `User.passwordHash`, mark `PasswordReset.usedAt`, **revoke all existing refresh tokens** for this user (force re-login everywhere — security best practice after password change).

**Success Response `200`:**
```json
{ "success": true, "data": { "message": "Password reset successfully." } }
```

**Error Responses:**
- `400 TOKEN_INVALID` — token doesn't match / already used
- `400 TOKEN_EXPIRED` — token older than 1 hour

---

### 2.6 Refresh Token

```
POST /v1/auth/refresh
Auth required: No (uses refresh token itself as credential)
```

**Request Body:**
```json
{ "refreshToken": "jwt..." }
```

**Business Logic:**
1. Verify JWT signature + expiry.
2. Look up matching (hashed) token in `RefreshToken` table — must not be revoked.
3. **Rotate:** revoke the old token, issue a brand-new access + refresh token pair.
4. If the presented token is not found in DB but is a valid JWT → this indicates reuse of an already-rotated token (possible theft) → revoke **all** refresh tokens for that user as a precaution.

**Success Response `200`:**
```json
{ "success": true, "data": { "accessToken": "jwt...", "refreshToken": "jwt..." } }
```

**Error Responses:**
- `401 TOKEN_INVALID` — malformed/tampered token
- `401 TOKEN_EXPIRED` — expired refresh token (user must log in again)

---

### 2.7 Logout

```
POST /v1/auth/logout
Auth required: Yes
```

**Request Body:**
```json
{ "refreshToken": "jwt..." }
```

**Business Logic:** revoke the specific refresh token (sets `revokedAt`). Access token remains valid until its natural 15-min expiry (stateless JWT) — acceptable tradeoff; mobile app also deletes tokens from local storage on logout.

**Success Response `200`:**
```json
{ "success": true, "data": { "message": "Logged out successfully." } }
```

---

### 2.8 Logout All Devices

```
POST /v1/auth/logout-all
Auth required: Yes
```

Revokes **all** refresh tokens for the current user. Used for the "log out everywhere" security feature.

---

### 2.9 Get Current Session / Active Devices

```
GET /v1/auth/sessions
Auth required: Yes
```

Returns all non-revoked, non-expired `RefreshToken` rows for the user (device label + last active + created date) — powers a "Manage Devices" settings screen.

**Success Response `200`:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "deviceInfo": "iPhone 15 - iOS App", "createdAt": "...", "expiresAt": "..." }
  ]
}
```

---

## Role-Based Authorization

Roles are defined **per wedding membership** (see Module 03 for the `WeddingMember` model), not globally on `User`.

| Role | Description |
|---|---|
| `owner` | The couple (or whoever created the wedding). Full control — can delete the wedding, manage members, all CRUD everywhere. |
| `co_owner` | Second half of the couple if invited separately, or a wedding planner given elevated trust. Same permissions as owner except cannot delete the wedding or remove the owner. |
| `family_member` | Can view everything, can add/edit guests and tasks, can view budget (read-only by default, configurable), cannot manage vendors/payments or delete critical data. |
| `viewer` | Read-only access to everything. For distant relatives who just want visibility. |

### `RolesGuard` behavior
- Decorator usage: `@Roles('owner', 'co_owner')` on controller methods.
- Guard reads the authenticated user's role **for the `:weddingId` in the route**, checks membership exists and role matches, else `403 FORBIDDEN` with code `WEDDING_ACCESS_DENIED`.

### Permission Matrix (summary — full detail in each module)

| Action | owner | co_owner | family_member | viewer |
|---|---|---|---|---|
| Manage wedding settings / delete wedding | ✅ | ❌ | ❌ | ❌ |
| Invite/remove members | ✅ | ✅ | ❌ | ❌ |
| CRUD vendors & payments | ✅ | ✅ | ❌ | ❌ |
| CRUD budget items | ✅ | ✅ | ❌ (view only) | ❌ (view only) |
| CRUD guests | ✅ | ✅ | ✅ | ❌ (view only) |
| CRUD events/timeline | ✅ | ✅ | ✅ (propose only, owner approves — optional workflow) | ❌ (view only) |
| CRUD tasks | ✅ | ✅ | ✅ | ❌ (view only) |
| View dashboard | ✅ | ✅ | ✅ | ✅ |

---

## Security Notes (Authentication-specific)

- Passwords: bcrypt, cost 12.
- Access tokens: JWT, 15-min expiry, signed with `JWT_ACCESS_SECRET`.
- Refresh tokens: JWT, 30-day expiry, signed with a **different** secret `JWT_REFRESH_SECRET`, hash stored in DB (never store plain refresh token server-side).
- Rate limiting on `/auth/login`, `/auth/forgot-password`, `/auth/register`: max 5 requests / 15 min / IP (via Redis-backed rate limiter).
- All `/auth/*` responses use generic error messages to avoid user enumeration where relevant (login, forgot-password).

## Edge Cases

- User tries Google login with an email already registered via password → auto-link accounts (see 2.3 logic), do not create duplicate.
- User requests password reset multiple times rapidly → invalidate previous unused `PasswordReset` tokens when a new one is issued (only latest token valid).
- Refresh token reused after rotation (theft signal) → revoke all sessions, force full re-login, optionally trigger a security-alert notification (see Module 09: Notifications).
- Soft-deleted user (`deletedAt` set) attempts login → treat as `401 UNAUTHORIZED`, generic message.

---

*Continue to Module 03: Users & Wedding Workspace*
# Module 03: Users & Wedding Workspace

**Dependency:** Requires Module 02 (Authentication) for `JwtAuthGuard`.

---

## Overview

Manages user profiles and the core concept of a **Wedding** — the workspace that every other module (vendors, guests, budget, events) is scoped under. Also handles inviting family members into a wedding.

## Business Logic

- Creating a wedding automatically makes the creator its `owner`.
- A wedding has a name (e.g., "Ayesha & Bilal's Wedding"), a target date, and optional metadata (venue city, estimated guest count) used to pre-fill dashboard widgets.
- Members are invited by email. If the invited email isn't registered yet, an invite record is created and auto-claimed on that email's first registration/login.
- Every list/detail endpoint across the whole system is implicitly scoped to `:weddingId` and protected by `WeddingAccessGuard`.

## Database Models

```prisma
model Wedding {
  id                String    @id @default(uuid())
  name              String
  weddingDate       DateTime?
  venueCity         String?
  estimatedGuests   Int?
  totalBudget        Decimal?  @db.Decimal(12,2)
  coverImageUrl     String?
  createdBy         String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  members           WeddingMember[]
  invites           WeddingInvite[]
  vendors           Vendor[]
  guests            Guest[]
  budgetItems       BudgetItem[]
  events            Event[]
  tasks             Task[]

  @@map("weddings")
}

model WeddingMember {
  id          String     @id @default(uuid())
  weddingId   String
  userId      String
  role        WeddingRole @default(FAMILY_MEMBER)
  joinedAt    DateTime   @default(now())

  wedding     Wedding    @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([weddingId, userId])
  @@index([userId])
  @@map("wedding_members")
}

enum WeddingRole {
  OWNER
  CO_OWNER
  FAMILY_MEMBER
  VIEWER
}

model WeddingInvite {
  id          String       @id @default(uuid())
  weddingId   String
  email       String
  role        WeddingRole  @default(FAMILY_MEMBER)
  invitedBy   String
  status      InviteStatus @default(PENDING)
  tokenHash   String
  expiresAt   DateTime
  createdAt   DateTime     @default(now())

  wedding     Wedding      @relation(fields: [weddingId], references: [id], onDelete: Cascade)

  @@index([weddingId])
  @@index([email])
  @@map("wedding_invites")
}

enum InviteStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}
```

## Relationships
- `Wedding` 1 — N `WeddingMember` — N `User` (many-to-many via join table)
- `Wedding` 1 — N `WeddingInvite`
- `Wedding` 1 — N everything else (vendors, guests, budget items, events, tasks) — all cascade-delete when wedding is deleted

---

## API Endpoints

### 3.1 Get Current User Profile

```
GET /v1/users/me
Auth required: Yes
```

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid", "fullName": "Ayesha Khan", "email": "ayesha@example.com",
    "phone": "+923001234567", "profileImageUrl": "https://...",
    "weddings": [
      { "id": "uuid", "name": "Ayesha & Bilal's Wedding", "role": "OWNER" }
    ]
  }
}
```

### 3.2 Update Profile

```
PATCH /v1/users/me
Auth required: Yes
```

**Request Body (all optional):**
```json
{ "fullName": "Ayesha B. Khan", "phone": "+923001234567", "profileImageUrl": "https://..." }
```

**Validation:** `fullName` 2–100 chars if provided; `phone` E.164 if provided.

**Error Responses:** `400 VALIDATION_ERROR`

---

### 3.3 Create Wedding

```
POST /v1/weddings
Auth required: Yes
```

**Request Body:**
```json
{
  "name": "Ayesha & Bilal's Wedding",
  "weddingDate": "2026-11-29",
  "venueCity": "Lahore",
  "estimatedGuests": 300,
  "totalBudget": 3200000
}
```

**Validation:**
- `name`: required, 2–150 chars
- `weddingDate`: optional, must be a future date if provided
- `totalBudget`: optional, positive decimal

**Business Logic:** Creates the `Wedding`, then creates a `WeddingMember` row for the creator with `role: OWNER` — both in a single DB transaction.

**Success Response `201`:** returns the created wedding object including `role: "OWNER"`.

---

### 3.4 Get Wedding Details

```
GET /v1/weddings/:weddingId
Auth required: Yes
Roles: any member
```

**Success Response `200`:** full wedding object + member count + current user's role.

**Error Responses:** `404 NOT_FOUND` if wedding doesn't exist or user isn't a member (same response for both — do not leak existence of weddings the user can't access).

---

### 3.5 Update Wedding Settings

```
PATCH /v1/weddings/:weddingId
Auth required: Yes
Roles: owner, co_owner
```

**Request Body:** any subset of the create-fields.

**Error Responses:** `403 WEDDING_ACCESS_DENIED` if role insufficient.

---

### 3.6 Delete Wedding

```
DELETE /v1/weddings/:weddingId
Auth required: Yes
Roles: owner only
```

Soft delete (`deletedAt` set). Cascading soft-delete is **not** automatic in Prisma — implement in service layer: mark wedding deleted, keep child records intact for potential recovery within a retention window (e.g., 30 days), then a scheduled job hard-deletes after that window.

**Success Response `204`**

---

### 3.7 List Wedding Members

```
GET /v1/weddings/:weddingId/members
Auth required: Yes
Roles: any member
```

**Success Response `200`:**
```json
{
  "success": true,
  "data": [
    { "userId": "uuid", "fullName": "Ayesha Khan", "email": "...", "role": "OWNER", "joinedAt": "..." }
  ]
}
```

---

### 3.8 Invite Member

```
POST /v1/weddings/:weddingId/invites
Auth required: Yes
Roles: owner, co_owner
```

**Request Body:**
```json
{ "email": "family@example.com", "role": "FAMILY_MEMBER" }
```

**Validation:** `email` valid format; `role` must be one of `CO_OWNER, FAMILY_MEMBER, VIEWER` (cannot invite as `OWNER`).

**Business Logic:**
- If invited email is already a member → `409 DUPLICATE_RESOURCE`.
- Generate invite token, store hash, set 7-day expiry, send invite email with deep link.
- If the email belongs to an existing user, also trigger an in-app notification (Module 09).

**Success Response `201`:** returns invite object with `status: "PENDING"`.

---

### 3.9 Accept Invite

```
POST /v1/invites/accept
Auth required: Yes (user must be logged in — if not registered, register first via 2.1/2.3, then call this)
```

**Request Body:**
```json
{ "token": "plain-invite-token" }
```

**Business Logic:** Validate token hash + expiry + `email` matches logged-in user's email. Create `WeddingMember`, mark invite `ACCEPTED`.

**Error Responses:**
- `400 TOKEN_INVALID` / `400 TOKEN_EXPIRED`
- `422` if the logged-in user's email doesn't match the invited email

---

### 3.10 Remove Member

```
DELETE /v1/weddings/:weddingId/members/:userId
Auth required: Yes
Roles: owner, co_owner (co_owner cannot remove owner)
```

**Success Response `204`**

**Error Responses:** `403 FORBIDDEN` if attempting to remove the owner while not being the owner.

---

### 3.11 Update Member Role

```
PATCH /v1/weddings/:weddingId/members/:userId
Auth required: Yes
Roles: owner only
```

**Request Body:**
```json
{ "role": "CO_OWNER" }
```

---

## State Management

`WeddingInvite.status` transitions:
```
PENDING → ACCEPTED   (on 3.9 success)
PENDING → EXPIRED    (scheduled job, daily, marks invites past expiresAt)
PENDING → REVOKED    (owner/co_owner manually cancels — DELETE /v1/weddings/:weddingId/invites/:inviteId)
```

## Edge Cases

- Last owner tries to leave/be removed from a wedding → block with `422`, require role transfer first ("You must assign a new owner before leaving").
- User invited to a wedding they're already a member of → `409 DUPLICATE_RESOURCE`.
- Wedding date in the past when creating/updating → allow it (some users log past weddings retroactively) but flag with a warning field in response, not a hard validation error.

---

*Continue to Module 04: Vendor Management*
# Module 04: Vendor Management

**Dependency:** Requires Module 02 (Auth) and Module 03 (Wedding + WeddingAccessGuard).

---

## Overview

Manages all vendors booked for the wedding (caterers, photographers, decorators, salons, transport, band/DJ, etc.), their booking status, contact details, and payment tracking (advance paid / balance due) — directly maps to the frontend "Vendor Management" screen showing status pills (Paid / Advance / Pending).

## Business Logic

- Each vendor belongs to a `VendorCategory` (predefined list + custom "other").
- A vendor has a total agreed price, and zero or more `VendorPayment` records (advance, installments, final payment) — the vendor's displayed status (`Paid` / `Advance` / `Pending`) is **derived**, not stored directly: computed from `SUM(payments) vs totalPrice`.
- Vendors can be linked to a specific `Event` (e.g., "Al-Madina Caterers" linked to the "Walima" event) or left wedding-wide (e.g., photographer covering all events).

## Database Models

```prisma
model Vendor {
  id            String    @id @default(uuid())
  weddingId     String
  name          String
  category      VendorCategory
  customCategory String?  // used when category = OTHER
  contactName   String?
  phone         String?
  email         String?
  totalPrice    Decimal?  @db.Decimal(12,2)
  notes         String?
  imageUrl      String?
  eventId       String?   // optional link to a specific function
  createdBy     String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  wedding       Wedding   @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  event         Event?    @relation(fields: [eventId], references: [id], onDelete: SetNull)
  payments      VendorPayment[]

  @@index([weddingId])
  @@index([weddingId, category])
  @@map("vendors")
}

enum VendorCategory {
  CATERING
  PHOTOGRAPHY
  DECORATION
  SALON
  TRANSPORT
  BAND_DJ
  VENUE
  DRESS_DESIGNER
  JEWELLERY
  INVITATION_CARDS
  OTHER
}

model VendorPayment {
  id          String   @id @default(uuid())
  vendorId    String
  amount      Decimal  @db.Decimal(12,2)
  paymentDate DateTime @default(now())
  method      PaymentMethod @default(CASH)
  note        String?
  recordedBy  String
  createdAt   DateTime @default(now())

  vendor      Vendor   @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@index([vendorId])
  @@map("vendor_payments")
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  CARD
  OTHER
}
```

## Relationships
- `Wedding` 1 — N `Vendor`
- `Vendor` 1 — N `VendorPayment`
- `Vendor` N — 1 `Event` (optional, nullable)

## Derived Status Logic (computed, not stored)

```
totalPaid = SUM(VendorPayment.amount WHERE vendorId = X)

if totalPaid == 0            → status = "PENDING"
if 0 < totalPaid < totalPrice → status = "ADVANCE"
if totalPaid >= totalPrice    → status = "PAID"
```

This is computed in the service layer on every read — for list endpoints with many vendors, use a single SQL aggregation (`GROUP BY vendorId`) rather than N+1 queries.

---

## API Endpoints

### 4.1 List Vendors

```
GET /v1/weddings/:weddingId/vendors
Auth required: Yes | Roles: any member
```

**Query Params:**
| Param | Type | Notes |
|---|---|---|
| `page`, `limit`, `sortBy`, `sortOrder` | standard (5.5) | `sortBy` whitelist: `name`, `createdAt`, `totalPrice` |
| `search` | string | matches `name`, `contactName` |
| `category` | enum | filter by `VendorCategory` |
| `status` | enum | `PENDING`, `ADVANCE`, `PAID` (computed filter — applied post-aggregation) |
| `eventId` | uuid | filter vendors linked to a specific event |

**Success Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "name": "Al-Madina Caterers", "category": "CATERING",
      "phone": "+92300...", "totalPrice": 950000, "totalPaid": 950000,
      "balanceDue": 0, "status": "PAID", "eventId": "uuid", "imageUrl": "..."
    }
  ],
  "meta": { "pagination": { "page": 1, "limit": 20, "totalItems": 8, "totalPages": 1 } }
}
```

---

### 4.2 Get Vendor Detail

```
GET /v1/weddings/:weddingId/vendors/:vendorId
Auth required: Yes | Roles: any member
```

**Success Response `200`:** full vendor object including `payments: []` array (payment history).

**Error Responses:** `404 NOT_FOUND`

---

### 4.3 Create Vendor

```
POST /v1/weddings/:weddingId/vendors
Auth required: Yes | Roles: owner, co_owner
```

**Request Body:**
```json
{
  "name": "Al-Madina Caterers",
  "category": "CATERING",
  "contactName": "Imran Sahab",
  "phone": "+923001112233",
  "email": "info@almadina.com",
  "totalPrice": 950000,
  "eventId": "uuid",
  "notes": "312 heads, buffet style"
}
```

**Validation:**
- `name`: required, 2–150 chars
- `category`: required, valid enum; if `OTHER`, `customCategory` becomes required (1–50 chars)
- `totalPrice`: optional, positive decimal if provided
- `phone`: optional, valid phone format
- `eventId`: optional, must belong to same `weddingId` if provided (validated in service layer)

**Success Response `201`**

**Error Responses:** `400 VALIDATION_ERROR`, `404 NOT_FOUND` (invalid `eventId`)

---

### 4.4 Update Vendor

```
PATCH /v1/weddings/:weddingId/vendors/:vendorId
Auth required: Yes | Roles: owner, co_owner
```

Same body shape as create, all fields optional.

---

### 4.5 Delete Vendor

```
DELETE /v1/weddings/:weddingId/vendors/:vendorId
Auth required: Yes | Roles: owner, co_owner
```

Soft delete. Cascades soft-delete intent to payments is **not** applied — payment history is preserved for financial audit trail even if vendor is removed from active view (filtered out via `deletedAt IS NULL` in list queries).

**Success Response `204`**

---

### 4.6 Record a Payment

```
POST /v1/weddings/:weddingId/vendors/:vendorId/payments
Auth required: Yes | Roles: owner, co_owner
```

**Request Body:**
```json
{ "amount": 500000, "paymentDate": "2026-07-01", "method": "BANK_TRANSFER", "note": "50% advance" }
```

**Validation:**
- `amount`: required, positive decimal
- **Business rule:** `amount` + existing `totalPaid` may exceed `totalPrice` (overpayment) — this is **allowed** but the response includes a `warning` field so the UI can flag it; do not hard-block, since real-world price renegotiations happen.

**Success Response `201`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "amount": 500000, "paymentDate": "...", "method": "BANK_TRANSFER" },
  "meta": {
    "warning": null,
    "vendorSummary": { "totalPaid": 500000, "totalPrice": 950000, "balanceDue": 450000, "status": "ADVANCE" }
  }
}
```

---

### 4.7 Delete a Payment

```
DELETE /v1/weddings/:weddingId/vendors/:vendorId/payments/:paymentId
Auth required: Yes | Roles: owner, co_owner
```

Hard delete (payments are corrections, not soft-deleted — but consider requiring a `reason` in a future audit-log enhancement).

---

### 4.8 List Vendor Categories (static reference endpoint)

```
GET /v1/vendors/categories
Auth required: Yes
```

Returns the enum list with display labels — used to populate the "Add Vendor" dropdown in the app.

```json
{
  "success": true,
  "data": [
    { "value": "CATERING", "label": "Catering" },
    { "value": "PHOTOGRAPHY", "label": "Photography" }
  ]
}
```

---

## Workflow

```
Create Vendor (status: PENDING)
      ↓
Record Payment(s) (status recalculated: PENDING → ADVANCE → PAID)
      ↓
Vendor fully paid → contributes to Dashboard "vendors paid" metric (Module 08)
```

## Edge Cases

- Vendor deleted after having payments recorded → payments preserved (soft-delete vendor only), excluded from active vendor list but retained for budget/audit reports.
- `eventId` provided but event later deleted → `Event` relation uses `onDelete: SetNull`, so vendor becomes wedding-wide (not orphaned/broken).
- Currency: system assumes single currency per wedding (PKR by default) — stored as `Decimal(12,2)`; no multi-currency support in this version (documented as a known limitation, not built).

---

*Continue to Module 05: Guest & RSVP Management*
# Module 05: Guest & RSVP Management

**Dependency:** Requires Module 02 (Auth) and Module 03 (Wedding + WeddingAccessGuard). Optionally links to Module 06 (Events) for per-function seating.

---

## Overview

Manages the guest list, invitations, RSVP tracking, and seating/grouping — maps directly to the frontend "Guest & RSVP" screen showing confirmed/pending/declined counts and side (Mardana/Zanana) tags.

## Business Logic

- A guest entry can represent a **group** (e.g., "Khan Family +6") via a `groupSize` field rather than requiring one row per individual — this matches how the frontend mockup displays guests ("Rana Aunty +4").
- RSVP status: `PENDING` (default on creation) → `CONFIRMED` or `DECLINED` (set either by the guest via a public RSVP link, or manually by a family member in-app).
- Guests can be tagged by `side` (`BRIDE`, `GROOM`, `BOTH`) and `gathering` (`MARDANA`, `ZANANA`, `MIXED`) to support seating/logistics planning common in Pakistani weddings.
- Guests can optionally be linked to specific `Event`s they're invited to (a guest might be invited to Walima only, not Mehndi) via a many-to-many `GuestEventInvite` table — if no specific events are linked, the guest is assumed invited to all events.
- Public RSVP: a guest receives a unique link (no login required) to confirm/decline — this requires a public, unauthenticated endpoint guarded by a per-guest secure token instead of JWT.

## Database Models

```prisma
model Guest {
  id            String       @id @default(uuid())
  weddingId     String
  name          String       // primary contact / group name, e.g. "Khan Family"
  groupSize     Int          @default(1)
  phone         String?
  email         String?
  side          GuestSide    @default(BOTH)
  gathering     GatheringType @default(MIXED)
  rsvpStatus    RsvpStatus   @default(PENDING)
  rsvpToken     String       @unique @default(uuid()) // used for public RSVP link
  tableNumber   String?
  notes         String?
  createdBy     String
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  deletedAt     DateTime?

  wedding       Wedding      @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  eventInvites  GuestEventInvite[]

  @@index([weddingId])
  @@index([weddingId, rsvpStatus])
  @@map("guests")
}

enum GuestSide {
  BRIDE
  GROOM
  BOTH
}

enum GatheringType {
  MARDANA
  ZANANA
  MIXED
}

enum RsvpStatus {
  PENDING
  CONFIRMED
  DECLINED
}

model GuestEventInvite {
  id        String   @id @default(uuid())
  guestId   String
  eventId   String
  createdAt DateTime @default(now())

  guest     Guest    @relation(fields: [guestId], references: [id], onDelete: Cascade)
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([guestId, eventId])
  @@map("guest_event_invites")
}
```

## Relationships
- `Wedding` 1 — N `Guest`
- `Guest` N — N `Event` (via `GuestEventInvite`)

---

## API Endpoints

### 5.1 List Guests

```
GET /v1/weddings/:weddingId/guests
Auth required: Yes | Roles: any member
```

**Query Params:**
| Param | Notes |
|---|---|
| `page`, `limit`, `sortBy` (`name`,`createdAt`,`groupSize`), `sortOrder` | standard |
| `search` | matches `name`, `phone` |
| `rsvpStatus` | `PENDING`\|`CONFIRMED`\|`DECLINED` |
| `side` | `BRIDE`\|`GROOM`\|`BOTH` |
| `gathering` | `MARDANA`\|`ZANANA`\|`MIXED` |
| `eventId` | filter guests invited to a specific event |

**Success Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "name": "Rana Aunty", "groupSize": 5, "phone": "+92...",
      "side": "BRIDE", "gathering": "ZANANA", "rsvpStatus": "CONFIRMED",
      "tableNumber": "3"
    }
  ],
  "meta": { "pagination": { } }
}
```

---

### 5.2 Get Guest Summary Counts (powers the 3 summary cards on the Guest screen)

```
GET /v1/weddings/:weddingId/guests/summary
Auth required: Yes | Roles: any member
```

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "totalGuests": 312,
    "confirmedHeads": 248,
    "pendingHeads": 40,
    "declinedHeads": 24,
    "totalGroups": 78
  }
}
```

**Business Logic:** `*Heads` fields SUM `groupSize` grouped by `rsvpStatus` — not a row count, since one row can represent multiple people. This is the number that matters for catering headcount.

---

### 5.3 Create Guest

```
POST /v1/weddings/:weddingId/guests
Auth required: Yes | Roles: owner, co_owner, family_member
```

**Request Body:**
```json
{
  "name": "Khan Family", "groupSize": 6, "phone": "+923001234567",
  "side": "GROOM", "gathering": "MARDANA", "eventIds": ["uuid1", "uuid2"]
}
```

**Validation:**
- `name`: required, 2–150 chars
- `groupSize`: required, integer, min 1, max 50
- `eventIds`: optional array of uuids, each must belong to same `weddingId`

**Business Logic:** creates `Guest`, then bulk-creates `GuestEventInvite` rows for each `eventId` in a transaction. If `eventIds` omitted, guest is considered invited to all wedding events by default (no rows created — absence = "all events" in query logic).

**Success Response `201`**

---

### 5.4 Bulk Import Guests (CSV/Excel upload)

```
POST /v1/weddings/:weddingId/guests/bulk-import
Auth required: Yes | Roles: owner, co_owner, family_member
Content-Type: multipart/form-data
```

**Request Body:** `file` (CSV/XLSX, max 5MB, expected columns: `name, groupSize, phone, side, gathering`)

**Business Logic:**
1. Upload file to temp storage (see Module 10: File Uploads).
2. Parse rows, validate each; collect row-level errors without failing the whole batch.
3. Insert valid rows in a single transaction; return a per-row report.

**Success Response `201`:**
```json
{
  "success": true,
  "data": {
    "importedCount": 45,
    "failedCount": 2,
    "failures": [ { "row": 12, "reason": "groupSize must be a number" } ]
  }
}
```

**Error Responses:** `400 VALIDATION_ERROR` (file type/size), `422` if zero valid rows found.

---

### 5.5 Update Guest

```
PATCH /v1/weddings/:weddingId/guests/:guestId
Auth required: Yes | Roles: owner, co_owner, family_member
```

Same fields as create, all optional. Updating `eventIds` fully replaces existing `GuestEventInvite` links for that guest (diff-and-sync in service layer).

---

### 5.6 Manually Set RSVP Status (in-app, by family member)

```
PATCH /v1/weddings/:weddingId/guests/:guestId/rsvp
Auth required: Yes | Roles: owner, co_owner, family_member
```

**Request Body:**
```json
{ "rsvpStatus": "CONFIRMED" }
```

---

### 5.7 Delete Guest

```
DELETE /v1/weddings/:weddingId/guests/:guestId
Auth required: Yes | Roles: owner, co_owner, family_member
```

Soft delete. **Success Response `204`**

---

### 5.8 Send Digital Invite

```
POST /v1/weddings/:weddingId/guests/:guestId/send-invite
Auth required: Yes | Roles: owner, co_owner, family_member
```

**Business Logic:** Enqueues a background job (Module 11: Jobs) that sends an SMS/WhatsApp/email containing the wedding details + the guest's public RSVP link: `https://app.smartwedding.app/rsvp/:rsvpToken`. Rate-limited to prevent resending spam (max 1 per guest per 24h unless `force: true` passed).

**Request Body (optional):**
```json
{ "channel": "WHATSAPP", "force": false }
```

**Success Response `202`** (accepted — actual send happens async):
```json
{ "success": true, "data": { "message": "Invite queued for delivery." } }
```

---

### 5.9 Bulk Send Invites

```
POST /v1/weddings/:weddingId/guests/bulk-send-invites
Auth required: Yes | Roles: owner, co_owner
```

**Request Body:**
```json
{ "guestIds": ["uuid1", "uuid2"], "channel": "WHATSAPP" }
```

Enqueues individual jobs per guest (avoids one giant blocking request).

---

### 5.10 Public RSVP — Get Invite Details (no auth)

```
GET /v1/public/rsvp/:rsvpToken
Auth required: No (token itself is the credential)
```

**Success Response `200`:** minimal wedding info + guest name + current status, safe for public exposure (no financial/other-guest data).
```json
{
  "success": true,
  "data": {
    "weddingName": "Ayesha & Bilal's Wedding", "weddingDate": "2026-11-29",
    "guestName": "Khan Family", "currentStatus": "PENDING"
  }
}
```

**Error Responses:** `404 NOT_FOUND` — invalid/expired token.

---

### 5.11 Public RSVP — Submit Response (no auth)

```
POST /v1/public/rsvp/:rsvpToken
Auth required: No
```

**Request Body:**
```json
{ "response": "CONFIRMED", "attendingCount": 5, "message": "Excited to be there!" }
```

**Validation:** `response` must be `CONFIRMED` or `DECLINED`; `attendingCount` optional, if provided must be ≤ guest's `groupSize`.

**Business Logic:** updates `Guest.rsvpStatus`; if `attendingCount` provided and differs from `groupSize`, update `groupSize` to reflect actual attendance (documented assumption — alternative: store as separate `confirmedCount` field if exact original group size must be preserved; **recommend adding a `confirmedCount` field** to avoid data loss — flagged as a design decision for the implementing engineer to confirm with product owner).

Triggers an in-app notification to wedding owners (Module 09).

**Success Response `200`**

---

## Workflow

```
Guest created (RSVP: PENDING)
      ↓
Invite sent (background job, Module 11)
      ↓
Guest opens public link → submits RSVP (5.11)
      ↓
Status updates → Dashboard/Summary counts refresh (5.2, Module 08)
      ↓
(Optional) Family member manually overrides status (5.6) if guest confirms via phone call instead
```

## Edge Cases

- Guest RSVPs twice via public link → allow overwrite (last response wins), log both attempts in an audit trail if `AuditLog` (Module 12) is implemented.
- `groupSize` edited down after some guests already confirmed a headcount → no automatic recalculation of catering numbers; summary endpoint (5.2) always reflects live data.
- CSV import with duplicate names → do not auto-merge; treat as separate rows (family may legitimately have two "Khan Family" entries from each side) — dedup is a manual user action, not automatic.

---

*Continue to Module 06: Budget Management*
# Module 06: Budget Management

**Dependency:** Requires Module 02 (Auth) and Module 03 (Wedding + WeddingAccessGuard). Related to Module 04 (Vendor payments can optionally sync into budget entries — see note below).

---

## Overview

Tracks total wedding budget, category-wise spending, and individual expense entries — maps to the frontend "Budget Tracker" screen (total budget card, category rows, "add expense" action).

## Business Logic

- `Wedding.totalBudget` (set in Module 03) is the ceiling.
- Every expense is recorded as a `BudgetItem` under a `BudgetCategory`.
- "Bacha hua paisa" (remaining) = `totalBudget - SUM(all BudgetItem.amount)`.
- Category totals (e.g., "Catering: Rs 9.5L") are `SUM(BudgetItem.amount) GROUP BY category`.
- **Design decision — Vendor payments vs. Budget items relationship:** these are modeled as two related-but-distinct records:
  - A `VendorPayment` (Module 04) records money paid to a *specific vendor*.
  - A `BudgetItem` records money spent under a *category*, which may or may not be tied to a vendor (e.g., "misc transport tips" has no vendor record).
  - To avoid double-counting on the dashboard, every `BudgetItem` has an optional `vendorId` link. When a `VendorPayment` is recorded (Module 04, endpoint 4.6), the service layer **also auto-creates a matching `BudgetItem`** in the same transaction (category inferred from `Vendor.category`), so the Budget screen and Vendor screen always agree on totals without the user entering data twice. This sync logic lives in `VendorService`, calling `BudgetService.createFromVendorPayment()` internally — documented here so both module owners are aware of the cross-module call.

## Database Models

```prisma
model BudgetItem {
  id           String    @id @default(uuid())
  weddingId    String
  category     BudgetCategory
  customCategory String? // used when category = OTHER
  title        String
  amount       Decimal   @db.Decimal(12,2)
  expenseDate  DateTime  @default(now())
  vendorId     String?   // optional link, auto-set when synced from a vendor payment
  paymentMethod PaymentMethod @default(CASH)
  notes        String?
  recordedBy   String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  wedding      Wedding   @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  vendor       Vendor?   @relation(fields: [vendorId], references: [id], onDelete: SetNull)

  @@index([weddingId])
  @@index([weddingId, category])
  @@map("budget_items")
}

enum BudgetCategory {
  CATERING
  DECORATION
  DRESSES
  JEWELLERY
  PHOTOGRAPHY
  VENUE
  TRANSPORT
  INVITATION_CARDS
  SALON_MAKEUP
  GIFTS
  MISCELLANEOUS
  OTHER
}
```

*(Reuses `PaymentMethod` enum from Module 04.)*

## Relationships
- `Wedding` 1 — N `BudgetItem`
- `BudgetItem` N — 1 `Vendor` (optional)

---

## API Endpoints

### 6.1 Get Budget Summary (powers the top card + category rows)

```
GET /v1/weddings/:weddingId/budget/summary
Auth required: Yes | Roles: any member (family_member/viewer see read-only)
```

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "totalBudget": 3200000,
    "totalSpent": 2304000,
    "remaining": 896000,
    "percentUsed": 72,
    "byCategory": [
      { "category": "CATERING", "amount": 950000 },
      { "category": "DECORATION", "amount": 520000 },
      { "category": "DRESSES", "amount": 480000 }
    ]
  }
}
```

**Business Logic:** `percentUsed = round(totalSpent / totalBudget * 100)`. If `totalBudget` is null/0, return `percentUsed: null` and let frontend show "set a budget" prompt rather than dividing by zero.

---

### 6.2 List Budget Items

```
GET /v1/weddings/:weddingId/budget/items
Auth required: Yes | Roles: any member
```

**Query Params:**
| Param | Notes |
|---|---|
| `page`, `limit`, `sortBy` (`expenseDate`,`amount`,`createdAt`), `sortOrder` | standard |
| `category` | filter by `BudgetCategory` |
| `search` | matches `title`, `notes` |
| `dateFrom`, `dateTo` | ISO date range filter on `expenseDate` |
| `vendorId` | filter items linked to a specific vendor |

**Success Response `200`:** paginated array of `BudgetItem`.

---

### 6.3 Get Budget Item Detail

```
GET /v1/weddings/:weddingId/budget/items/:itemId
Auth required: Yes | Roles: any member
```

---

### 6.4 Create Budget Item (manual expense entry)

```
POST /v1/weddings/:weddingId/budget/items
Auth required: Yes | Roles: owner, co_owner
```

**Request Body:**
```json
{
  "category": "TRANSPORT", "title": "Baraat car decoration + fuel",
  "amount": 35000, "expenseDate": "2026-07-15", "paymentMethod": "CASH",
  "notes": "Paid to driver directly"
}
```

**Validation:**
- `category`: required enum; `customCategory` required if `OTHER`
- `title`: required, 2–150 chars
- `amount`: required, positive decimal
- `expenseDate`: optional, defaults to now; cannot be more than 1 year in the future (sanity check)

**Success Response `201`**

---

### 6.5 Update Budget Item

```
PATCH /v1/weddings/:weddingId/budget/items/:itemId
Auth required: Yes | Roles: owner, co_owner
```

**Business Rule:** if this item has a non-null `vendorId` (i.e., it was auto-created from a vendor payment), block direct `amount` edits — return `422` instructing the user to edit the payment via the Vendor module instead, to keep both sides in sync. Other fields (notes, category) remain editable.

---

### 6.6 Delete Budget Item

```
DELETE /v1/weddings/:weddingId/budget/items/:itemId
Auth required: Yes | Roles: owner, co_owner
```

Same rule as 6.5 — if linked to a vendor payment, deletion must happen from the Vendor module (deleting the `VendorPayment` cascades the linked `BudgetItem` deletion). Direct deletion attempts on vendor-linked items return `422 { code: "LINKED_TO_VENDOR_PAYMENT" }`.

**Success Response `204`**

---

### 6.7 List Budget Categories (static reference)

```
GET /v1/budget/categories
Auth required: Yes
```

Same pattern as Module 04 endpoint 4.8.

---

## Workflow

```
Set totalBudget on Wedding (Module 03)
      ↓
Add expenses either:
  (a) Manually via 6.4, OR
  (b) Automatically via Vendor Payment (Module 04, 4.6) → cross-module sync
      ↓
Dashboard (Module 08) reads /budget/summary for the budget widget
```

## Edge Cases

- `totalSpent` exceeds `totalBudget` → not blocked; `remaining` goes negative, `percentUsed` can exceed 100 — frontend shows this as an overspend warning (red bar).
- Vendor deleted (Module 04, soft delete) → its synced `BudgetItem` rows remain (financial history preserved), `vendorId` still points to the soft-deleted vendor for traceability.
- Currency: same single-currency (PKR) assumption as Module 04.

---

*Continue to Module 07: Event Timeline*
# Module 07: Event Timeline & Tasks

**Dependency:** Requires Module 02 (Auth) and Module 03 (Wedding + WeddingAccessGuard).

---

## Part A: Event Timeline

### Overview

Manages the multi-day function schedule (Dholki, Mayun, Mehndi, Baraat, Walima, etc.) — maps to the frontend "Timeline" screen showing a vertical timeline with status (Done / Aane wala / upcoming).

### Business Logic

- Each `Event` represents one function with a date, venue, and time.
- Status is **derived**, not manually set in normal use: `DONE` if `eventDate < now`, `UPCOMING` if in the future, with the single nearest future event flagged as `NEXT` in list responses (matches the "agla: Mehndi" label in the mockup). A manual `status` override field exists for edge cases (postponed/cancelled events).
- Events are referenced by Vendors (Module 04, optional link) and Guests (Module 05, via `GuestEventInvite`).

### Database Models

```prisma
model Event {
  id          String      @id @default(uuid())
  weddingId   String
  name        String      // e.g. "Mehndi", "Baraat" — free text, not a fixed enum, since function names vary by family/region
  eventDate   DateTime
  startTime   String?     // stored as "HH:mm" — simpler than full datetime for a recurring-format time-of-day
  venueName   String?
  venueAddress String?
  notes       String?
  manualStatus EventStatus? // null = auto-derive from date; set = override (e.g. CANCELLED)
  createdBy   String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  deletedAt   DateTime?

  wedding     Wedding     @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  vendors     Vendor[]
  guestInvites GuestEventInvite[]
  tasks       Task[]

  @@index([weddingId])
  @@index([weddingId, eventDate])
  @@map("events")
}

enum EventStatus {
  UPCOMING
  DONE
  CANCELLED
  POSTPONED
}
```

### Relationships
- `Wedding` 1 — N `Event`
- `Event` 1 — N `Vendor` (optional link, from Module 04)
- `Event` N — N `Guest` (via `GuestEventInvite`, from Module 05)
- `Event` 1 — N `Task`

---

### API Endpoints

#### 7.1 List Events (Timeline view)

```
GET /v1/weddings/:weddingId/events
Auth required: Yes | Roles: any member
```

**Query Params:** `page`, `limit` (default higher, e.g. 50, since event count is small), `sortBy` default `eventDate` asc.

**Success Response `200`:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Dholki", "eventDate": "2026-03-12", "venueName": "Ghar", "computedStatus": "DONE" },
    { "id": "uuid", "name": "Mehndi", "eventDate": "2026-03-28", "venueName": "Pearl Hall", "computedStatus": "NEXT" },
    { "id": "uuid", "name": "Baraat", "eventDate": "2026-03-29", "venueName": "Grand Marquee", "computedStatus": "UPCOMING" }
  ]
}
```

**Business Logic:** `computedStatus` = `manualStatus` if set, else derived from `eventDate` vs `now()`; exactly one future event (the earliest) is labeled `NEXT` instead of `UPCOMING`.

---

#### 7.2 Get Event Detail

```
GET /v1/weddings/:weddingId/events/:eventId
Auth required: Yes | Roles: any member
```

Includes counts: `linkedVendorsCount`, `invitedGuestsCount`, `openTasksCount`.

---

#### 7.3 Create Event

```
POST /v1/weddings/:weddingId/events
Auth required: Yes | Roles: owner, co_owner, family_member (propose)
```

**Request Body:**
```json
{ "name": "Mehndi", "eventDate": "2026-03-28", "startTime": "18:00", "venueName": "Pearl Hall", "venueAddress": "..." }
```

**Validation:** `name` required 2–100 chars; `eventDate` required valid date; `startTime` optional, format `HH:mm`.

---

#### 7.4 Update Event

```
PATCH /v1/weddings/:weddingId/events/:eventId
Auth required: Yes | Roles: owner, co_owner
```

---

#### 7.5 Delete Event

```
DELETE /v1/weddings/:weddingId/events/:eventId
Auth required: Yes | Roles: owner, co_owner
```

Soft delete. Linked `Vendor.eventId` set to null (`onDelete: SetNull`), `GuestEventInvite` rows cascade-deleted, `Task` rows linked to this event become wedding-level (unlinked) — implement as explicit service-layer step since Prisma cascade behavior must be set per-relation intentionally.

---

## Part B: Tasks

### Overview

Simple checklist system for wedding-planning to-dos, with optional assignment to a specific family member and optional link to an `Event`. Supports the "task ownership" feature from the solution document.

### Database Models

```prisma
model Task {
  id            String     @id @default(uuid())
  weddingId     String
  eventId       String?
  title         String
  description   String?
  assignedTo    String?    // userId
  dueDate       DateTime?
  status        TaskStatus @default(PENDING)
  priority      TaskPriority @default(MEDIUM)
  createdBy     String
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  deletedAt     DateTime?

  wedding       Wedding    @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  event         Event?     @relation(fields: [eventId], references: [id], onDelete: SetNull)

  @@index([weddingId])
  @@index([weddingId, status])
  @@index([assignedTo])
  @@map("tasks")
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  DONE
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
}
```

### API Endpoints

#### 7.6 List Tasks

```
GET /v1/weddings/:weddingId/tasks
Auth required: Yes | Roles: any member
```

**Query Params:** `page`, `limit`, `sortBy` (`dueDate`,`priority`,`createdAt`), `sortOrder`, `status`, `assignedTo`, `eventId`, `search` (title/description).

---

#### 7.7 Create Task

```
POST /v1/weddings/:weddingId/tasks
Auth required: Yes | Roles: owner, co_owner, family_member
```

**Request Body:**
```json
{ "title": "Confirm salon booking", "assignedTo": "userId", "dueDate": "2026-03-25", "priority": "HIGH", "eventId": "uuid" }
```

**Validation:** `title` required 2–200 chars; `assignedTo` if provided must be a member of the wedding (validated against `WeddingMember`); `eventId` if provided must belong to same wedding.

---

#### 7.8 Update Task

```
PATCH /v1/weddings/:weddingId/tasks/:taskId
Auth required: Yes | Roles: owner, co_owner, family_member (any member can update tasks assigned to them — see permission note below)
```

**Permission nuance:** a `family_member` can always update the `status` field of a task **assigned to themselves**, even though general task editing is owner/co_owner-level. Implement as: allow PATCH if `(role in [owner, co_owner]) OR (task.assignedTo == currentUserId AND body only contains 'status')`.

---

#### 7.9 Delete Task

```
DELETE /v1/weddings/:weddingId/tasks/:taskId
Auth required: Yes | Roles: owner, co_owner
```

---

## Edge Cases (both parts)

- Event date changed after guests/vendors already linked → no cascading changes needed, links remain by ID; only the displayed date changes.
- Task assigned to a user who is later removed from the wedding (Module 03, 3.10) → `assignedTo` retained (historical record) but service layer should surface these as "unassigned member" in list responses (join against current `WeddingMember` to detect).
- Two events on the same date/time → allowed, no uniqueness constraint (real weddings do have overlapping-venue logistics the user needs to see, not have blocked).

---

*Continue to Module 08: Dashboard*
# Module 08: Dashboard

**Dependency:** Requires Modules 03–07 (aggregates data from Weddings, Vendors, Guests, Budget, Events, Tasks). Build this **last** among the core modules.

---

## Overview

Powers the frontend "Home Dashboard" screen — the single aggregated view showing overall progress, countdown, and quick-glance cards (budget %, guest count, vendor count, event count).

## Business Logic

This module has **no own database table** — it is a read-only aggregation layer that queries other modules' repositories and composes a single response. This keeps the dashboard always accurate (no stale cached counters to keep in sync) at the cost of a heavier query — mitigated with Redis caching (see Performance section).

**Overall progress percentage** is a weighted composite metric, calculated as:
```
progress = average of:
  - tasksCompletionRate   (DONE tasks / total tasks)
  - vendorsBookedRate     (vendors with status != PENDING / total vendors)
  - guestRsvpRate         (CONFIRMED + DECLINED guests / total guests)  // "responded" rate
  - budgetPlanningRate    (1 if totalBudget is set, else 0 — binary "did they plan a budget")
```
This exact formula is a **documented assumption** — flagged for product-owner confirmation, since "wedding progress" is inherently subjective. The implementing engineer should keep this logic isolated in a single `calculateProgress()` function in `dashboard.service.ts` so it can be tuned later without touching controllers.

## API Endpoints

### 8.1 Get Dashboard Summary

```
GET /v1/weddings/:weddingId/dashboard
Auth required: Yes | Roles: any member
```

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "weddingName": "Ayesha & Bilal's Wedding",
    "daysUntilWedding": 24,
    "overallProgress": 68,
    "tasksCompleted": 17,
    "tasksTotal": 25,
    "budget": {
      "totalBudget": 3200000,
      "totalSpent": 2304000,
      "percentUsed": 72
    },
    "guests": {
      "total": 312,
      "confirmed": 248
    },
    "vendors": {
      "totalCount": 8,
      "fullyPaidCount": 5
    },
    "events": {
      "totalCount": 5,
      "nextEvent": { "id": "uuid", "name": "Mehndi", "eventDate": "2026-03-28" }
    }
  }
}
```

**Business Logic — data sources per field:**
| Field | Source |
|---|---|
| `daysUntilWedding` | `Wedding.weddingDate - now()`, in days, floored |
| `overallProgress` | computed per formula above |
| `tasksCompleted/Total` | `Task` table `COUNT` grouped by status (Module 07) |
| `budget.*` | reuses `Module 06, endpoint 6.1` logic internally (service-to-service call, not HTTP) |
| `guests.*` | reuses `Module 05, endpoint 5.2` logic internally |
| `vendors.*` | `Vendor` + `VendorPayment` aggregation (Module 04) |
| `events.*` | `Event` table, nearest future event (Module 07) |

**Caching:** cache this response in Redis with key `dashboard:{weddingId}`, TTL 60 seconds. Invalidate (delete key) on any write to Vendor, Guest, BudgetItem, Event, or Task within that wedding — implement via a shared `CacheInvalidationService.invalidateDashboard(weddingId)` called at the end of each mutating service method across modules. This is the one place where modules "know about" the dashboard cache — documented here so it isn't missed during implementation.

---

### 8.2 Get Recent Activity Feed (optional enhancement, supports a future "what's new" widget)

```
GET /v1/weddings/:weddingId/dashboard/activity
Auth required: Yes | Roles: any member
```

**Query Params:** `limit` (default 10, max 50)

**Business Logic:** Requires an `AuditLog` table (see note in Module 12) capturing create/update/delete events across modules with `weddingId`, `actorUserId`, `action`, `entityType`, `entityId`, `createdAt`. Returns most recent N entries, human-readable via a `description` field composed at write-time (e.g., "Ayesha added a payment of Rs 500,000 to Al-Madina Caterers").

**Note:** This endpoint is **not required for MVP** — it is included here because a "recent activity" feed is a natural extension of a shared multi-user dashboard and was flagged during UI analysis as a likely near-term ask. Documented so it's not a surprise scope addition later; implement only if prioritized.

---

## Edge Cases

- Wedding has zero guests/vendors/tasks yet (brand new wedding) → all rates in the progress formula default to `0` (not `NaN` from divide-by-zero) — guard every division in `calculateProgress()`.
- `weddingDate` not set → `daysUntilWedding: null`, frontend shows "set your wedding date" prompt instead of a countdown.
- Wedding date in the past (event already happened) → `daysUntilWedding` returns a negative number; frontend interprets negative as "wedding day has passed."

---

*Continue to Module 09: Notifications*
# Module 09: Notifications & Module 10: File Uploads

**Dependency:** Requires Module 02 (Auth), Module 03 (Wedding). Notifications are triggered *from* other modules (Guests, Vendors, Weddings) — see cross-references.

---

## Part A: Notifications

### Overview

In-app notification center + push/email/SMS delivery for reminders and events (payment due, RSVP received, invite received, task assigned) — supports the "Reminders & Alerts" feature from the solution document.

### Business Logic

- Two layers: **in-app** notifications (stored, shown in a bell-icon list) and **external delivery** (push notification via FCM, email, or SMS/WhatsApp) — a notification can trigger one or both.
- Notifications are created by other modules calling `NotificationService.create()` — never created directly via a public "create notification" endpoint (prevents abuse).
- Scheduled reminders (e.g., "payment due in 3 days") are produced by a recurring background job (Module 11) that scans for upcoming due dates and calls the same `NotificationService.create()`.

### Database Models

```prisma
model Notification {
  id          String    @id @default(uuid())
  weddingId   String
  userId      String    // recipient
  type        NotificationType
  title       String
  body        String
  entityType  String?   // e.g. "Vendor", "Guest", "Task" — for deep-linking
  entityId    String?
  isRead      Boolean   @default(false)
  createdAt   DateTime  @default(now())

  wedding     Wedding   @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([weddingId])
  @@map("notifications")
}

enum NotificationType {
  PAYMENT_DUE_REMINDER
  TASK_DUE_REMINDER
  RSVP_RECEIVED
  MEMBER_INVITED
  MEMBER_JOINED
  TASK_ASSIGNED
  EVENT_REMINDER
  GENERAL
}

model DeviceToken {
  id          String   @id @default(uuid())
  userId      String
  fcmToken    String   @unique
  platform    Platform
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("device_tokens")
}

enum Platform {
  IOS
  ANDROID
}
```

### API Endpoints

#### 9.1 List My Notifications

```
GET /v1/notifications
Auth required: Yes
```

**Query Params:** `page`, `limit`, `isRead` (filter), `weddingId` (optional — filter to one wedding if user belongs to multiple).

**Success Response `200`:** paginated `Notification[]`, plus `meta.unreadCount`.

---

#### 9.2 Mark Notification as Read

```
PATCH /v1/notifications/:notificationId/read
Auth required: Yes
```

**Authorization:** must belong to the requesting user (`userId` matches `CurrentUser`) — not wedding-role-based, purely ownership-based.

---

#### 9.3 Mark All as Read

```
PATCH /v1/notifications/read-all
Auth required: Yes
```

**Query Params:** `weddingId` (optional, scopes the bulk-read to one wedding).

---

#### 9.4 Register Device Token (for push notifications)

```
POST /v1/notifications/device-token
Auth required: Yes
```

**Request Body:**
```json
{ "fcmToken": "...", "platform": "ANDROID" }
```

Upserts — if token already registered (possibly to a different user, e.g., shared/reset device), reassign to current user.

---

#### 9.5 Unregister Device Token (on logout)

```
DELETE /v1/notifications/device-token
Auth required: Yes
```

**Request Body:**
```json
{ "fcmToken": "..." }
```

Called by the mobile app alongside `POST /v1/auth/logout` (Module 02) so a logged-out device stops receiving pushes for that user.

---

### Cross-Module Trigger Points (reference for other module implementers)

| Event | Triggered from | Notification type |
|---|---|---|
| Guest submits RSVP | Module 05, endpoint 5.11 | `RSVP_RECEIVED` → all owner/co_owner |
| Member invited | Module 03, endpoint 3.8 | `MEMBER_INVITED` → invitee (if existing user) |
| Member accepts invite | Module 03, endpoint 3.9 | `MEMBER_JOINED` → wedding owner |
| Task assigned to someone | Module 07, endpoint 7.7/7.8 | `TASK_ASSIGNED` → assignee |
| Vendor payment approaching balance-due milestone | scheduled job (Module 11) | `PAYMENT_DUE_REMINDER` |
| Task due date approaching (24h before) | scheduled job (Module 11) | `TASK_DUE_REMINDER` |
| Event approaching (48h before) | scheduled job (Module 11) | `EVENT_REMINDER` |

---

## Part B: File Uploads

### Overview

Handles image uploads (vendor photos, guest bulk-import files, wedding cover image, user profile photos) to S3-compatible storage. Supports the "vendor photos" and "cover image" fields referenced throughout the mockup screens.

### Business Logic

- Files are uploaded directly to a pre-signed S3 URL from the mobile client (not proxied through the API server) to avoid loading the backend with binary data — the API only issues the pre-signed URL and validates the resulting object afterward.
- Two-step flow: (1) request upload URL, (2) client uploads directly to S3, (3) client confirms completion, backend validates the object exists and records its public URL.

### API Endpoints

#### 10.1 Request Upload URL

```
POST /v1/uploads/presigned-url
Auth required: Yes
```

**Request Body:**
```json
{ "fileName": "vendor-photo.jpg", "fileType": "image/jpeg", "purpose": "VENDOR_IMAGE" }
```

**Validation:**
- `fileType`: must be in allowlist — `image/jpeg`, `image/png`, `image/webp` for images; `text/csv`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` for guest imports (Module 05, 5.4).
- `purpose`: enum `VENDOR_IMAGE`, `WEDDING_COVER`, `PROFILE_PHOTO`, `GUEST_IMPORT` — determines the S3 key prefix and max file size (images 5MB, import files 5MB).

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://s3.../presigned...",
    "fileKey": "vendor-images/uuid.jpg",
    "publicUrl": "https://cdn.smartwedding.app/vendor-images/uuid.jpg",
    "expiresIn": 300
  }
}
```

**Error Responses:** `400 VALIDATION_ERROR` — disallowed file type or purpose.

---

#### 10.2 Confirm Upload

```
POST /v1/uploads/confirm
Auth required: Yes
```

**Request Body:**
```json
{ "fileKey": "vendor-images/uuid.jpg" }
```

**Business Logic:** performs a HEAD request against S3 to confirm the object exists (client actually completed the upload) before returning success — prevents broken image references if the client abandoned the upload.

**Success Response `200`:**
```json
{ "success": true, "data": { "publicUrl": "https://cdn.smartwedding.app/vendor-images/uuid.jpg" } }
```

**Error Responses:** `404 NOT_FOUND` — object not found in S3 (upload never completed).

---

### Security (Uploads-specific)

- Pre-signed URLs expire in 5 minutes.
- File size enforced both client-side (frontend) and via S3 bucket policy (`content-length-range`) as a server-side backstop.
- Uploaded images should be passed through a virus/malware scan (e.g., AWS's ClamAV Lambda layer, or a third-party API) before `publicUrl` is considered "confirmed" for production hardening — documented as a recommended addition, not blocking MVP.
- CDN (CloudFront/Cloudflare) in front of the S3 bucket for image delivery performance.

---

*Continue to Module 11: Background Jobs & Module 12: Security/Audit*
# Module 11: Background Jobs & Module 12: Security / Audit

---

## Module 11: Background Jobs

### Overview

BullMQ (Redis-backed) queue system for all async/scheduled work: sending invites, reminders, notification delivery, and future AI processing.

### Queue Definitions

| Queue name | Job type | Trigger | Processor location |
|---|---|---|---|
| `guest-invites` | Send RSVP invite (SMS/WhatsApp/email) | Module 05, 5.8/5.9 | `jobs/invite.processor.ts` |
| `notifications` | Deliver push/email for a `Notification` row | Any module via `NotificationService` | `jobs/notification.processor.ts` |
| `reminders` | Scan for upcoming due dates, create reminder notifications | Cron (daily, 8am) | `jobs/reminder.processor.ts` |
| `guest-import` | Parse & validate bulk CSV/XLSX upload | Module 05, 5.4 | `jobs/guest-import.processor.ts` |

### Reminder Job Logic (runs daily via cron)

```
1. Query all Weddings with weddingDate in the future.
2. For each wedding:
   a. Find Tasks with dueDate within next 24h and status != DONE → create TASK_DUE_REMINDER
   b. Find Events with eventDate within next 48h → create EVENT_REMINDER
   c. Find Vendors with balanceDue > 0 (computed) — no due date on vendor,
      so this checks a configurable "days before wedding" threshold
      (e.g., 14 days before weddingDate) → create PAYMENT_DUE_REMINDER
3. Deduplicate: do not create the same reminder twice in 24h
   (check for an existing Notification of the same type/entityId created in last 24h).
```

### Retry & Failure Policy

- All jobs: 3 retry attempts, exponential backoff (5s, 30s, 2min).
- Failed jobs after exhausting retries → logged to monitoring (see Performance/Monitoring below), not silently dropped.
- `guest-import` failures are partial by design (see Module 05, 5.4) — job-level failure only occurs on total file parse failure (corrupt file).

---

## Module 12: Security & Audit

### Overview

Cross-cutting security measures and (recommended, flagged as post-MVP) audit logging.

### JWT Authentication (implementation detail, consolidates Module 02)

- Access token payload: `{ sub: userId, email, iat, exp }` — deliberately excludes wedding/role info (roles are looked up fresh per-request via `WeddingAccessGuard` querying `WeddingMember`, so a role change takes effect immediately rather than waiting for token refresh).
- Refresh token payload: `{ sub: userId, tokenId, iat, exp }` — `tokenId` matches the `RefreshToken.id` for DB lookup/revocation.

### Password Hashing
bcrypt, cost factor 12 (Module 02).

### Rate Limiting

Implemented via `@nestjs/throttler` backed by Redis (shared state across horizontally-scaled instances).

| Route pattern | Limit |
|---|---|
| `/v1/auth/login` | 5 / 15 min / IP |
| `/v1/auth/register` | 5 / 15 min / IP |
| `/v1/auth/forgot-password` | 3 / 15 min / IP |
| `/v1/public/rsvp/*` | 10 / min / IP (public endpoint, needs abuse protection) |
| All other authenticated routes | 100 / min / user |

### Input Validation
All request bodies validated via `class-validator` DTOs at the controller boundary (NestJS `ValidationPipe`, global, `whitelist: true` — strips unknown fields, `forbidNonWhitelisted: true` — rejects requests with unexpected fields).

### XSS Protection
- All user-supplied text fields (notes, titles, guest names) are stored as-is (not HTML-escaped in DB) but **escaped on render** — this is a frontend responsibility, documented here so the frontend team knows the backend does not sanitize/strip HTML from input (avoids double-encoding issues). Backend responsibility is limited to rejecting `<script>` tags in fields never meant to contain markup, via a shared validator if product requires stricter enforcement.

### SQL Injection Prevention
Prisma's parameterized queries are used exclusively — no raw string-concatenated SQL anywhere in the codebase. Any future raw query (`$queryRaw`) must use Prisma's tagged-template parameterization, never string interpolation.

### CORS
```
Allowed origins: mobile app (via Capacitor/React Native — typically no browser CORS concern),
                  admin web dashboard (if built) — explicit allowlist, not wildcard.
Allowed methods: GET, POST, PATCH, DELETE
Credentials: true (if cookies used for web dashboard sessions)
```

### CSRF
Not applicable to the mobile app (token-based auth, not cookie-based) — only relevant if a companion web dashboard is later built using cookie sessions, in which case standard double-submit-cookie CSRF protection should be added at that time.

### File Upload Validation
Covered in Module 10 — type allowlist, size limits, presigned URL expiry.

### Permission Middleware
`WeddingAccessGuard` + `RolesGuard` (Module 02/03) applied globally to all `/v1/weddings/:weddingId/*` routes via a route-level guard composition — never rely on service-layer checks alone; guards run before controller logic executes.

### Audit Logs (recommended addition — not MVP-blocking, flagged for planning)

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  weddingId   String
  actorUserId String
  action      String   // e.g. "VENDOR_PAYMENT_CREATED"
  entityType  String
  entityId    String
  metadata    Json?    // before/after snapshot for critical financial changes
  createdAt   DateTime @default(now())

  @@index([weddingId, createdAt])
  @@map("audit_logs")
}
```

Recommended to log at minimum: all budget/vendor-payment mutations, member role changes, wedding deletion. Powers Module 08's optional activity feed (8.2).

---

## Performance & Scalability Notes

| Concern | Recommendation |
|---|---|
| Database indexing | Every table scoped by `weddingId` has an index on `weddingId` (shown in each module's Prisma schema above) — this is the single most important index across the system since nearly every query filters by it. |
| Query optimization | Dashboard aggregations (Module 08) use SQL `GROUP BY`/`SUM` rather than fetching rows into application memory. |
| Redis caching | Dashboard summary (60s TTL), budget summary and guest summary can share the same cache-invalidation pattern if they become hot paths. |
| Background jobs | All slow/external operations (sending SMS, email, push) are queued, never run inline in a request-response cycle. |
| File storage | S3 + CDN, direct-to-S3 upload (Module 10) keeps the API stateless and light. |
| Pagination | Enforced (max `limit: 100`) on every list endpoint to prevent unbounded queries. |
| Lazy loading | Mobile app should paginate guest/vendor/budget lists rather than fetching all at once — API supports this natively via the standard pagination params (Module 01, section 5.5). |
| Microservice readiness | Current modular monolith (NestJS modules) is intentionally structured so any module (e.g., `notifications`, `ai`) could be extracted into a separate service later — each module's repository layer is the only thing that would need to become an API client instead of a direct Prisma call. |
| Event-driven future | NestJS's built-in `EventEmitter` can be introduced for in-process module decoupling (e.g., "GuestRsvpConfirmed" event → Notification module listens) before graduating to a full message broker (e.g., SQS/RabbitMQ) if scale demands it. |

---

*This completes the module-by-module specification. See the final document section for the Postman Collection generation guide and the missing-features summary.*
# Implementation Guide for Claude Code Agent

This section is written directly for the coding agent implementing this backend.

## Build Order (respects dependency notes in each module)

```
1. Project scaffold: NestJS + Prisma + PostgreSQL + Redis (docker-compose for local dev)
2. Module 01 setup: global config, common/ folder (guards, filters, interceptors, response envelope)
3. Module 02: Authentication (register, login, Google OAuth, forgot/reset password, refresh, logout)
4. Module 03: Users & Weddings (creates WeddingAccessGuard + RolesGuard used by everything after)
5. Module 04: Vendors
6. Module 05: Guests & RSVP
7. Module 06: Budget (cross-references Module 04's vendor payment sync — implement after 04)
8. Module 07: Events & Tasks
9. Module 08: Dashboard (aggregates 03–07 — build last among core modules)
10. Module 09: Notifications & Uploads
11. Module 11: Background Jobs (BullMQ queues, cron reminder job)
12. Module 12: Security hardening pass (rate limiting, audit logs if in scope)
13. Generate Postman collection (see below) from the final route list
```

## Rules to Follow While Implementing

1. **One module = one folder under `src/modules/`.** Do not let one module's service import another module's Prisma model directly except through the documented cross-module calls (e.g., `VendorService` → `BudgetService.createFromVendorPayment()`, `NotificationService.create()` called from other modules). This keeps modules independently testable.
2. **Every list endpoint must implement pagination, sorting, search, and filtering exactly as documented per module** — do not skip params to save time; the frontend is already built expecting them.
3. **Every response must use the standard envelope** (Module 01, section 5.2) — implement this once as a global `ResponseInterceptor`, never manually wrap responses in each controller.
4. **Every protected wedding-scoped route must pass through `WeddingAccessGuard`** — apply it at the controller level (`@UseGuards(JwtAuthGuard, WeddingAccessGuard)`), not per-method, to avoid accidentally leaving a route unguarded.
5. **All monetary fields are `Decimal(12,2)`** — never use floating point (`Float`) for money in Prisma schema or in application code; use a decimal library (e.g., `decimal.js`, which Prisma's `Decimal` type already wraps) for any arithmetic.
6. **Soft delete via `deletedAt`** — every `findMany`/`findFirst` query must include `deletedAt: null` in its `where` clause. Recommend a Prisma middleware (`$use`) that automatically injects this filter globally, rather than remembering it in every repository method.
7. **Write DTOs with `class-validator` decorators matching the validation rules documented per endpoint exactly** — the validation rules in each module are the spec, not a suggestion.
8. **Generate Swagger/OpenAPI docs from the same DTOs** (`@nestjs/swagger` decorators) — this keeps a machine-readable spec in sync with the code, and can be used to auto-generate the Postman collection (see below) instead of hand-writing it.

## Environment Variables Required (`.env.example` to create)

```
# App
NODE_ENV=development
PORT=3000
API_PREFIX=v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/smart_wedding

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=change-me
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=change-me-too
JWT_REFRESH_EXPIRY=30d

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# S3 / File Storage
S3_BUCKET_NAME=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
CDN_BASE_URL=

# Email (for password reset, invites)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@smartwedding.app

# SMS/WhatsApp (for guest invites)
WHATSAPP_API_KEY=
SMS_API_KEY=

# Push Notifications
FCM_SERVER_KEY=

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

---

## Postman Collection — Generation Instructions

Generate a single Postman collection JSON file (`Smart-Wedding-API.postman_collection.json`) plus an environment file (`Smart-Wedding.postman_environment.json`). Structure as follows:

### Collection Folder Structure (mirrors the modules)

```
Smart Wedding API
├── 01 - Authentication
│   ├── Register
│   ├── Login
│   ├── Google Login
│   ├── Forgot Password
│   ├── Reset Password
│   ├── Refresh Token
│   ├── Logout
│   ├── Logout All Devices
│   └── Get Active Sessions
├── 02 - Users & Weddings
│   ├── Get My Profile
│   ├── Update Profile
│   ├── Create Wedding
│   ├── Get Wedding Details
│   ├── Update Wedding Settings
│   ├── Delete Wedding
│   ├── List Members
│   ├── Invite Member
│   ├── Accept Invite
│   ├── Remove Member
│   └── Update Member Role
├── 03 - Vendors
│   ├── List Vendors
│   ├── Get Vendor Detail
│   ├── Create Vendor
│   ├── Update Vendor
│   ├── Delete Vendor
│   ├── Record Payment
│   ├── Delete Payment
│   └── List Vendor Categories
├── 04 - Guests & RSVP
│   ├── List Guests
│   ├── Get Guest Summary
│   ├── Create Guest
│   ├── Bulk Import Guests
│   ├── Update Guest
│   ├── Set RSVP Status
│   ├── Delete Guest
│   ├── Send Digital Invite
│   ├── Bulk Send Invites
│   ├── [Public] Get RSVP Invite
│   └── [Public] Submit RSVP
├── 05 - Budget
│   ├── Get Budget Summary
│   ├── List Budget Items
│   ├── Get Budget Item Detail
│   ├── Create Budget Item
│   ├── Update Budget Item
│   ├── Delete Budget Item
│   └── List Budget Categories
├── 06 - Events & Tasks
│   ├── List Events
│   ├── Get Event Detail
│   ├── Create Event
│   ├── Update Event
│   ├── Delete Event
│   ├── List Tasks
│   ├── Create Task
│   ├── Update Task
│   └── Delete Task
├── 07 - Dashboard
│   ├── Get Dashboard Summary
│   └── Get Recent Activity
├── 08 - Notifications
│   ├── List Notifications
│   ├── Mark as Read
│   ├── Mark All as Read
│   ├── Register Device Token
│   └── Unregister Device Token
└── 09 - File Uploads
    ├── Request Upload URL
    └── Confirm Upload
```

### Environment Variables to Include

```json
{
  "baseUrl": "http://localhost:3000/v1",
  "accessToken": "",
  "refreshToken": "",
  "weddingId": "",
  "userId": "",
  "vendorId": "",
  "guestId": "",
  "eventId": "",
  "taskId": "",
  "budgetItemId": ""
}
```

### Per-Request Requirements

For every request in the collection, include:
1. **Pre-configured Authorization** — `Bearer {{accessToken}}` at the collection level (inherited by all requests), except the public/unauthenticated endpoints (register, login, forgot-password, public RSVP endpoints) which explicitly set "No Auth."
2. **Example request body** — populated with realistic sample data matching the exact JSON shown in each module's endpoint documentation above (not placeholder text like "string").
3. **Saved example responses** — at least one 200/201 success example and one error example (e.g., 400 validation error) per endpoint, copied directly from the "Success Response" / "Error Responses" blocks documented above.
4. **Tests script** on login/register/refresh requests that auto-saves `accessToken` and `refreshToken` into the environment:
```javascript
const response = pm.response.json();
if (response.success && response.data.accessToken) {
    pm.environment.set("accessToken", response.data.accessToken);
    pm.environment.set("refreshToken", response.data.refreshToken);
}
```
5. **Path variables** using the environment variables (e.g., `{{baseUrl}}/weddings/{{weddingId}}/vendors/{{vendorId}}`) so the frontend developer can run the whole collection sequentially and have IDs auto-populate.

### Recommended Generation Method

Rather than hand-writing the JSON, generate it from the NestJS Swagger/OpenAPI spec (produced automatically if `@nestjs/swagger` decorators are added per the implementation rules above):

```bash
# 1. Start the API with Swagger enabled (typically exposes /api-json)
curl http://localhost:3000/api-json -o openapi-spec.json

# 2. Convert to Postman collection using the official converter
npx openapi-to-postmanv2 -s openapi-spec.json -o Smart-Wedding-API.postman_collection.json -p
```

This guarantees the Postman collection never drifts out of sync with the actual implemented routes. Manually enrich the generated collection afterward with the example responses and test scripts described above (the converter does not generate these automatically).

Deliver both files (`Smart-Wedding-API.postman_collection.json` and `Smart-Wedding.postman_environment.json`) to the frontend developer — they should be able to import both, select the environment, and immediately start calling every endpoint with working example payloads.

---

## End of Backend Technical Documentation

Total modules: 12 (Overview/Architecture, Authentication, Users & Weddings, Vendors, Guests & RSVP, Budget, Events & Tasks, Dashboard, Notifications, File Uploads, Background Jobs, Security & Audit).
