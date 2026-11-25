
import fs from "node:fs/promises";
import { Readable } from "node:stream";

import { getGoogleDriveClient } from "../config/googleDrive.js";
import encryptBackup from "./encryptBackup.js";

const uploadBackupToGoogleDrive = async (archivePath) => {
    try {
        // 1. Validate the ZIP archive.
        if (!archivePath) {
            throw new Error("Backup archive path is required.");
        }

        const archiveStats = await fs.stat(archivePath);

        if (
            !archiveStats.isFile() ||
            archiveStats.size === 0
        ) {
            throw new Error(
                "Backup archive is missing, invalid, or empty."
            );
        }

        // 2. Read the ZIP archive.
        const archiveBuffer = await fs.readFile(archivePath);

        if (!archiveBuffer.length) {
            throw new Error("Backup archive is empty.");
        }

        // 3. Encrypt the archive before uploading.
        const encryptedBuffer = encryptBackup(archiveBuffer);

        if (
            !Buffer.isBuffer(encryptedBuffer) ||
            encryptedBuffer.length === 0
        ) {
            throw new Error(
                "Backup encryption failed or returned invalid data."
            );
        }

        console.log(
            `Backup encrypted successfully. Size: ${encryptedBuffer.length} bytes.`
        );

        // 4. Connect to Google Drive.
        const drive = await getGoogleDriveClient();

        // 5. Validate backup folder name.
        const folderName =
            process.env.GOOGLE_DRIVE_FOLDER_NAME || "IMS_Backups";

        if (!folderName.trim()) {
            throw new Error(
                "Google Drive backup folder name is invalid."
            );
        }

        // Escape special characters for Google Drive query.
        const escapedFolderName = folderName
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'");

        // 6. Find the existing backup folder.
        const folderResponse = await drive.files.list({
            q: `name = '${escapedFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: "nextPageToken, files(id, name, mimeType)",
            pageSize: 100,
            orderBy: "createdTime"
        });

        const existingFolders =
            folderResponse.data.files || [];

        let folderId = existingFolders[0]?.id;

        // 7. Create the folder if it does not exist.
        if (!folderId) {
            const createdFolder = await drive.files.create({
                requestBody: {
                    name: folderName,
                    mimeType: "application/vnd.google-apps.folder"
                },
                fields: "id, name, mimeType"
            });

            folderId = createdFolder.data.id;

            if (!folderId) {
                throw new Error(
                    "Google Drive backup folder could not be created."
                );
            }

            console.log(
                "Google Drive backup folder created:",
                folderName
            );
        }

        // 8. Generate a unique encrypted backup filename.
        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        const fileName =
            `IMS_Database_Backup_${timestamp}.zip.enc`;

        // 9. Upload encrypted backup.
        const uploadResponse = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId]
            },
            media: {
                mimeType: "application/octet-stream",

                // Send the complete Buffer as one stream chunk.
                body: Readable.from([encryptedBuffer])
            },
            fields: "id, name, size, mimeType, parents"
        });

        const uploadedFile = uploadResponse.data;

        // 10. Verify uploaded file metadata.
        if (
            !uploadedFile.id ||
            uploadedFile.name !== fileName
        ) {
            throw new Error(
                "Google Drive returned invalid uploaded file metadata."
            );
        }

        if (
            Number(uploadedFile.size) !== encryptedBuffer.length
        ) {
            throw new Error(
                "Uploaded backup size does not match the encrypted backup size."
            );
        }

        if (
            uploadedFile.mimeType !== "application/octet-stream"
        ) {
            throw new Error(
                "Uploaded backup has an unexpected MIME type."
            );
        }

        if (
            !uploadedFile.parents?.includes(folderId)
        ) {
            throw new Error(
                "Uploaded backup is not in the expected Google Drive folder."
            );
        }

        console.log(
            "Encrypted database backup uploaded and metadata verified:",
            uploadedFile.name
        );

        // 11. Return upload information.
        return {
            success: true,
            fileId: uploadedFile.id,
            fileName: uploadedFile.name,
            size: uploadedFile.size,
            folderId
        };

    } catch (error) {
        throw new Error(
            `Google Drive backup upload failed: ${error.message}`
        );
    }
};

export default uploadBackupToGoogleDrive;
