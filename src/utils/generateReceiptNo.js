import Counter from "../models/counterModel.js";

const generateReceiptNumber = async (session) => {
    const counter = await Counter.findOneAndUpdate(
        { _id: "receipt" },
        {
            $inc: { sequence: 1 }
        },
        {
            returnDocument : "after",
            upsert: true,
            setDefaultsOnInsert: true,
            session
        }
    );

    return String(counter.sequence).padStart(4, "0");
};

export default generateReceiptNumber;
