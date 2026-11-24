
import fs from "node:fs/promises";
import path from "node:path";

const cleanupOldBackups = async (
    backupRoot,
    keepCount = 10,
    protectedBackupPaths = []
) => {
    if (!Number.isInteger(keepCount) || keepCount < 1) {
        throw new Error("keepCount must be a positive integer.");
    }

    await fs.mkdir(backupRoot, { recursive: true });

    const requiredFiles = [
        "admins.bson",
        "businessinfos.bson",
        "counters.bson",
        "customers.bson",
        "expenses.bson",
        "installments.bson",
        "payments.bson"
    ];

    const protectedPaths = new Set(
        protectedBackupPaths.map(backupPath =>
            path.resolve(backupPath).toLowerCase()
        )
    );

    const folders = await fs.readdir(backupRoot, {
        withFileTypes: true
    });

    const validBackups = [];

    for (const folder of folders) {
        if (
            !folder.isDirectory() ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(
                folder.name
            )
        ) {
            continue;
        }

        const backupPath = path.resolve(
            backupRoot,
            folder.name
        );

        const databasePath = path.join(
            backupPath,
            "Installment_Management_System"
        );

        try {
            const databaseStats = await fs.stat(databasePath);

            if (!databaseStats.isDirectory()) continue;

            let isValid = true;

            for (const fileName of requiredFiles) {
                const filePath = path.join(
                    databasePath,
                    fileName
                );

                const fileStats = await fs.stat(filePath);

                if (
                    !fileStats.isFile() ||
                    fileStats.size === 0
                ) {
                    isValid = false;
                    break;
                }
            }

            if (isValid) {
                validBackups.push({
                    name: folder.name,
                    path: backupPath
                });
            }
        } catch {
            // Incomplete or invalid backup: never count it
            // as a valid backup for retention.
            continue;
        }
    }

    validBackups.sort((a, b) =>
        b.name.localeCompare(a.name)
    );

    const deletableBackups = validBackups.filter(
        backup =>
            !protectedPaths.has(backup.path.toLowerCase())
    );

    const protectedCount = validBackups.filter(
        backup =>
            protectedPaths.has(backup.path.toLowerCase())
    ).length;

    const remainingSlots = Math.max(
        0,
        keepCount - protectedCount
    );

    const oldBackups = deletableBackups.slice(
        remainingSlots
    );

    const deletedBackups = [];

    for (const backup of oldBackups) {
        await fs.rm(backup.path, {
            recursive: true,
            force: false
        });

        deletedBackups.push(backup.name);
    }

    console.log(
        `Backup retention completed. Deleted ${deletedBackups.length} old backups.`
    );

    return {
        deletedBackups,
        retainedBackups: validBackups.length - deletedBackups.length
    };
};

export default cleanupOldBackups;
