
import fs from "node:fs/promises";
import path from "node:path";
import backupDatabase from "../utils/backupDatabase.js";

import {
    generateGoogleAuthUrl,
    saveGoogleTokens,
    getGoogleDriveClient
    } from "../config/googleDrive.js";

const backupRoot = process.env.BACKUP_PATH || "D:\\IMS_Backups";

import { Readable } from "node:stream";
import encryptBackup from "../utils/encryptBackup.js";
import decryptBackup from "../utils/decryptBackup.js";


// Create manual backup
export const createBackup = async (req, res) => {
    try {
        const result = await backupDatabase();

        return res.status(200).json({
            success: true,
            message: "Database backup created successfully",
            data: result
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get backup history
export const getBackupHistory = async (req, res) => {
    try {
        await fs.mkdir(backupRoot, { recursive: true });

        const folders = await fs.readdir(backupRoot, {
            withFileTypes: true
        });

        const backups = [];

        for (const folder of folders) {
        if (!folder.isDirectory()) continue;

        // Include only timestamped backup folders
        if (!/^\d{4}-\d{2}-\d{2}T/.test(folder.name)) {
            continue;
        }

            const folderPath = path.join(backupRoot, folder.name);

            const stats = await fs.stat(folderPath);

            backups.push({
                folderName: folder.name,
                backupPath: folderPath,
                createdAt: stats.birthtime
            });
        }

        backups.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        return res.status(200).json({
            success: true,
            message: "Backup history fetched successfully",
            data: {
                totalBackups: backups.length,
                backups
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Start Google Drive authorization
export const connectGoogleDrive = async (req, res) => {
    try {
        const authUrl = generateGoogleAuthUrl();

        return res.status(200).json({
            success: true,
            message: "Google authorization URL generated successfully",
            data: {
                authUrl
            }
        });

    } catch (error) {
        console.error("Google connection error:", error.message);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Google OAuth callback
export const googleDriveCallback = async (req, res) => {
    try {
        const { code, state, error } = req.query;

        if (error) {
            return res.status(400).send(
                "Google Drive authorization was cancelled or denied."
            );
        }

        if (!code || !state) {
            return res.status(400).send(
                "Google authorization code or state is missing."
            );
        }

        await saveGoogleTokens(code, state);

        return res.redirect(
            "http://localhost:5173/settings?googleDrive=connected"
        );

    } catch (error) {
        console.error("Google callback error:", error.message);

        return res.status(400).send(
            `Google Drive connection failed: ${error.message}`
        );
    }
};

// Verify Google Drive connection
export const testGoogleDriveConnection = async (req, res) => {
    try {
        const drive = await getGoogleDriveClient();

        const response = await drive.about.get({
            fields: "user(displayName,emailAddress)"
        });

        return res.status(200).json({
            success: true,
            message: "Google Drive connected successfully",
            data: {
                displayName: response.data.user.displayName,
                email: response.data.user.emailAddress
            }
        });

    } catch (error) {
        console.error("Google Drive test error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Google Drive connection failed",
            error: error.message
        });
    }
};


// Upload encrypted test file to Google Drive
export const uploadEncryptedTestBackup = async (req, res) => {
    try {
        const drive = await getGoogleDriveClient();

        // Step 1: Find existing backup folder
        const folderResponse = await drive.files.list({
            q: "name = 'IMS_Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields: "files(id, name)",
            spaces: "drive"
        });

        let folderId;

        if (folderResponse.data.files.length > 0) {
            folderId = folderResponse.data.files[0].id;
        } else {
            // Step 2: Create backup folder
            const newFolder = await drive.files.create({
                requestBody: {
                    name: "IMS_Backups",
                    mimeType: "application/vnd.google-apps.folder"
                },
                fields: "id, name"
            });

            folderId = newFolder.data.id;
        }

        // Step 3: Create test content (not actual customer data)
        const testContent = Buffer.from(
            "IMS Google Drive encrypted backup test. No customer data."
        );

        // Step 4: Encrypt test content
        const encryptedContent = encryptBackup(testContent);

        // Step 5: Upload encrypted file
        const fileName = `IMS_Test_Backup_${Date.now()}.enc`;

        const uploadResponse = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId]
            },
            media: {
                mimeType: "application/octet-stream",
                body: Readable.from(encryptedContent)
            },
            fields: "id, name, mimeType, size, webViewLink"
        });

        return res.status(200).json({
            success: true,
            message: "Encrypted test backup uploaded successfully",
            data: {
                folderId,
                fileId: uploadResponse.data.id,
                fileName: uploadResponse.data.name,
                fileSize: uploadResponse.data.size,
                webViewLink: uploadResponse.data.webViewLink
            }
        });

    } catch (error) {
        console.error("Encrypted upload error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Encrypted test backup upload failed",
            error: error.message
        });
    }
};

// Download and verify encrypted test backup
export const downloadAndVerifyTestBackup = async (req, res) => {
    try {
        const { fileId } = req.params;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                message: "Google Drive file ID is required."
            });
        }

        const drive = await getGoogleDriveClient();

        // Get file information first
        const fileInfo = await drive.files.get({
            fileId,
            fields: "id, name, mimeType, size, trashed"
        });

        // Only allow our test backup files in this endpoint
        if (
            fileInfo.data.trashed ||
            !fileInfo.data.name.startsWith("IMS_Test_Backup_") ||
            !fileInfo.data.name.endsWith(".enc")
        ) {
            return res.status(400).json({
                success: false,
                message: "This endpoint only supports IMS encrypted test files."
            });
        }

        // Download encrypted file
        const response = await drive.files.get(
            {
                fileId,
                alt: "media"
            },
            {
                responseType: "stream"
            }
        );

        const chunks = [];

        for await (const chunk of response.data) {
            chunks.push(Buffer.from(chunk));
        }

        const encryptedBuffer = Buffer.concat(chunks);

        // Decrypt downloaded file
        const decryptedBuffer = decryptBackup(encryptedBuffer);

        const recoveredContent = decryptedBuffer.toString("utf8");

        const expectedContent =
            "IMS Google Drive encrypted backup test. No customer data.";

        if (recoveredContent !== expectedContent) {
            throw new Error("Backup verification failed. Recovered content does not match.");
        }

        return res.status(200).json({
            success: true,
            message: "Encrypted backup downloaded and decrypted successfully.",
            data: {
                fileName: fileInfo.data.name,
                encryptedSize: encryptedBuffer.length,
                decryptionVerified: true,
                contentVerified: true,
                recoveredContent
            }
        });

    } catch (error) {
        console.error("Google backup verification error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Backup download or decryption failed.",
            error: error.message
        });
    }
};