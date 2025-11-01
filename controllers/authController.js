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
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");

  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  req.session.tokens = tokens;
  await new Promise((resolve) => req.session.save(resolve));

  console.log("✅ Google tokens stored in session");
  res.redirect(`${process.env.FRONTEND_ORIGIN}`);
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
    hasTokens: !!req.session.tokens,
    session: req.session
  });
};
