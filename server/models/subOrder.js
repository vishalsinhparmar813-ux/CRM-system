const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        _id: { type: String, required: true, unique: true, index: true },
        orderNo: { type: Number, required: true},
        orderId: { type: String, ref: 'order', required: true }, // Add the missing orderId field
        date: { type: Date },
        clientId: { type: String, ref: 'client' },
        productId: { type: String, ref: 'Product' },
        quantity: { type: Number },
        status: { type: String },
        unitType: { type: String }, // NOS, SQUARE_FEET, SQUARE_METER
        type: { type: String },
        
        // Dispatch invoice specific fields
        invoiceNo: { type: String }, // Add missing invoiceNo field
        isDispatchInvoice: { type: Boolean, default: false },
        dispatchDate: { type: Date },
        dispatchInfo: {
            type: { type: String }, // By Road, Pickup, Courier
            destination: { type: String },
            vehicleNo: { type: String },
            consigneeName: { type: String },
            consigneeAddress: { type: String },
            consigneeContact: { type: String },
            consigneeState: { type: String },
            buyerName: { type: String },
            buyerAddress: { type: String },
            buyerContact: { type: String },
            buyerState: { type: String },
            gstEnabled: { type: Boolean, default: false }
        },
        dispatchedProducts: [{
            productId: { type: String },
            productName: { type: String },
            name: { type: String }, // Product name alias
            quantity: { type: Number },
            unitType: { type: String },
            ratePrice: { type: Number },
            numberOfItems: { type: Number }, // Missing field causing the issue!
            amount: { type: Number }
        }],
        totalAmount: { type: Number }
    },
    { timestamps: true }
)

// Check if model already exists to prevent OverwriteModelError
module.exports = mongoose.models['sub-order'] || mongoose.model('sub-order', schema)