import { startCallMaintenance } from "./services/callMaintenance.js";
import callActionRoutes from "./routes/callActions.js";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { firebaseMessaging } from "./firebase.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import chatNotificationRoutes from "./routes/chatNotifications.js";
import settingsRoutes from "./routes/settings.js";
import socialRoutes from "./routes/social.js";
import conversationRoutes from "./routes/conversations.js";
import groupRoutes from "./routes/groups.js";
import groupCallRoutes from "./routes/groupCalls.js";
import { serveAttachment } from "./services/attachmentStorage.js";
import uploadRoutes from "./routes/uploads.js";
import messageRoutes from "./routes/messages.js";

import { configureSocketAuth } from "./utils/socketAuth.js";
import { registerSocketHandlers } from "./sockets/index.js";

const app = express();
const server = http.createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = (config.clientUrl || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {

    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`Origin is not allowed by CORS: ${origin}`)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "HEAD",
    "PUT",
    "PATCH",
    "POST",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Chatterbox-Native",
  ],
};

app.use(cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

app.get("/uploads/:filename", serveAttachment);

app.use(express.json({ limit: "20kb" }));

app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "chatterbox-api",
  });
});

app.use("/api/settings", settingsRoutes);
app.use("/api/chat-notifications", chatNotificationRoutes);

app.use("/api/conversations", conversationRoutes);
app.use("/api/social", socialRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/call-actions", callActionRoutes);

app.use("/api/users", userRoutes);

app.use("/api/groups", groupRoutes);

app.use("/api/group-calls", groupCallRoutes);

app.use("/api/uploads", uploadRoutes);

app.use("/api/messages", messageRoutes);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },

  maxHttpBufferSize: 1e6,

  pingTimeout: 20000,
  pingInterval: 25000,

  connectTimeout: 45000,
});
 
app.set("io", io);

app.set("firebaseMessaging", firebaseMessaging);

configureSocketAuth(io);

registerSocketHandlers(io);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  if (
    error.message?.startsWith(
      "Origin is not allowed by CORS"
    )
  ) {
    return res.status(403).json({
      message: "This application origin is not allowed.",
    });
  }

  return res.status(500).json({
    message: "An unexpected server error occurred.",
  });
});

async function start() {
  try {
    if (!config.mongoUri) {
      throw new Error("MongoDB URI is missing.");
    }

    await mongoose.connect(config.mongoUri);

    startCallMaintenance(io);

    server.listen(config.port, () => {
      console.log(
        `Chatterbox API listening on port ${config.port}`
      );

    });

  } catch (error) {
    console.error("Chatterbox startup failed:", error);
    process.exit(1);
  }
}

start();