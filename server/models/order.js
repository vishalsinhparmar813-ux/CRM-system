const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
	productId: { type: String, required: true },
	quantity: { type: Number, required: true },
	remainingQuantity: { type: Number, required: true },
	unitType: { type: String, required: true },
	discount: { type: Number, default: 0 },
	amount: { type: Number, required: true },
}, { _id: false });

const schema = mongoose.Schema(
	{
		_id: { type: String, required: true, unique: true, index: true },
		orderNo: { type: Number, required: true, unique: true, index: true },
		date: { type: Date },
		clientId: { type: String },
		products: { type: [productSchema], required: true },
		quantity: { type: Number, default: 0 },
		remainingQuantity: {type: Number},
		dueDate: { type: Date, default: null },
		status: { type: String },
		type: { type: String },
		subOrders: { type: Array, default: [] },
		transactions: {type: Array, default: []},
		txnStatus: {type: String, default: "PENDING"},
	},
	{ timestamps: true }
)

module.exports = mongoose.model('order', schema)
