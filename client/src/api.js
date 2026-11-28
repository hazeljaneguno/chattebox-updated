
import { Capacitor } from "@capacitor/core";
import { io } from "socket.io-client";
import { normalizeApiUrl } from "./apiConfig.js";
import { incomingCallBridge as bridge } from "./incomingCallBridge.js";

/* =========================================
   PLATFORM CONFIGURATION
========================================= */

const native = Capacitor.getPlatform() === "android";

const TOKEN_KEY = "chatterbox_native_token";

const getToken = () => {
  if (!native) return null;

  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const authHeaders = () => {
  if (!native) return {};

  const token = getToken();

  return {
    "X-Chatterbox-Native": "android",
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
};

/* =========================================
   API BASE URL
========================================= */

export const API_URL = normalizeApiUrl(
  import.meta.env.VITE_API_URL
);

console.log("CHATTERBOX API URL:", API_URL);

/* =========================================
   NATIVE SESSION
========================================= */

async function configureNativeSession(token) {
  if (!native) return;

  try {
    await bridge.configureSession({
      token: token || "",
      apiUrl: API_URL,
    });
  } catch (error) {
    console.warn(
      "Could not configure native call session:",
      error
    );
  }
}

/* =========================================
   RESPONSE PARSER
========================================= */

async function parseResponse(response) {
  const contentType =
    response.headers.get("content-type") || "";

  if (response.status === 204) {
    return {};
  }

  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => "");

  return text ? { message: text } : {};
}

/* =========================================
   REQUEST HELPER
========================================= */

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;

  const {
    headers: customHeaders,
    ...fetchOptions
  } = options;

  const headers = new Headers(customHeaders || {});

  Object.entries(authHeaders()).forEach(
    ([key, value]) => headers.set(key, value)
  );

  const isFormData =
    typeof FormData !== "undefined" &&
    fetchOptions.body instanceof FormData;

  if (
    fetchOptions.body != null &&
    !isFormData &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response;

  try {
    response = await fetch(url, {
      ...fetchOptions,
      credentials: "include",
      headers,
    });
  } catch (error) {
    console.error("CHATTERBOX NETWORK ERROR:", {
      path,
      message: error?.message,
    });

    throw new Error(
      "Unable to connect to the Chatterbox server. " +
      "Check your internet connection and API URL."
    );
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    console.error("CHATTERBOX API ERROR:", {
      method: fetchOptions.method || "GET",
      path,
      status: response.status,
    });

    throw new Error(
      data.message ||
      data.error ||
      `Request failed with status ${response.status}`
    );
  }

  const isLoginOrSignup =
    path === "/api/auth/login" ||
    path === "/api/auth/signup";

  if (native && isLoginOrSignup && data.token) {
    try {
      localStorage.setItem(TOKEN_KEY, data.token);
    } catch (error) {
      console.warn("Could not save native token:", error);
    }

    await configureNativeSession(data.token);
  }

  return data;
}

/* =========================================
   CHATTERBOX API
========================================= */

export const api = {
  /* =======================================
     ACCOUNT SETTINGS
  ======================================= */

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

  /* =======================================
     CONVERSATION SETTINGS
  ======================================= */

  getConversationSettings: (
    id,
    { isGroup = false } = {}
  ) =>
    isGroup
      ? request(
          `/api/groups/${encodeURIComponent(id)}/background`
        )
      : request(
          `/api/conversations/${encodeURIComponent(id)}/settings`
        ),

  updateConversationBackground: (
    userId,
    background
  ) =>
    request(
      `/api/conversations/${encodeURIComponent(userId)}/settings`,
      {
        method: "PATCH",
        body: JSON.stringify({ background }),
      }
    ),

  updateGroupBackground: (
    groupId,
    background
  ) =>
    request(
      `/api/groups/${encodeURIComponent(groupId)}/background`,
      {
        method: "PATCH",
        body: JSON.stringify({ background }),
      }
    ),
  updatePrivateNickname: (userId, nickname, memberId) =>
    request(`/api/conversations/${encodeURIComponent(userId)}/nickname`, {
      method: "PATCH",
      body: JSON.stringify({ nickname, memberId }),
    }),

  updateGroupNickname: (groupId, nickname, memberId) =>
    request(`/api/groups/${encodeURIComponent(groupId)}/nickname`, {
      method: "PATCH",
      body: JSON.stringify({ nickname, memberId }),
    }),
  /* =======================================
     AUTHENTICATION
  ======================================= */

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
    try {
      return await request("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      if (native) {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch (error) {
          console.warn(
            "Could not remove native token:",
            error
          );
        }

        await configureNativeSession("");
      }
    }
  },

  /* =======================================
     USERS
  ======================================= */

  social: () => request("/api/social"),

  updateFriendship: (id, action) =>
    request(`/api/social/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, { method: "POST" }),

  users: (search = "", { includeActivity = false } = {}) =>
    request(
      `/api/users?search=${encodeURIComponent(search)}${includeActivity ? "&includeActivity=1" : ""}`
    ),

  /* =======================================
     FIREBASE NOTIFICATIONS
  ======================================= */

  registerFcmToken: (
    token,
    platform = "android"
  ) =>
    request("/api/users/fcm-token", {
      method: "POST",
      body: JSON.stringify({
        token,
        platform,
      }),
    }),

  removeFcmToken: (token) =>
    request("/api/users/fcm-token", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    }),

  /* =======================================
     PRIVATE MESSAGES
  ======================================= */

  messages: (userId) =>
    request(
      `/api/messages/${encodeURIComponent(userId)}`
    ),

  /* =======================================
     MESSAGE REQUESTS
  ======================================= */

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

  /* =======================================
     CALLS
  ======================================= */

  getPendingCalls: () =>
    request("/api/conversations/calls/pending"),

  meetingMessages: (callId) =>
    request(`/api/group-calls/${encodeURIComponent(callId)}/chat`, { cache: "no-store" }),

  sendMeetingMessage: (callId, text) =>
    request(`/api/group-calls/${encodeURIComponent(callId)}/chat`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  getGroupCallToken: (
    groupId,
    callId
  ) =>
    request(
      `/api/group-calls/${encodeURIComponent(groupId)}/token`,
      {
        method: "POST",
        body: JSON.stringify({ callId }),
      }
    ),

  /* =======================================
     GROUP CHATS
  ======================================= */

  chatNotifications: (chat) =>
    request(`/api/chat-notifications/${chat.isGroup ? "group" : "private"}/${encodeURIComponent(chat.id)}`),

  updateChatNotifications: (chat, changes) =>
    request(`/api/chat-notifications/${chat.isGroup ? "group" : "private"}/${encodeURIComponent(chat.id)}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),

  groups: () =>
    request("/api/groups"),

  createGroup: (payload) =>
    request("/api/groups", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  addGroupMembers: (
    groupId,
    memberIds
  ) =>
    request(
      `/api/groups/${encodeURIComponent(groupId)}/members`,
      {
        method: "PATCH",
        body: JSON.stringify({ memberIds }),
      }
    ),

  setGroupMemberAddPolicy: (groupId, memberAddPolicy) =>
    request(`/api/groups/${encodeURIComponent(groupId)}/member-add-policy`, {
      method: "PATCH",
      body: JSON.stringify({ memberAddPolicy }),
    }),

  setGroupAdmin: (groupId, memberId, admin) =>
    request(`/api/groups/${encodeURIComponent(groupId)}/admins/${encodeURIComponent(memberId)}`, {
      method: "PATCH",
      body: JSON.stringify({ admin }),
    }),

  uploadGroupPicture: (groupId, formData) =>
    request(`/api/uploads/groups/${encodeURIComponent(groupId)}/profile-picture`, {
      method: "POST",
      body: formData,
    }),

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

  /* =======================================
     FILE UPLOADS
  ======================================= */

  uploadProfilePicture: (formData) =>
    request("/api/uploads/profile-picture", { method: "POST", body: formData }),

  uploadFile: async (formData) => {
    if (!(formData instanceof FormData)) {
      throw new Error(
        "uploadFile requires a FormData object."
      );
    }

    return request("/api/uploads", {
      method: "POST",
      body: formData,
    });
  },
};

/* =========================================
   SOCKET.IO CONNECTION
========================================= */

export function connectSocket() {
  const socket = io(API_URL, {
    autoConnect: true,

    withCredentials: true,

    auth: (done) => {
      done({
        token: getToken(),
      });
    },

    transports: [
      "polling",
      "websocket",
    ],

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  /* =======================================
     CONNECTED
  ======================================= */

  socket.on("connect", () => {
    console.log("SOCKET.IO CONNECTED:", {
      socketId: socket.id,
      transport:
        socket.io.engine?.transport?.name,
      apiUrl: API_URL,
    });
  });

  /* =======================================
     CONNECTION ERROR
  ======================================= */

  socket.on("connect_error", (error) => {
    console.error(
      "SOCKET.IO CONNECTION ERROR:",
      {
        message: error?.message,
        name: error?.name,
        description: error?.description,
        context: error?.context,
      }
    );
  });

  /* =======================================
     DISCONNECTED
  ======================================= */

  socket.on("disconnect", (reason) => {
    console.warn(
      "SOCKET.IO DISCONNECTED:",
      {
        reason,
        socketId: socket.id,
      }
    );
  });

  /* =======================================
     RECONNECT ATTEMPT
  ======================================= */

  socket.io.on(
    "reconnect_attempt",
    (attempt) => {
      console.log(
        "SOCKET.IO RECONNECT ATTEMPT:",
        attempt
      );
    }
  );

  /* =======================================
     RECONNECTED
  ======================================= */

  socket.io.on(
    "reconnect",
    (attempt) => {
      console.log(
        "SOCKET.IO RECONNECTED:",
        {
          attempt,
          socketId: socket.id,
        }
      );
    }
  );

  /* =======================================
     RECONNECT ERROR
  ======================================= */

  socket.io.on(
    "reconnect_error",
    (error) => {
      console.error(
        "SOCKET.IO RECONNECT ERROR:",
        error?.message
      );
    }
  );

  /* =======================================
     RECONNECT FAILED
  ======================================= */

  socket.io.on(
    "reconnect_failed",
    () => {
      console.error(
        "SOCKET.IO RECONNECTION FAILED"
      );
    }
  );

  return socket;
}
