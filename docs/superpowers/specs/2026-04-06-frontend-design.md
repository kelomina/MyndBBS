# Frontend UI Design Specification: MyndBBS
Date: 2026-04-06

## 1. Overview
This document specifies the visual design and layout architecture for the MyndBBS frontend, which is built with Next.js and styled with Tailwind CSS. The design follows a "Clean/Light" aesthetic, drawing inspiration from Apple and Notion, characterized by abundant whitespace, rounded corners, soft shadows, and a high-contrast typographical hierarchy.

## 2. Layout Architecture
The application utilizes a **Header + Sidebar** structure, optimizing for both content consumption and navigation ease.

### 2.1 Global Header (Top Navigation)
- **Positioning:** Fixed at the top of the viewport (`sticky top-0`).
- **Visuals:** Features a subtle backdrop blur (`backdrop-blur-md`, `bg-white/80`) to ensure content readability while maintaining a modern, layered feel.
- **Components:**
  - **Left:** MyndBBS Logo and branding.
  - **Center:** Global Search bar (rounded, low contrast border).
  - **Right:** Call-to-Action (CTA) button for "New Post", and the User Profile dropdown menu (or Login/Register links for unauthenticated users).

### 2.2 Sidebar (Left Navigation)
- **Positioning:** Fixed to the left side of the screen on desktop viewports (`w-64`, `hidden md:block`).
- **Content:** 
  - Main navigation links: Home, Popular, Recent.
  - Community categories/nodes (e.g., Technology, Life, Q&A).
- **Behavior:** Remains fixed while the main content area scrolls.

### 2.3 Main Content Area
- **Background:** A very light gray (`bg-gray-50` or `#f9fafb`) to provide subtle contrast against the white content cards.
- **Layout:** Centered column, max-width constrained for optimal reading length (`max-w-3xl` or `max-w-4xl`).

## 3. Core Pages

### 3.1 Home / Feed (Post List)
- **Card Design:** Posts are displayed as individual cards.
  - **Shape:** Large rounded corners (`rounded-xl` or `12px`).
  - **Shadow:** Soft, diffused drop shadow (`shadow-sm` or `shadow-md` on hover).
  - **Background:** Solid white (`bg-white`).
- **Card Content Structure:**
  - **Header:** User avatar (circular), username, timestamp (relative time), and category/node label (pill shape, subtle background color).
  - **Body:** Post title (bold, dark gray/black text, changes color on hover), followed by a brief text excerpt (truncated to 2 lines max).
  - **Footer:** Interaction buttons (Upvote, Comment count). These buttons should feature subtle micro-interactions (e.g., scale up slightly or change background color on hover).

### 3.2 Authentication Pages (Login / Register)
- **Layout:** Full-screen, centered layout, independent of the main Header/Sidebar structure.
- **Background:** Subtle, elegant background (e.g., a very faint gradient or a minimal grid pattern) to maintain the clean aesthetic without being plain white.
- **Card Design:** A singular, minimalist white card in the center.
- **Components:**
  - Standard input fields for Email and Password (emphasizing the strict password policy visually, perhaps with a strength meter).
  - Prominent CTA buttons.
  - **WebAuthn Integration:** A highly visible "Sign in with Passkey" button, given priority over traditional passwords where supported.
  - **Captcha:** Designated placeholder area for the required Captcha verification during registration.

## 4. Visual Language & Tokens
- **Colors:**
  - Primary Background: `#f9fafb` (Gray 50)
  - Card Background: `#ffffff` (White)
  - Primary Text: `#111827` (Gray 900)
  - Secondary Text: `#6b7280` (Gray 500)
  - Accent/Primary Brand Color: To be determined (e.g., a clean blue or teal).
- **Typography:** Clean sans-serif (Inter or system default like San Francisco).
- **Spacing:** Generous padding and margins to ensure the "Clean/Light" feel.

## 5. Scope & Next Steps
This specification covers the initial visual direction and structural layout. The immediate next step is to translate this design into React components and Tailwind utility classes within the Next.js frontend package, starting with the layout shell and the authentication screens to connect with the recently completed backend logic.