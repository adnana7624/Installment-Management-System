
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const restoreBackupToTestDatabase = async (extractionPath) => {
    try {
        const databaseName = new URL(process.env.MONGO_URI)
            .pathname
            .replace(/^\/+/, "")
            .split("/")[0];

        const databaseBackupPath = path.join(
            extractionPath,
            databaseName
        );

        // Verify extracted database folder
        const files = await fs.readdir(databaseBackupPath);

        const bsonFiles = files.filter(file =>
            file.endsWith(".bson")
        );

        if (bsonFiles.length === 0) {
            throw new Error(
                "No BSON files found in the extracted backup."
            );
        }

        // Restore into a separate test database
        const testDatabaseName = "IMS_Cloud_Restore_Test";

        const restoreUri = new URL(process.env.MONGO_URI);
        restoreUri.pathname = "/";

        const mongorestorePath =
            "C:\\MongoDB\\DatabaseTools\\mongorestore.exe";

        const restoreResult = await execFileAsync(
            mongorestorePath,
            [
                `--uri=${restoreUri.toString()}`,
                `--nsFrom=${databaseName}.*`,
                `--nsTo=${testDatabaseName}.*`,
                "--drop",

                // IMPORTANT: Pass the parent extraction folder
                extractionPath
            ],
            {
                windowsHide: true,
                maxBuffer: 10 * 1024 * 1024
            }
        );

        console.log(
            "MONGORESTORE OUTPUT:",
            restoreResult.stdout
        );

        console.log(
            "MONGORESTORE ERRORS:",
            restoreResult.stderr
        );

        // Verify that documents were actually restored
        const restoreLogs =
            `${restoreResult.stdout}\n${restoreResult.stderr}`;

        const restoredMatch = restoreLogs.match(
            /(\d+)\s+document\(s\)\s+restored successfully/i
        );

        if (!restoredMatch || Number(restoredMatch[1]) === 0) {
            throw new Error(
                "MongoDB did not restore any documents. " +
                restoreLogs
            );
        }

        return {
            success: true,
            sourceDatabase: databaseName,
            restoredDatabase: testDatabaseName,
            restoredCollections: bsonFiles.length,
            restoredDocuments: Number(restoredMatch[1]),
            restoreOutput: restoreResult.stdout,
            restoreErrors: restoreResult.stderr
        };

    } catch (error) {
        throw new Error(
            `Test database restoration failed: ${error.message}`
        );
    }
};

export default restoreBackupToTestDatabase;
