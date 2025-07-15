// utils/roles.js
const VALID_ROLES = ['admin', 'sub-admin']

function isValidRole(role) {
	return VALID_ROLES.includes(role)
}

module.exports = {
	VALID_ROLES,
	isValidRole,
}
