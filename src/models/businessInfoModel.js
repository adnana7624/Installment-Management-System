import mongoose from "mongoose";

const businessInfoSchema = new mongoose.Schema(
    {
        settingKey: {
            type: String,
            default: "primary",
            unique: true,
            immutable: true
        },

        businessName: {
            type: String,
            required: true,
            trim: true
        },

        businessContact: {
            type: String,
            required: true,
            trim: true
        },

        businessAddress: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

const BusinessInfo = mongoose.model("BusinessInfo", businessInfoSchema);

export default BusinessInfo;