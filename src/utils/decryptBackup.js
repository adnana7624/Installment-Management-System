
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const decryptBackup = (encryptedBuffer) => {
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

    // Validate encrypted backup input.
    if (!Buffer.isBuffer(encryptedBuffer)) {
        throw new Error(
            "Encrypted backup must be a Buffer."
        );
    }

    // Require at least one byte of encrypted content.
    const minimumLength = IV_LENGTH + AUTH_TAG_LENGTH + 1;

    if (encryptedBuffer.length < minimumLength) {
        throw new Error(
            "Invalid or incomplete encrypted backup file."
        );
    }

    const key = Buffer.from(keyHex, "hex");

    // Extract IV.
    const iv = encryptedBuffer.subarray(
        0,
        IV_LENGTH
    );

    // Extract authentication tag.
    const authTag = encryptedBuffer.subarray(
        IV_LENGTH,
        IV_LENGTH + AUTH_TAG_LENGTH
    );

    // Extract encrypted ZIP data.
    const encryptedData = encryptedBuffer.subarray(
        IV_LENGTH + AUTH_TAG_LENGTH
    );

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        iv
    );

    decipher.setAuthTag(authTag);

    // Authentication failure causes decipher.final() to throw.
    return Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
    ]);
};

export default decryptBackup;
