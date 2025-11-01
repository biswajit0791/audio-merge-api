require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const FileStore = require("session-file-store")(session);

const audioRoutes = require("./routes/audioRoutes");
const driveRoutes = require("./routes/driveRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://audio-merge-studio.vercel.app"
];

app.use(
  cors({
    origin: [
      "https://audio-merge-studio.vercel.app", // your Vercel frontend
      "http://localhost:5173"                  // for local dev
    ],
    credentials: true, // ✅ Allow cookies / sessions
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
  })
);

// ✅ Handle OPTIONS preflight for all routes
app.options("*", cors());

app.use(express.json());

app.use(
  session({
    store: new FileStore({ path: "./sessions" }),
    secret: process.env.SESSION_SECRET || "supersecret123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,            // Required for HTTPS
      httpOnly: true,
      sameSite: "none",        // <-- VERY IMPORTANT for cross-origin cookies
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
  })
);

// ✅ Static folders
app.use("/uploads", express.static("uploads"));
app.use("/merged", express.static("merged"));

// ✅ Routes
app.use("/auth", authRoutes);
app.use("/api", audioRoutes);
app.use("/api", driveRoutes);

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
