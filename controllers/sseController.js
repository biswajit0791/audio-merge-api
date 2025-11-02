// controllers/sseController.js
const MergeService = require("../services/mergeService");

// ✅ Open SSE connection for progress updates
exports.subscribeProgress = (req, res) => {
  const { jobId } = req.params;
  if (!jobId) return res.status(400).send("Job ID required");

  // SSE headers
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.flushHeaders();

  const sendEvent = (type, payload) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Listen for updates
  const onUpdate = (ev) => {
    if (ev.jobId === jobId) {
      sendEvent(ev.type, ev.payload);
      if (["completed", "failed"].includes(ev.type)) {
        res.end();
        MergeService.off("progress", onUpdate);
      }
    }
  };

  MergeService.on("progress", onUpdate);

  req.on("close", () => {
    MergeService.off("progress", onUpdate);
  });
};
