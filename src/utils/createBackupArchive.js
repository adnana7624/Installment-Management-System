
import {ZipArchive} from "archiver";
import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";

const createBackupArchive = async (sourcePath, outputPath) => {
    try {
        // Verify the source backup folder exists
        await fs.access(sourcePath);

        // Create the output directory if necessary
        await fs.mkdir(path.dirname(outputPath), {
            recursive: true
        });

        return await new Promise((resolve, reject) => {
            const output = createWriteStream(outputPath);

            const archive = new ZipArchive("zip", {
                zlib: { level: 9 }
            });

            let settled = false;

            const handleError = (error) => {
                if (settled) return;

                settled = true;
                output.destroy();
                reject(error);
            };

            output.on("close", () => {
                if (settled) return;

                settled = true;

                resolve({
                    archivePath: outputPath,
                    size: archive.pointer()
                });
            });

            output.on("error", handleError);
            archive.on("error", handleError);
            archive.on("warning", handleError);

            archive.pipe(output);

            // Add all MongoDB backup files to the ZIP
            archive.directory(sourcePath, false);

            archive.finalize();
        });

    } catch (error) {
        throw new Error(
            `Backup archive creation failed: ${error.message}`
        );
    }
};

export default createBackupArchive;
