const express = require("express");
const router = express.Router();
const {
  uploadAudio,
  getMetadata,
  mergeAudio,
  deleteFile,
  getUploadsList
} = require("../controllers/audioController");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload dirs exist
const UPLOADS_DIR = path.join(__dirname, "../uploads");
const MERGED_DIR = path.join(__dirname, "../merged");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(MERGED_DIR)) fs.mkdirSync(MERGED_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(
      null,
      `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.\-]/g, "_")}`
    );
  }
});

const upload = multer({ storage });

// ROUTES
router.post("/upload", upload.single("audio"), uploadAudio);
router.get("/metadata/:filename", getMetadata);
router.post("/merge", mergeAudio);
router.delete("/delete/:type/:filename", deleteFile);
router.get("/uploads", getUploadsList);

module.exports = router;
