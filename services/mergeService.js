// services/mergeService.js
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");
const ffmpeg = require("fluent-ffmpeg");
const ffprobeStatic = require("ffprobe-static");
const { v4: uuidv4 } = require("uuid");

ffmpeg.setFfprobePath(ffprobeStatic.path);

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const MERGED_DIR = path.join(__dirname, "..", "merged");

class MergeService extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.active = false;
    this.jobs = new Map();
  }

  async enqueueMerge({ files, name }) {
    const id = uuidv4();
    const mergedName = `${name || "merged"}_${Date.now()}.mp3`;
    const job = { id, files, mergedName, status: "queued", progress: 0 };
    this.queue.push(job);
    this.jobs.set(id, job);
    this._processQueue();
    return job;
  }

  async _processQueue() {
    if (this.active) return;
    const job = this.queue.shift();
    if (!job) return;
    this.active = true;
    job.status = "running";
    this.emit("progress", { jobId: job.id, type: "started" });

    try {
      // Build input list file
      const listFile = path.join(MERGED_DIR, `inputs_${job.id}.txt`);
      const listContent = job.files
        .map((f) => `file '${path.join(UPLOADS_DIR, f).replace(/\\/g, "/")}'`)
        .join("\n");
      fs.writeFileSync(listFile, listContent);

      // Calculate total duration
      const totalDuration = await this._getTotalDuration(job.files);

      const outputPath = path.join(MERGED_DIR, job.mergedName);
      const args = [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-acodec",
        "libmp3lame",
        "-q:a",
        "2",
        outputPath
      ];

      const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

      ff.stderr.setEncoding("utf8");
      ff.stderr.on("data", (chunk) => {
        const timeMatch = chunk.match(/time=([0-9:.]+)/);
        if (timeMatch) {
          const timeSec = this._timeToSeconds(timeMatch[1]);
          const percent = Math.min(
            100,
            Math.round((timeSec / totalDuration) * 100)
          );
          this.emit("progress", {
            jobId: job.id,
            type: "progress",
            payload: { percent }
          });
        }
      });

      ff.on("exit", (code) => {
        fs.unlinkSync(listFile);
        this.active = false;
        if (code === 0) {
          job.status = "completed";
          this.emit("progress", {
            jobId: job.id,
            type: "completed",
            payload: { mergedName: job.mergedName }
          });
        } else {
          job.status = "failed";
          this.emit("progress", {
            jobId: job.id,
            type: "failed",
            payload: { code }
          });
        }
        this._processQueue();
      });
    } catch (err) {
      job.status = "failed";
      this.active = false;
      this.emit("progress", {
        jobId: job.id,
        type: "failed",
        payload: { error: err.message }
      });
      this._processQueue();
    }
  }

  async _getTotalDuration(files) {
    let total = 0;
    for (const f of files) {
      const filePath = path.join(UPLOADS_DIR, f);
      const info = await this._probe(filePath);
      total += info.format.duration;
    }
    return total;
  }

  _probe(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
  }

  _timeToSeconds(time) {
    const [h, m, s] = time.split(":").map(parseFloat);
    return h * 3600 + m * 60 + s;
  }
}

module.exports = new MergeService();
