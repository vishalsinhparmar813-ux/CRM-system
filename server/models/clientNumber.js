const mongoose = require('mongoose')

const schema = mongoose.Schema(
	{
		_id: { type: String },
		clientNo: { type: Number },
	},
	{ timestamps: true }
)

module.exports = mongoose.model('clientNumber', schema) 