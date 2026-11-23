
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

import cleanupOldBackups from "./cleanupOldBackups.js";
import createBackupArchive from "./createBackupArchive.js";
import uploadBackupToGoogleDrive from "./uploadBackupToGoogleDrive.js";

const execFileAsync = promisify(execFile);

const backupDatabase = async () => {
    let archivePath = null;

    try {
        const backupRoot =
            process.env.BACKUP_PATH || "D:\\IMS_Backups";

        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        const backupPath = path.join(
            backupRoot,
            timestamp
        );

        // 1. Create local backup directory
        await fs.mkdir(backupPath, { recursive: true });

        const mongodumpPath =
            "C:\\MongoDB\\DatabaseTools\\mongodump.exe";

        // 2. Create MongoDB backup
        await execFileAsync(
            mongodumpPath,
            [
                `--uri=${process.env.MONGO_URI}`,
                `--out=${backupPath}`
            ],
            { windowsHide: true }
        );

        // 3. Verify the local backup
        const databaseName = new URL(process.env.MONGO_URI)
            .pathname
            .replace(/^\/+/, "")
            .split("/")[0];

        const databaseBackupPath = path.join(
            backupPath,
            databaseName
        );

        const backupFiles = await fs.readdir(
            databaseBackupPath
        );

        const bsonFiles = backupFiles.filter(file =>
            file.endsWith(".bson")
        );

        if (bsonFiles.length === 0) {
            throw new Error(
                "Local backup verification failed. No BSON files found."
            );
        }

        console.log(
            "Local MongoDB backup verified successfully."
        );

        // 4. Prepare separate Google Drive backup status
        let cloudBackup = {
            success: false,
            status: "failed",
            fileId: null,
            fileName: null,
            error: null
        };

        try {
            // Keep the ZIP outside the source backup folder
            archivePath = path.join(
                backupRoot,
                `IMS_Database_Backup_${timestamp}.zip`
            );

            // 5. Create ZIP archive
            const archiveResult = await createBackupArchive(
                backupPath,
                archivePath
            );

            console.log(
                "Backup archive created:",
                archiveResult.archivePath
            );

            // 6. Encrypt and upload to Google Drive
            const uploadResult =
                await uploadBackupToGoogleDrive(archivePath);

            cloudBackup = {
                success: true,
                status: "uploaded",
                fileId: uploadResult.fileId,
                fileName: uploadResult.fileName,
                error: null
            };

            console.log(
                "Encrypted database backup uploaded to Google Drive:",
                uploadResult.fileName
            );

        } catch (error) {
            // Local backup remains successful even if cloud upload fails
            cloudBackup = {
                success: false,
                status: "failed",
                fileId: null,
                fileName: null,
                error: error.message
            };

            console.error(
                "Google Drive backup failed. Local backup is safe:",
                error.message
            );

        } finally {
            // 7. Remove temporary ZIP archive
            if (archivePath) {
                try {
                    await fs.unlink(archivePath);

                    console.log(
                        "Temporary ZIP archive removed."
                    );

                } catch (error) {
                    if (error.code !== "ENOENT") {
                        console.error(
                            "Temporary ZIP cleanup failed:",
                            error.message
                        );
                    }
                }
            }
        }

        // 8. Keep only the latest 10 local backups
        let deletedBackups = [];
        let cleanupWarning = null;

        try {
            const cleanupResult = await cleanupOldBackups(
                backupRoot,
                10
            );

            deletedBackups = cleanupResult.deletedBackups;

        } catch (error) {
            cleanupWarning = error.message;

            console.error(
                "Local backup created, but old backup cleanup failed:",
                error.message
            );
        }

        // 9. Return separate local and cloud statuses
        return {
            success: true,
            localBackup: {
                success: true,
                status: "completed",
                backupPath,
                verifiedFiles: bsonFiles.length
            },
            cloudBackup,
            deletedBackups,
            cleanupWarning
        };

    } catch (error) {
        throw new Error(
            `Database backup failed: ${error.message}`
        );
    }
};

export default backupDatabase;
