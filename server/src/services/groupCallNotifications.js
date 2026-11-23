import { firebaseMessaging } from "../firebase.js";
import User from "../models/User.js";

const GROUP_CALL_INVITATION_TTL = 30_000;
const GROUP_CALL_JOIN_TTL = 60 * 60 * 1000;

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

/**
 * Send a group-call invitation or ongoing-call notification
 * to Android users in a group.
 *
 * action:
 * - incoming: invitation to answer or decline
 * - join: notification that a group call is ongoing
 */
export async function sendGroupCallNotification(
  recipients,
  {
    callId,
    groupId,
    groupName,
    callerId,
    callerName,
    callType,
    action = "incoming",
    expiresAt,
  } = {}
) {
  try {
    if (!firebaseMessaging) {
      console.error(
        "Firebase Messaging is not configured."
      );

      return {
        success: false,
        reason: "firebase-not-configured",
      };
    }

    if (
      !callId ||
      !groupId ||
      !["audio", "video"].includes(callType) ||
      !["incoming", "join", "ended"].includes(action)
    ) {
      return {
        success: false,
        reason: "invalid-group-call-data",
      };
    }

    const recipientIds = [
      ...new Set(
        (Array.isArray(recipients) ? recipients : [])
          .map((recipient) =>
            String(recipient?._id || recipient)
          )
          .filter((id) => id && id !== "undefined")
      ),
    ];

    if (!recipientIds.length) {
      return {
        success: false,
        reason: "no-recipients",
      };
    }

    const users = await User.find({
      _id: { $in: recipientIds },
    }).select("_id fcmTokens");

    const tokenOwners = new Map();

    for (const user of users) {
      const tokens = Array.isArray(user.fcmTokens)
        ? user.fcmTokens
        : [];

      for (const item of tokens) {
        if (
          item?.platform !== "android" ||
          typeof item.token !== "string"
        ) {
          continue;
        }

        const token = item.token.trim();

        if (!token) continue;

        if (!tokenOwners.has(token)) {
          tokenOwners.set(token, []);
        }

        tokenOwners.get(token).push(user._id);
      }
    }

    const tokens = [...tokenOwners.keys()];

    if (!tokens.length) {
      return {
        success: false,
        reason: "no-android-tokens",
      };
    }

    const ttl =
      action === "incoming"
        ? GROUP_CALL_INVITATION_TTL
        : GROUP_CALL_JOIN_TTL;

    const requestedExpiration = expiresAt
      ? new Date(expiresAt).getTime()
      : Date.now() + ttl;

    if (!Number.isFinite(requestedExpiration)) {
      return {
        success: false,
        reason: "invalid-expiration",
      };
    }

    const remainingTtl = Math.min(
      ttl,
      requestedExpiration - Date.now()
    );

    if (remainingTtl <= 0) {
      return {
        success: false,
        reason: "notification-expired",
      };
    }

    const data = {
      type: "group_call",
      action,
      callId: String(callId),
      groupId: String(groupId),
      groupName: String(groupName || "Group"),
      callerId: String(callerId || ""),
      callerName: String(callerName || "Chatterbox user"),
      callType: String(callType),
      expiresAt: new Date(
        requestedExpiration
      ).toISOString(),
    };

    let successCount = 0;
    let failureCount = 0;

    const invalidTokens = [];

    // Firebase supports up to 500 tokens per multicast request.
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);

      const response =
        await firebaseMessaging.sendEachForMulticast({
          tokens: batch,

          data,

          android: {
            priority: "high",
            ttl: remainingTtl,
            collapseKey: `group-call-${callId}`,
          },
        });

      successCount += response.successCount;
      failureCount += response.failureCount;

      response.responses.forEach((result, index) => {
        if (
          !result.success &&
          INVALID_TOKEN_CODES.has(result.error?.code)
        ) {
          invalidTokens.push(batch[index]);
        }
      });
    }

    // Remove expired or invalid Android registration tokens.
    if (invalidTokens.length) {
      const invalidOwners = new Map();

      for (const token of invalidTokens) {
        const owners = tokenOwners.get(token) || [];

        for (const ownerId of owners) {
          const key = String(ownerId);

          if (!invalidOwners.has(key)) {
            invalidOwners.set(key, {
              ownerId,
              tokens: [],
            });
          }

          invalidOwners.get(key).tokens.push(token);
        }
      }

      await Promise.all(
        [...invalidOwners.values()].map(
          ({ ownerId, tokens: ownerTokens }) =>
            User.updateOne(
              { _id: ownerId },
              {
                $pull: {
                  fcmTokens: {
                    token: { $in: ownerTokens },
                  },
                },
              }
            )
        )
      );
    }

    console.log("Group call notifications:", {
      callId,
      action,
      successCount,
      failureCount,
    });

    return {
      success: successCount > 0,
      successCount,
      failureCount,
    };
  } catch (error) {
    console.error(
      "Group call notification error:",
      error.message
    );

    return {
      success: false,
      reason: "notification-error",
    };
  }
}
