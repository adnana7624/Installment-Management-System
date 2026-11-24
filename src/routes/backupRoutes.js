
import express from "express";

import {
    createBackup,
    getBackupHistory,
    connectGoogleDrive,
    googleDriveCallback,
    testGoogleDriveConnection,
    uploadEncryptedTestBackup,
    downloadAndVerifyTestBackup,
    restoreCloudBackupTest,
    getCloudBackupHistory,
    restoreCloudBackupLive,
    downloadCloudBackup,
    
} from "../controllers/backupController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Existing local backup routes
router.post("/create", protect, createBackup);
router.get("/get", protect, getBackupHistory);

// Google Drive authorization routes
router.get("/google/connect", protect, connectGoogleDrive);
router.get("/google/callback", googleDriveCallback);

router.get("/google/test", protect, testGoogleDriveConnection);

router.post("/google/upload-test",protect,uploadEncryptedTestBackup);

router.get("/google/download-test/:fileId",protect,downloadAndVerifyTestBackup);

// Restore actual encrypted cloud backup into a test database
router.post(
    "/google/restore-test/:fileId",
    protect,
    restoreCloudBackupTest
);

router.get("/google/backups", protect, getCloudBackupHistory);

router.post(
    "/google/restore-live/:fileId",
    protect,
    restoreCloudBackupLive
);

router.get(
    "/google/download/:fileId",
    protect,
    downloadCloudBackup
);



export default router;
