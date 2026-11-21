
import express from "express";

import {
    loginAdmin,
    changePassword
} from "../controllers/authController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin login
router.post("/login", loginAdmin);

// Change password (protected)
router.put("/change-password", protect, changePassword);

// Protected profile
router.get("/profile", protect, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Protected API accessed successfully",
        admin: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email
        }
    });
});

export default router;
