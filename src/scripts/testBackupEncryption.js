import assert from "node:assert/strict";

import encryptBackup from "../utils/encryptBackup.js";
import decryptBackup from "../utils/decryptBackup.js";

const originalKey = process.env.BACKUP_ENCRYPTION_KEY;

const testKey = "0123456789abcdef".repeat(4);
const wrongKey = "fedcba9876543210".repeat(4);

const runTest = () => {
    try {
        // Use a temporary test key.
        // This does NOT change your .env file.
        process.env.BACKUP_ENCRYPTION_KEY = testKey;

        // Original test data.
        const originalData = Buffer.from(
            "Installment Management System encryption test",
            "utf8"
        );

        // Test 1: Encrypt and decrypt.
        const encryptedData = encryptBackup(originalData);
        const decryptedData = decryptBackup(encryptedData);

        assert.ok(
            originalData.equals(decryptedData),
            "Encryption and decryption round-trip failed."
        );

        console.log("PASS: Encryption and decryption.");

        // Test 2: Reject modified encrypted data.
        const tamperedData = Buffer.from(encryptedData);

        tamperedData[tamperedData.length - 1] ^= 1;

        assert.throws(() => {
            decryptBackup(tamperedData);
        });

        console.log("PASS: Modified backup rejected.");

        // Test 3: Reject an incorrect encryption key.
        process.env.BACKUP_ENCRYPTION_KEY = wrongKey;

        assert.throws(() => {
            decryptBackup(encryptedData);
        });

        console.log("PASS: Incorrect encryption key rejected.");

        console.log("\nAll backup encryption tests passed.");
    } catch (error) {
        console.error("\nBACKUP ENCRYPTION TEST FAILED:");
        console.error(error.message);

        process.exitCode = 1;
    } finally {
        // Restore the original environment value.
        if (originalKey === undefined) {
            delete process.env.BACKUP_ENCRYPTION_KEY;
        } else {
            process.env.BACKUP_ENCRYPTION_KEY = originalKey;
        }
    }
};

runTest();