
import { useEffect } from "react";

export default function useChatSocket({
  socket,
  setSocketStatus,
  setError,
  setMentionToast,
  setMissedCalls,
}) {
  useEffect(() => {
    if (!socket) return;

    function handleConnect() {
      console.log("Socket connected:", socket.id);

      setSocketStatus("connected");
      setError("");
    }

    function handleDisconnect(reason) {
      console.warn("Socket disconnected:", reason);

      setSocketStatus("disconnected");

      // A temporary disconnect does not mean
      // the user's login session has expired.
      if (reason === "io server disconnect") {
        console.warn(
          "Server disconnected the chat socket."
        );
      }
    }

    function handleConnectError(error) {
      const message = String(error?.message || "");
      const code = String(error?.data?.code || "");

      console.error("SOCKET CONNECTION ERROR:", {
        message,
        code,
        data: error?.data,
        connected: socket.connected,
      });

      setSocketStatus("disconnected");

      const authenticationFailed =
        message === "Authentication required" ||
        message === "Invalid session" ||
        [
          "TOKEN_EXPIRED",
          "INVALID_TOKEN",
          "UNAUTHORIZED",
        ].includes(code);

      if (authenticationFailed) {
        setError(
          "Your chat session could not be verified. Please sign in again."
        );
      } else {
        setError(
          "Chat connection interrupted. Please check your connection."
        );
      }
    }

    function handleMentionNotification(notification) {
      console.log("Mention notification:", notification);

      setMentionToast({
        senderName: notification.senderName,
        groupName: notification.groupName,
        notification,
      });
    }

    function handleMissedCall({ callId, callerId, callType } = {}) {
      if (!callId || !callerId) return;
      const call = { id: callId, callerId, callType, createdAt: new Date().toISOString() };
      setMissedCalls((previous) => {
        if (previous.some((item) => item.id === callId)) return previous;
        return [call, ...previous].slice(0, 50);
      });
    }

    function handleCallEnded({ callId } = {}) {
      console.log("Call ended:", callId);

      // Do not log out or disconnect Socket.IO here.
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    socket.on(
      "mention:notification",
      handleMentionNotification
    );

    socket.on("call:missed", handleMissedCall);
    socket.on("call:ended", handleCallEnded);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      socket.off(
        "mention:notification",
        handleMentionNotification
      );

      socket.off("call:missed", handleMissedCall);
      socket.off("call:ended", handleCallEnded);
    };
  }, [
    socket,
    setSocketStatus,
    setError,
    setMentionToast,
    setMissedCalls,
  ]);
}
