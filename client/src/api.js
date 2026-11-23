import { Capacitor } from "@capacitor/core";
import { io } from "socket.io-client";
import { normalizeApiUrl } from "./apiConfig.js";
import { incomingCallBridge as bridge } from "./incomingCallBridge.js";

const native = Capacitor.getPlatform() === "android";

const getToken = () =>
  native ? localStorage.getItem("chatterbox_native_token") : null;

const authHeaders = () => {
  if (!native) return {};

  const token = getToken();

  return {
    "X-Chatterbox-Native": "android",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};


// ==========================================
// API BASE URL
// ==========================================

export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

console.log("API BASE URL:", API_URL);

// ==========================================
// REQUEST HELPER
// ==========================================

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(
      `API ERROR: ${options.method || "GET"} ${path} STATUS ${response.status}`
    );

    throw new Error(
      data.message || `Request failed with status ${response.status}`
    );
  }

  const isLoginOrSignup =
    path === "/api/auth/login" || path === "/api/auth/signup";

  if (native && isLoginOrSignup && data.token) {
    localStorage.setItem("chatterbox_native_token", data.token);
    await bridge.configureSession({
      token: data.token,
      apiUrl: API_URL,
    });
  }

  return data;
}
// ==========================================
// API METHODS
// ==========================================

export const api = {
  // ==========================================
  // ACCOUNT SETTINGS
  // ==========================================

  updateTheme: (theme) =>
    request("/api/settings/theme", {
      method: "PATCH",
      body: JSON.stringify({ theme }),
    }),

  updateActiveStatus: (showActiveStatus) =>
    request("/api/users/active-status", {
      method: "PATCH",
      body: JSON.stringify({ showActiveStatus }),
    }),

  // ==========================================
  // PRIVATE CONVERSATION SETTINGS
  // ==========================================

  getConversationSettings: (id, { isGroup = false } = {}) =>
    isGroup
      ? request(
          `/api/groups/${encodeURIComponent(id)}/background`
        )
      : request(
          `/api/conversations/${encodeURIComponent(id)}/settings`
        ),

  getPendingCalls: () =>
    request("/api/conversations/calls/pending"),

  updateConversationBackground: (userId, background) =>
    request(
      `/api/conversations/${encodeURIComponent(userId)}/settings`,
      {
        method: "PATCH",
        body: JSON.stringify({ background }),
      }
    ),

  // ==========================================
  // GROUP CONVERSATION SETTINGS
  // ==========================================

  updateGroupBackground: (groupId, background) =>
    request(
      `/api/groups/${encodeURIComponent(groupId)}/background`,
      {
        method: "PATCH",
        body: JSON.stringify({ background }),
      }
    ),

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  me: () =>
    request("/api/auth/me"),

  signup: (payload) =>
    request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: async () => {
    try { return await request("/api/auth/logout", { method: "POST" }); }
    finally {
      if (native) {
        localStorage.removeItem("chatterbox_native_token");
        await bridge.configureSession({ token: "", apiUrl: API_URL });
      }
    }
  },

  // ==========================================
  // USERS
  // ==========================================

  users: (search = "") =>
    request(
      `/api/users?search=${encodeURIComponent(search)}`
    ),

  // ==========================================
  // FIREBASE DEVICE REGISTRATION
  // ==========================================

  registerFcmToken: (token, platform = "android") =>
    request("/api/users/fcm-token", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    }),

  removeFcmToken: (token) =>
    request("/api/users/fcm-token", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    }),

  // ==========================================
  // PRIVATE MESSAGES
  // ==========================================

  messages: (userId) =>
    request(
      `/api/messages/${encodeURIComponent(userId)}`
    ),

  // ==========================================
  // PRIVATE MESSAGE REQUESTS
  // ==========================================

  getMessageRequests: () =>
    request("/api/conversations/requests"),

  acceptMessageRequest: (userId) =>
    request(
      `/api/conversations/${encodeURIComponent(userId)}/accept`,
      {
        method: "POST",
      }
    ),

  rejectMessageRequest: (userId) =>
    request(
      `/api/conversations/${encodeURIComponent(userId)}/reject`,
      {
        method: "POST",
      }
    ),

  deleteMessageRequest: (userId) =>
    request(
      `/api/conversations/${encodeURIComponent(userId)}/request`,
      {
        method: "DELETE",
      }
    ),

  blockConversation: (userId) =>
    request(
      `/api/conversations/${encodeURIComponent(userId)}/block`,
      {
        method: "POST",
      }
    ),

  // ==========================================
  // GROUP CALLS
  // ==========================================

  getGroupCallToken: (groupId, callId) =>
    request(
      `/api/group-calls/${encodeURIComponent(groupId)}/token`,
      {
        method: "POST",
        body: JSON.stringify({ callId }),
      }
    ),

  // ==========================================
  // GROUP CHATS
  // ==========================================

  groups: () =>
    request("/api/groups"),

  createGroup: (payload) =>
    request("/api/groups", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  addGroupMembers: (groupId, memberIds) =>
    request(
      `/api/groups/${encodeURIComponent(groupId)}/members`,
      {
        method: "PATCH",
        body: JSON.stringify({ memberIds }),
      }
    ),

  deleteGroup: (groupId) =>
    request(
      `/api/groups/${encodeURIComponent(groupId)}`,
      {
        method: "DELETE",
      }
    ),

  groupMessages: (groupId) =>
    request(
      `/api/groups/${encodeURIComponent(groupId)}/messages`
    ),

  // ==========================================
  // FILE ATTACHMENTS
  // ==========================================

  uploadFile: async (formData) => {
    const url = `${API_URL}/api/uploads`;

    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("FILE UPLOAD FAILED:", {
        url,
        status: response.status,
        response: data,
      });

      throw new Error(
        data.message || "File upload failed."
      );
    }

    return data;
  },
};

// ==========================================
// SOCKET.IO CONNECTION
// ==========================================

export function connectSocket() {
  const socket = io(API_URL, {
    withCredentials: true,
    auth: (done) => done({ token: getToken() }),

    // Keep polling and WebSocket fallback.
    transports: ["polling", "websocket"],

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  // ==========================================
  // SOCKET CONNECTED
  // ==========================================

  socket.on("connect", () => {
    console.log("SOCKET.IO CONNECTED:", {
      socketId: socket.id,
      transport: socket.io.engine?.transport?.name,
      apiUrl: API_URL,
    });
  });

  // ==========================================
  // SOCKET CONNECTION ERROR
  // ==========================================

  socket.on("connect_error", (error) => {
    console.error("SOCKET.IO CONNECTION ERROR:", {
      message: error?.message,
      name: error?.name,
      description: error?.description,
      context: error?.context,
      stack: error?.stack,
    });
  });

  // ==========================================
  // SOCKET DISCONNECTED
  // ==========================================

  socket.on("disconnect", (reason) => {
    console.warn("SOCKET.IO DISCONNECTED:", {
      reason,
      socketId: socket.id,
    });
  });

  // ==========================================
  // SOCKET RECONNECTED TRANSPORT
  // ==========================================

  socket.io.on("reconnect_attempt", (attempt) => {
    console.log("SOCKET.IO RECONNECT ATTEMPT:", attempt);
  });

  socket.io.on("reconnect", (attempt) => {
    console.log("SOCKET.IO RECONNECTED:", {
      attempt,
      socketId: socket.id,
    });
  });

  socket.io.on("reconnect_error", (error) => {
    console.error("SOCKET.IO RECONNECT ERROR:", {
      message: error?.message,
      name: error?.name,
    });
  });

  socket.io.on("reconnect_failed", () => {
    console.error("SOCKET.IO RECONNECTION FAILED");
  });

  return socket;
}
