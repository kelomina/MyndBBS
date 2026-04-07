# User Center Header Navigation Design

## Context
Currently, the global header (`packages/frontend/src/components/layout/Header.tsx`) features a static User icon that always links to the `/login` page. We need to dynamically change this link based on the user's authentication status. If a user is logged in, clicking the avatar should direct them to their personal settings (`/u/settings`). If they are not logged in, it should direct them to `/login` (or register).

## Design

### 1. `UserNav` Client Component
We will introduce a new Client Component: `packages/frontend/src/components/layout/UserNav.tsx`.

- **Responsibility**: Fetch the current user's profile on mount and render the appropriate navigation icon.
- **State**:
  - `loading`: Initially true while checking session.
  - `user`: Stores the fetched user object (containing `username`, `email`, etc.).
- **Data Fetching**:
  - Perform a `fetch('/api/v1/user/profile', { credentials: 'include' })` call inside a `useEffect`.
  - If the response is `200 OK`, set the `user` state.
  - If the response is `401 Unauthorized` or fails, set `user` to null.
- **Rendering**:
  - **Loading State**: Display a skeleton or the default User icon with a spinning/loading state.
  - **Authenticated State**: Display a circular avatar (e.g., using the first letter of the user's username) wrapped in a `<Link href="/u/settings">`.
  - **Unauthenticated State**: Display the existing `User` icon from `lucide-react` wrapped in a `<Link href="/login">`.

### 2. Update Global `Header`
Update the `Header.tsx` Server Component:
- Remove the static `<Link href="/login">...<User/></Link>` markup.
- Import and render `<UserNav dict={dict} />` in its place, passing any necessary i18n dictionary strings (e.g., for the `title` attribute).

## Security & Performance
- The profile check happens on the client side, meaning the page can be statically cached or SSR'd quickly, and only the user navigation pill updates dynamically.
- The `fetch` uses `credentials: 'include'` to send the HttpOnly JWT cookies to the backend securely.

## Testing Strategy
- Open the application unauthenticated: verify the User icon is visible and links to `/login`.
- Log in to the application: verify the header updates to show the user's avatar initial, and clicking it navigates to `/u/settings`.
