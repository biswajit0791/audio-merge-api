const express = require("express");
const {
  uploadToDrive,
  getMergedFromDrive,
  streamDriveFile,
  deleteDriveFile
} = require("../controllers/driveController");

const router = express.Router();

router.post("/uploadToDrive", uploadToDrive);
router.get("/merged", getMergedFromDrive);
router.get("/drive/file/:id", streamDriveFile);
router.delete("/drive/file/:id", deleteDriveFile); // 🔥 New route for deletion

module.exports = router;
