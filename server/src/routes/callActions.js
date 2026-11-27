import { sendCallState } from "../utils/sendCallState.js";
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import Call from "../models/Call.js";
import Group from "../models/Group.js";
import GroupCall from "../models/GroupCall.js";
import mongoose from "mongoose";
const router = Router();
router.post("/:callId/decline", requireAuth, async (req,res,next) => {
  try {
    const { callId } = req.params;
    if (!mongoose.isObjectIdOrHexString(callId)) return res.status(400).json({ message: "Invalid call ID" });
    const uid = String(req.user._id);
    if (req.body.groupId) {
      if (!mongoose.isObjectIdOrHexString(req.body.groupId)) return res.sendStatus(400);
      const group = await Group.findOne({ _id: req.body.groupId, members: uid });
      if (!group) return res.sendStatus(403);
      await GroupCall.updateOne({ _id: callId, group: group._id, status: "active", "invitations.user": uid }, { $set: { "invitations.$.status": "declined", "invitations.$.respondedAt": new Date() } });
    } else {
      const call = await Call.findOneAndUpdate({ callId, receiver: uid, status: "ringing", expiresAt: { $gt: new Date() } }, { $set: { status: "declined", endedAt: new Date() } }, { new: true });
      if (call) void sendCallState(uid, callId);
      if (call) {
        req.app.get("io").to(`user:${call.caller}`).emit("call:response", { callId, recipientId: uid, accepted: false });
        req.app.get("io").to(`user:${call.caller}`).emit("call:declined", { callId, senderId: uid });
      }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});
export default router;
