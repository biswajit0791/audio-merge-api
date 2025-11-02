// routes/sseRoutes.js
const express = require("express");
const sseController = require("../controllers/sseController");

const router = express.Router();

// Subscribe to merge/upload progress
router.get("/progress/:jobId", sseController.subscribeProgress);

module.exports = router;
