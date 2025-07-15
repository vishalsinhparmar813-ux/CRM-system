const path = require('path')
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('dotenv').config({
	path: path.resolve(__dirname, `${process.env.NODE_ENV}.env`),
})

module.exports = {
	NODE_ENV: process.env.NODE_ENV,
	MONGO_CONNECTION_URI: process.env.MONGO_CONNECTION_URI,
	AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
	AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
	AWS_REGION: process.env.AWS_REGION,
	AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
}