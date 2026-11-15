
import cron from "node-cron";
import fs from "node:fs/promises";
import path from "node:path";

import backupDatabase from "./backupDatabase.js";

const backupRoot = process.env.BACKUP_PATH || "D:\\IMS_Backups";

// Get the current local date in YYYY-MM-DD format
const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

// Check whether a successful backup already exists for this date
const hasBackupToday = async () => {
    await fs.mkdir(backupRoot, { recursive: true });

    const databaseName = new URL(process.env.MONGO_URI)
        .pathname
        .replace(/^\/+/, "")
        .split("/")[0];

    const folders = await fs.readdir(backupRoot, {
        withFileTypes: true
    });

    const today = getLocalDateKey(new Date());

    for (const folder of folders) {
        if (
            !folder.isDirectory() ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(folder.name)
        ) {
            continue;
        }

        const folderPath = path.join(backupRoot, folder.name);
        const stats = await fs.stat(folderPath);

        // Ignore backups created on a different local date
        if (getLocalDateKey(stats.birthtime) !== today) {
            continue;
        }

        const databaseBackupPath = path.join(
            folderPath,
            databaseName
        );

        try {
            const files = await fs.readdir(databaseBackupPath);

            const bsonFiles = files.filter(file =>
                file.endsWith(".bson")
            );

            if (bsonFiles.length > 0) {
                return true;
            }
        } catch {
            // Ignore incomplete or invalid backup folders
        }
    }

    return false;
};

const startBackupScheduler = async () => {

    // Normal automatic backup at 11:00 PM
    cron.schedule("0 23 * * *", async () => {
        console.log("Starting automatic database backup...");

        try {
            const result = await backupDatabase();

            console.log(
                "Automatic backup completed:",
                result.backupPath
            );

        } catch (error) {
            console.error(
                "Automatic backup failed:",
                error.message
            );
        }
    });

    console.log("Daily backup scheduler started (11:00 PM)");

    // Check for a missed backup whenever the backend starts
    try {
        const backupExists = await hasBackupToday();

        if (backupExists) {
            console.log(
                "A successful backup already exists for this date. Startup backup skipped."
            );

            return;
        }

        console.log(
            "No successful backup found for this date. Creating startup backup..."
        );

        const result = await backupDatabase();

        console.log(
            "Startup backup completed successfully:",
            result.backupPath
        );

    } catch (error) {
        console.error(
            "Startup backup failed:",
            error.message
        );

        // The backend can still start if backup fails
    }
};

export default startBackupScheduler;
