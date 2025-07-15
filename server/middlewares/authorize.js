// middlewares/authorize.js
module.exports = function authorize(...allowedRoles) {
  return (req, res, next) => {
    console.log('req.user.role', req.user.role)
    console.log('allowedRoles', allowedRoles)
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Access denied' })
    }
    next()
  }
}
