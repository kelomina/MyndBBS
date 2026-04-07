# Dogfood Report: Passkey Passwordless Login

## Summary
- **Target**: `http://localhost:3000/login`
- **Total Issues**: 1
- **High/Critical**: 0
- **Medium**: 1
- **Low**: 0

## Scope
Tested the "Sign in with Passkey" button on the login page to ensure it correctly triggers the WebAuthn flow.

## Findings

### ISSUE-001: WebAuthn Prompts in Dev Environment
- **Severity**: Medium
- **Description**: The "Sign in with Passkey" button relies on `navigator.credentials.get`. In automated headless browsers (like the agent browser), the WebAuthn API is either unavailable or fails immediately with `NotAllowedError` because it requires a Secure Context (HTTPS or explicit localhost) and a physical/virtual authenticator. 
- **Repro Steps**:
  1. Navigate to `/login`.
  2. Click "Sign in with Passkey".
  3. The system prompt for passkey authentication is expected, but in headless test environments, it throws an error or does nothing.
- **Resolution**: Manual verification is required using a real browser with a registered passkey. The implementation code correctly calls `startAuthentication(options)` and catches errors, but relies on the OS-level prompt which cannot be automated without specialized virtual authenticator setup.

