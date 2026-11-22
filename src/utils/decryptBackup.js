
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

const decryptBackup = (encryptedBuffer) => {
    const keyHex = process.env.BACKUP_ENCRYPTION_KEY;

    if (!keyHex || !/^[a-fA-F0-9]{64}$/.test(keyHex)) {
        throw new Error("Invalid backup encryption key.");
    }

    // Minimum format: 12-byte IV + 16-byte authentication tag
    if (!Buffer.isBuffer(encryptedBuffer) || encryptedBuffer.length < 28) {
        throw new Error("Invalid or incomplete encrypted backup file.");
    }

    const key = Buffer.from(keyHex, "hex");

    // Extract IV, authentication tag and encrypted content
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encryptedData = encryptedBuffer.subarray(28);

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        iv
    );

    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
    ]);
};

export default decryptBackup;
