
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent maintenance status file.
// Backend/storage/maintenance-mode.json
const maintenanceDirectory = path.resolve(
    __dirname,
    "../../storage"
);

const maintenanceFile = path.join(
    maintenanceDirectory,
    "maintenance-mode.json"
);

let maintenanceMode = false;

let activeRequests = 0;

const waitQueue = [];

// Load maintenance status when the backend starts.
try {
    if (fs.existsSync(maintenanceFile)) {
        maintenanceMode = true;

        console.log(
            "WARNING: Persistent maintenance mode detected. Application remains in maintenance mode."
        );
    }
} catch (error) {
    // Fail safely: do not allow normal requests if
    // maintenance status cannot be checked.
    maintenanceMode = true;

    console.error(
        "Could not check persistent maintenance status:",
        error.message
    );
}

// Enable and persist maintenance mode.
export const enableMaintenanceMode = () => {
    fs.mkdirSync(maintenanceDirectory, {
        recursive: true
    });

    fs.writeFileSync(
        maintenanceFile,
        JSON.stringify(
            {
                enabled: true,
                reason: "Database restoration",
                enabledAt: new Date().toISOString()
            },
            null,
            2
        ),
        "utf8"
    );

    maintenanceMode = true;

    console.log("Persistent maintenance mode enabled.");
};

// Disable maintenance mode only after recovery is confirmed.
export const disableMaintenanceMode = () => {
    if (fs.existsSync(maintenanceFile)) {
        fs.unlinkSync(maintenanceFile);
    }

    maintenanceMode = false;

    console.log("Persistent maintenance mode disabled.");
};

export const isMaintenanceMode = () => maintenanceMode;

// Wait for existing requests to finish.
// Timeout after 60 seconds by default.
export const waitForActiveRequests = async (
    timeoutMs = 60000
) => {
    if (activeRequests === 0) {
        return;
    }

    console.log(
        `Waiting for ${activeRequests} active request(s) to finish...`
    );

    await new Promise((resolve, reject) => {
        const waiter = {
            resolve: () => {
                clearTimeout(waiter.timer);
                resolve();
            },
            reject: (error) => {
                clearTimeout(waiter.timer);
                reject(error);
            },
            timer: null
        };

        waiter.timer = setTimeout(() => {
            const index = waitQueue.indexOf(waiter);

            if (index !== -1) {
                waitQueue.splice(index, 1);
            }

            reject(
                new Error(
                    `Database restoration cancelled because ${activeRequests} active request(s) did not finish within ${timeoutMs / 1000} seconds.`
                )
            );
        }, timeoutMs);

        waitQueue.push(waiter);
    });

    console.log(
        "All existing API requests have finished."
    );
};

// Release waiting restoration process when requests finish.
const releaseWaitingRequests = () => {
    if (activeRequests !== 0) {
        return;
    }

    while (waitQueue.length > 0) {
        const waiter = waitQueue.shift();

        waiter.resolve();
    }
};

// Express maintenance middleware.
export const maintenanceMiddleware = (req, res, next) => {

    // Allow the authenticated live restore route to continue.
    const isLiveRestoreRequest =
        req.method === "POST" &&
        req.path.startsWith(
            "/api/v1/backups/google/restore-live/"
        );

    if (maintenanceMode && !isLiveRestoreRequest) {
        return res.status(503).json({
            success: false,
            message:
                "The application is temporarily unavailable because a database restore operation is in progress. Please try again shortly."
        });
    }

    // Do not count the live restore request itself.
    if (isLiveRestoreRequest) {
        return next();
    }

    activeRequests++;

    let requestFinished = false;

    const finishRequest = () => {
        if (requestFinished) {
            return;
        }

        requestFinished = true;

        activeRequests--;

        console.log(
            `Active requests remaining: ${activeRequests}`
        );

        releaseWaitingRequests();
    };

    res.on("finish", finishRequest);
    res.on("close", finishRequest);

    next();
};
