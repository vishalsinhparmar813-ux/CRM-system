// validators/authValidator.js
const Joi = require('joi')
const { VALID_ROLES } = require('../utils/roles')

const signupSchema = Joi.object({
	email: Joi.string().email().required(),
	password: Joi.string().min(6).required(),
	role: Joi.string()
		.valid(...VALID_ROLES)
		.required(),
})

const loginSchema = Joi.object({
	email: Joi.string().email().required(),
	password: Joi.string().required(),
})

module.exports = {
	signupSchema,
	loginSchema,
}
