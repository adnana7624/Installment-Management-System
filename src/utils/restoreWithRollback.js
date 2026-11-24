
import path from "node:path";

import restoreBackupToLiveDatabase from "./restoreBackupToLiveDatabase.js";
import verifyRestoredLiveDatabase from "./verifyRestoredLiveDatabase.js";

const EXPECTED_DATABASE_NAME =
    "Installment_Management_System";

const EXPECTED_COLLECTION_COUNT = 7;

const verifyDatabase = async () => {
    const verification =
        await verifyRestoredLiveDatabase();

    if (
        !verification ||
        verification.success !== true ||
        verification.databaseName !== EXPECTED_DATABASE_NAME ||
        verification.collectionCount !== EXPECTED_COLLECTION_COUNT
    ) {
        throw new Error(
            "Database restoration verification failed. Expected database and all seven collections were not confirmed."
        );
    }

    return verification;
};

const restoreWithRollback = async ({
    selectedBackupPath,
    safetyBackupPath
}) => {
    if (!selectedBackupPath || !safetyBackupPath) {
        throw new Error(
            "Selected backup path and safety backup path are required."
        );
    }

    // Confirm the configured live database.
    const liveDatabaseName = new URL(
        process.env.MONGO_URI
    ).pathname.replace(/^\/+/, "").split("/")[0];

    if (liveDatabaseName !== EXPECTED_DATABASE_NAME) {
        throw new Error(
            "Unexpected live database configuration. Restoration cancelled."
        );
    }

    // Resolve and compare paths safely on Windows.
    const selectedPath = path.resolve(selectedBackupPath);
    const safetyPath = path.resolve(safetyBackupPath);

    if (
        selectedPath.toLowerCase() ===
        safetyPath.toLowerCase()
    ) {
        throw new Error(
            "Selected backup and safety backup must be different folders."
        );
    }

    try {
        console.log(
            "Starting selected cloud backup restoration..."
        );

        await restoreBackupToLiveDatabase(selectedPath);

        console.log(
            "Verifying selected backup restoration..."
        );

        const verification = await verifyDatabase();

        return {
            success: true,
            rollbackPerformed: false,
            rollbackSuccessful: null,
            message:
                "Selected backup restored and verified successfully.",
            verification
        };

    } catch (restoreError) {
        console.error(
            "Selected backup restore failed:",
            restoreError.message
        );

        try {
            console.log(
                "Starting database rollback using safety backup..."
            );

            await restoreBackupToLiveDatabase(safetyPath);

            console.log(
                "Verifying database rollback..."
            );

            const rollbackVerification =
                await verifyDatabase();

            return {
                success: false,
                rollbackPerformed: true,
                rollbackSuccessful: true,
                message:
                    "Selected backup restoration failed. The previous database was restored and verified successfully.",
                restoreError: restoreError.message,
                rollbackVerification
            };

        } catch (rollbackError) {
            console.error(
                "CRITICAL: Database rollback failed:",
                rollbackError.message
            );

            throw new Error(
                "CRITICAL: Both the selected backup restore and rollback failed. " +
                "Keep the application in maintenance mode. " +
                `Restore error: ${restoreError.message}. ` +
                `Rollback error: ${rollbackError.message}`
            );
        }
    }
};

export default restoreWithRollback;
