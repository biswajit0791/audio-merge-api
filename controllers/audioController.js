// controllers/audioController.js
const AudioService = require("../services/audioService");
const MergeService = require("../services/mergeService");

// ✅ Upload single audio file (Multer handles actual file save)
exports.uploadAudio = (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  res.json({
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size
  });
};

// ✅ Get metadata of uploaded audio
exports.getMetadata = async (req, res) => {
  try {
    const data = await AudioService.getMetadata(req.params.filename);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Trigger background merge (async job)
exports.mergeAudio = async (req, res) => {
  try {
    const { files, name } = req.body;
    if (!files?.length)
      return res.status(400).json({ error: "No files provided" });

    const job = await MergeService.enqueueMerge({ files, name });
    res.json({ jobId: job.id, mergedName: job.mergedName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Delete uploaded or merged file
exports.deleteFile = (req, res) => {
  try {
    const { type, filename } = req.params;
    const result = AudioService.deleteFile(type, filename);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ List uploaded files
exports.getUploads = (req, res) => {
  const files = AudioService.listUploads();
  res.json(files);
};
