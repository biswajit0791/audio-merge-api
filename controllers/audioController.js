const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

const UPLOADS_DIR = path.join(__dirname, "../uploads");
const MERGED_DIR = path.join(__dirname, "../merged");

// ✅ Upload
exports.uploadAudio = (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size
  });
};

// ✅ Get metadata using ffprobe
exports.getMetadata = (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File not found" });

  // ✅ Explicitly set CORS-safe headers for this route
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  ffmpeg.ffprobe(filePath, (err, metadata) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      duration: metadata.format.duration,
      size: metadata.format.size,
      format: metadata.format.format_name
    });
  });
};

// ✅ Merge multiple audios
exports.mergeAudio = async (req, res) => {
  const files = req.body.files;
  if (!files?.length)
    return res.status(400).json({ error: "No files provided" });

  const mergedName = `${req.body.name || "merged"}_${Date.now()}.mp3`;
  const mergedPath = path.join(MERGED_DIR, mergedName);
  const listFilePath = path.join(MERGED_DIR, `inputs_${Date.now()}.txt`);

  try {
    const listContent = files
      .map((f) => `file '${path.join(UPLOADS_DIR, f).replace(/\\/g, "/")}'`)
      .join("\n");

    fs.writeFileSync(listFilePath, listContent);

    const { exec } = require("child_process");
    const cmd = `ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -acodec libmp3lame -q:a 2 "${mergedPath}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      fs.unlinkSync(listFilePath);
      if (err) return res.status(500).json({ error: stderr });
      console.log("✅ Merged successfully:", mergedPath);
      res.json({ mergedFile: mergedName });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
