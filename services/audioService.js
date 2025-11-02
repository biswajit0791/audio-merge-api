// services/audioService.js
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffprobeStatic = require("ffprobe-static");

ffmpeg.setFfprobePath(ffprobeStatic.path);

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const MERGED_DIR = path.join(__dirname, "..", "merged");

const AudioService = {
  // ✅ Get audio metadata
  getMetadata(filename) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(UPLOADS_DIR, filename);
      if (!fs.existsSync(filePath)) return reject(new Error("File not found"));

      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) return reject(err);
        resolve({
          duration: data.format.duration,
          size: data.format.size,
          format: data.format.format_name
        });
      });
    });
  },

  // ✅ Delete file (uploads or merged)
  deleteFile(type, filename) {
    const dir =
      type === "uploads" ? UPLOADS_DIR : type === "merged" ? MERGED_DIR : null;
    if (!dir) throw new Error("Invalid file type");

    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) throw new Error("File not found");

    fs.unlinkSync(filePath);
    return { deleted: filename };
  },

  // ✅ List uploaded files
  listUploads() {
    return fs.readdirSync(UPLOADS_DIR).map((name) => ({
      name,
      size: fs.statSync(path.join(UPLOADS_DIR, name)).size
    }));
  }
};

module.exports = AudioService;
