const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const {
  mergeQueue,
  enqueueMergeJob,
  metaQueue
} = require("../worker/mergeWorker");

const UPLOADS_DIR = path.join(__dirname, "../uploads");
const MERGED_DIR = path.join(__dirname, "../merged");

// ✅ Upload
exports.uploadAudio = async (req, res) => {
  try {
    const filePath = path.join(UPLOADS_DIR, req.file.filename);
    const { filename, originalname, size } = req.file;

    // 🟢 Enqueue metadata extraction job
    await metaQueue.add("extract", { filePath, filename, originalname, size });

    // Respond immediately (non-blocking)
    res.json({
      success: true,
      originalname,
      filename,
      size,
      duration: null,
      message: "File uploaded. Metadata will be extracted shortly."
    });
  } catch (err) {
    console.error("❌ Upload failed:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get metadata using ffprobe
exports.getMetadata = async (req, res) => {
  try {
    const { filename } = req.params;
    const metaPath = path.join(UPLOADS_DIR, `${filename}.json`);

    if (!fs.existsSync(metaPath)) {
      return res.status(202).json({ status: "processing" });
    }

    const data = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    res.json({ status: "done", ...data });
  } catch (err) {
    console.error("❌ Metadata fetch failed:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Merge multiple audios
exports.mergeAudio = async (req, res) => {
  const { files, name } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0)
    return res.status(400).json({ error: "No files provided" });

  try {
    const jobId = await enqueueMergeJob(files, name);
    res.json({ jobId, message: "Merge queued successfully" });
  } catch (err) {
    console.error("❌ Failed to queue job:", err.message);
    res
      .status(500)
      .json({ error: "Failed to queue job", details: err.message });
  }
};

exports.mergeAudioStatus = async (req, res) => {
  try {
    const job = await mergeQueue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;

    res.json({
      id: job.id,
      state,
      progress,
      data: job.data,
      result
    });
  } catch (err) {
    console.error("❌ Status check failed:", err);
    res.status(500).json({ error: "Status check failed" });
  }
};

// ✅ Delete file
exports.deleteFile = (req, res) => {
  const { type, filename } = req.params;
  const dir =
    type === "uploads" ? UPLOADS_DIR : type === "merged" ? MERGED_DIR : null;
  if (!dir) return res.status(400).json({ error: "Invalid type" });

  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File not found" });

  fs.unlinkSync(filePath);
  res.json({ deleted: filename });
};

// ✅ Optional: list uploaded files
exports.getUploadsList = (req, res) => {
  const files = fs.readdirSync(UPLOADS_DIR).map((name) => ({
    name,
    size: fs.statSync(path.join(UPLOADS_DIR, name)).size
  }));
  res.json(files);
};
