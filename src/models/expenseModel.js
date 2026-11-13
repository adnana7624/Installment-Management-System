
import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        category: {
            type: String,
            enum: [
                "rent",
                "electricity",
                "salary",
                "transport",
                "maintenance",
                "other"
            ],
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        expenseDate: {
            type: Date,
            required: true,
            default: Date.now
        },

        paymentMethod: {
            type: String,
            enum: ["cash", "bank"],
            required: true
        },

        notes: {
            type: String,
            trim: true,
            default: ""
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true
        }
    },
    {
        timestamps: true
    }
);

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
