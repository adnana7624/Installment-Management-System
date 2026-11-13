import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./src/config/db.js";

import authRoutes from "./src/routes/authRoutes.js";
import installmentRoutes from "./src/routes/installmentRoutes.js"
import paymentRoutes from "./src/routes/paymentRoutes.js";
import expenseRoutes from "./src/routes/expenseRoutes.js";


dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/v1/auth" , authRoutes)
app.use("/api/v1/installments",installmentRoutes)
app.use("/api/v1/payments",paymentRoutes);
app.use("/api/v1/expenses",expenseRoutes);

app.get("/",(req , res) =>{
    return res.status(200).json({
        success : true,
        message : "app running successfully"
    })
})

const port = process.env.PORT || 3000;

await connectDB();

app.listen(port , ()=>{
    console.log(`server running on port no ${port}`)
})
