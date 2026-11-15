
import fs from "node:fs/promises";
import path from "node:path";
import backupDatabase from "../utils/backupDatabase.js";

const backupRoot = process.env.BACKUP_PATH || "D:\\IMS_Backups";

// Create manual backup
export const createBackup = async (req, res) => {
    try {
        const result = await backupDatabase();

        return res.status(200).json({
            success: true,
            message: "Database backup created successfully",
            data: result
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get backup history
export const getBackupHistory = async (req, res) => {
    try {
        await fs.mkdir(backupRoot, { recursive: true });

        const folders = await fs.readdir(backupRoot, {
            withFileTypes: true
        });

        const backups = [];

        for (const folder of folders) {
        if (!folder.isDirectory()) continue;

        // Include only timestamped backup folders
        if (!/^\d{4}-\d{2}-\d{2}T/.test(folder.name)) {
            continue;
        }

            const folderPath = path.join(backupRoot, folder.name);

            const stats = await fs.stat(folderPath);

            backups.push({
                folderName: folder.name,
                backupPath: folderPath,
                createdAt: stats.birthtime
            });
        }

        backups.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        return res.status(200).json({
            success: true,
            message: "Backup history fetched successfully",
            data: {
                totalBackups: backups.length,
                backups
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
