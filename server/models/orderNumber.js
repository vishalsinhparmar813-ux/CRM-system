const mongoose = require('mongoose')

const schema = mongoose.Schema(
	{
		_id: { type: String },
		orderNo: { type: Number },
	},
	{ timestamps: true }
)

module.exports = mongoose.model('orderNumber', schema)