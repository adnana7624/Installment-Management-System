
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const encryptBackup = (inputBuffer) => {
    // Validate input.
    if (
        !Buffer.isBuffer(inputBuffer) ||
        inputBuffer.length === 0
    ) {
        throw new Error(
            "Backup input must be a non-empty Buffer."
        );
    }

    // Validate encryption key.
    const keyHex = process.env.BACKUP_ENCRYPTION_KEY;

    if (
        !keyHex ||
        !/^[a-fA-F0-9]{64}$/.test(keyHex)
    ) {
        throw new Error(
            "BACKUP_ENCRYPTION_KEY must be a valid 32-byte hexadecimal key."
        );
    }

    const key = Buffer.from(keyHex, "hex");

    // Generate a unique random IV for every encryption.
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

    // Generate authentication tag.
    const authTag = cipher.getAuthTag();

    // File format:
    // 12-byte IV + 16-byte Auth Tag + Encrypted Data.
    return Buffer.concat([
        iv,
        authTag,
        encrypted
    ]);
};

export default encryptBackup;
