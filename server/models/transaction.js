const mongoose = require('mongoose')

const transactionSchema = mongoose.Schema(
    {
        _id: { type: String, required: true, unique: true, index: true },
        clientId: { type: String },
        orderId: { type: String},
        amount: {type: Number},
        date: { type: Date },
        mediaFileUrl: { type: String },
    },
    { timestamps: true }
)

const Transaction = mongoose.model('Transaction', transactionSchema)
module.exports = Transaction