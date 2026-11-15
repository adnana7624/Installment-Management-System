import fs from "node:fs/promises";
import path from "node:path";

const cleanupOldBackups = async (backupRoot, keepCount = 30) => {
    await fs.mkdir(backupRoot, { recursive: true });

    const folders = await fs.readdir(backupRoot, {
        withFileTypes: true
    });

    // Match only folders created by our timestamp-based backup system
    const backupFolders = folders
        .filter((folder) => {
            return (
                folder.isDirectory() &&
                /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(folder.name)
            );
        })
        .sort((a, b) => b.name.localeCompare(a.name));

    // Keep the newest 30 backups
    const oldBackups = backupFolders.slice(keepCount);
    const deletedBackups = [];

    for (const backup of oldBackups) {
        const backupPath = path.join(backupRoot, backup.name);

        await fs.rm(backupPath, {
            recursive: true,
            force: true
        });

        deletedBackups.push(backup.name);
    }

    console.log(
        `Backup retention completed. Kept ${Math.min(backupFolders.length, keepCount)} backups. Deleted ${deletedBackups.length} old backups.`
    );

    return {
        deletedBackups
    };
};

export default cleanupOldBackups;