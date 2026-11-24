
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";

import backupDatabase from "../utils/backupDatabase.js";

import {
    generateGoogleAuthUrl,
    saveGoogleTokens,
    getGoogleDriveClient
} from "../config/googleDrive.js";

import downloadBackupFromGoogleDrive
    from "../utils/downloadBackupFromGoogleDrive.js";

import extractBackupArchive
    from "../utils/extractBackupArchive.js";

import restoreBackupToTestDatabase
    from "../utils/restoreBackupToTestDatabase.js";

import validateBackupForRestore
    from "../utils/validateBackupForRestore.js";

import createRestoreSafetyBackup
    from "../utils/createRestoreSafetyBackup.js";

import restoreWithRollback
    from "../utils/restoreWithRollback.js";

import {
    acquireBackupOperationLock
} from "../utils/backupOperationLock.js";

import {
    enableMaintenanceMode,
    disableMaintenanceMode,
    waitForActiveRequests
} from "../middleware/maintenanceMode.js";


import encryptBackup from "../utils/encryptBackup.js";
import decryptBackup from "../utils/decryptBackup.js";


const backupRoot =
    process.env.BACKUP_PATH || "D:\\IMS_Backups";


// ============================================
// Create Manual Backup
// ============================================

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


// ============================================
// Get Local Backup History
// ============================================

export const getBackupHistory = async (req, res) => {
    try {
        await fs.mkdir(backupRoot, {
            recursive: true
        });

        const folders = await fs.readdir(backupRoot, {
            withFileTypes: true
        });

        const backups = [];

        for (const folder of folders) {
            if (!folder.isDirectory()) continue;

            // Include only timestamped backup folders.
            if (!/^\d{4}-\d{2}-\d{2}T/.test(folder.name)) {
                continue;
            }

            const folderPath = path.join(
                backupRoot,
                folder.name
            );

            const stats = await fs.stat(folderPath);

            backups.push({
                folderName: folder.name,
                backupPath: folderPath,
                createdAt: stats.birthtime
            });
        }

        backups.sort(
            (a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
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


// ============================================
// Start Google Drive Authorization
// ============================================

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
        console.error(
            "Google connection error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ============================================
// Google OAuth Callback
// ============================================

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
        console.error(
            "Google callback error:",
            error.message
        );

        return res.status(400).send(
            `Google Drive connection failed: ${error.message}`
        );
    }
};


// ============================================
// Verify Google Drive Connection
// ============================================

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
        console.error(
            "Google Drive test error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Google Drive connection failed",
            error: error.message
        });
    }
};


// ============================================
// Upload Encrypted Test File to Google Drive
// ============================================

export const uploadEncryptedTestBackup = async (req, res) => {
    try {
        const drive = await getGoogleDriveClient();

        // Step 1: Find existing backup folder.
        const folderResponse = await drive.files.list({
            q: "name = 'IMS_Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields: "files(id, name)",
            spaces: "drive"
        });

        let folderId;

        if (folderResponse.data.files.length > 0) {
            folderId = folderResponse.data.files[0].id;

        } else {
            // Step 2: Create backup folder.
            const newFolder = await drive.files.create({
                requestBody: {
                    name: "IMS_Backups",
                    mimeType: "application/vnd.google-apps.folder"
                },
                fields: "id, name"
            });

            folderId = newFolder.data.id;
        }

        // Step 3: Create test content.
        const testContent = Buffer.from(
            "IMS Google Drive encrypted backup test. No customer data."
        );

        // Step 4: Encrypt test content.
        const encryptedContent = encryptBackup(testContent);

        // Step 5: Upload encrypted file.
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
        console.error(
            "Encrypted upload error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Encrypted test backup upload failed",
            error: error.message
        });
    }
};


// ============================================
// Download and Verify Encrypted Test Backup
// ============================================

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

        // Get file information first.
        const fileInfo = await drive.files.get({
            fileId,
            fields: "id, name, mimeType, size, trashed"
        });

        // Only allow our test backup files.
        if (
            fileInfo.data.trashed ||
            !fileInfo.data.name.startsWith("IMS_Test_Backup_") ||
            !fileInfo.data.name.endsWith(".enc")
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This endpoint only supports IMS encrypted test files."
            });
        }

        // Download encrypted file.
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

        // Decrypt downloaded file.
        const decryptedBuffer = decryptBackup(encryptedBuffer);

        const recoveredContent =
            decryptedBuffer.toString("utf8");

        const expectedContent =
            "IMS Google Drive encrypted backup test. No customer data.";

        if (recoveredContent !== expectedContent) {
            throw new Error(
                "Backup verification failed. Recovered content does not match."
            );
        }

        return res.status(200).json({
            success: true,
            message:
                "Encrypted backup downloaded and decrypted successfully.",
            data: {
                fileName: fileInfo.data.name,
                encryptedSize: encryptedBuffer.length,
                decryptionVerified: true,
                contentVerified: true,
                recoveredContent
            }
        });

    } catch (error) {
        console.error(
            "Google backup verification error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Backup download or decryption failed.",
            error: error.message
        });
    }
};


// ============================================
// Restore Cloud Backup into Test Database
// ============================================

export const restoreCloudBackupTest = async (req, res) => {
    let temporaryPath = null;

    try {
        const { fileId } = req.params;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                message: "Google Drive file ID is required."
            });
        }

        // 1. Create a temporary working directory.
        temporaryPath = await fs.mkdtemp(
            path.join(os.tmpdir(), "ims-cloud-restore-")
        );

        // 2. Download encrypted backup from Google Drive.
        const downloadResult =
            await downloadBackupFromGoogleDrive(fileId);

        // 3. Decrypt and extract backup.
        const extractionPath = path.join(
            temporaryPath,
            "extracted"
        );

        const extractionResult = await extractBackupArchive(
            downloadResult.encryptedBuffer,
            extractionPath
        );

        // 4. Restore into a separate test database.
        const restoreResult =
            await restoreBackupToTestDatabase(extractionPath);

        return res.status(200).json({
            success: true,
            message:
                "Cloud backup downloaded, decrypted, extracted and restored successfully.",
            data: {
                fileName: downloadResult.fileName,
                encryptedSize: downloadResult.encryptedSize,
                extraction: extractionResult,
                restoration: restoreResult
            }
        });

    } catch (error) {
        console.error(
            "Cloud backup restore test failed:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Cloud backup restoration test failed.",
            error: error.message
        });

    } finally {
        // 5. Remove temporary extracted files.
        if (temporaryPath) {
            try {
                await fs.rm(temporaryPath, {
                    recursive: true,
                    force: true
                });

                console.log(
                    "Temporary cloud restore files removed."
                );

            } catch (error) {
                console.error(
                    "Temporary folder cleanup failed:",
                    error.message
                );
            }
        }
    }
};


// ============================================
// Get Cloud Backup History from Google Drive
// ============================================


export const getCloudBackupHistory = async (req, res) => {
    try {
        const drive = await getGoogleDriveClient();

        const folderName =
            process.env.GOOGLE_DRIVE_FOLDER_NAME || "IMS_Backups";

        // Find the IMS backup folder.
        const folderResponse = await drive.files.list({
            q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: "files(id, name)",
            spaces: "drive"
        });

        const folder = folderResponse.data.files?.[0];

        if (!folder) {
            return res.status(200).json({
                success: true,
                message: "Google Drive backup folder not found.",
                data: {
                    totalBackups: 0,
                    backups: []
                }
            });
        }

        // Fetch every page of backup history.
        let allFiles = [];
        let nextPageToken = null;

        do {
            const backupResponse = await drive.files.list({
                q: `'${folder.id}' in parents and name contains 'IMS_Database_Backup_' and trashed = false`,
                pageSize: 100,
                orderBy: "createdTime desc",
                pageToken: nextPageToken || undefined,
                fields: "nextPageToken, files(id, name, size, createdTime, mimeType)",
                spaces: "drive"
            });

            allFiles.push(
                ...(backupResponse.data.files || [])
            );

            nextPageToken =
                backupResponse.data.nextPageToken || null;

        } while (nextPageToken);

        // Return complete backup history.
        const backups = allFiles.map((file) => ({
            fileId: file.id,
            fileName: file.name,
            fileSize: Number(file.size || 0),
            createdAt: file.createdTime,
            mimeType: file.mimeType
        }));

        return res.status(200).json({
            success: true,
            message: "Complete cloud backup history fetched successfully.",
            data: {
                totalBackups: backups.length,
                backups
            }
        });

    } catch (error) {
        console.error(
            "Cloud backup history error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch cloud backup history.",
            error: error.message
        });
    }
};



// ============================================
// Restore Cloud Backup into Live Database
// ============================================



export const restoreCloudBackupLive = async (req, res) => {
    let operationLock = null;
    let temporaryDirectory = null;

    let maintenanceEnabled = false;
    let restoreAttempted = false;
    let keepMaintenanceEnabled = false;

    try {
        const { fileId } = req.params;
        const confirmation = req.body?.confirmation;

        // 1. Validate Google Drive file ID.
        if (!fileId) {
            return res.status(400).json({
                success: false,
                message: "Cloud backup file ID is required."
            });
        }

        // 2. Require explicit confirmation.
        if (confirmation !== "RESTORE LIVE DATABASE") {
            return res.status(400).json({
                success: false,
                message:
                    'Explicit confirmation is required. Send confirmation: "RESTORE LIVE DATABASE".'
            });
        }

        // 3. Verify the configured live database.
        const liveDatabaseName = new URL(
            process.env.MONGO_URI
        ).pathname.replace(/^\/+/, "").split("/")[0];

        if (
            liveDatabaseName !==
            "Installment_Management_System"
        ) {
            throw new Error(
                "Unexpected live database configuration. Restore cancelled."
            );
        }

        // 4. Acquire the shared backup/restore lock.
        operationLock = acquireBackupOperationLock(
            "Live Database Restore"
        );

        if (!operationLock.acquired) {
            operationLock = null;

            return res.status(409).json({
                success: false,
                message:
                    "Cannot restore database. Another backup or restore operation is already running."
            });
        }

        // 5. Enable maintenance mode.
        enableMaintenanceMode();
        maintenanceEnabled = true;

        // 6. Wait for existing API requests to finish.
        await waitForActiveRequests();

        // 7. Create temporary working directory.
        temporaryDirectory = await fs.mkdtemp(
            path.join(os.tmpdir(), "ims-live-restore-")
        );

        // 8. Download selected encrypted cloud backup.
        const cloudBackup =
            await downloadBackupFromGoogleDrive(fileId);

        // 9. Decrypt and extract selected backup.
        const extractionPath = path.join(
            temporaryDirectory,
            "extracted"
        );

        await extractBackupArchive(
            cloudBackup.encryptedBuffer,
            extractionPath
        );

        // 10. Validate selected backup files.
        const validation =
            await validateBackupForRestore(extractionPath);

        // 11. Test selected backup in separate test database.
        console.log(
            "Testing selected backup in separate test database..."
        );

        const testRestoreResult =
            await restoreBackupToTestDatabase(extractionPath);

        if (!testRestoreResult?.success) {
            throw new Error(
                "Selected backup failed test database restoration."
            );
        }

        // 12. Verify test database restoration.
        const testVerification =
            await verifyRestoredTestDatabase();

        if (
            !testVerification?.success ||
            testVerification.databaseName !==
                "IMS_Cloud_Restore_Test" ||
            testVerification.collectionCount !== 7
        ) {
            throw new Error(
                "Selected backup failed test database verification."
            );
        }

        console.log(
            "Selected backup passed test restoration and verification."
        );

        console.log(
            `Verified documents: ${testVerification.totalDocuments}`
        );

        // 13. Create a fresh local safety backup.
        const safetyBackup =
            await createRestoreSafetyBackup();

        if (
            !safetyBackup.success ||
            !safetyBackup.backupPath
        ) {
            throw new Error(
                "The current database safety backup could not be verified. Live restore cancelled."
            );
        }

        // 14. Start live restoration with rollback protection.
        restoreAttempted = true;

        const restoration = await restoreWithRollback({
            selectedBackupPath: extractionPath,
            safetyBackupPath: safetyBackup.backupPath
        });

        // 15. Handle unsuccessful restoration.
        if (!restoration.success) {
            if (!restoration.rollbackSuccessful) {
                keepMaintenanceEnabled = true;
            }

            return res.status(500).json({
                success: false,
                message:
                    restoration.message ||
                    "Live database restoration failed.",
                data: {
                    rollbackPerformed:
                        restoration.rollbackPerformed === true,
                    rollbackSuccessful:
                        restoration.rollbackSuccessful === true,
                    verification:
                        restoration.rollbackVerification || null
                },
                maintenanceMode: keepMaintenanceEnabled
                    ? "enabled"
                    : "will be disabled"
            });
        }

        // 16. Successful live restoration.
        return res.status(200).json({
            success: true,
            message:
                "Cloud backup restored and verified successfully.",
            data: {
                backupFileName: cloudBackup.fileName,
                restoredDatabase: validation.databaseName,
                restoredCollections: validation.collectionCount,
                safetyBackupPath: safetyBackup.backupPath,
                verification: restoration.verification
            }
        });

    } catch (error) {
        console.error(
            "LIVE RESTORE ERROR:",
            error
        );

        // If restoration was attempted and recovery
        // was not confirmed, keep maintenance mode enabled.
        if (restoreAttempted) {
            keepMaintenanceEnabled = true;
        }

        return res.status(500).json({
            success: false,
            message: error.message,
            maintenanceMode: keepMaintenanceEnabled
                ? "enabled"
                : "will be disabled"
        });

    } finally {

        // 17. Remove temporary restore files.
        if (temporaryDirectory) {
            try {
                await fs.rm(temporaryDirectory, {
                    recursive: true,
                    force: true
                });

                console.log(
                    "Temporary live restore files removed."
                );

            } catch (cleanupError) {
                console.error(
                    "Temporary live restore cleanup failed:",
                    cleanupError.message
                );
            }
        }

        try {
            // 18. Disable maintenance only when safe.
            if (
                maintenanceEnabled &&
                !keepMaintenanceEnabled
            ) {
                disableMaintenanceMode();
            }

        } catch (maintenanceError) {
            keepMaintenanceEnabled = true;

            console.error(
                "CRITICAL: Could not disable maintenance mode:",
                maintenanceError.message
            );

        } finally {
            // 19. Always release the operation lock.
            operationLock?.release();
        }
    }
};




export const downloadCloudBackup = async (req, res) => {
    try {
        const { fileId } = req.params;

        const backup = await downloadBackupFromGoogleDrive(fileId);

        res.setHeader(
            "Content-Type",
            "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${backup.fileName}"`
        );

        res.setHeader(
            "Content-Length",
            backup.encryptedSize
        );

        return res.status(200).send(backup.encryptedBuffer);

    } catch (error) {
        console.error("Cloud backup download error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to download cloud backup.",
            error: error.message
        });
    }
};
