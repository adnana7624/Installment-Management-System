import express from "express";

import { loginAdmin } from "../controllers/authController.js";

const router = express.Router();

router.post("/login",loginAdmin);

import { protect } from "../middleware/authMiddleware.js";

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