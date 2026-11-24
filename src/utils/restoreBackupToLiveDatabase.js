
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

const execFileAsync = promisify(execFile);

const restoreBackupToLiveDatabase = async (extractionPath) => {
    const mongoUri = process.env.MONGO_URI;

    const mongorestorePath =
        "C:\\MongoDB\\DatabaseTools\\mongorestore.exe";

    const expectedDatabaseName =
        "Installment_Management_System";

    const requiredFiles = [
        "admins.bson",
        "businessinfos.bson",
        "counters.bson",
        "customers.bson",
        "expenses.bson",
        "installments.bson",
        "payments.bson"
    ];

    if (!mongoUri || !extractionPath) {
        throw new Error(
            "MongoDB URI or backup path is missing."
        );
    }

    // 1. Validate MongoDB URI.
    const restoreUri = new URL(mongoUri);

    if (
        restoreUri.protocol !== "mongodb:" &&
        restoreUri.protocol !== "mongodb+srv:"
    ) {
        throw new Error(
            "Invalid MongoDB connection URI."
        );
    }

    // 2. Validate target database.
    const databaseName = restoreUri.pathname
        .replace(/^\/+/, "")
        .split("/")[0];

    if (databaseName !== expectedDatabaseName) {
        throw new Error(
            "Live restore rejected: unexpected target database."
        );
    }

    // 3. Verify mongorestore executable.
    await fs.access(mongorestorePath);

    // 4. Resolve and verify backup directory.
    const absoluteExtractionPath = path.resolve(
        extractionPath
    );

    const databaseBackupPath = path.join(
        absoluteExtractionPath,
        databaseName
    );

    const backupStats = await fs.stat(
        databaseBackupPath
    );

    if (!backupStats.isDirectory()) {
        throw new Error(
            "The expected database backup directory is missing."
        );
    }

    // 5. Verify all required BSON files before --drop.
    for (const fileName of requiredFiles) {
        const filePath = path.join(
            databaseBackupPath,
            fileName
        );

        const fileStats = await fs.stat(filePath);

        if (
            !fileStats.isFile() ||
            fileStats.size === 0
        ) {
            throw new Error(
                `Invalid or empty backup file: ${fileName}`
            );
        }
    }

    let reconnectRequired = false;
    let restoreResult = null;
    let restoreError = null;
    let reconnectError = null;

    try {
        // 6. Mark reconnection as required before disconnecting.
        reconnectRequired = true;

        console.log(
            "Disconnecting MongoDB before live restoration..."
        );

        await mongoose.disconnect();

        console.log(
            "MongoDB disconnected successfully."
        );

        // 7. Restore the validated backup.
        console.log(
            `Starting MongoDB restoration for ${databaseName}...`
        );

        restoreResult = await execFileAsync(
            mongorestorePath,
            [
                `--uri=${restoreUri.toString()}`,
                `--nsInclude=${databaseName}.*`,
                "--drop",
                "--stopOnError",
                absoluteExtractionPath
            ],
            {
                windowsHide: true,
                maxBuffer: 20 * 1024 * 1024
            }
        );

        console.log(
            "MongoDB restoration command completed."
        );

        console.log(
            restoreResult.stdout || ""
        );

        console.log(
            restoreResult.stderr || ""
        );

    } catch (error) {
        restoreError = error;

        console.error(
            "MongoDB restoration operation failed:",
            error.message
        );

    } finally {
        // 8. Always attempt reconnection if it was required.
        if (reconnectRequired) {
            try {
                console.log(
                    "Reconnecting MongoDB after restoration..."
                );

                await mongoose.connect(mongoUri);

                console.log(
                    "MongoDB reconnected successfully."
                );

            } catch (error) {
                reconnectError = error;

                console.error(
                    "MongoDB reconnection failed:",
                    error.message
                );
            }
        }
    }

    // 9. Handle reconnection failure.
    if (reconnectError) {
        throw new Error(
            "MongoDB reconnection failed after restoration. " +
            `${reconnectError.message}. ` +
            `Restore error: ${restoreError?.message || "None"}`
        );
    }

    // 10. Handle restoration failure.
    if (restoreError) {
        throw new Error(
            `Live database restore failed: ${restoreError.message}`
        );
    }

    if (!restoreResult) {
        throw new Error(
            "MongoDB restoration did not return a successful result."
        );
    }

    return {
        success: true,
        databaseName,
        restoreOutput: restoreResult.stdout || "",
        restoreErrors: restoreResult.stderr || ""
    };
};

export default restoreBackupToLiveDatabase;
