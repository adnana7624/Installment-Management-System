
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        installment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Installment",
            required: true
        },

        receiptNumber: {
            type: String,
            required: true,
            unique: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0.01
        },

        paymentDate: {
            type: Date,
            required: true,
            default: Date.now
        },

        paymentMethod: {
            type: String,
            enum: ["cash", "bank"],
            required: true
        },

        paymentType: {
            type: String,
            enum: ["down_payment", "regular"],
            default: "regular"
        },

        referenceNumber: {
            type: String,
            trim: true,
            default: ""
        },

        notes: {
            type: String,
            trim: true,
            default: ""
        },

        receivedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true
        }
    },
    { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
