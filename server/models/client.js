const mongoose = require('mongoose')

const schema = mongoose.Schema(
	{
		_id: { type: String, required: true, unique: true, index: true },
		clientNo: { type: Number, required: true, unique: true, index: true },
		name: { type: String, required: true },
		alias: { type: String, default: '' },
		email: { type: String, required: false, default: null, unique: true, sparse: true },
		/**email have been not required
		 * 1. mobile number temporaraily set to the following value
		 *	 	mobile: { type: String, required: false, default: null, unique: false }
		 * 2. even than it demands for unique value
		 */
		mobile: {
			type: String,
			required: false,
			default: null,
			unique: false,
			index: true,
		},
		correspondenceAddress: {
			country: { type: String, default: '' },
			state: { type: String, default: '' },
			city: { type: String, default: '' },
			area: { type: String, default: '' },
			postalCode: { type: String, default: '' },
			landmark: { type: String, default: '' },
		},
		permanentAddress: {
			country: { type: String, default: '' },
			state: { type: String, default: '' },
			city: { type: String, default: '' },
			area: { type: String, default: '' },
			postalCode: { type: String, default: '' },
			landmark: { type: String, default: '' },
		},
		orders: {type: Array, default: []},
	},
	{ timestamps: true }
)

module.exports = mongoose.model('client', schema)
