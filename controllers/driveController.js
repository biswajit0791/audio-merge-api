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
  if (!req.session.tokens) {
    return res.status(401).json({ error: "Not authenticated" });
  }

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
      if (err) {
        console.error("Stream error:", err.message);
        // Don't try to send response if headers already sent
        if (!res.headersSent) {
          // Try local fallback
          const localPath = path.join(MERGED_DIR, `${id}.mp3`);
          if (fs.existsSync(localPath)) {
            return res.sendFile(localPath);
          }
          res.status(500).json({ error: "Failed to stream file" });
        }
      }
    });
  } catch (err) {
    // Check if headers were already sent before trying to send response
    if (res.headersSent) {
      console.error("Headers already sent, cannot send error response");
      return;
    }

    console.warn("⚠️ Drive file not found, checking local merged folder...");
    const localPath = path.join(MERGED_DIR, `${id}.mp3`);
    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath, (sendErr) => {
        if (sendErr) {
          console.error("Local file send error:", sendErr.message);
          // Only send error if headers haven't been sent
          if (!res.headersSent) {
            res.status(404).json({ error: "File not found" });
          }
        }
      });
    }

    // Only send JSON if headers haven't been sent
    if (!res.headersSent) {
      res.status(404).json({ error: "File not found" });
    }
  }
};

// ✅ List files and folders from a specific Drive folder
exports.listDriveFolder = async (req, res) => {
  console.log("📋 listDriveFolder called");
  console.log("Session ID:", req.sessionID);
  console.log("Has tokens:", !!req.session.tokens);

  if (!req.session.tokens) {
    console.log("❌ No tokens in session");
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { folderId } = req.params;
  console.log("Folder ID:", folderId);

  if (!folderId) {
    return res.status(400).json({ error: "Folder ID is required" });
  }

  const oauth2Client = createOAuthClient();

  try {
    oauth2Client.setCredentials(req.session.tokens);

    // Set up automatic token refresh (only once per OAuth client instance)
    // Note: This listener will be set up each time, but that's okay for token refresh
    oauth2Client.on("tokens", (tokens) => {
      try {
        if (tokens.refresh_token) {
          req.session.tokens.refresh_token = tokens.refresh_token;
        }
        if (tokens.access_token) {
          req.session.tokens.access_token = tokens.access_token;
        }
        if (tokens.expiry_date) {
          req.session.tokens.expiry_date = tokens.expiry_date;
        }
        req.session.save((err) => {
          if (err) {
            console.error("Error saving refreshed tokens:", err);
          } else {
            console.log("✅ Tokens refreshed and saved");
          }
        });
      } catch (tokenErr) {
        console.error("Error updating tokens in session:", tokenErr);
      }
    });
  } catch (err) {
    console.error("Error setting credentials:", err.message);
    console.error("Token error details:", err);
    console.error("Session tokens:", req.session.tokens ? "exists" : "missing");
    return res.status(401).json({ error: "Invalid authentication tokens" });
  }

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    console.log(`📁 Attempting to list folder: ${folderId}`);
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields:
        "files(id,name,mimeType,modifiedTime,size,webViewLink,webContentLink)",
      orderBy: "name"
    });

    console.log(`✅ Successfully retrieved ${response.data.files?.length || 0} items from folder`);

    // Check if response.data exists and has files array
    if (!response.data || !response.data.files) {
      return res.json({
        folders: [],
        files: []
      });
    }

    // Separate folders and files
    const folders = (response.data.files || []).filter(
      (file) => file.mimeType === "application/vnd.google-apps.folder"
    );
    const files = (response.data.files || []).filter(
      (file) => file.mimeType !== "application/vnd.google-apps.folder"
    );

    res.json({
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime
      })),
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        size: f.size,
        webViewLink: f.webViewLink,
        webContentLink: f.webContentLink
      }))
    });
  } catch (err) {
    console.error("Drive folder list error:", err);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
    });

    // Handle specific Google API errors
    if (err.code === 404 || err.response?.status === 404) {
      return res.status(404).json({ error: "Folder not found" });
    }
    if (err.code === 403 || err.response?.status === 403) {
      return res.status(403).json({
        error: "Access denied to this folder",
        details: err.response?.data?.error?.message || "You may not have permission to access this folder"
      });
    }
    if (err.code === 401 || err.response?.status === 401) {
      return res.status(401).json({
        error: "Authentication failed. Please reconnect to Google Drive.",
        details: err.response?.data?.error?.message || "Your session may have expired"
      });
    }

    // Check if it's a token expiration issue
    if (err.message?.includes("invalid_grant") || err.message?.includes("Token has been expired")) {
      return res.status(401).json({
        error: "Your Google Drive session has expired. Please reconnect.",
        code: "TOKEN_EXPIRED"
      });
    }

    res.status(500).json({
      error: err.message || "Failed to list folder contents",
      code: err.code,
      details: err.response?.data || null
    });
  }
};

// ✅ Debug endpoint to check folder access
exports.debugFolderAccess = async (req, res) => {
  const { folderId } = req.params;

  if (!req.session.tokens) {
    return res.status(401).json({
      error: "Not authenticated",
      hasTokens: false
    });
  }

  const oauth2Client = createOAuthClient();

  try {
    oauth2Client.setCredentials(req.session.tokens);
  } catch (err) {
    return res.status(401).json({
      error: "Invalid tokens",
      tokenError: err.message
    });
  }

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    // Try to get folder metadata first
    const folderMeta = await drive.files.get({
      fileId: folderId,
      fields: "id,name,mimeType,permissions"
    });

    // Try to list files
    const listResponse = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1
    });

    res.json({
      success: true,
      folder: {
        id: folderMeta.data.id,
        name: folderMeta.data.name,
        mimeType: folderMeta.data.mimeType
      },
      canList: true,
      fileCount: listResponse.data.files?.length || 0
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: err.code,
      status: err.response?.status,
      details: err.response?.data
    });
  }
};

// ✅ Download Drive file to local storage for merging
exports.downloadDriveFile = async (req, res) => {
  if (!req.session.tokens)
    return res.status(401).json({ error: "Not authenticated" });

  const { fileId } = req.params;
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(req.session.tokens);
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    // Get file metadata
    const meta = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,size"
    });

    // Download file
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    // Save to uploads directory
    const ext = path.extname(meta.data.name) || ".mp3";
    const filename = `${Date.now()}_${meta.data.name.replace(/[^a-zA-Z0-9.\-]/g, "_")}`;
    const filePath = path.join(__dirname, "../uploads", filename);

    const writeStream = fs.createWriteStream(filePath);
    response.data.pipe(writeStream);

    writeStream.on("finish", () => {
      res.json({
        success: true,
        filename,
        originalname: meta.data.name,
        size: meta.data.size,
        mimeType: meta.data.mimeType
      });
    });

    writeStream.on("error", (err) => {
      console.error("Download error:", err);
      res.status(500).json({ error: "Failed to download file" });
    });
  } catch (err) {
    console.error("Drive download error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
