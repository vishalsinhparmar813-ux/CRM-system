const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
	productId: { type: String, required: true },
	quantity: { type: Number, required: true },
	remainingQuantity: { type: Number, required: true },
	unitType: { type: String, required: true },
	ratePrice: { type: Number, required: true },
	cashRate: { type: Number, default: null }, 
	amount: { type: Number, required: true },
}, { _id: false });

const schema = mongoose.Schema(
	{
		_id: { type: String, required: true, unique: true, index: true },
		orderNo: { type: Number, required: true, unique: true, index: true },
		date: { type: Date, default: Date.now },
		orderDate: { type: Date, default: Date.now },
		clientId: { type: String },
		products: { type: [productSchema], required: true },
		quantity: { type: Number, default: 0 },
		remainingQuantity: {type: Number},
		totalAmount: { type: Number, default: 0 },
		remainingAmount: { type: Number, default: 0 },  
		dueDate: { type: Date, default: null },
		status: { type: String },
		type: { type: String },
		subOrders: { type: Array, default: [] },
		transactions: {type: Array, default: []},
		txnStatus: {type: String, default: "PENDING"},
		gst: {
			type: String,
			required: false,
			default: ""
		}
	},
	{ timestamps: true }
)

module.exports = mongoose.model('order', schema)
