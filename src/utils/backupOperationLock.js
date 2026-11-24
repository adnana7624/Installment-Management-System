
let activeOperation = null;

export const acquireBackupOperationLock = (operationName) => {
    if (activeOperation !== null) {
        return {
            acquired: false,
            activeOperation
        };
    }

    activeOperation = operationName;

    let released = false;

    return {
        acquired: true,

        release: () => {
            if (released) return;

            released = true;
            activeOperation = null;

            console.log(
                `${operationName} operation lock released.`
            );
        }
    };
};

export const getActiveBackupOperation = () => {
    return activeOperation;
};
