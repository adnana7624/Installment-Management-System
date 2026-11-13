
import mongoose from "mongoose";

const installmentSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true
        },

        productName: {
            type: String,
            required: true,
            
        },

        dealerRate: {
            type: Number,
            required: true,
            min: 0
        },

        actualRate: {
            type: Number,
            required: true,
            min: 0
        },

        percentage: {
            type: Number,
            required: true,
            min: 0
        },

        percentageAmount: {
            type: Number,
            required: true,
            min: 0
        },

        finalPrice: {
            type: Number,
            required: true,
            min: 0
        },

        purchaseDate: {
            type: Date,
            required: true
        },

        downPayment: {
            type: Number,
            required: true,
            min: 0
        },

        totalPaid: {
            type: Number,
            default: 0,
            min: 0
        },

        remainingAmount: {
            type: Number,
            required: true,
            min: 0
        },

        status: {
            type: String,
            enum: ["active", "completed", "cancelled"],
            default: "active"
        }
    },
    {
        timestamps: true
    }
);

const Installment = mongoose.model("Installment",installmentSchema);

export default Installment;