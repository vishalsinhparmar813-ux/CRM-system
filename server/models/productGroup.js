const mongoose = require('mongoose')

const productGroupSchema = mongoose.Schema(
    {
        _id: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        description: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
)

const ProductGroup = mongoose.model('ProductGroup', productGroupSchema)
module.exports = ProductGroup 