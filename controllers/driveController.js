// controllers/driveController.js
const path = require("path");
const fs = require("fs");
const DriveService = require("../services/driveService");
const MergeService = require("../services/mergeService");

const MERGED_DIR = path.join(__dirname, "..", "merged");

// ✅ Upload merged audio to Google Drive
exports.uploadToDrive = async (req, res) => {
  const { filename, jobId } = req.body;
  if (!filename) return res.status(400).json({ error: "Filename missing" });

  const filePath = path.join(MERGED_DIR, filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "Merged file not found" });

  try {
    await DriveService.uploadToDrive({ filePath, fileName: filename, jobId });
    res.json({ success: true, name: filename });
  } catch (err) {
    console.error("Drive upload failed:", err);
    res.status(500).json({ error: err.message });
  }
};
