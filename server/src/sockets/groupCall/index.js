import { registerGroupCallStart } from "./groupCallStart.js";
import { registerGroupCallInvitations } from "./groupCallInvitations.js";
import { registerGroupCallJoin } from "./groupCallJoin.js";
import { registerGroupCallLifecycle } from "./groupCallLifecycle.js";

export function registerGroupCallHandlers(io, socket) {
  const userId = String(socket.user.id);

  registerGroupCallStart(io, socket, userId);

  registerGroupCallInvitations(io, socket, userId);

  registerGroupCallJoin(io, socket, userId);

  registerGroupCallLifecycle(io, socket, userId);
}
