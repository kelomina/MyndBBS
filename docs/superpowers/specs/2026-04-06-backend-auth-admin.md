# Backend Auth, Captcha, & Admin API Design Specification
Date: 2026-04-06

## 1. Overview
This specification outlines the backend architecture and API design for MyndBBS. It focuses on implementing a highly secure authentication system using Argon2id for password hashing, a server-side verified anti-automation slider captcha, and the foundational APIs for the Admin Panel (User, Category, and Post management). The backend runs on Node.js/Express with Prisma connecting to a local SQLite database.

## 2. Database Schema (Prisma)
The following models will be added or modified in `packages/backend/prisma/schema.prisma`:

### 2.1. CaptchaChallenge (New)
Stores the state of an active slider captcha challenge.
- `id` (String, UUID)
- `targetPosition` (Int) - The randomly generated target X coordinate.
- `verified` (Boolean) - Defaults to false. Set to true if the trajectory and final position pass server-side checks.
- `expiresAt` (DateTime) - 5 minutes from creation.

### 2.2. User (Modified)
- Replace `passwordHash` and `passwordSalt` with a single `password` field (String), as Argon2id includes the salt in its output string.
- Existing fields: `role` (USER, ADMIN, MODERATOR), `status` (ACTIVE, BANNED, PENDING).

### 2.3. Category (New)
Represents a forum node/partition.
- `id` (String, UUID)
- `name` (String, Unique)
- `description` (String?)
- `sortOrder` (Int)
- `createdAt`, `updatedAt`

### 2.4. Post (New)
Represents a user's forum post.
- `id` (String, UUID)
- `title` (String)
- `content` (String, Markdown text)
- `authorId` (String, Relation to User)
- `categoryId` (String, Relation to Category)
- `status` (Enum: PUBLISHED, HIDDEN, PINNED)
- `createdAt`, `updatedAt`

## 3. Authentication & Security

### 3.1. Password Hashing (Argon2id)
We will use the `argon2` npm package.
- **Registration**: Hash the user-provided password using `argon2.hash()` and store it in the `password` field.
- **Login**: Verify the password using `argon2.verify()`.
- **JWT**: Upon successful login, generate a JSON Web Token (JWT) containing `{ userId, role, status }` signed with a strong secret.

### 3.2. Server-Side Slider Captcha
The frontend will render the slider UI (`增强反自动化滑块验证系统.html`), but the validation logic will reside entirely on the backend to prevent tampering.

**API: `GET /api/auth/captcha`**
- **Action**: Generates a random `targetPosition` (e.g., between 80 and TrackWidth - TargetWidth).
- **Storage**: Saves a new `CaptchaChallenge` record with `verified = false`.
- **Response**: `{ captchaId, targetPosition }`. (The frontend needs the targetPosition to render the target zone).

**API: `POST /api/auth/captcha/verify`**
- **Payload**: `{ captchaId, dragPath: [{x, time}, ...], totalDragTime, finalPosition }`
- **Validation Logic**:
  1. Check if `CaptchaChallenge` exists and is not expired.
  2. **Automation Check 1**: `totalDragTime` < 200ms -> Fail.
  3. **Automation Check 2**: `dragPath.length` < 8 -> Fail.
  4. **Automation Check 3 (Variance)**: Calculate the standard deviation of time intervals between points in `dragPath`. If `< 1.5` (too uniform), -> Fail.
  5. **Position Check**: Calculate the center offset between `finalPosition` and `targetPosition`. If absolute difference > 35px -> Fail.
- **Action**: If all checks pass, update `CaptchaChallenge.verified = true`.
- **Response**: `{ success: true/false, message }`.

**API: `POST /api/auth/register`**
- **Payload**: `{ email, username, password, captchaId }`
- **Action**: Query `CaptchaChallenge` by `captchaId`. It MUST exist, not be expired, and have `verified == true`. If valid, proceed to hash the password with Argon2 and create the User.

## 4. Admin Panel APIs
These routes will be protected by a middleware (`isAdmin`) that verifies the JWT and ensures the user's role is `ADMIN` or `MODERATOR`.

### 4.1. User Management (`/api/admin/users`)
- `GET /`: List all users with pagination.
- `PATCH /:id/role`: Update user role (e.g., promote to MODERATOR).
- `PATCH /:id/status`: Ban or unban a user (ACTIVE <-> BANNED).

### 4.2. Category Management (`/api/admin/categories`)
- `GET /`: List all categories.
- `POST /`: Create a new category.
- `PUT /:id`: Update category name/description.
- `DELETE /:id`: Delete a category (if no posts exist).

### 4.3. Post Management (`/api/admin/posts`)
- `GET /`: List all posts across the platform.
- `PATCH /:id/status`: Change post status (e.g., from PUBLISHED to HIDDEN to moderate inappropriate content, or PINNED to stick it to the top).