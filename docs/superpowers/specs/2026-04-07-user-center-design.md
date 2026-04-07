# User Center Data Integration Design

## Context
The project already has a static frontend mockup for the public profile (`/u/[username]`) and a settings dashboard (`/u/settings`). The goal is to implement the User Center by connecting these UI components to real backend data. The project uses a Next.js frontend (`packages/frontend`) and an Express/Prisma backend (`packages/backend`).

## Design

### 1. Backend Public Profile API
We need a way for the frontend to fetch a public user's profile and their posts.
- **Endpoint**: `GET /api/v1/user/public/:username` (Added to `user.ts` controller and `routes/user.ts`)
- **Query Params**: None
- **Response**:
  ```json
  {
    "user": {
      "username": "johndoe",
      "role": "USER",
      "createdAt": "2026-04-01T12:00:00.000Z",
      "posts": [
        {
          "id": "post-id",
          "title": "My first post",
          "content": "Hello world",
          "createdAt": "2026-04-02T12:00:00.000Z",
          "category": {
            "name": "General"
          }
        }
      ],
      "_count": {
        "posts": 1
      }
    }
  }
  ```
- **Error Handling**: Return 404 if the user is not found.

### 2. Frontend Public Profile Page (`app/u/[username]/page.tsx`)
- Convert the page to an `async` Next.js Server Component to support Server-Side Rendering (SSR).
- **Data Fetching**: Call the backend endpoint `GET /api/v1/user/public/${username}`.
  - Base URL should use an environment variable (e.g., `process.env.API_URL` or `http://localhost:3001`).
- **Rendering**:
  - Replace static mockup data with real user data (username, join date, role, post count).
  - Iterate over `user.posts` to render the list of actual posts.
  - Show a "User not found" or Next.js `notFound()` page if the backend returns a 404.

### 3. Frontend Settings Page (`app/u/settings/page.tsx`)
- The `app/u/settings/page.tsx` and its child components (`ProfileSettings`, `SecuritySettings`, `SessionManagement`) currently mock their client-side fetch requests.
- **Validation**: Ensure that all components fetch from the correct authenticated endpoints (`/api/v1/user/profile`, `/api/v1/user/sessions`, `/api/v1/user/passkeys`, etc.).
- **Error Handling**: Handle fetch errors gracefully (e.g., redirect to login if unauthorized).

## Security & Privacy
- The public profile endpoint must **not** expose sensitive data like `email`, `password`, `totpSecret`, `registeredIp`, or `status`.
- Only `username`, `role`, `createdAt`, and related public entities (e.g., `posts`) should be returned.

## Testing Strategy
- Manual testing using the `dogfood` skill:
  - Verify a user can register/login, create a post, and view their public profile.
  - Verify the public profile shows the correct number of posts and correct join date.
  - Verify navigating to a non-existent username returns a 404.
