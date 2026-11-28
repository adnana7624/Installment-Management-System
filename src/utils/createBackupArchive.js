
import * as archiver from "archiver";
import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";

const createBackupArchive = async (sourcePath, outputPath) => {
    try {
        const sourceStats = await fs.stat(sourcePath);

        if (!sourceStats.isDirectory()) {
            throw new Error("Backup source must be a directory.");
        }

        await fs.mkdir(path.dirname(outputPath), {
            recursive: true
        });

        return await new Promise((resolve, reject) => {
            const output = createWriteStream(outputPath);

            const archive = archiver("zip", {
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
            archive.directory(sourcePath, false);
            archive.finalize().catch(handleError);
        });
    } catch (error) {
        throw new Error(
            `Backup archive creation failed: ${error.message}`
        );
    }
};

export default createBackupArchive;
