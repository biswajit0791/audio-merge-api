const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { pipeline } = require("stream");
const { createOAuthClient } = require("../utils/googleClient");
const { ensureFolderExists } = require("../utils/ensureFolderExists");

const MERGED_DIR = path.join(__dirname, "../merged");

exports.uploadToDrive = async (req, res) => {
  const filename = req.body.filename;
  const filePath = path.join(MERGED_DIR, filename);

  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File not found" });
  if (!req.session.tokens)
    return res.status(401).json({ error: "Not authenticated" });

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(req.session.tokens);
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    const folderId = await ensureFolderExists(drive, "programs");

    const response = await drive.files.create({
      resource: { name: filename, parents: [folderId] },
      media: { mimeType: "audio/mpeg", body: fs.createReadStream(filePath) },
      fields: "id,name,webViewLink,webContentLink"
    });

    res.json(response.data);
  } catch (err) {
    console.error("Drive upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getMergedFromDrive = async (req, res) => {
  if (!req.session.tokens)
    return res.status(401).json({ error: "Not authenticated" });

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(req.session.tokens);
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    const folderId = await ensureFolderExists(drive, "programs");
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType contains 'audio/'`,
      fields:
        "files(id,name,mimeType,modifiedTime,size,webViewLink,webContentLink)",
      orderBy: "modifiedTime desc"
    });

    res.json(response.data.files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Try Drive first → fallback to backend/merged
exports.streamDriveFile = async (req, res) => {
  const { id } = req.params;
  const oauth2Client = createOAuthClient();
  if (!req.session.tokens)
    return res.status(401).json({ error: "Not authenticated" });

  oauth2Client.setCredentials(req.session.tokens);
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    const meta = await drive.files.get({
      fileId: id,
      fields: "id,name,mimeType,size"
    });

    res.setHeader(
      "Access-Control-Allow-Origin",
      `${process.env.FRONTEND_ORIGIN}`
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Content-Type", meta.data.mimeType || "audio/mpeg");
    res.setHeader("Content-Length", meta.data.size);
    res.flushHeaders();

    const response = await drive.files.get(
      { fileId: id, alt: "media" },
      { responseType: "stream" }
    );

    pipeline(response.data, res, (err) => {
      if (err) console.error("Stream error:", err.message);
    });
  } catch (err) {
    console.warn("⚠️ Drive file not found, checking local merged folder...");
    const localPath = path.join(MERGED_DIR, `${id}.mp3`);
    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath);
    }
    res.status(404).json({ error: "File not found" });
  }
};
