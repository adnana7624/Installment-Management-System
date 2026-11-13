
import express from "express";
import { createInstallment , getAllInstallments, getSingleInstallment, receivePayment } from "../controllers/installmentController.js";
import { protect } from "../middleware/authMiddleware.js";


const router = express.Router();

router.post("/create", protect, createInstallment);

router.get("/getAll", protect,getAllInstallments)

// get single installment details
router.get("/single/:id",protect , getSingleInstallment);

// payment api
router.post("/payment/:id",protect,receivePayment);

export default router;
