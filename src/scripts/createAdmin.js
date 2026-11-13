
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Admin from "../models/adminModel.js";

dotenv.config();

const createAdmin = async () => {
    try {
        await connectDB();

        // Check whether an admin already exists
        const existingAdmin = await Admin.findOne();

        if (existingAdmin) {
            console.log("Admin account already exists.");
            return;
        }

        
        const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

        // Validate environment variables
        if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
            throw new Error("Admin environment variables are missing.");
        }

        if (ADMIN_PASSWORD.length < 6) {
            throw new Error("Password must contain at least 6 characters.");
        }

        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

        await Admin.create({
            name: ADMIN_NAME,
            email: ADMIN_EMAIL,
            password: hashedPassword
        });

        console.log("Admin account created successfully.");

    } catch (error) {
        console.error("Admin creation failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

createAdmin();
