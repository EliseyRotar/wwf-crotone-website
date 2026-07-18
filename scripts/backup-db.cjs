const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const dbPath = path.join(root, "prisma", "dev.db");
const backupDir = path.join(root, "backups");

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupFile = path.join(backupDir, `dev-${timestamp}.db`);

try {
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    // SQLite — copy the file
    fs.copyFileSync(dbPath, backupFile);
    console.log(`SQLite backup: ${backupFile}`);
  } else {
    // PostgreSQL — pg_dump
    execSync(`pg_dump "${process.env.DATABASE_URL}" > "${backupFile}"`, { stdio: "pipe" });
    console.log(`PostgreSQL backup: ${backupFile}`);
  }

  // Delete backups older than 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (fs.existsSync(backupDir)) {
    fs.readdirSync(backupDir).forEach((f) => {
      const fp = path.join(backupDir, f);
      if (fs.statSync(fp).mtime.getTime() < cutoff) {
        fs.unlinkSync(fp);
        console.log(`Deleted old backup: ${f}`);
      }
    });
  }
} catch (e) {
  console.error("Backup failed:", e.message);
  process.exit(1);
}