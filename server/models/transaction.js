const mongoose = require('mongoose')

const transactionSchema = mongoose.Schema(
    {
        _id: { type: String, required: true, unique: true, index: true },
        clientId: { type: String },
        orderId: { type: String},
        amount: {type: Number},
        date: { type: Date },
        mediaFileUrl: { type: String },
        remarks: { type: String, default: '' },
        transactionType: { type: String, enum: ['cash', 'online', 'advanced_payment'], default: 'cash' },
        paymentMethod: { type: String }, // For online payments: 'bank_transfer', 'upi', 'credit_card', etc.
        txnNumber: { type: String }, // Transaction reference number for online payments
    },
    { timestamps: true }
)

const Transaction = mongoose.model('Transaction', transactionSchema)
module.exports = Transaction