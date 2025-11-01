const { createOAuthClient } = require("../utils/googleClient");

exports.getAuthUrl = (req, res) => {
  const oauth2Client = createOAuthClient();
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.metadata.readonly"
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent"
  });
  res.json({ url });
};

exports.handleCallback = async (req, res) => {
  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);

    req.session.tokens = tokens;
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );
    console.log("✅ Google tokens stored in session");

    res.redirect(
      process.env.FRONTEND_URL || "https://audio-merge-studio.vercel.app"
    );
  } catch (err) {
    console.error("❌ Error during callback:", err);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
};

exports.checkAuthStatus = (req, res) => {
  try {
    if (req.session && req.session.tokens) {
      return res.status(200).json({ status: true });
    } else {
      return res.status(200).json({ status: false });
    }
  } catch (err) {
    console.error("Auth status check failed:", err);
    return res
      .status(500)
      .json({ status: false, error: "Internal Server Error" });
  }
};

exports.debugSession = (req, res) => {
  res.json({
    hasSession: !!req.session,
    hasTokens: !!req.session?.tokens,
    sessionData: req.session
  });
};
