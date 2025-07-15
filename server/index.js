// server.js
const express = require('express')
const cors = require('cors')
const app = express()
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const constants = require('./constants')
const path = require('path')
require('dotenv').config({
	path: path.resolve(__dirname, `${process.env.NODE_ENV}.env`),
})
const logger = require('./utils/logger')
const initializeOrderNumber = require('./init/initializeOrderNumber')
const initializeClientNumber = require('./init/initializeClientNumber')

const authRoutes = require('./routes/authRoutes')
const orderRoutes = require('./routes/orderRoutes')
const productRoutes = require('./routes/productRoutes')
const productGroupRoutes = require('./routes/productGroupRoutes')
const clientRoutes = require('./routes/clientRoutes')
const subOrderRoutes = require('./routes/subOrderRoutes')
const transactionRoutes = require('./routes/transactionRoutes')

const SERVER_PORT = 3010
const MONGO_URI = constants.MONGO_CONNECTION_URI
app.use(cors());
app.use(bodyParser.json())

app.use('/auth', authRoutes)
app.use('/order', orderRoutes)
app.use('/product', productRoutes)
app.use('/productGroup', productGroupRoutes)
app.use('/client', clientRoutes)
app.use('/sub-order', subOrderRoutes)
app.use('/transaction', transactionRoutes)


app.use((req, res, next) => {
	res.header('Access-Control-Allow-Methods', 'GET, POST')
	next()
})
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*')
	res.header(
		'Access-Control-Allow-Headers',
		'Origin, X-Requested-With, Content-Type, Accept'
	)
	next()
})

logger.info(`Connecting to DB at ${MONGO_URI}`)
logger.info(`Running in ${constants.NODE_ENV} mode`)

mongoose
	.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
	.then(() => {
		logger.info(`Connected to DB`)
		app.listen(SERVER_PORT, async () => {
			logger.info(`Server started on port ${SERVER_PORT}`)

			logger.info('Initializing order number...')
			await initializeOrderNumber()
			logger.info('Order number initialized.')

			logger.info('Initializing client number...')
			await initializeClientNumber()
			logger.info('Client number initialized.')
		})
	})
	.catch((err) => logger.error('DB connection failed:', err))
