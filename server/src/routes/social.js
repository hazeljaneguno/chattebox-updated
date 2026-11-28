import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/requireAuth.js";
import Conversation from "../models/Conversation.js";
import Friendship from "../models/Friendship.js";
import Group from "../models/Group.js";
import User from "../models/User.js";
import { conversationKey } from "./messages.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [groups, friendships, blocked] = await Promise.all([
      Group.find({ members: userId }).select("members").lean(),
      Friendship.find({ participants: userId }).lean(),
      Conversation.find({ participants: userId, status: "blocked" }).select("participants").lean(),
    ]);
    const otherId = (pair) => pair.participants.map(String).find((id) => id !== String(userId));
    const blockedIds = new Set(blocked.map(otherId));
    const sharedGroups = new Map();
    for (const group of groups) {
      for (const id of new Set(group.members.map(String))) {
        if (id === String(userId) || blockedIds.has(id)) continue;
        sharedGroups.set(id, (sharedGroups.get(id) || 0) + 1);
      }
    }

    const relationships = new Map(friendships.map((friendship) => [otherId(friendship), friendship]));
    const suggestionIds = [...sharedGroups.keys()]
      .filter((id) => !relationships.has(id))
      .sort((a, b) => sharedGroups.get(b) - sharedGroups.get(a) || a.localeCompare(b))
      .slice(0, 50);
    const ids = [...suggestionIds, ...[...relationships.keys()].filter((id) => !blockedIds.has(id))];
    const users = await User.find({ _id: { $in: ids } }).select("username profilePicture").lean();
    const byId = new Map(users.map((user) => [String(user._id), {
      id: String(user._id),
      username: user.username,
      profilePicture: user.profilePicture || "",
      sharedGroupCount: sharedGroups.get(String(user._id)) || 0,
    }]));
    const friends = [];
    const incoming = [];
    const sent = [];
    for (const [id, relationship] of relationships) {
      const person = byId.get(id);
      if (!person) continue;
      if (relationship.status === "accepted") friends.push(person);
      if (relationship.status === "pending") {
        (String(relationship.requestedBy) === String(userId) ? sent : incoming).push(person);
      }
    }
    return res.json({ suggestions: suggestionIds.map((id) => byId.get(id)).filter(Boolean), friends, incoming, sent });
  } catch (error) {
    next(error);
  }
});

router.post("/:userId/:action", async (req, res, next) => {
  try {
    const current = req.user._id;
    const { userId, action } = req.params;
    if (!mongoose.isObjectIdOrHexString(userId) || !["request", "confirm", "decline"].includes(action)) {
      return res.status(400).json({ message: "Invalid friend request action." });
    }

    const other = new mongoose.Types.ObjectId(userId);
    if (other.equals(current)) return res.status(400).json({ message: "Choose another person." });
    const key = conversationKey(current, other);
    if (await Conversation.exists({ conversationKey: key, status: "blocked" })) {
      return res.status(403).json({ message: "This person is unavailable." });
    }

    if (action === "request") {
      const shared = await Group.exists({ members: { $all: [current, other] } });
      if (!shared || !await User.exists({ _id: other })) {
        return res.status(403).json({ message: "This person is unavailable." });
      }
      try {
        await Friendship.create({ _id: key, participants: [current, other], requestedBy: current, status: "pending" });
      } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: "A friend request already exists." });
        throw error;
      }
    } else {
      const result = await Friendship.updateOne(
        { _id: key, participants: current, requestedBy: other, status: "pending" },
        { $set: { status: action === "confirm" ? "accepted" : "declined" } }
      );
      if (!result.matchedCount) return res.status(404).json({ message: "Pending friend request not found." });
    }

    req.app.get("io")?.to([`user:${current}`, `user:${other}`]).emit("social:updated");
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
