const mongoose = require('mongoose')

const advancedPaymentSchema = mongoose.Schema(
    {
        _id: { type: String, required: true, unique: true, index: true },
        clientId: { type: String, required: true, index: true },
        orderId: { type: String, default: null }, // null means general advance payment
        amount: { type: Number, required: true },
        remainingAmount: { type: Number, required: true }, // Amount not yet used
        date: { type: Date, required: true },
        status: { 
            type: String, 
            enum: ['active', 'fully_used', 'refunded'], 
            default: 'active' 
        },
        transactionType: { type: String, enum: ['cash', 'online'], default: 'cash' },
        paymentMethod: { type: String }, // For online payments: 'bank_transfer', 'upi', 'credit_card'
        txnNumber: { type: String }, // Transaction reference number
        remarks: { type: String, default: '' },
        mediaFileUrl: { type: String },
        // Track how this advance payment has been used
        usageHistory: [{
            orderId: String,
            orderNo: String,
            amountUsed: Number,
            dateUsed: { type: Date, default: Date.now },
            remarks: String
        }]
    },
    { timestamps: true }
)

// Index for better query performance
advancedPaymentSchema.index({ clientId: 1, status: 1 })
advancedPaymentSchema.index({ clientId: 1, createdAt: -1 })

const AdvancedPayment = mongoose.model('AdvancedPayment', advancedPaymentSchema)
module.exports = AdvancedPayment