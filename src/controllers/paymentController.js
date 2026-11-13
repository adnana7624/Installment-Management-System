
import Payment from "../models/paymentModel.js";
import Customer from "../models/customerModel.js";
import Installment from "../models/installmentModel.js";

export const getAllPayments = async (req, res) => {
    try {
        const {
            search = "",
            paymentMethod,
            paymentType,
            startDate,
            endDate,
            page = 1,
            limit = 10
        } = req.query;

        // 1. Validate filters
        if (
            paymentMethod &&
            !["cash", "bank"].includes(paymentMethod)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method"
            });
        }

        if (
            paymentType &&
            !["down_payment", "regular"].includes(paymentType)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment type"
            });
        }

        const pageNumber = Math.max(1, Number(page));
        const limitNumber = Math.min(100, Math.max(1, Number(limit)));

        if (
            !Number.isInteger(pageNumber) ||
            !Number.isInteger(limitNumber)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination values"
            });
        }

        // 2. Build payment query
        const filter = {};

        if (paymentMethod) {
            filter.paymentMethod = paymentMethod;
        }

        if (paymentType) {
            filter.paymentType = paymentType;
        }

        // 3. Search receipt number or customer
        if (search.trim()) {
            const searchValue = search.trim();

            const customers = await Customer.find({
                $or: [
                    { customerName: { $regex: searchValue, $options: "i" } },
                    { cnic: { $regex: searchValue, $options: "i" } }
                ]
            }).select("_id");

            const installments = await Installment.find({
                customer: { $in: customers.map(c => c._id) }
            }).select("_id");

            filter.$or = [
                {
                    receiptNumber: {
                        $regex: searchValue,
                        $options: "i"
                    }
                },
                {
                    installment: {
                        $in: installments.map(i => i._id)
                    }
                }
            ];
        }

        // 4. Date filters
        if (startDate || endDate) {
            filter.paymentDate = {};

            if (startDate) {
                const start = new Date(startDate);

                if (Number.isNaN(start.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid start date"
                    });
                }

                start.setUTCHours(0, 0, 0, 0);
                filter.paymentDate.$gte = start;
            }

            if (endDate) {
                const end = new Date(endDate);

                if (Number.isNaN(end.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid end date"
                    });
                }

                end.setUTCHours(23, 59, 59, 999);
                filter.paymentDate.$lte = end;
            }
        }

        // 5. Get total payment count
        const totalPayments = await Payment.countDocuments(filter);

        // 6. Get payments
        const payments = await Payment.find(filter)
            .populate({
                path: "installment",
                populate: {
                    path: "customer",
                    select: "customerName cnic fatherName contactNumber"
                }
            })
            .populate("receivedBy", "name email")
            .sort({ paymentDate: -1, createdAt: -1 })
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);

        // 7. Send response
        return res.status(200).json({
            success: true,
            message: "Payments fetched successfully",
            data: payments,
            pagination: {
                totalPayments,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalPayments / limitNumber),
                limit: limitNumber
            }
        });

    } catch (error) {
        console.error("Get payments error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch payments"
        });
    }
};
