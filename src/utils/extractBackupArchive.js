
import fs from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";

import decryptBackup from "./decryptBackup.js";

// Extraction safety limits.
const MAX_ENCRYPTED_SIZE = 1024 * 1024 * 1024; // 1 GB
const MAX_ENTRIES = 10000;
const MAX_FILE_SIZE = 256 * 1024 * 1024; // 256 MB per file
const MAX_TOTAL_EXTRACTED_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

const extractBackupArchive = async (
    encryptedBuffer,
    extractionPath
) => {
    try {
        // 1. Validate input.
        if (
            !Buffer.isBuffer(encryptedBuffer) ||
            encryptedBuffer.length < 28
        ) {
            throw new Error(
                "Invalid encrypted backup data."
            );
        }

        if (encryptedBuffer.length > MAX_ENCRYPTED_SIZE) {
            throw new Error(
                "Encrypted backup exceeds the maximum allowed size."
            );
        }

        if (!extractionPath) {
            throw new Error(
                "Extraction directory is required."
            );
        }

        // 2. Decrypt backup.
        const zipBuffer = decryptBackup(encryptedBuffer);

        if (!zipBuffer.length) {
            throw new Error(
                "Decrypted ZIP archive is empty."
            );
        }

        // 3. Open ZIP archive.
        const directory = await unzipper.Open.buffer(
            zipBuffer
        );

        // 4. Check entry count.
        if (directory.files.length > MAX_ENTRIES) {
            throw new Error(
                "ZIP archive contains too many entries."
            );
        }

        // 5. Validate all entries before extraction.
        const validatedEntries = [];
        const usedPaths = new Set();

        let totalExtractedSize = 0;

        for (const entry of directory.files) {
            const entryPath = entry.path;

            if (
                !entryPath ||
                entryPath.includes("\\") ||
                entryPath.includes("\0") ||
                path.isAbsolute(entryPath) ||
                /^[a-zA-Z]:/.test(entryPath)
            ) {
                throw new Error(
                    "Unsafe ZIP archive entry."
                );
            }

            const normalizedSegments = entryPath
                .split("/")
                .filter(Boolean);

            if (
                normalizedSegments.length === 0 ||
                normalizedSegments.some(segment =>
                    segment === "." || segment === ".."
                )
            ) {
                throw new Error(
                    "Unsafe ZIP archive path detected."
                );
            }

            const outputPath = path.resolve(
                extractionPath,
                ...normalizedSegments
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
                throw new Error(
                    "ZIP path traversal detected."
                );
            }

            // Windows paths are case-insensitive.
            const normalizedOutputPath =
                outputPath.toLowerCase();

            if (usedPaths.has(normalizedOutputPath)) {
                throw new Error(
                    `Duplicate ZIP archive path: ${entryPath}`
                );
            }

            usedPaths.add(normalizedOutputPath);

            // Reject symbolic links and unsupported entry types.
            if (
                entry.type !== "File" &&
                entry.type !== "Directory"
            ) {
                throw new Error(
                    `Unsupported ZIP entry type: ${entryPath}`
                );
            }

            if (entry.type === "Directory") {
                validatedEntries.push({
                    entry,
                    outputPath,
                    isDirectory: true,
                    size: 0
                });

                continue;
            }

            const fileSize = Number(
                entry.uncompressedSize
            );

            if (
                !Number.isSafeInteger(fileSize) ||
                fileSize < 0
            ) {
                throw new Error(
                    `Invalid ZIP file size: ${entryPath}`
                );
            }

            if (fileSize > MAX_FILE_SIZE) {
                throw new Error(
                    `ZIP file exceeds the maximum allowed size: ${entryPath}`
                );
            }

            totalExtractedSize += fileSize;

            if (
                totalExtractedSize >
                MAX_TOTAL_EXTRACTED_SIZE
            ) {
                throw new Error(
                    "ZIP archive exceeds the maximum total extraction size."
                );
            }

            validatedEntries.push({
                entry,
                outputPath,
                isDirectory: false,
                size: fileSize
            });
        }

        // 6. Create extraction directory.
        const absoluteExtractionPath = path.resolve(
            extractionPath
        );

        await fs.mkdir(absoluteExtractionPath, {
            recursive: true
        });

        // 7. Extract validated entries.
        let extractedFiles = 0;

        for (const item of validatedEntries) {
            if (item.isDirectory) {
                await fs.mkdir(item.outputPath, {
                    recursive: true
                });

                continue;
            }

            await fs.mkdir(
                path.dirname(item.outputPath),
                {
                    recursive: true
                }
            );

            const fileBuffer = await item.entry.buffer();

            // Verify actual extracted size against ZIP metadata.
            if (fileBuffer.length !== item.size) {
                throw new Error(
                    `Extracted file size does not match ZIP metadata: ${item.entry.path}`
                );
            }

            await fs.writeFile(
                item.outputPath,
                fileBuffer,
                { flag: "wx" }
            );

            extractedFiles++;
        }

        return {
            success: true,
            extractionPath: absoluteExtractionPath,
            extractedFiles,
            totalExtractedSize
        };

    } catch (error) {
        throw new Error(
            `Backup decryption or extraction failed: ${error.message}`
        );
    }
};

export default extractBackupArchive;
