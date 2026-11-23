
import fs from "node:fs/promises";
import { Readable } from "node:stream";

import { getGoogleDriveClient } from "../config/googleDrive.js";
import encryptBackup from "./encryptBackup.js";

const uploadBackupToGoogleDrive = async (archivePath) => {
    try {
        // 1. Read the ZIP archive
        const archiveBuffer = await fs.readFile(archivePath);

        if (!archiveBuffer.length) {
            throw new Error("Backup archive is empty.");
        }

        // 2. Encrypt the archive
        const encryptedBuffer = encryptBackup(archiveBuffer);

        // 3. Connect to Google Drive
        const drive = await getGoogleDriveClient();

        const folderName =
            process.env.GOOGLE_DRIVE_FOLDER_NAME || "IMS_Backups";

        // 4. Find the backup folder
        const folderResponse = await drive.files.list({
            q: `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: "files(id, name)",
            pageSize: 10
        });

        let folderId = folderResponse.data.files?.[0]?.id;

        // 5. Create the folder if it does not exist
        if (!folderId) {
            const createdFolder = await drive.files.create({
                requestBody: {
                    name: folderName,
                    mimeType: "application/vnd.google-apps.folder"
                },
                fields: "id, name"
            });

            folderId = createdFolder.data.id;
        }

        // 6. Create a unique encrypted backup filename
        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        const fileName = `IMS_Database_Backup_${timestamp}.zip.enc`;

        // 7. Upload encrypted backup
        const uploadResponse = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId]
            },
            media: {
                mimeType: "application/octet-stream",
                body: Readable.from(encryptedBuffer)
            },
            fields: "id, name, size"
        });

        return {
            success: true,
            fileId: uploadResponse.data.id,
            fileName: uploadResponse.data.name,
            size: uploadResponse.data.size,
            folderId
        };

    } catch (error) {
        throw new Error(
            `Google Drive backup upload failed: ${error.message}`
        );
    }
};

export default uploadBackupToGoogleDrive;
