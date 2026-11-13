import mongoose from "mongoose";
import Customer from "../models/customerModel.js";
import Installment from "../models/installmentModel.js";
import Payment from "../models/paymentModel.js";
import generateReceiptNumber from "../utils/generateReceiptNo.js";


export const createInstallment = async (req, res) => {
    let session;

    try {
        const {
            customerName,
            cnic,
            fatherName,
            contactNumber,
            productName,
            dealerRate,
            actualRate,
            percentage,
            purchaseDate,
            downPayment,
            paymentMethod
        } = req.body;

        // 1. Validate required fields
        if (
            !customerName ||
            !cnic ||
            !fatherName ||
            !contactNumber ||
            !productName ||
            dealerRate === undefined ||
            actualRate === undefined ||
            percentage === undefined ||
            !purchaseDate ||
            downPayment === undefined ||
            !paymentMethod
        ) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be provided"
            });
        }

        // 2. Validate CNIC
        const cleanCNIC = String(cnic).replace(/-/g, "").trim();

        if (!/^\d{13}$/.test(cleanCNIC)) {
            return res.status(400).json({
                success: false,
                message: "CNIC must contain exactly 13 digits"
            });
        }

        // 3. Validate numeric fields
        const dealer = Number(dealerRate);
        const actual = Number(actualRate);
        const percent = Number(percentage);
        const down = Number(downPayment);

        if (
            !Number.isFinite(dealer) ||
            !Number.isFinite(actual) ||
            !Number.isFinite(percent) ||
            !Number.isFinite(down) ||
            dealer < 0 ||
            actual <= 0 ||
            percent < 0 ||
            down < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid amounts and percentage"
            });
        }

        // 4. Validate payment method
        if (!["cash", "bank"].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method"
            });
        }

        // 5. Validate purchase date
        const date = new Date(purchaseDate);

        if (Number.isNaN(date.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid purchase date"
            });
        }

        // 6. Calculate customer price
        const percentageAmount = Number(
            (actual * percent / 100).toFixed(2)
        );

        const finalPrice = Number(
            (actual + percentageAmount).toFixed(2)
        );

        const remainingAmount = Number(
            (finalPrice - down).toFixed(2)
        );

        if (down > finalPrice) {
            return res.status(400).json({
                success: false,
                message: "Down payment cannot exceed final customer price"
            });
        }

        // 7. Start MongoDB transaction
        session = await mongoose.startSession();

        let result;

        await session.withTransaction(async () => {

            // 8. Find existing customer
            let customer = await Customer.findOne({
                cnic: cleanCNIC
            }).session(session);

            // 9. Create customer if not found
            if (!customer) {
                const [newCustomer] = await Customer.create(
                    [
                        {
                            customerName: customerName.trim(),
                            cnic: cleanCNIC,
                            fatherName: fatherName.trim(),
                            contactNumber: contactNumber.trim()
                        }
                    ],
                    { session }
                );

                customer = newCustomer;
            }

            // 10. Create installment account
            const [installment] = await Installment.create(
                [
                    {
                        customer: customer._id,
                        productName: productName.trim(),
                        dealerRate: dealer,
                        actualRate: actual,
                        percentage: percent,
                        percentageAmount,
                        finalPrice,
                        purchaseDate: date,
                        downPayment: down,
                        totalPaid: down,
                        remainingAmount,
                        status: remainingAmount === 0
                            ? "completed"
                            : "active"
                    }
                ],
                { session }
            );

            // 11. Create initial down-payment record
            let payment = null;

            if (down > 0) {

                // Generate receipt using the shared counter
                const receiptNumber = await generateReceiptNumber(session);

                const [newPayment] = await Payment.create(
                    [
                        {
                            installment: installment._id,
                            receiptNumber,
                            amount: down,
                            paymentDate: date,
                            paymentMethod,
                            paymentType: "down_payment",
                            notes: "Initial down payment",
                            receivedBy: req.user._id
                        }
                    ],
                    { session }
                );

                payment = newPayment;
            }

            // 12. Prepare response data
            result = {
                customer,
                installment,
                initialPayment: payment
            };
        });

        // 13. Send response after successful transaction
        return res.status(201).json({
            success: true,
            message: "Installment account created successfully",
            data: result
        });

    } catch (error) {
        console.error("Create installment error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Failed to create installment account"
        });

        } finally {
        if (session) {
            await session.endSession();
        }
    }
};


export const getAllInstallments = async (req, res) => {
    try {
        const {
            search = "",
            status,
            page = 1,
            limit = 10
        } = req.query;

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageLimit = Math.min(
            100,
            Math.max(1, parseInt(limit, 10) || 10)
        );

        const filter = {};

        // Filter by account status
        if (status) {
            if (!["active", "completed", "cancelled"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid account status"
                });
            }

            filter.status = status;
        }

        // Search customer name, CNIC, or product name
        if (search.trim()) {
            const matchingCustomers = await Customer.find({
                $or: [
                    {
                        customerName: {
                            $regex: search.trim(),
                            $options: "i"
                        }
                    },
                    {
                        cnic: {
                            $regex: search.trim().replace(/-/g, ""),
                            $options: "i"
                        }
                    }
                ]
            }).select("_id");

            const customerIds = matchingCustomers.map(
                customer => customer._id
            );

            filter.$or = [
                { productName: { $regex: search.trim(), $options: "i" } },
                { customer: { $in: customerIds } }
            ];
        }

        const totalAccounts = await Installment.countDocuments(filter);

        const installments = await Installment.find(filter)
            .populate("customer", "customerName cnic fatherName contactNumber")
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * pageLimit)
            .limit(pageLimit)
            .lean();

        return res.status(200).json({
            success: true,
            message: "Installment accounts fetched successfully",
            pagination: {
                totalAccounts,
                currentPage,
                totalPages: Math.ceil(totalAccounts / pageLimit),
                pageLimit
            },
            data: installments
        });

    } catch (error) {
        console.error("Get installments error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch installment accounts"
        });
    }
};


export const getSingleInstallment = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid installment ID"
            });
        }

        // Find installment and customer
        const installment = await Installment.findById(id)
            .populate(
                "customer",
                "customerName cnic fatherName contactNumber"
            )
            .lean();

        if (!installment) {
            return res.status(404).json({
                success: false,
                message: "Installment account not found"
            });
        }

        // Find payment history
        const payments = await Payment.find({
            installment: id
        })
            .sort({ paymentDate: -1, createdAt: -1 })
            .populate("receivedBy", "name email")
            .lean();

        return res.status(200).json({
            success: true,
            message: "Installment details fetched successfully",
            data: {
                installment,
                payments
            }
        });

    } catch (error) {
        console.error("Get single installment error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch installment details"
        });
    }
};


export const receivePayment = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { id } = req.params;

        const {
            amount,
            paymentMethod,
            paymentDate,
            referenceNumber = "",
            notes = ""
        } = req.body;

        // 1. Validate installment ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid installment ID"
            });
        }

        // 2. Validate amount
        const paymentAmount = Number(amount);

        if (
            amount === undefined ||
            amount === null ||
            amount === "" ||
            !Number.isFinite(paymentAmount) ||
            paymentAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid payment amount"
            });
        }

        // 3. Validate payment method
        if (!["cash", "bank"].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Payment method must be cash or bank"
            });
        }

        // 4. Validate payment date if provided
        let date = new Date();

        if (paymentDate !== undefined) {
            date = new Date(paymentDate);

            if (Number.isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment date"
                });
            }
        }

        let result;

        // 5. Start MongoDB transaction
        await session.withTransaction(async () => {

            const installment = await Installment.findById(id)
                .session(session);

            if (!installment) {
                const error = new Error("Installment account not found");
                error.statusCode = 404;
                throw error;
            }

            if (installment.status !== "active") {
                const error = new Error(
                    "Payment cannot be received for this account"
                );
                error.statusCode = 400;
                throw error;
            }

            if (paymentAmount > installment.remainingAmount) {
                const error = new Error(
                    "Payment amount cannot exceed remaining balance"
                );
                error.statusCode = 400;
                throw error;
            }

            const newRemainingAmount = Number(
                (installment.remainingAmount - paymentAmount).toFixed(2)
            );

            const newTotalPaid = Number(
                (installment.totalPaid + paymentAmount).toFixed(2)
            );

            // 6. Update installment balance
            const updatedInstallment = await Installment.findOneAndUpdate(
                {
                    _id: id,
                    status: "active",
                    remainingAmount: { $gte: paymentAmount }
                },
                {
                    $inc: {
                        totalPaid: paymentAmount,
                        remainingAmount: -paymentAmount
                    },
                    $set: {
                        status: newRemainingAmount === 0
                            ? "completed"
                            : "active"
                    }
                },
                {
                    returnDocument : "after",
                    session
                }
            );

            if (!updatedInstallment) {
                const error = new Error(
                    "Account balance changed. Please try again."
                );
                error.statusCode = 409;
                throw error;
            }

            // 7. Generate receipt number
            const receiptNumber = await generateReceiptNumber(session);

            // 8. Create payment record
            const [payment] = await Payment.create(
                [
                    {
                        installment: id,
                        receiptNumber,
                        amount: paymentAmount,
                        paymentDate: date,
                        paymentMethod,
                        paymentType: "regular",
                        referenceNumber,
                        notes,
                        receivedBy: req.user._id
                    }
                ],
                { session }
            );

            result = {
                installment: updatedInstallment,
                payment
            };
        });

        return res.status(201).json({
            success: true,
            message: "Payment received successfully",
            data: result
        });

    } catch (error) {
        console.error("Receive payment error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Failed to receive payment"
        });

    } finally {
        await session.endSession();
    }
};

