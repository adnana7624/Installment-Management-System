
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

import cleanupOldBackups from "./cleanupOldBackups.js";

const execFileAsync = promisify(execFile);

const backupDatabase = async () => {
    try {
        const backupRoot = process.env.BACKUP_PATH || "D:\\IMS_Backups";

        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        const backupPath = path.join(backupRoot, timestamp);

        await fs.mkdir(backupPath, { recursive: true });

        const mongodumpPath =
            "C:\\MongoDB\\DatabaseTools\\mongodump.exe";

        await execFileAsync(
            mongodumpPath,
            [
                `--uri=${process.env.MONGO_URI}`,
                `--out=${backupPath}`
            ],
            { windowsHide: true }
        );

        // Verify the backup
        const databaseName = new URL(process.env.MONGO_URI)
            .pathname
            .replace(/^\/+/, "")
            .split("/")[0];

        const databaseBackupPath = path.join(
            backupPath,
            databaseName
        );

        const backupFiles = await fs.readdir(databaseBackupPath);

        const bsonFiles = backupFiles.filter(file =>
            file.endsWith(".bson")
        );

        if (bsonFiles.length === 0) {
            throw new Error("Backup verification failed. No BSON files found.");
        }

        // Clean old backups after successful verification
        let deletedBackups = [];
        let cleanupWarning = null;

        try {
            const cleanupResult = await cleanupOldBackups(
                backupRoot,
                30
            );

            deletedBackups = cleanupResult.deletedBackups;

        } catch (error) {
            cleanupWarning = error.message;

            console.error(
                "Backup created, but cleanup failed:",
                error.message
            );
        }

        return {
            success: true,
            backupPath,
            deletedBackups,
            cleanupWarning
        };

    } catch (error) {
        throw new Error(`Database backup failed: ${error.message}`);
    }
};

export default backupDatabase;
