
import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false
        },

        role: {
            type: String,
            enum: ["admin"],
            default: "admin"
        },

        isActive: {
            type: Boolean,
            default: true
        },
        accountKey: {
            type: String,
            unique: true,
            default: "primary",
            immutable: true
        },
    },
    {
        timestamps: true
    }
);

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
