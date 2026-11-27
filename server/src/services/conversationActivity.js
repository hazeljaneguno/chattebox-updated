import Message from "../models/Message.js";
import GroupMessage from "../models/GroupMessage.js";

async function latestByConversation(model, filter, conversation) {
  const summaries = await model.aggregate([
    { $match: filter },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: conversation,
        id: { $first: "$_id" },
        createdAt: { $first: "$createdAt" },
        senderId: { $first: "$sender" },
        text: { $first: "$text" },
        isDeleted: { $first: "$isDeleted" },
        attachment: { $first: "$attachment" },
        type: { $first: "$type" },
      },
    },
  ]);

  return new Map(summaries.map(({ _id, ...summary }) => [String(_id), summary]));
}

export function latestPrivateMessages(userId) {
  return latestByConversation(Message, {
    isGroup: { $ne: true },
    recipient: { $ne: null },
    $or: [{ sender: userId }, { recipient: userId }],
    deletedFor: { $ne: userId },
  }, {
    $cond: [{ $eq: ["$sender", userId] }, "$recipient", "$sender"],
  });
}

export function latestGroupMessages(groupIds, userId) {
  return latestByConversation(GroupMessage, {
    group: { $in: groupIds },
    deletedFor: { $ne: userId },
  }, "$group");
}
