
import fs from "node:fs/promises";
import path from "node:path";

import cleanupOldBackups from "../utils/cleanupOldBackups.js";

const testRoot = "D:\\IMS_Retention_Test";

const requiredFiles = [
    "admins.bson",
    "businessinfos.bson",
    "counters.bson",
    "customers.bson",
    "expenses.bson",
    "installments.bson",
    "payments.bson"
];

const runTest = async () => {
    try {
        // Never overwrite an existing test directory.
        try {
            await fs.access(testRoot);

            throw new Error(
                `Test directory already exists: ${testRoot}. Rename or inspect it before running this test.`
            );
        } catch (error) {
            if (error.code !== "ENOENT") {
                throw error;
            }
        }

        await fs.mkdir(testRoot, { recursive: true });

        console.log("Creating 12 simulated valid backups...");

        const backupNames = [];

        for (let i = 0; i < 12; i++) {
            const date = new Date(
                Date.now() - (12 - i) * 24 * 60 * 60 * 1000
            );

            const timestamp = date
                .toISOString()
                .replace(/[:.]/g, "-");

            backupNames.push(timestamp);

            const databasePath = path.join(
                testRoot,
                timestamp,
                "Installment_Management_System"
            );

            await fs.mkdir(databasePath, {
                recursive: true
            });

            for (const file of requiredFiles) {
                await fs.writeFile(
                    path.join(databasePath, file),
                    "SIMULATED TEST DATA"
                );
            }
        }

        // Protect the oldest backup.
        const protectedBackupPath = path.join(
            testRoot,
            backupNames[0]
        );

        console.log("Creating one incomplete backup...");

        const incompleteName = "2000-01-01T00-00-00-000Z";

        await fs.mkdir(
            path.join(
                testRoot,
                incompleteName,
                "Installment_Management_System"
            ),
            { recursive: true }
        );

        await fs.writeFile(
            path.join(
                testRoot,
                incompleteName,
                "Installment_Management_System",
                "admins.bson"
            ),
            "INCOMPLETE TEST DATA"
        );

        console.log("Running backup retention...");

        const result = await cleanupOldBackups(
            testRoot,
            10,
            [protectedBackupPath]
        );

        // Verify the protected backup still exists.
        await fs.access(protectedBackupPath);

        // Verify the incomplete backup still exists.
        await fs.access(
            path.join(testRoot, incompleteName)
        );

        // Verify exactly two valid backups were deleted.
        if (result.deletedBackups.length !== 2) {
            throw new Error(
                `Expected 2 deletions, got ${result.deletedBackups.length}.`
            );
        }

        if (result.retainedBackups !== 10) {
            throw new Error(
                `Expected 10 retained backups, got ${result.retainedBackups}.`
            );
        }

        // Verify the newest 9 backups remain.
        for (const name of backupNames.slice(3)) {
            await fs.access(path.join(testRoot, name));
        }

        // Verify the second and third oldest backups were deleted.
        for (const name of backupNames.slice(1, 3)) {
            try {
                await fs.access(path.join(testRoot, name));

                throw new Error(
                    `Old backup was not deleted: ${name}`
                );
            } catch (error) {
                if (error.code !== "ENOENT") {
                    throw error;
                }
            }
        }

        console.log("\nBACKUP RETENTION TEST PASSED");
        console.log("Deleted backups:", result.deletedBackups);
        console.log("Retained valid backups:", result.retainedBackups);
        console.log("Protected backup: preserved");
        console.log("Incomplete backup: preserved");

        // Remove only this test directory after success.
        await fs.rm(testRoot, {
            recursive: true,
            force: false
        });

        console.log("Temporary test directory removed.");

    } catch (error) {
        console.error("\nBACKUP RETENTION TEST FAILED:");
        console.error(error.message);
        console.error(
            "Test files have been preserved for inspection:",
            testRoot
        );

        process.exitCode = 1;
    }
};

runTest();
