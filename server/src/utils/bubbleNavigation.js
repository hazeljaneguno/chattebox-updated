
import { Capacitor } from "@capacitor/core";

const EVENT_NAME = "chatterboxBubbleOpened";

export function listenForBubbleNavigation(onOpenChat) {
  if (Capacitor.getPlatform() !== "android") {
    return () => {};
  }

  function handleBubbleOpened(event) {
    try {
      const detail = event?.detail;

      const data =
        typeof detail === "string"
          ? JSON.parse(detail)
          : detail;

      if (!data || typeof data !== "object") {
        return;
      }

      console.log(
        "ANDROID BUBBLE NAVIGATION RECEIVED:",
        data
      );

      const isGroup =
        data.type === "group_message" ||
        data.isGroup === true ||
        Boolean(data.groupId);

      if (isGroup) {
        const groupId = String(data.groupId || "");

        if (!groupId) {
          console.warn(
            "Group bubble is missing groupId:",
            data
          );
          return;
        }

        onOpenChat({
          id: groupId,
          isGroup: true,
          groupId,
          conversationId: data.conversationId || null,
        });

        return;
      }

      // Private chats use the other user's ID.
      const senderId = String(
        data.senderId ||
        data.otherUserId ||
        ""
      );

      if (!senderId) {
        console.warn(
          "Private bubble is missing senderId:",
          data
        );
        return;
      }

      onOpenChat({
        id: senderId,
        isGroup: false,
        senderId,
        conversationId: data.conversationId || null,
      });

    } catch (error) {
      console.error(
        "Unable to process bubble navigation:",
        error
      );
    }
  }

  window.addEventListener(
    EVENT_NAME,
    handleBubbleOpened
  );

  return () => {
    window.removeEventListener(
      EVENT_NAME,
      handleBubbleOpened
    );
  };
}
