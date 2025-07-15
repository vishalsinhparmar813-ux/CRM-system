const mongoose = require('mongoose')

const productSchema = mongoose.Schema(
    {
        _id: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        alias: { type: String, default: '' },
        productGroupId: { type: String, default: null },
        unitType: { type: String, required: true }, // squareMeter, squareFeet, NOS
        alternateUnits: {
            numberOfItems: { type: Number,},
            numberOfUnits: { type: Number, },
        },
        ratePerUnit: { type: Number, required: true },        
    },
    { timestamps: true }
)

const Product = mongoose.model('Product', productSchema)
module.exports = Product


// list of products
/**
 * 
I-Shape
Unipaver
Damru
Toran

200x200 Stone Finish
200x200 Sand Finish
200x200 Cobbles Finish

200x100 Stone Finish
200x100 Sand Finish

100x100 Stone Finish
100x100 Sand Finish

Drain Saucer
Kurb Stone
Grass Paver
 */

// code to add products
