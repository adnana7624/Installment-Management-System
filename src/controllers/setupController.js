import Admin from "../models/adminModel.js";

export const getSetupStatus = async (req, res) => {
    try {
        const adminExists = await Admin.exists({
            accountKey: "primary"
        });

        return res.status(200).json({
            success: true,
            initialized: Boolean(adminExists),
            nextStep: adminExists ? "login" : "setup"
        });

    } catch (error) {
        console.error("Setup status error:", error.message);

        return res.status(503).json({
            success: false,
            message: "Unable to check application setup status."
        });
    }
};