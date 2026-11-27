# Chatterbox Messenger upgrade

Implemented: Messenger-style reaction/action menu, touch hold/right click, local per-conversation pin/reaction/reminder metadata, Chat Information shared-content listings, existing reply/edit/delete preserved.

LIMITATIONS: Reactions/pins/reminders are stored only in localStorage on this device. Forward, bump, report, AI generation are NOT connected to backend. Reminders do not deliver notifications. Image saving opens the image URL. Full cross-user functionality needs MongoDB routes, Socket.IO, Firebase scheduling and an AI image service.

Build not verified: uploaded dependencies were Windows node_modules; Vite is unavailable in this Linux environment. On your laptop: cd client && npm install && npm run build.

Security: node_modules, .git and environment/credential files are intentionally omitted from the ZIP.
