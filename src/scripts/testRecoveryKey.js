import crypto from "node:crypto";

import {
    generateRecoveryCode,
    wrapMasterKey,
    unwrapMasterKey
} from "../utils/recoveryKey.js";

const runTest = async () => {
    try {
        console.log("Starting recovery key tests...\n");

        // Generate a temporary master key for testing.
        const originalMasterKey = crypto.randomBytes(32);

        // Generate a temporary recovery code.
        const recoveryCode = generateRecoveryCode();

        console.log("Recovery code generated.");

        // Encrypt (wrap) the master key.
        const recoveryPackage = await wrapMasterKey(
            originalMasterKey,
            recoveryCode
        );

        console.log("Master key wrapped successfully.");

        // Test correct recovery code.
        const recoveredMasterKey = await unwrapMasterKey(
            recoveryPackage,
            recoveryCode
        );

        if (!originalMasterKey.equals(recoveredMasterKey)) {
            throw new Error("Recovered master key does not match.");
        }

        console.log("PASS: Correct recovery code.");

        // Test incorrect recovery code.
        try {
            await unwrapMasterKey(
                recoveryPackage,
                "incorrect-recovery-code-123456"
            );

            throw new Error(
                "Incorrect recovery code was unexpectedly accepted."
            );
        } catch (error) {
            if (
                error.message ===
                "Incorrect recovery code was unexpectedly accepted."
            ) {
                throw error;
            }

            console.log("PASS: Incorrect recovery code rejected.");
        }

        // Test modified recovery package.
        const modifiedPackage = {
            ...recoveryPackage,
            encryptedMasterKey: crypto.randomBytes(32).toString("base64")
        };

        try {
            await unwrapMasterKey(
                modifiedPackage,
                recoveryCode
            );

            throw new Error(
                "Modified recovery package was unexpectedly accepted."
            );
        } catch (error) {
            if (
                error.message ===
                "Modified recovery package was unexpectedly accepted."
            ) {
                throw error;
            }

            console.log("PASS: Modified recovery package rejected.");
        }

        console.log("\nAll recovery key tests passed.");

    } catch (error) {
        console.error("\nRecovery key test failed:", error.message);
        process.exitCode = 1;
    }
};

runTest();