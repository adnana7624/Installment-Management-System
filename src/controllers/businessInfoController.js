import BusinessInfo from "../models/businessInfoModel.js";

// Get Business Information
export const getBusinessInfo = async (req, res) => {
    try {
        let businessInfo = await BusinessInfo.findOne({
            settingKey: "primary"
        });

        // Return empty fields if information has not been saved yet
        if (!businessInfo) {
            return res.status(200).json({
                success: true,
                message: "Business information fetched successfully",
                data: {
                    businessName: "",
                    businessContact: "",
                    businessAddress: ""
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: "Business information fetched successfully",
            data: businessInfo
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch business information",
            error: error.message
        });
    }
};


// Create or Update Business Information
export const updateBusinessInfo = async (req, res) => {
    try {
        const {
            businessName,
            businessContact,
            businessAddress
        } = req.body;

        // Validate required fields
        if (
            !businessName?.trim() ||
            !businessContact?.trim() ||
            !businessAddress?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Business name, contact, and address are required"
            });
        }

        const businessInfo = await BusinessInfo.findOneAndUpdate(
            { settingKey: "primary" },
            {
                $set: {
                    businessName: businessName.trim(),
                    businessContact: businessContact.trim(),
                    businessAddress: businessAddress.trim()
                }
            },
            {
                returnDocument : "after",
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "Business information saved successfully",
            data: businessInfo
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to save business information",
            error: error.message
        });
    }
};