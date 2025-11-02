// routes/driveRoutes.js
const express = require("express");
const driveController = require("../controllers/driveController");

const router = express.Router();

// Upload merged audio to Google Drive
router.post("/uploadToDrive", driveController.uploadToDrive);

module.exports = router;
