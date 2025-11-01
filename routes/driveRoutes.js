const express = require("express");
const {
  uploadToDrive,
  getMergedFromDrive,
  streamDriveFile
} = require("../controllers/driveController");

const router = express.Router();

router.post("/uploadToDrive", uploadToDrive);
router.get("/merged", getMergedFromDrive);
router.get("/drive/file/:id", streamDriveFile);

module.exports = router;
