# Dogfood Report: MyndBBS User Center

## Summary
- **Date**: 2026-04-07
- **Target**: `http://localhost:3000`
- **Focus**: User Center (`/u/settings` and `/u/[username]`)
- **Total Issues Found**: 2

### Issues by Severity
- **Critical**: 0
- **High**: 1
- **Medium**: 1
- **Low**: 0

---

## Issues

### ISSUE-001: SliderCaptcha lacks ARIA roles and accessibility
**Severity:** High
**Type:** Accessibility / UX
**Description:** The `SliderCaptcha` component on the registration page renders only standard `div` tags without appropriate ARIA roles. This makes it completely invisible and inaccessible to screen readers, keyboard-only users, and browser automation tools.
**Repro Steps:**
1. Navigate to `http://localhost:3000/register`
2. Attempt to use a screen reader or keyboard navigation to interact with the captcha slider.
3. Observe that it cannot be focused or interacted with.
**Repro Video:** N/A

### ISSUE-002: Login Page Form Validation doesn't show explicit error messages
**Severity:** Medium
**Type:** UX
**Description:** If a user tries to submit the login form without filling in required fields, the browser's native HTML5 validation stops submission but no custom error messages are displayed below the inputs.
**Repro Steps:**
1. Navigate to `http://localhost:3000/login`
2. Click "Sign in" without typing anything.
3. Form does not submit, but relies entirely on native browser popups rather than consistent in-app UI.
**Repro Video:** N/A
