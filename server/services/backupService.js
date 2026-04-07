// server/services/backupService.js
// Automated daily database backup to AWS S3 using node-cron

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || 'veyano-db-backups';
const DB_PATH = path.resolve(__dirname, '..', process.env.DB_PATH || './veyano.db');
const MAX_BACKUPS = 30; // Keep last 30 days

/**
 * Upload the SQLite database to S3 with a timestamped key
 */
async function backupToS3() {
  if (!fs.existsSync(DB_PATH)) {
    console.warn('[Backup] Database file not found:', DB_PATH);
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `backups/veyano-${timestamp}.db`;

  const fileStream = fs.createReadStream(DB_PATH);

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileStream,
    ContentType: 'application/x-sqlite3',
    Metadata: {
      'backup-date': new Date().toISOString(),
      'system': 'veyano-foods-backend',
    },
  });

  await s3.send(command);
  console.log(`[Backup] ✅ Database backed up to S3: ${key}`);

  await pruneOldBackups();
}

/**
 * Delete backups older than MAX_BACKUPS to control storage costs
 */
async function pruneOldBackups() {
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: 'backups/',
  });

  const response = await s3.send(listCommand);
  const objects = (response.Contents || []).sort(
    (a, b) => new Date(a.LastModified) - new Date(b.LastModified)
  );

  if (objects.length > MAX_BACKUPS) {
    const toDelete = objects.slice(0, objects.length - MAX_BACKUPS);
    for (const obj of toDelete) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
      console.log(`[Backup] 🗑️ Pruned old backup: ${obj.Key}`);
    }
  }
}

/**
 * Schedule daily backup at 2:00 AM IST (20:30 UTC)
 * Cron expression: '30 20 * * *' (UTC) = 2:00 AM IST
 */
function scheduleBackup() {
  if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === 'your_aws_access_key') {
    console.warn('[Backup] ⚠️  AWS credentials not configured. Skipping backup scheduler. Fill in .env to enable.');
    return;
  }

  // Run immediately on startup (dev convenience)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Backup] Development mode — skipping immediate backup on startup.');
  }

  // Schedule: 2:00 AM IST = 8:30 PM UTC
  cron.schedule('30 20 * * *', async () => {
    console.log('[Backup] Starting scheduled AWS S3 database backup...');
    try {
      await backupToS3();
    } catch (err) {
      console.error('[Backup] ❌ Backup failed:', err.message);
    }
  }, {
    timezone: 'UTC',
  });

  console.log('[Backup] ✅ Daily backup scheduled for 2:00 AM IST');
}

module.exports = { scheduleBackup, backupToS3 };
