// routes/audioRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const audioController = require("../controllers/audioController");

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 * 2 } // 2GB limit per file
});

// Upload audio file
router.post("/upload", upload.single("audio"), audioController.uploadAudio);

// Get metadata
router.get("/metadata/:filename", audioController.getMetadata);

// Start merge job
router.post("/merge", audioController.mergeAudio);

// Delete file
router.delete("/delete/:type/:filename", audioController.deleteFile);

// List uploaded files
router.get("/uploads", audioController.getUploads);

module.exports = router;
