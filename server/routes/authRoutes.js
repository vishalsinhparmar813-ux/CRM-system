const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/user')
const { signupSchema, loginSchema } = require('../validators/authValidator')
const validate = require('../middlewares/validate')
const router = express.Router()
const path = require('path')
require('dotenv').config({
    path: path.resolve(__dirname, `${process.env.NODE_ENV}.env`),
})

const generateToken = (user) => {
	return jwt.sign(
		{ id: user._id, email: user.email, role: user.role },
		process.env.JWT_SECRET,
		{ expiresIn: '1d' }
	)
}

router.post('/signup', validate(signupSchema), async (req, res) => {
	const { email, password, role } = req.body
	try {
		const existingUser = await User.findOne({ email })
		if (existingUser)
			return res.status(400).json({ message: 'User already exists' })

		const user = await User.create({ email, password, role })
		const token = generateToken(user)

		res.status(201).json({ token , role:user.role})
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message })
	}
})

router.post('/login', validate(loginSchema), async (req, res) => {
	const { email, password } = req.body
	try {
		const user = await User.findOne({ email })
		if (!user || !(await user.comparePassword(password))) {
			return res.status(401).json({ message: 'Invalid credentials' })
		}

		const token = generateToken(user)
		res.json({ token ,role:user.role})
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message })
	}
})

module.exports = router
