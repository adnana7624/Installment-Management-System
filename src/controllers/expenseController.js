
import Expense from "../models/expenseModel.js";

const validCategories = [
    "rent",
    "electricity",
    "salary",
    "transport",
    "maintenance",
    "other"
];

// CREATE EXPENSE
export const createExpense = async (req, res) => {
    try {
        const {
            title,
            category,
            amount,
            expenseDate,
            paymentMethod,
            notes = ""
        } = req.body;

        if (
            !title ||
            !category ||
            amount === undefined ||
            !paymentMethod
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields"
            });
        }

        const expenseAmount = Number(amount);

        if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Expense amount must be greater than zero"
            });
        }

        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense category"
            });
        }

        if (!["cash", "bank"].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Payment method must be cash or bank"
            });
        }

        const date = expenseDate ? new Date(expenseDate) : new Date();

        if (Number.isNaN(date.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense date"
            });
        }

        const expense = await Expense.create({
            title: title.trim(),
            category,
            amount: expenseAmount,
            expenseDate: date,
            paymentMethod,
            notes,
            createdBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: "Expense created successfully",
            data: expense
        });

    } catch (error) {
        console.error("Create expense error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create expense"
        });
    }
};

// GET ALL EXPENSES
export const getAllExpenses = async (req, res) => {
    try {
        const {
            search = "",
            category,
            paymentMethod,
            startDate,
            endDate,
            page = 1,
            limit = 10
        } = req.query;

        const pageNumber = Number(page);
        const limitNumber = Number(limit);

        if (
            !Number.isInteger(pageNumber) ||
            !Number.isInteger(limitNumber) ||
            pageNumber < 1 ||
            limitNumber < 1 ||
            limitNumber > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination values"
            });
        }

        const filter = {};

        if (search.trim()) {
            filter.title = {
                $regex: search.trim(),
                $options: "i"
            };
        }

        if (category) {
            if (!validCategories.includes(category)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid expense category"
                });
            }

            filter.category = category;
        }

        if (paymentMethod) {
            if (!["cash", "bank"].includes(paymentMethod)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment method"
                });
            }

            filter.paymentMethod = paymentMethod;
        }

        if (startDate || endDate) {
            filter.expenseDate = {};

            if (startDate) {
                const start = new Date(startDate);

                if (Number.isNaN(start.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid start date"
                    });
                }

                start.setUTCHours(0, 0, 0, 0);
                filter.expenseDate.$gte = start;
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
                filter.expenseDate.$lte = end;
            }
        }

        const totalExpenses = await Expense.countDocuments(filter);

        const expenses = await Expense.find(filter)
            .populate("createdBy", "name email")
            .sort({ expenseDate: -1, createdAt: -1 })
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);

        return res.status(200).json({
            success: true,
            message: "Expenses fetched successfully",
            data: expenses,
            pagination: {
                totalExpenses,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalExpenses / limitNumber),
                limit: limitNumber
            }
        });

    } catch (error) {
        console.error("Get expenses error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch expenses"
        });
    }
};

// GET SINGLE EXPENSE
export const getSingleExpense = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^[a-fA-F0-9]{24}$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense ID"
            });
        }

        const expense = await Expense.findById(id)
            .populate("createdBy", "name email");

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Expense fetched successfully",
            data: expense
        });

    } catch (error) {
        console.error("Get expense error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch expense"
        });
    }
};

// UPDATE EXPENSE
export const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^[a-fA-F0-9]{24}$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense ID"
            });
        }

        const {
            title,
            category,
            amount,
            expenseDate,
            paymentMethod,
            notes
        } = req.body;

        const updates = {};

        if (title !== undefined) {
            if (!title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Title cannot be empty"
                });
            }

            updates.title = title.trim();
        }

        if (category !== undefined) {
            if (!validCategories.includes(category)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid expense category"
                });
            }

            updates.category = category;
        }

        if (amount !== undefined) {
            const value = Number(amount);

            if (!Number.isFinite(value) || value <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Expense amount must be greater than zero"
                });
            }

            updates.amount = value;
        }

        if (expenseDate !== undefined) {
            const date = new Date(expenseDate);

            if (Number.isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid expense date"
                });
            }

            updates.expenseDate = date;
        }

        if (paymentMethod !== undefined) {
            if (!["cash", "bank"].includes(paymentMethod)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment method"
                });
            }

            updates.paymentMethod = paymentMethod;
        }

        if (notes !== undefined) {
            updates.notes = notes;
        }

        const expense = await Expense.findByIdAndUpdate(
            id,
            { $set: updates },
            {
                returnDocument: "after",
                runValidators: true
            }
        ).populate("createdBy", "name email");

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Expense updated successfully",
            data: expense
        });

    } catch (error) {
        console.error("Update expense error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update expense"
        });
    }
};

// DELETE EXPENSE
export const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^[a-fA-F0-9]{24}$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense ID"
            });
        }

        const expense = await Expense.findByIdAndDelete(id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Expense deleted successfully"
        });

    } catch (error) {
        console.error("Delete expense error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete expense"
        });
    }
};
