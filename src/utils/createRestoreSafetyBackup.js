
import backupDatabase from "./backupDatabase.js";

const createRestoreSafetyBackup = async () => {
    try {
        // The live-restore controller will already hold
        // the shared backup-operation lock.
        const result = await backupDatabase({
            lockAlreadyAcquired: true
        });

        const localBackup = result?.localBackup;

        if (
            !localBackup ||
            localBackup.success !== true ||
            !localBackup.backupPath
        ) {
            throw new Error(
                "A complete local safety backup could not be created."
            );
        }

        return {
            success: true,
            backupPath: localBackup.backupPath,
            cloudBackupStatus:
                result.cloudBackup?.status || "not uploaded"
        };

    } catch (error) {
        throw new Error(
            `Pre-restore safety backup failed: ${error.message}`
        );
    }
};

export default createRestoreSafetyBackup;
