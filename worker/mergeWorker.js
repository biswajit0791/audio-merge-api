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

// 🧩 Queue (no QueueScheduler needed)
const mergeQueue = new Queue("merge-audio", { connection });

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

// 🎧 Worker logic
const worker = new Worker(
  "merge-audio",
  async (job) => {
    const { files, name } = job.data;
    const jobId = job.id || uuidv4();
    console.log(`🎬 Starting merge for job ${jobId}: ${name}`);

    // 📝 FFmpeg concat list file
    const listFile = path.join(workerDir, "merge_list.txt");
    const content = files
      .map((f) => `file '${path.join(uploadDir, f)}'`)
      .join("\n");
    fs.writeFileSync(listFile, content);

    // 🧩 Safe filename
    const safeBaseName = name
      .replace(/\s+/g, "_")
      .replace(/[^\w\-_.]/g, "")
      .replace(/_+/g, "_")
      .trim();
    const outputName = `${safeBaseName || "merged"}_${Date.now()}.mp3`;
    const outputPath = path.join(mergedDir, outputName);

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    const cmd = `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`;

    // 🕒 Run FFmpeg
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

      // ⏱️ Simulate progress updates
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

// 🧾 Worker events
worker.on("completed", (job, result) => {
  console.log(`✅ [Worker] Job ${job.id} completed: ${result.name}`);
});

worker.on("failed", (job, err) => {
  console.error(`💥 [Worker] Job ${job.id} failed: ${err.message}`);
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
connection.on("error", (err) =>
  console.error("❌ Redis connection error:", err)
);

module.exports = { mergeQueue, enqueueMergeJob };
