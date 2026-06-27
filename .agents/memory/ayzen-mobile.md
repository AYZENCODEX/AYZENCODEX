---
name: AYZEN Mobile App
description: Expo React Native app setup, auth flow, and key gotchas for artifacts/ayzen-mobile
---

## Location & Workflow
- App lives at `artifacts/ayzen-mobile/`
- Workflow: "AYZEN Mobile" — `cd artifacts/ayzen-mobile && EXPO_PUBLIC_API_URL=https://$REPLIT_DEV_DOMAIN:8000 pnpm run dev -- --clear`
- Port 8081 (console outputType — shows QR code for Expo Go)
- User scans QR code with Expo Go (Android) or Camera (iOS)

## Auth Contract (critical)
- `/api/auth/login` → POST `{email, password}` → returns `{token, user}` directly (NO OTP step)
- `/api/auth/send-otp` → POST `{email}` → sends 6-digit code (for registration only)
- `/api/auth/register` → POST `{email, username, password, emailOtp}` → `{token, user}`
- `/api/auth/magic-link` → POST `{email}` → sends magic-link OTP
- `/api/auth/magic-link/verify` → POST `{email, code}` → `{token, user}`
- `/api/auth/verify-otp` → POST `{email, code}` → `{valid: true}` only (no session/token)

**Why:** Memory notes say "2-step signin" but the actual login route returns token immediately without OTP. The OTP-gated flow is magic-link only.

## Key Setup Decisions
- `@types/react` must be `^19.2.0` in both devDependencies and `pnpm.overrides` — the workspace root uses 19.2.x; without override, Ionicons/Tabs get TS2786 JSX errors
- Use `expo-clipboard` (`Clipboard.setStringAsync()`) not `react-native`'s `Clipboard` (removed from RN core)
- Token stored in `expo-secure-store` (native) or `localStorage` (web)
- `metro.config.js` configured for monorepo: `watchFolders` + `nodeModulesPaths` pointing to workspace root

## Design
- Cyberpunk dark theme matching web app (Space Mono font, cyan #00d4b1 primary, violet #8b44f7 secondary)
- Always dark (ignores system color scheme)
- 5 tabs: Dashboard, Projects, Tasks, Wallets, Profile
