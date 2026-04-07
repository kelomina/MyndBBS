# Eclipse / Glowing Orb Captcha Design Specification

## Overview
The traditional "jigsaw puzzle" slider captcha is replaced with a premium, elegant "Eclipse" concept. The user slides a glowing orb (the "moon") along a sleek track to perfectly align with a delicate target ring (the "sun") rendered on the server. The interaction feels native, fluid, and visually stunning, adhering to high-end frontend design principles.

## 1. Visual Changes

### Background (SVG rendered by backend)
- Replaces the generic grey background with a sleek, dark glassmorphism or deep-space gradient.
- The target is no longer a dashed rectangle but an elegant glowing ring (stroke) with a subtle drop shadow.
- The SVG dimensions remain `318x128` to fit the current layout seamlessly.

### The Slider & Track (Frontend)
- **Track**: A subtle, thin horizontal pill shape (`h-1.5` or `h-2`) instead of a thick chunky bar.
- **Orb (Thumb)**: A sleek, white/cyan glowing orb (`w-[48px] h-[48px] rounded-full`) with a soft glow shadow (`box-shadow: 0 0 15px rgba(255,255,255,0.8)`).
- **Alignment**: The orb moves horizontally and is vertically centered with the target ring, creating a perfect "eclipse" effect when aligned.

### States & Motion
- **Idle**: The orb rests at the left.
- **Dragging**: The orb scales slightly down (`scale-95`), the glow intensifies, and the cursor becomes `grabbing`.
- **Success**: The orb pulses green (`bg-emerald-400`), expands slightly, and the track fills with a soft green gradient.
- **Error**: The orb shakes (CSS animation), flashes red, and snaps back to the start.

## 2. UX Improvements
- **Frictionless Entry**: The clunky "Click to confirm you are human" first step is removed. The slider is immediately interactive, reducing friction and feeling more premium.
- **Spring Animations**: Added smooth CSS transitions for the orb release and error snapping.

## 3. Backend Adjustments (`captcha.ts`)
- **SVG Generation (`generateCaptcha`)**: Update the generated SVG to match the new dark, elegant aesthetic and draw the target ring at `cx="${targetPosition + 24}" cy="64" r="20"`.
- **Verification (`verifyCaptcha`)**: Adjust the `SLIDER_CENTER_OFFSET` and `TARGET_CENTER_OFFSET` to match the new 48px orb size (offset = 24).
  - The `sliderCenter` logic will be updated since the visual puzzle piece is no longer separate from the slider thumb. The slider thumb *is* the orb.
  - `sliderCenter = finalPosition + 24`.
  - `targetCenter = targetPosition + 24`.

## 4. Components & Data Flow
- **Component**: `SliderCaptcha.tsx` will be completely refactored to use the new HTML/CSS structure.
- **Dependencies**: Uses `lucide-react` for state icons (Check/X) if needed, but mostly relies on CSS for visuals.
- **Data Flow**: Remains identical to the current implementation (`GET /api/auth/captcha` -> `POST /api/auth/captcha/verify`). No changes to the API payload schema.