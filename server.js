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

// ✅ Create runtime folders (important for Render)
const dirs = ["sessions", "uploads", "merged"];
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

app.use(
  cors({
    origin: [
      "https://audio-merge-studio.vercel.app", // your Vercel frontend
      "http://localhost:5173" // for local dev
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
    store: new FileStore({
      path: path.join(__dirname, "sessions"),
      retries: 0, // don’t keep retrying forever
      ttl: 86400, // 1 day
      logFn: function () {} // silence noisy logs
    }),
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // Render uses HTTPS
      httpOnly: true,
      sameSite: "none", // allows Vercel cross-site cookies
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  })
);
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

// ✅ Routes
app.use("/auth", authRoutes);
app.use("/api", audioRoutes);
app.use("/api", driveRoutes);

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
