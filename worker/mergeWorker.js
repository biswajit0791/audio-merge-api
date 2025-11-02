const { Queue, Worker } = require("bullmq");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const IORedis = require("ioredis");

// ⚙️ Redis connection
const connection = new IORedis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379",
  {
    maxRetriesPerRequest: null, // ✅ required for BullMQ
    enableReadyCheck: false // ✅ faster connection start
  }
);

// 🧩 Queues
const mergeQueue = new Queue("merge-audio", { connection });
const metaQueue = new Queue("audio-metadata", { connection });

// 📁 Folder setup
const workerDir = __dirname;
const uploadDir = path.join(__dirname, "../uploads");
const mergedDir = path.join(__dirname, "../merged");
[uploadDir, mergedDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created folder: ${dir}`);
  }
});

// 🎧 ========== MERGE WORKER ==========
const mergeWorker = new Worker(
  "merge-audio",
  async (job) => {
    const { files, name } = job.data;
    const jobId = job.id || uuidv4();
    console.log(`🎬 Starting merge for job ${jobId}: ${name}`);

    const listFile = path.join(workerDir, "merge_list.txt");
    const content = files
      .map((f) => `file '${path.join(uploadDir, f)}'`)
      .join("\n");
    fs.writeFileSync(listFile, content);

    const safeBaseName = name
      .replace(/\s+/g, "_")
      .replace(/[^\w\-_.]/g, "")
      .replace(/_+/g, "_")
      .trim();

    const outputName = `${safeBaseName || "merged"}_${Date.now()}.mp3`;
    const outputPath = path.join(mergedDir, outputName);

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    const cmd = `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`;

    return new Promise((resolve, reject) => {
      const process = exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Job ${jobId} failed: ${stderr}`);
          job.log(stderr);
          return reject(new Error(stderr));
        }

        console.log(`✅ Job ${jobId} completed: ${outputName}`);
        job.updateProgress(100);
        resolve({ output: outputPath, name: outputName });
      });

      // Simulate progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        if (progress >= 95) clearInterval(interval);
        job.updateProgress(Math.min(progress, 95));
      }, 700);
    });
  },
  {
    connection,
    concurrency: 2,
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 7200 }
  }
);

// 🎵 ========== METADATA WORKER ==========
const metaWorker = new Worker(
  "audio-metadata",
  async (job) => {
    const { filePath, filename, originalname, size } = job.data;
    console.log(`📊 Extracting metadata for ${filename}`);

    return new Promise((resolve, reject) => {
      exec(
        `ffprobe -v quiet -show_entries format=duration,size -of json "${filePath}"`,
        (err, stdout) => {
          if (err) {
            console.error(`❌ Metadata extraction failed: ${err.message}`);
            return reject(err);
          }

          const info = JSON.parse(stdout).format;
          const duration = parseFloat(info.duration) || 0;
          const fileSize = parseInt(info.size) || size;

          const metaPath = path.join(uploadDir, `${filename}.json`);
          fs.writeFileSync(
            metaPath,
            JSON.stringify({
              filename,
              originalname,
              size: fileSize,
              duration
            })
          );

          console.log(
            `✅ Metadata saved: ${filename} (${duration.toFixed(2)}s)`
          );
          resolve({ filename, duration, size: fileSize });
        }
      );
    });
  },
  {
    connection,
    concurrency: 3,
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 7200 }
  }
);

// 🧾 Worker events
mergeWorker.on("completed", (job, result) => {
  console.log(`✅ [Worker] Merge job ${job.id} completed: ${result.name}`);
});

mergeWorker.on("failed", (job, err) => {
  console.error(`💥 [Worker] Merge job ${job.id} failed: ${err.message}`);
});

metaWorker.on("completed", (job, result) => {
  console.log(`✅ [Worker] Metadata job completed: ${result.filename}`);
});

metaWorker.on("failed", (job, err) => {
  console.error(`💥 [Worker] Metadata job failed: ${err.message}`);
});

// 🔁 Enqueue merge job
const enqueueMergeJob = async (files, name) => {
  const job = await mergeQueue.add(
    "merge-task",
    { files, name },
    { attempts: 2, backoff: { type: "exponential", delay: 2000 } }
  );
  console.log(`📦 Enqueued merge job ${job.id} for ${name}`);
  return job.id;
};

connection.on("connect", () => console.log("✅ Redis connected (BullMQ)"));
connection.on("error", (err) => console.error("❌ Redis error:", err.message));

module.exports = { mergeQueue, enqueueMergeJob, metaQueue };
