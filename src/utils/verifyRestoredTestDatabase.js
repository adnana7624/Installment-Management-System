
import mongoose from "mongoose";

const verifyRestoredTestDatabase = async () => {
    let connection;

    try {
        const testDatabaseName = "IMS_Cloud_Restore_Test";

        // Create a separate connection to the test database.
        connection = await mongoose
            .createConnection(process.env.MONGO_URI, {
                dbName: testDatabaseName
            })
            .asPromise();

        const database = connection.db;

        const requiredCollections = [
            "admins",
            "businessinfos",
            "counters",
            "customers",
            "expenses",
            "installments",
            "payments"
        ];

        // Get available collections.
        const collectionList = await database
            .listCollections({}, { nameOnly: true })
            .toArray();

        const availableCollections = collectionList.map(
            collection => collection.name
        );

        // Check required collections.
        const missingCollections = requiredCollections.filter(
            collection =>
                !availableCollections.includes(collection)
        );

        if (missingCollections.length > 0) {
            throw new Error(
                `Missing test collections: ${missingCollections.join(", ")}`
            );
        }

        // Count documents.
        const collectionCounts = {};

        for (const collectionName of requiredCollections) {
            collectionCounts[collectionName] =
                await database
                    .collection(collectionName)
                    .countDocuments({});
        }

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
            `Test database verification failed: ${error.message}`
        );

    } finally {
        if (connection) {
            await connection.close();
        }
    }
};

export default verifyRestoredTestDatabase;
