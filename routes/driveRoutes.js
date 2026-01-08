const express = require("express");
const {
  uploadToDrive,
  getMergedFromDrive,
  streamDriveFile,
  listDriveFolder,
  downloadDriveFile,
  debugFolderAccess
} = require("../controllers/driveController");

const router = express.Router();

router.post("/uploadToDrive", uploadToDrive);
router.get("/merged", getMergedFromDrive);
router.get("/drive/file/:id", streamDriveFile);
router.get("/drive/folder/:folderId", listDriveFolder);
router.get("/drive/debug/:folderId", debugFolderAccess);
router.get("/drive/download/:fileId", downloadDriveFile);

module.exports = router;
