
import { getGoogleDriveClient } from "../config/googleDrive.js";

const downloadBackupFromGoogleDrive = async (fileId) => {
    try {
        if (!fileId) {
            throw new Error("Google Drive backup file ID is required.");
        }

        const drive = await getGoogleDriveClient();

        // Verify that the file exists and is not in the trash
        const fileInfo = await drive.files.get({
            fileId,
            fields: "id, name, mimeType, size, trashed"
        });

        const fileName = fileInfo.data.name;

        if (
            !fileName ||
            !fileName.startsWith("IMS_Database_Backup_") ||
            !fileName.endsWith(".zip.enc") ||
            fileInfo.data.trashed
        ) {
            throw new Error("Invalid Google Drive backup file.");
        }

        // Download the encrypted backup
        const response = await drive.files.get(
            {
                fileId,
                alt: "media"
            },
            {
                responseType: "arraybuffer"
            }
        );

        const encryptedBuffer = Buffer.from(response.data);

        if (encryptedBuffer.length < 28) {
            throw new Error("Downloaded backup is incomplete.");
        }

        return {
            fileId,
            fileName,
            encryptedBuffer,
            encryptedSize: encryptedBuffer.length
        };

    } catch (error) {
        throw new Error(
            `Google Drive backup download failed: ${error.message}`
        );
    }
};

export default downloadBackupFromGoogleDrive;
