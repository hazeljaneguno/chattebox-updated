import User from "../models/User.js";
import { firebaseMessaging } from "../firebase.js";
export async function sendCallState(userId, callId) {
  try {
    const user = await User.findById(userId).select("fcmTokens");
    const tokens = [...new Set((user?.fcmTokens || []).filter(t => t.platform === "android").map(t => t.token))];
    if (!firebaseMessaging || !tokens.length) return;
    for (let i = 0; i < tokens.length; i += 500) await firebaseMessaging.sendEachForMulticast({ tokens: tokens.slice(i,i+500), data: { type: "call_ended", callId: String(callId) }, android: { priority: "high", ttl: 45000 } });
  } catch (e) { console.error("Call state push:", e.message); }
}
