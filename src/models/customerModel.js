
import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
    {
        customerName: {
            type: String,
            required: true,
            
        },

        cnic: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: [
                /^\d{13}$/,
                "CNIC must contain exactly 13 digits"
            ]
        },

        fatherName: {
            type: String,
            required: true,
            
        },

        contactNumber: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;