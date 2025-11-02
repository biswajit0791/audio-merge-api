// queues/mergeQueue.js
const { Queue } = require("bullmq");
const { Redis } = require("ioredis");

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const mergeQueue = new Queue("audioMerge", { connection });

module.exports = mergeQueue;
