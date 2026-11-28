import GroupMessage from "../models/GroupMessage.js";

export async function postGroupNotice(io, group, actor, text) {
  const notice = await GroupMessage.create({
    group: group._id,
    sender: actor._id,
    type: "group_notice",
    text,
  });
  const message = {
    id: String(notice._id),
    groupId: String(notice.group),
    senderId: String(notice.sender),
    senderName: actor.username || "A group member",
    type: notice.type,
    text: notice.text,
    createdAt: notice.createdAt,
  };
  for (const memberId of group.members) {
    io?.to(`user:${memberId}`).emit("group:message:new", message);
  }
}
