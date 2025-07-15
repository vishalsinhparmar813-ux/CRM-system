// middlewares/auth.js
const jwt = require('jsonwebtoken')
const path = require('path')
require('dotenv').config({
	path: path.resolve(__dirname, `${process.env.NODE_ENV}.env`),
})

module.exports = function authenticate(req, res, next) {
	const authHeader = req.headers.authorization

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res
			.status(401)
			.json({ message: 'Authorization token missing or invalid' })
	}

	const token = authHeader.split(' ')[1]

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET)
		req.user = decoded
		next()
	} catch (err) {
		res.status(401).json({ message: 'Invalid or expired token' })
	}
}
