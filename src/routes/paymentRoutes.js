import express from "express";

import { getAllPayments } from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// get payment history
router.get("/getAll" , protect , getAllPayments);

export default router;