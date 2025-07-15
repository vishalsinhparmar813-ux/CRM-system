const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        _id: { type: String, required: true, unique: true, index: true },
        orderNo: { type: Number, required: true},
        date: { type: Date },
        clientId: { type: String, ref: 'client' },
        productId: { type: String, ref: 'Product' },
        quantity: { type: Number },
        status: { type: String },
        unitType: { type: String }, // NOS, SQUARE_FEET, SQUARE_METER
        type: { type: String },
    },
    { timestamps: true }
)
module.exports = mongoose.model('sub-order', schema)
    