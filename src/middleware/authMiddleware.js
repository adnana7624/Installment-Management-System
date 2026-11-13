
import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";

export const protect = async (req, res, next) => {
    try {
        let token;

        // Read token from Authorization header
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer ")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access denied. Please login first."
            });
        }

        // Verify JWT
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Find logged-in admin
        const admin = await Admin.findById(decoded.id).select("-password");

        if (!admin || !admin.isActive) {
            return res.status(401).json({
                success: false,
                message: "Invalid or inactive admin account"
            });
        }

        // Attach admin information to request
        req.user = admin;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};
