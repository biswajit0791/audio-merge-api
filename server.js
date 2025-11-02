require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const FileStore = require("session-file-store")(session);

const audioRoutes = require("./routes/audioRoutes");
const driveRoutes = require("./routes/driveRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
const isProd = process.env.NODE_ENV === "production";

// ======== FOLDER SETUP (Render-safe) ========
const SESSION_PATH = isProd
  ? "/tmp/sessions"
  : path.join(__dirname, "sessions");

["uploads", "merged", SESSION_PATH].forEach((dir) => {
  const fullPath = path.resolve(__dirname, dir);
  try {
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created: ${dir}`);
    }
    fs.chmodSync(fullPath, 0o777);
  } catch (err) {
    console.error(`❌ Folder setup failed for ${dir}:`, err);
  }
});

// ======== STATIC FOLDERS ========
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/merged", express.static(path.join(__dirname, "merged")));

// ======== DISABLE CACHING ========
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ======== CORS (PROXY-FRIENDLY) ========
// ✅ Only allow localhost for dev — production handled by proxy
const allowedOrigins = [
  "http://localhost:5173", // local dev (Vite)
  "https://audio-merge-studio.vercel.app" // production frontend
];

// ✅ Flexible CORS config (proxy & direct safe)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin, server-to-server, or Postman (no origin)
      if (!origin) return callback(null, true);

      // Allow if in whitelist (exact match)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("❌ CORS blocked:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
  })
);
app.options("*", cors()); // handle preflight

// Increase upload limits
app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ limit: "1gb", extended: true }));

// ======== TRUST PROXY (REQUIRED for secure cookies on Render) ========
app.set("trust proxy", 1);

// ======== SESSION CONFIG ========
app.use(
  session({
    store: new FileStore({
      path: SESSION_PATH,
      retries: 1
    }),
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd, // HTTPS only in prod
      httpOnly: true,
      sameSite: isProd ? "none" : "lax", // "none" needed for Render + Vercel
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  })
);

// ======== ROUTES ========
app.use("/auth", authRoutes);
app.use("/api", audioRoutes);
app.use("/api", driveRoutes);

// ======== HEALTH CHECK ========
app.get("/health", (_, res) => res.send("OK"));

// ======== START SERVER ========
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
