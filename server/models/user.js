// models/User.js
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, unique: true, index: true },
		password: { type: String, required: true },
		role: {
			type: String,
			enum: ['user', 'admin', 'sub-admin'],
			default: 'user',
		},
	},
	{ timestamps: true }
)

// Hash password before saving
userSchema.pre('save', async function (next) {
	if (!this.isModified('password')) return next()
	this.password = await bcrypt.hash(this.password, 10)
	next()
})

// Compare password
userSchema.methods.comparePassword = function (password) {
	return bcrypt.compare(password, this.password)
}

module.exports = mongoose.model('user', userSchema)
