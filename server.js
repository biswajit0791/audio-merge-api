require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const audioRoutes = require("./routes/audioRoutes");
const driveRoutes = require("./routes/driveRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
// ✅ Detect runtime environment
const isProd = process.env.NODE_ENV === "production";

const SESSION_PATH = isProd
  ? "/tmp/sessions"
  : path.join(__dirname, "sessions");

// ✅ Create runtime folders (important for Render)
const dirs = [SESSION_PATH, "uploads", "merged"];
dirs.forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  try {
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created ${dir} folder`);
    }

    // ✅ Give read-write-execute permissions (owner, group, others)
    fs.chmodSync(fullPath, 0o777);
    console.log(`🔓 Permissions set for ${dir} folder`);
  } catch (err) {
    console.error(`❌ Failed to prepare ${dir} folder:`, err);
  }
});
// only require after dirs are guaranteed
const FileStore = require("session-file-store")(session);

// ✅ Serve static folders for uploads and merged files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/merged", express.static(path.join(__dirname, "merged")));
// Disable caching for all responses
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow local dev or non-browser requests (like Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // ✅ Allow cookies / sessions
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
  })
);

// ✅ Handle OPTIONS preflight for all routes
app.options("*", cors());

app.use(express.json());

// ✅ Session config (auto adjusts for environment)
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
      secure: isProd, // Only HTTPS in production
      httpOnly: true,
      sameSite: isProd ? "none" : "lax", // Cross-origin allowed only in prod
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  })
);

// ✅ Routes
app.use("/auth", authRoutes);
app.use("/api", audioRoutes);
app.use("/api", driveRoutes);

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
