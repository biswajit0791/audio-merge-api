// services/driveService.js
const fs = require("fs");
const { google } = require("googleapis");
const MergeService = require("./mergeService");

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

function getAuthClient() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return new google.auth.JWT(key.client_email, null, key.private_key, SCOPES);
  } else {
    const OAuth2 = google.auth.OAuth2;
    const oAuth2Client = new OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oAuth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
    return oAuth2Client;
  }
}

async function uploadToDrive({ filePath, fileName, jobId }) {
  const auth = getAuthClient();
  const drive = google.drive({ version: "v3", auth });

  const fileSize = fs.statSync(filePath).size;
  const stream = fs.createReadStream(filePath);

  const res = await drive.files.create(
    {
      requestBody: { name: fileName, mimeType: "audio/mpeg" },
      media: { mimeType: "audio/mpeg", body: stream }
    },
    {
      onUploadProgress: (evt) => {
        const progress = Math.round((evt.bytesRead / fileSize) * 100);
        MergeService.emit("progress", {
          jobId,
          type: "drive_progress",
          payload: { progress }
        });
      }
    }
  );

  return res.data;
}

module.exports = { uploadToDrive };
