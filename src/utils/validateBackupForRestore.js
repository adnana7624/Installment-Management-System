
import fs from "node:fs/promises";
import path from "node:path";

const validateBackupForRestore = async (extractionPath) => {
    try {
        // 1. Validate input.
        if (!extractionPath) {
            throw new Error(
                "Backup extraction path is required."
            );
        }

        if (!process.env.MONGO_URI) {
            throw new Error(
                "MongoDB connection URI is missing."
            );
        }

        // 2. Identify the database name.
        const databaseName = new URL(
            process.env.MONGO_URI
        ).pathname.replace(/^\/+/, "").split("/")[0];

        if (!databaseName) {
            throw new Error(
                "Database name could not be identified."
            );
        }

        // 3. Check extraction directory.
        const extractionStats = await fs.stat(
            extractionPath
        );

        if (!extractionStats.isDirectory()) {
            throw new Error(
                "Backup extraction path is not a directory."
            );
        }

        // 4. Locate database backup folder.
        const databaseBackupPath = path.join(
            extractionPath,
            databaseName
        );

        const databaseStats = await fs.stat(
            databaseBackupPath
        );

        if (!databaseStats.isDirectory()) {
            throw new Error(
                "Database backup folder is missing."
            );
        }

        // 5. Define required collections.
        const requiredCollections = [
            "admins",
            "businessinfos",
            "counters",
            "customers",
            "expenses",
            "installments",
            "payments"
        ];

        // 6. Read backup files.
        const files = await fs.readdir(
            databaseBackupPath
        );

        const bsonFiles = files.filter(file =>
            file.endsWith(".bson")
        );

        const availableCollections = bsonFiles.map(file =>
            file.replace(/\.bson$/, "")
        );

        // 7. Check missing collections.
        const missingCollections =
            requiredCollections.filter(
                collection =>
                    !availableCollections.includes(collection)
            );

        if (missingCollections.length > 0) {
            throw new Error(
                `Backup is missing required collections: ${missingCollections.join(", ")}`
            );
        }

        // 8. Verify every required BSON file.
        const verifiedFiles = {};

        for (const collectionName of requiredCollections) {
            const bsonPath = path.join(
                databaseBackupPath,
                `${collectionName}.bson`
            );

            const bsonStats = await fs.stat(bsonPath);

            if (!bsonStats.isFile()) {
                throw new Error(
                    `Invalid BSON backup file: ${collectionName}.bson`
                );
            }

            verifiedFiles[collectionName] = {
                fileName: `${collectionName}.bson`,
                size: bsonStats.size
            };
        }

        // 9. Return validation results.
        return {
            success: true,
            databaseName,
            databaseBackupPath,
            collections: requiredCollections,
            collectionCount: requiredCollections.length,
            verifiedFiles
        };

    } catch (error) {
        throw new Error(
            `Backup validation failed: ${error.message}`
        );
    }
};

export default validateBackupForRestore;
