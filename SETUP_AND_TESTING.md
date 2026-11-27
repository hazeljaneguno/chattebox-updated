# Setup, changes, and verification — 12 November 2026

## What changed

- API configuration rejects comma-separated URL lists and unsupported origins; strips an accidental `/api` suffix. The frontend URL belongs in backend `CLIENT_URL`, not `VITE_API_URL`.
- Android login/signup can return a bearer session. HTTP, uploads and Socket.IO use the same native token while browser sessions retain HTTP-only cookies. Native credentials are kept in app-private preferences for background Decline, and WebView local storage for HTTP/socket requests. Logout clears local credentials even if the request fails. This is not Android Keystore-backed token encryption.
- Removed the online-only call UI guard so an offline Android recipient can receive FCM.
- App-owned `CallMessagingService` handles data-only private/group call messages. It replaces the broken dependency patch/broadcast routing. Ordinary message notifications still use Capacitor.
- Incoming notifications have native Answer and Decline actions. Answer directly opens the activity, stores the action before the bridge is ready, then React recovers the current server call before requesting media. Decline sends an authenticated HTTPS request from a receiver without opening the app. If offline, Decline dismisses locally but is not queued for retry; the call expires on the server.
- Native notification intents carry group ID/type, call ID and action; unique intent URIs prevent action collisions. Expired payloads are ignored. Group `join` notifications use a quiet channel and Join Call action. End pushes dismiss the matching notification.
- Fixed group token capacity accidentally capped at one; maximum is ten. Fixed a missing cleanup import. Explicit late join works after missed/declined invitations; members added after call start can join after membership authorization.
- Group header recovers active call state on selection, reconnect, visibility resume and every 15 seconds. It exposes the existing Join Call control.
- Server maintenance runs every 15 seconds, marks missed invitations, sends Join Call reminders, renews them every 15 minutes, and ends empty/missing rooms after a 90-second startup grace. LiveKit errors do not mark rooms ended. Explicit host end also sends notification cleanup. Late joins do not recreate a missing room.
- Added configurable TURN/ICE servers for private calls, native release debugging protection, and consistent Java/Kotlin 21 compilation settings.

## Backend and deployment

1. Install Node 22+ and MongoDB. Run `npm ci` inside both `server` and `client`.
2. Copy `server/.env.example` to `server/.env`. Set `MONGODB_URI` and a long random `JWT_SECRET`. Keep the secret stable across restarts.
3. Set `CLIENT_URL` to a comma-separated list of exact frontend origins. Include your deployed web origin and the Capacitor Android origin, normally `https://localhost` for Capacitor 8. The example includes common local origins. Never put this list into `VITE_API_URL`.
4. For cross-site browser cookies over HTTPS set `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none`. Browser third-party cookie restrictions can still require hosting frontend/API under the same site. Android bearer authentication avoids depending on cross-site cookies.
5. Deploy the Node server on an always-on host supporting Socket.IO polling and WebSocket upgrades. A static Vercel frontend is fine; the Node Socket.IO server needs its own persistent runtime. Use one server instance for this version: presence, reservations and timers are process-local. Multiple instances require shared coordination and a Socket.IO adapter.
6. Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` for a reachable LiveKit deployment. LiveKit handles group media; MongoDB holds call state. The current room cap is ten.
7. For reliable private calls across mobile networks, configure a TURN server. Put an ICE-server JSON array in `VITE_ICE_SERVERS_JSON`, for example `[{"urls":"turn:turn.example.com:3478","username":"temporary-user","credential":"temporary-password"}]`. Vite values are public: use short-lived credentials and rebuild/refresh as needed; this project does not include a TURN credential-minting endpoint. STUN alone is insufficient for some networks.
8. Set `client/.env.production` to `VITE_API_URL=https://YOUR-BACKEND-HOST` and `VITE_ICE_SERVERS_JSON=[]` or your ICE configuration. Set `.env.development` separately for local work. Run `npm run build` after changing Vite variables.

## Firebase and Android Studio

1. In Firebase, register Android package **com.hazeljane.chatterbox**. Download your project's `google-services.json` into `client/android/app/google-services.json`. The cleaned ZIP excludes the uploaded project's Firebase config so you deliberately select the correct project.
2. Enable Firebase Cloud Messaging HTTP v1. Create/download an Admin SDK service-account key from that same Firebase project. Set its complete JSON in the server's `FIREBASE_SERVICE_ACCOUNT_JSON` secret. Alternatively place it only on your development machine at `server/src/config/firebase-service-account.json`. Never put Admin keys into React, Git or the APK.
3. The original upload contained server environment credentials and a service-account file. These are excluded from the deliverable. Rotate the original service-account key and any other credentials that were exposed in the shared archive; then configure fresh values privately.
4. Open `client/android` in Android Studio with Android SDK 36 and JDK 21. Allow Gradle/dependencies to download. Use a physical Android device with Google Play services. Set the production HTTPS API URL before building; `localhost` on a phone is the phone itself.
5. In `client`, run `npm run build`, `npx cap sync android`, and `npx cap open android`. Sync regenerates native web assets, which are intentionally omitted from the source ZIP. The custom Java files and manifest remain in the app source; no patch-package step is needed.
6. Sign in after installing this update to save the native session used by background Decline. Grant notifications, microphone, and camera. Inspect the backend token-registration response and Firebase Admin initialization logs. Incoming calls use `chatterbox_incoming_calls`; messages retain the existing message channels; join reminders use `chatterbox_ongoing_calls`.
7. Build/install a debug APK first, then validate a signed release build. The manifest registers exactly one app FCM service and removes Capacitor's service declaration with the manifest merger. Inspect the merged manifest during your Android build to confirm this.

## What closed-app behavior means

A data-only high-priority FCM message can reach the native Firebase service while the React WebView is not running. Native code posts the notification without loading React. Actual delivery depends on Google Play services, notification permission, network, device power policy and FCM. Android Settings **Force stop** prevents delivery until the app is reopened. Swiping recents and force stop are different test cases.

Answer opens/resumes Chatterbox to connect media; it does not run the React call invisibly behind the notification. Locked devices may require unlocking. This update uses heads-up notifications, not a full-screen incoming-call activity or Android Telecom integration. It does not add a native microphone/camera foreground service: sustained screen-off/background media is not guaranteed. Do not describe it as fully equivalent to Messenger's native calling stack.

Incoming private invitations expire after 45 seconds; group ringing expires after 30 seconds. Maintenance converts missed group invitations into Join Call reminders within the next 15-second sweep. Reminders expire locally after at most one hour and are renewed every 15 minutes while applicable. End pushes clear them; if delivery is lost/offline, a stale reminder can remain until timeout. Every Join action checks server state before connecting, so an ended call is rejected. Brief network or empty-room periods and the 90-second room grace still need tuning with real devices.

## Checks performed here

| Check | Result |
| --- | --- |
| React Vite production bundle | Passed, 1,661 modules; warning for large bundle |
| Capacitor Android sync | Passed |
| Server module syntax | Passed for 45 modules |
| Isolated regression tests | 7 passed; HTTP/auth, URL parsing, native Decline authorization, second participant/full/ended room, outsider join, maintenance lifecycle |
| Android Gradle build | Blocked: Gradle distribution download failed with network unreachable; no APK produced |
| Live MongoDB / deployed Socket.IO / LiveKit media | Not tested; database and media APIs were mocked in regression tests |
| FCM delivery, native actions, cold start, permissions, locked phone | Not tested on a device |

The original archive contained Windows-specific node_modules. Linux build tools were installed locally for the React check. Dependencies, IDE state, Git history, Gradle caches, release outputs, secrets and generated assets are excluded from the deliverable. Reinstall with `npm ci`. Existing source and uploaded message images remain.

## Device acceptance checklist

Use two accounts with an accepted private conversation and a group with at least three members.

- Test both voice and video private calls while recipient is foregrounded, backgrounded, swiped away, and locked. Verify native Answer, Decline without launch, timeout, caller cancellation, end cleanup and one active notification per call. Confirm native Decline updates the caller UI.
- Deny notification permission and microphone/camera permission separately; confirm a useful failure and no stuck media. Repeat after logout/login, token refresh, account switching and release installation.
- Start group voice and video calls; join with a second and third device. Miss ringing, verify Join Call reminder, join later from notification and from group header. Decline ringing and deliberately join later. Add a member during the call and test joining.
- Leave as a participant; end as host; confirm all notifications clear. Disconnect every participant and confirm room cleanup. Try a stale Join notification after end and after server restart.
- Test two tabs/devices on one account, Wi-Fi to mobile transitions, TURN-only connectivity, reconnects and intermittent internet. Test more than ten join attempts for capacity enforcement.
- Test ordinary private/group message pushes and original chat operations (uploads, edits, requests, backgrounds, group administration).
- Test Android force stop separately; reopen before expecting FCM. Test screen-off media and device battery restrictions without assuming continuity.

Run `npm test` in `server` to repeat the isolated suite. Credentials and external services are deliberately not contacted by these tests.

References: https://firebase.google.com/docs/cloud-messaging/android/receive-messages and https://firebase.blog/posts/2024/07/understand-fcm-delivery-rates/
