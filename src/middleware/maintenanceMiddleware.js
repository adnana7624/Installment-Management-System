
let maintenanceEnabled = false;

let activeRequests = 0;

let drainResolvers = [];

const maintenanceMiddleware = (req, res, next) => {

    // Allow the live restore request to continue
    const isLiveRestoreRequest =
        req.method === "POST" &&
        /^\/api\/v1\/backups\/google\/restore-live\/[^/]+$/.test(req.path);

    // Reject normal requests during maintenance
    if (maintenanceEnabled && !isLiveRestoreRequest) {
        return res.status(503).json({
            success: false,
            message: "The application is temporarily under maintenance. Please try again shortly."
        });
    }

    // Do not count the restore request itself
    if (isLiveRestoreRequest) {
        return next();
    }

    activeRequests++;

    let completed = false;

    const finishRequest = () => {
        if (completed) return;

        completed = true;
        activeRequests--;

        // Notify restore process when all requests have finished
        if (activeRequests === 0) {
            drainResolvers.forEach(resolve => resolve());
            drainResolvers = [];
        }
    };

    res.once("finish", finishRequest);
    res.once("close", finishRequest);

    next();
};

// Enable maintenance mode
export const enableMaintenanceMode = () => {
    maintenanceEnabled = true;

    console.log("Application maintenance mode enabled.");
};

// Disable maintenance mode
export const disableMaintenanceMode = () => {
    maintenanceEnabled = false;

    console.log("Application maintenance mode disabled.");
};

// Wait until existing API requests finish
export const waitForActiveRequests = (timeoutMs = 30000) => {

    if (activeRequests === 0) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {

        const timer = setTimeout(() => {

            drainResolvers = drainResolvers.filter(
                callback => callback !== onDrained
            );

            reject(
                new Error(
                    "Existing API requests did not finish within the allowed time."
                )
            );

        }, timeoutMs);

        const onDrained = () => {
            clearTimeout(timer);
            resolve();
        };

        drainResolvers.push(onDrained);
    });
};

export default maintenanceMiddleware;
