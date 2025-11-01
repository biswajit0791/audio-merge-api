const express = require("express");
const {
  getAuthUrl,
  handleCallback,
  checkAuthStatus,
  debugSession
} = require("../controllers/authController");

const router = express.Router();

router.get("/url", getAuthUrl);
router.get("/callback", handleCallback);
router.get("/status", checkAuthStatus);
router.get("/debug/session", debugSession);

module.exports = router;
