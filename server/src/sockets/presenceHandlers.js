import User from "../models/User.js";

const presenceRoom = "presence:visible";

function sendSnapshot(io, socket) {
  const connected = io.sockets.adapter.rooms.get(presenceRoom) ?? [];
  const onlineIds = new Set();

  if (socket.rooms.has(presenceRoom)) {
    for (const socketId of connected) {
      const userId = io.sockets.sockets.get(socketId)?.user.id;
      if (userId && userId !== socket.user.id) onlineIds.add(userId);
    }
  }

  socket.emit("presence:snapshot", [...onlineIds]);
}

export function updatePresenceVisibility(io, userId, enabled) {
  const accountRoom = `user:${userId}`;
  const socketIds = io.sockets.adapter.rooms.get(accountRoom) ?? [];

  for (const socketId of socketIds) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    socket.user.showActiveStatus = enabled;
    if (enabled) socket.join(presenceRoom);
    else socket.leave(presenceRoom);
    socket.emit("presence:visibility", enabled);
    sendSnapshot(io, socket);
  }

  io.to(presenceRoom).except(accountRoom).emit("presence:update", {
    userId,
    isOnline: enabled && socketIds.size > 0,
  });
}

export function registerPresenceHandlers(io, socket) {
  const userId = socket.user.id;
  const accountRoom = `user:${userId}`;

  if (socket.user.showActiveStatus) {
    socket.join(presenceRoom);
    socket.to(presenceRoom).except(accountRoom).emit("presence:update", {
      userId,
      isOnline: true,
    });
  }

  socket.on("presence:request", () => {
    socket.emit("presence:visibility", socket.user.showActiveStatus);
    sendSnapshot(io, socket);
  });

  socket.on("disconnect", () => {
    if (io.sockets.adapter.rooms.has(accountRoom)) return;

    if (socket.user.showActiveStatus) {
      io.to(presenceRoom).emit("presence:update", { userId, isOnline: false });
    }

    User.updateOne({ _id: userId }, { lastSeen: new Date() }).catch((error) => {
      console.error("Could not save last seen:", error);
    });
  });
}
