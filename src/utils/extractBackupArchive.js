
import fs from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";

import decryptBackup from "./decryptBackup.js";

const extractBackupArchive = async (
    encryptedBuffer,
    extractionPath
) => {
    try {
        if (
            !Buffer.isBuffer(encryptedBuffer) ||
            encryptedBuffer.length < 28
        ) {
            throw new Error("Invalid encrypted backup data.");
        }

        // 1. Decrypt the downloaded backup
        const zipBuffer = decryptBackup(encryptedBuffer);

        if (!zipBuffer.length) {
            throw new Error("Decrypted ZIP archive is empty.");
        }

        // 2. Read ZIP archive
        const directory = await unzipper.Open.buffer(zipBuffer);

        // 3. Create extraction directory
        await fs.mkdir(extractionPath, {
            recursive: true
        });

        // 4. Extract and validate each entry
        for (const entry of directory.files) {
            const entryPath = entry.path;

            if (
                path.isAbsolute(entryPath) ||
                entryPath.includes("\\")
            ) {
                throw new Error("Unsafe ZIP archive entry.");
            }

            const outputPath = path.resolve(
                extractionPath,
                entryPath
            );

            const relativePath = path.relative(
                extractionPath,
                outputPath
            );

            if (
                relativePath === ".." ||
                relativePath.startsWith(`..${path.sep}`) ||
                path.isAbsolute(relativePath)
            ) {
                throw new Error("ZIP path traversal detected.");
            }

            // Reject symbolic links
            if (entry.type !== "File" && entry.type !== "Directory") {
                throw new Error("Unsupported ZIP entry type.");
            }

            if (entry.type === "Directory") {
                await fs.mkdir(outputPath, {
                    recursive: true
                });

                continue;
            }

            await fs.mkdir(path.dirname(outputPath), {
                recursive: true
            });

            const fileBuffer = await entry.buffer();

            await fs.writeFile(outputPath, fileBuffer);
        }

        return {
            success: true,
            extractionPath,
            extractedFiles: directory.files.length
        };

    } catch (error) {
        throw new Error(
            `Backup decryption or extraction failed: ${error.message}`
        );
    }
};

export default extractBackupArchive;
