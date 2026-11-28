
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const getEncryptionKey = (masterKey = null) => {
    // Use an explicitly supplied master key during recovery.
    if (masterKey !== null) {
        if (
            !Buffer.isBuffer(masterKey) ||
            masterKey.length !== 32
        ) {
            throw new Error(
                "Master encryption key must be a 32-byte Buffer."
            );
        }

        return masterKey;
    }

    // Preserve compatibility with existing backups.
    const keyHex = process.env.BACKUP_ENCRYPTION_KEY;

    if (
        !keyHex ||
        !/^[a-fA-F0-9]{64}$/.test(keyHex)
    ) {
        throw new Error(
            "BACKUP_ENCRYPTION_KEY must be a valid 32-byte hexadecimal key."
        );
    }

    return Buffer.from(keyHex, "hex");
};

const encryptBackup = (inputBuffer, masterKey = null) => {
    if (
        !Buffer.isBuffer(inputBuffer) ||
        inputBuffer.length === 0
    ) {
        throw new Error(
            "Backup input must be a non-empty Buffer."
        );
    }

    const key = getEncryptionKey(masterKey);

    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(
        ALGORITHM,
        key,
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(inputBuffer),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Preserve the existing file format:
    // IV + Authentication Tag + Encrypted Data.
    return Buffer.concat([
        iv,
        authTag,
        encrypted
    ]);
};

export default encryptBackup;
