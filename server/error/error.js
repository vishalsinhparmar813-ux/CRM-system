class InternalServerError extends Error {
    constructor(message) {
        super(message)
        this.name = 'InternalServerError'
        this.statusCode = 500
        this.message = message
    }
}
 
class BadRequestError extends Error {
    constructor(message) {
        super(message)
        this.name = 'BadRequestError'
        this.statusCode = 400
        this.message = message
    }
}
 
class NotFoundError extends Error {
    constructor(message) {
        super(message)
        this.name = 'NotFoundError'
        this.statusCode = 404
        this.message = message
    }
}
 
module.exports = {
    InternalServerError: InternalServerError,
    BadRequestError: BadRequestError,
    NotFoundError: NotFoundError,
}