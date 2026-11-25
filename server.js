// import express from "express";
// import dotenv from "dotenv";
// import cors from "cors";
// import connectDB from "./src/config/db.js";

// import startBackupScheduler from "./src/utils/backupScheduler.js";

// import authRoutes from "./src/routes/authRoutes.js";
// import installmentRoutes from "./src/routes/installmentRoutes.js"
// import paymentRoutes from "./src/routes/paymentRoutes.js";
// import expenseRoutes from "./src/routes/expenseRoutes.js";
// import dashboardRoutes from "./src/routes/dashboardRoutes.js";
// import reportRoutes from "./src/routes/reportRoutes.js";
// import backupRoutes from "./src/routes/backupRoutes.js";
// import businessInfoRoutes from "./src/routes/businessInfoRoutes.js";

// import {
//     maintenanceMiddleware
// } from "./src/middleware/maintenanceMode.js";


// dotenv.config();

// const app = express();
// app.use(cors({
//     origin: "http://localhost:5173"
// }));
// app.use(express.json());

// app.use(maintenanceMiddleware);

// app.use("/api/v1/auth" , authRoutes)
// app.use("/api/v1/installments",installmentRoutes)
// app.use("/api/v1/payments",paymentRoutes);
// app.use("/api/v1/expenses",expenseRoutes);
// app.use("/api/v1/dashboard",dashboardRoutes);
// app.use("/api/v1/reports",reportRoutes);
// app.use("/api/v1/backups", backupRoutes);
// app.use("/api/v1/business-info", businessInfoRoutes);


// app.get("/",(req , res) =>{
//     return res.status(200).json({
//         success : true,
//         message : "app running successfully"
//     })
// })

// const port = process.env.PORT || 3000;

// await connectDB();

// await startBackupScheduler();

// app.listen(port , ()=>{
//     console.log(`server running on port no ${port}`)
// })



import "dotenv/config";

import express from "express";
import cors from "cors";

import connectDB from "./src/config/db.js";
import startBackupScheduler from "./src/utils/backupScheduler.js";

import authRoutes from "./src/routes/authRoutes.js";
import installmentRoutes from "./src/routes/installmentRoutes.js";
import paymentRoutes from "./src/routes/paymentRoutes.js";
import expenseRoutes from "./src/routes/expenseRoutes.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import reportRoutes from "./src/routes/reportRoutes.js";
import backupRoutes from "./src/routes/backupRoutes.js";
import businessInfoRoutes from "./src/routes/businessInfoRoutes.js";

import {
    maintenanceMiddleware
} from "./src/middleware/maintenanceMode.js";

const app = express();

const port = process.env.PORT || 3000;

// 1. Middleware
app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());

app.use(maintenanceMiddleware);

// 2. API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/installments", installmentRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/backups", backupRoutes);
app.use("/api/v1/business-info", businessInfoRoutes);

// 3. Health Check
app.get("/", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "App running successfully"
    });
});

// 4. Start Application
const startServer = async () => {
    try {
        // Connect MongoDB before accepting requests.
        await connectDB();

        console.log("MongoDB connected successfully.");

        // Start HTTP server.
        const server = app.listen(port, () => {
            console.log(
                `Server running on port no ${port}`
            );

            // Start backup scheduler in the background.
            // Startup backup will not block the API server.
            startBackupScheduler().catch(error => {
                console.error(
                    "Backup scheduler initialization failed:",
                    error.message
                );
            });
        });

        server.on("error", error => {
            console.error(
                "HTTP server error:",
                error.message
            );
        });

    } catch (error) {
        console.error(
            "Application startup failed:",
            error.message
        );

        process.exit(1);
    }
};

startServer();
