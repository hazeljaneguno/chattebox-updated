# Chatterbox — repaired React / Node / Capacitor source

Start with **SETUP_AND_TESTING.md**. This source update retains the existing messaging UI, attachments, message requests, editing, backgrounds, private WebRTC calls, and LiveKit group calling. It repairs call notification routing and adds native Android FCM handling, background Decline, cold-start Answer recovery, and ongoing group-call reminders.

This is source code, not a signed APK. Android compilation and real-device push/media behavior still require validation. Never deploy the example credentials or default localhost API URL.

## Quick start

Use Node 22 or newer. In `server`, run `npm ci`, copy `.env.example` to `.env`, configure MongoDB and secrets, then `npm run dev`. In a second terminal, in `client`, run `npm ci`, copy `.env.example` to `.env.development`, set the single backend origin, then `npm run dev`.

Run `npm test` in `server` for the isolated regression tests. For Android, set the production HTTPS backend origin in `client/.env.production`, run `npm run build`, `npx cap sync android`, then `npx cap open android`.
