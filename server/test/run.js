import { spawnSync } from "node:child_process";
const r = spawnSync(process.execPath, ["--test", "test/calls.test.js"], { stdio: "inherit", env: { ...process.env, MONGODB_URI: "mongodb://127.0.0.1/test", JWT_SECRET: "test-only-secret", LIVEKIT_URL: "wss://example.com", LIVEKIT_API_KEY: "test", LIVEKIT_API_SECRET: "test-secret" } });
process.exit(r.status ?? 1);
