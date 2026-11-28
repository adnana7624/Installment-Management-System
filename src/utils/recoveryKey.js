
import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const SCRYPT_OPTIONS = {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024
};

// Generate a unique recovery code.
export const generateRecoveryCode = () => {
    return crypto.randomBytes(24).toString("base64url");
};

// Derive an encryption key from the recovery code.
const deriveRecoveryKey = async (recoveryCode, salt) => {
    if (
        typeof recoveryCode !== "string" ||
        recoveryCode.length < 20
    ) {
        throw new Error("Invalid recovery code.");
    }

    return scryptAsync(
        recoveryCode,
        salt,
        KEY_LENGTH,
        SCRYPT_OPTIONS
    );
};

// Encrypt the master key using the recovery code.
export const wrapMasterKey = async (
    masterKeyBuffer,
    recoveryCode
) => {
    if (
        !Buffer.isBuffer(masterKeyBuffer) ||
        masterKeyBuffer.length !== KEY_LENGTH
    ) {
        throw new Error("Invalid master encryption key.");
    }

    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    const recoveryKey = await deriveRecoveryKey(
        recoveryCode,
        salt
    );

    const cipher = crypto.createCipheriv(
        ALGORITHM,
        recoveryKey,
        iv
    );

    const encryptedMasterKey = Buffer.concat([
        cipher.update(masterKeyBuffer),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return {
        version: 1,
        algorithm: ALGORITHM,
        kdf: "scrypt",
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        encryptedMasterKey: encryptedMasterKey.toString("base64")
    };
};

// Recover the original master key.
export const unwrapMasterKey = async (
    recoveryPackage,
    recoveryCode
) => {
    try {
        if (
            !recoveryPackage ||
            recoveryPackage.version !== 1 ||
            recoveryPackage.algorithm !== ALGORITHM ||
            recoveryPackage.kdf !== "scrypt"
        ) {
            throw new Error("Invalid recovery package.");
        }

        const salt = Buffer.from(
            recoveryPackage.salt,
            "base64"
        );

        const iv = Buffer.from(
            recoveryPackage.iv,
            "base64"
        );

        const authTag = Buffer.from(
            recoveryPackage.authTag,
            "base64"
        );

        const encryptedMasterKey = Buffer.from(
            recoveryPackage.encryptedMasterKey,
            "base64"
        );

        if (
            salt.length !== SALT_LENGTH ||
            iv.length !== IV_LENGTH ||
            authTag.length !== AUTH_TAG_LENGTH ||
            encryptedMasterKey.length !== KEY_LENGTH
        ) {
            throw new Error("Invalid recovery package data.");
        }

        const recoveryKey = await deriveRecoveryKey(
            recoveryCode,
            salt
        );

        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            recoveryKey,
            iv
        );

        decipher.setAuthTag(authTag);

        const masterKey = Buffer.concat([
            decipher.update(encryptedMasterKey),
            decipher.final()
        ]);

        if (masterKey.length !== KEY_LENGTH) {
            throw new Error("Recovered master key is invalid.");
        }

        return masterKey;

    } catch {
        throw new Error(
            "Recovery failed. Check your recovery code."
        );
    }
};
