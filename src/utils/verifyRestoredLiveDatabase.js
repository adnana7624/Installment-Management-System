
import mongoose from "mongoose";

const verifyRestoredLiveDatabase = async () => {
    try {
        const expectedDatabaseName =
            "Installment_Management_System";

        const requiredCollections = [
            "admins",
            "businessinfos",
            "counters",
            "customers",
            "expenses",
            "installments",
            "payments"
        ];

        // 1. Check MongoDB connection.
        if (mongoose.connection.readyState !== 1) {
            throw new Error(
                "MongoDB is not connected."
            );
        }

        const database = mongoose.connection.db;

        // 2. Verify database name.
        if (
            database.databaseName !==
            expectedDatabaseName
        ) {
            throw new Error(
                `Wrong database connected. Expected ${expectedDatabaseName}, received ${database.databaseName}.`
            );
        }

        // 3. Get available collections.
        const collectionList = await database
            .listCollections({}, { nameOnly: true })
            .toArray();

        const availableCollections =
            collectionList.map(
                collection => collection.name
            );

        // 4. Check required collections.
        const missingCollections =
            requiredCollections.filter(
                collection =>
                    !availableCollections.includes(collection)
            );

        if (missingCollections.length > 0) {
            throw new Error(
                `Missing collections after restore: ${missingCollections.join(", ")}`
            );
        }

        // 5. Count documents in all required collections.
        const collectionCounts = {};

        for (const collectionName of requiredCollections) {
            collectionCounts[collectionName] =
                await database
                    .collection(collectionName)
                    .countDocuments({});
        }

        // 6. Verify single-admin requirement.
        if (collectionCounts.admins !== 1) {
            throw new Error(
                `Expected exactly one admin account, found ${collectionCounts.admins}.`
            );
        }

        // 7. Calculate total documents.
        const totalDocuments = Object.values(
            collectionCounts
        ).reduce(
            (total, count) => total + count,
            0
        );

        return {
            success: true,
            databaseName: database.databaseName,
            collectionCount: requiredCollections.length,
            totalDocuments,
            collectionCounts
        };

    } catch (error) {
        throw new Error(
            `Restored database verification failed: ${error.message}`
        );
    }
};

export default verifyRestoredLiveDatabase;
