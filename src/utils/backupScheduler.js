
import cron from "node-cron";
import fs from "node:fs/promises";
import path from "node:path";

import backupDatabase from "./backupDatabase.js";

import {
    isMaintenanceMode
} from "../middleware/maintenanceMode.js";

const backupRoot =
    process.env.BACKUP_PATH || "D:\\IMS_Backups";

const requiredCollections = [
    "admins",
    "businessinfos",
    "counters",
    "customers",
    "expenses",
    "installments",
    "payments"
];

// Convert backup folder name into a Date.
const getBackupDate = (folderName) => {
    const match = folderName.match(
        /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/
    );

    if (!match) {
        return null;
    }

    const [, date, hours, minutes, seconds, milliseconds] =
        match;

    return new Date(
        `${date}T${hours}:${minutes}:${seconds}.${milliseconds}Z`
    );
};

// Calculate the start of the current week in Pakistan time.
const getPakistanWeekStart = () => {
    const now = new Date();

    // Pakistan uses UTC+5.
    const pakistanTime = new Date(
        now.getTime() + 5 * 60 * 60 * 1000
    );

    const day = pakistanTime.getUTCDay();

    // Monday = 0, Sunday = 6.
    const daysSinceMonday = (day + 6) % 7;

    const mondayMidnightPakistan = Date.UTC(
        pakistanTime.getUTCFullYear(),
        pakistanTime.getUTCMonth(),
        pakistanTime.getUTCDate() - daysSinceMonday,
        0,
        0,
        0,
        0
    );

    // Convert Pakistan midnight back to UTC.
    return mondayMidnightPakistan -
        5 * 60 * 60 * 1000;
};

// Check that a backup folder contains all required BSON files.
const isCompleteBackup = async (folderPath) => {
    try {
        const databaseName = new URL(
            process.env.MONGO_URI
        ).pathname.replace(/^\/+/, "").split("/")[0];

        if (!databaseName) {
            return false;
        }

        const databasePath = path.join(
            folderPath,
            databaseName
        );

        for (const collectionName of requiredCollections) {
            const bsonPath = path.join(
                databasePath,
                `${collectionName}.bson`
            );

            const stats = await fs.stat(bsonPath);

            if (!stats.isFile()) {
                return false;
            }
        }

        return true;

    } catch {
        return false;
    }
};

// Find whether a complete backup already exists this week.
const hasSuccessfulBackupThisWeek = async () => {
    try {
        await fs.mkdir(backupRoot, {
            recursive: true
        });

        const folders = await fs.readdir(
            backupRoot,
            { withFileTypes: true }
        );

        const weekStart = getPakistanWeekStart();
        const now = Date.now();

        for (const folder of folders) {
            if (!folder.isDirectory()) {
                continue;
            }

            const backupDate = getBackupDate(
                folder.name
            );

            if (!backupDate) {
                continue;
            }

            const backupTime = backupDate.getTime();

            if (
                backupTime < weekStart ||
                backupTime > now
            ) {
                continue;
            }

            const folderPath = path.join(
                backupRoot,
                folder.name
            );

            if (await isCompleteBackup(folderPath)) {
                return true;
            }
        }

        return false;

    } catch (error) {
        console.error(
            "Could not check existing weekly backups:",
            error.message
        );

        return false;
    }
};

// Start weekly backup scheduler.
const startBackupScheduler = async () => {

    // 1. Check persistent maintenance mode first.
    if (isMaintenanceMode()) {
        console.log(
            "Startup backup skipped because the application is in maintenance mode."
        );
    } else {
        // 2. Run startup backup only if no successful backup
        // exists in the current Pakistan calendar week.
        try {
            const backupExists =
                await hasSuccessfulBackupThisWeek();

            if (backupExists) {
                console.log(
                    "A successful backup already exists this week. Startup backup skipped."
                );
            } else if (isMaintenanceMode()) {
                console.log(
                    "Startup backup skipped because maintenance mode is active."
                );
            } else {
                console.log(
                    "No successful backup found this week. Starting startup backup..."
                );

                await backupDatabase();

                console.log(
                    "Startup backup completed."
                );
            }

        } catch (error) {
            console.error(
                "Startup backup failed:",
                error.message
            );
        }
    }

    // 3. Schedule weekly backup.
    // Every Monday at 10:00 AM Pakistan time.
    const task = cron.schedule(
        "0 10 * * 1",
        async () => {

            // Check maintenance mode before scheduled backup.
            if (isMaintenanceMode()) {
                console.log(
                    "Scheduled backup skipped because the application is in maintenance mode."
                );

                return;
            }

            try {
                console.log(
                    "Starting scheduled weekly database backup..."
                );

                await backupDatabase();

                console.log(
                    "Scheduled weekly database backup completed."
                );

            } catch (error) {
                console.error(
                    "Scheduled weekly database backup failed:",
                    error.message
                );
            }
        },
        {
            timezone: "Asia/Karachi"
        }
    );

    console.log(
        "Weekly backup scheduler started (Monday at 10:00 AM Pakistan time)."
    );

    return task;
};

export default startBackupScheduler;
