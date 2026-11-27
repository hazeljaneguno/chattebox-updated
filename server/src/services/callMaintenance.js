import GroupCall from "../models/GroupCall.js";
import Group from "../models/Group.js";
import Call from "../models/Call.js";
import { getRoomService } from "../sockets/groupCall/groupCallHelpers.js";
import { sendGroupCallNotification } from "./groupCallNotifications.js";
import { sendCallState } from "../utils/sendCallState.js";
import GroupMessage from "../models/GroupMessage.js";
const lastReminder = new Map();
export async function reconcileCalls(io) {
  const expired = await Call.find({ status: "ringing", expiresAt: { $lte: new Date() } });
  for (const call of expired) {
    await Call.updateOne({ _id: call._id, status: "ringing" }, { $set: { status: "missed", endedAt: new Date() } });
    for (const id of [call.caller, call.receiver]) io.to(`user:${id}`).emit("call:missed", { callId: call.callId });
    await sendCallState(call.receiver, call.callId);
  }
  for (const call of await GroupCall.find({ status: "active" })) {
    const group = await Group.findById(call.group);
    if (!group) continue;
    let ended = false;
    // Allow the host time to acquire media and connect. Service failures never end a call.
    if (Date.now() - new Date(call.startedAt).getTime() > 90000) {
      const rooms = await getRoomService().listRooms([call.roomName]);
      const peers = rooms.length ? await getRoomService().listParticipants(call.roomName) : [];
      ended = peers.length === 0;
    }
    const missed = call.invitations.filter(i => i.status === "pending" && new Date(i.expiresAt) <= new Date());
    for (const item of missed) {
      item.status = "missed"; item.respondedAt = new Date();
      const data = { callId: String(call._id), groupId: String(call.group), userId: String(item.user) };
      io.to(`user:${item.user}`).emit("group-call:invitation:missed", data);
      io.to(`user:${call.host}`).emit("group-call:invitation:missed", data);
    }

    if (ended) { call.status = "ended"; call.endedAt = new Date(); }
    if (ended || missed.length) await call.save();
    if (ended) {
  await GroupMessage.updateOne(
    {
      group: call.group,
      callId: String(call._id),
      type: "group_call_ended",
    },
    {
      $setOnInsert: {
        sender: call.host,
        callType: call.callType,
        status: "ended",
        startedAt: call.startedAt,
        endedAt: call.endedAt,
      },
    },
    { upsert: true, runValidators: true }
  );
}
    const remind = Date.now() - (lastReminder.get(String(call._id)) || 0) > 15 * 60 * 1000;
    const recipients = ended ? group.members : call.invitations.filter(i => i.status === "missed" && (remind || missed.includes(i))).map(i => i.user);
    if (recipients.length) lastReminder.set(String(call._id), Date.now());
    if (ended) lastReminder.delete(String(call._id));
    if (recipients.length) await sendGroupCallNotification(recipients, {
      callId: call._id, groupId: group._id, groupName: group.name,
      callerId: call.host, callType: call.callType, action: ended ? "ended" : "join"
    });
    if (ended) {
      for (const id of group.members) io.to(`user:${id}`).emit("group-call:ended", { callId: String(call._id), groupId: String(group._id) });
      await getRoomService().deleteRoom(call.roomName).catch(() => {});
    }
  }
}
export function startCallMaintenance(io) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await reconcileCalls(io); } catch (e) { console.error("Call reconciliation:", e.message); }
    finally { running = false; }
  };
  void tick();
  return setInterval(tick, 15000).unref();
}
