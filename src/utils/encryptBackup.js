
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

const encryptBackup = (inputBuffer) => {
    const keyHex = process.env.BACKUP_ENCRYPTION_KEY;

    if (!keyHex || !/^[a-fA-F0-9]{64}$/.test(keyHex)) {
        throw new Error(
            "BACKUP_ENCRYPTION_KEY must be a valid 32-byte hexadecimal key."
        );
    }

    const key = Buffer.from(keyHex, "hex");

    // Generate a unique initialization vector for every encryption
    const iv = crypto.randomBytes(12);

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

    // File format: IV + Authentication Tag + Encrypted Data
    return Buffer.concat([
        iv,
        authTag,
        encrypted
    ]);
};

export default encryptBackup;
