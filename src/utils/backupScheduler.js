
import cron from "node-cron";
import fs from "node:fs/promises";
import path from "node:path";

import backupDatabase from "./backupDatabase.js";

const backupRoot = process.env.BACKUP_PATH || "D:\\IMS_Backups";

// Get Monday at 00:00 of the current week (local time)
const getWeekStart = (date) => {
    const weekStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    const day = weekStart.getDay();
    const daysSinceMonday = (day + 6) % 7;

    weekStart.setDate(weekStart.getDate() - daysSinceMonday);

    return weekStart;
};

// Check whether a successful backup exists in the current week
const hasBackupThisWeek = async () => {
    await fs.mkdir(backupRoot, { recursive: true });

    const databaseName = new URL(process.env.MONGO_URI)
        .pathname
        .replace(/^\/+/, "")
        .split("/")[0];

    const folders = await fs.readdir(backupRoot, {
        withFileTypes: true
    });

    const weekStart = getWeekStart(new Date());

    for (const folder of folders) {
        if (
            !folder.isDirectory() ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(folder.name)
        ) {
            continue;
        }

        const folderPath = path.join(backupRoot, folder.name);
        const stats = await fs.stat(folderPath);

        // Ignore backups created before this week's Monday
        if (stats.birthtime < weekStart) {
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

// Create a backup only if this week does not already have one
const createBackupIfNeeded = async (source) => {
    try {
        const backupExists = await hasBackupThisWeek();

        if (backupExists) {
            console.log(
                `A successful backup already exists this week. ${source} backup skipped.`
            );
            return;
        }

        console.log(`Starting ${source} database backup...`);

        const result = await backupDatabase();

        console.log(
            `${source} backup completed successfully:`,
            result.backupPath
        );

    } catch (error) {
        console.error(
            `${source} backup failed:`,
            error.message
        );
    }
};

const startBackupScheduler = async () => {
    // Weekly backup: Every Monday at 10:00 AM Pakistan time
    cron.schedule(
        "0 10 * * 1",
        async () => {
            await createBackupIfNeeded("Scheduled weekly");
        },
        {
            timezone: "Asia/Karachi"
        }
    );

    console.log(
        "Weekly backup scheduler started (Monday at 10:00 AM Pakistan time)."
    );

    // Startup backup: Create a backup if this week has none
    await createBackupIfNeeded("Startup");
};

export default startBackupScheduler;
