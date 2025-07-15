const mongoose = require('mongoose')
const Order = require('../models/order')
const logger = require('../utils/logger')
const {
	BadRequestError,
	InternalServerError,
	NotFoundError,
} = require('../error/error')
const uuid = require('uuid')
const OrderNumber = require('../models/orderNumber')
const orderStatusEnum = require('../enums/orderStatus')
const productUnitEnum = require('../enums/productUnits')
const clientController = require('../controllers/clientController')
const Product = require('../models/product') // <-- Ensure product model is registered

const createNewOrder = async (
	client,
	products,
	dueDate
) => {
	const session = await mongoose.startSession()
	session.startTransaction()

	try {
		logger.info('request received in order controller to create a new order (multi-product)')

		// Fetch and increment order number
		const orderNumberDoc = await OrderNumber.findOne({})
			.sort({ orderNo: -1 })
			.session(session)
		if (!orderNumberDoc) {
			logger.error('order number not found')
			throw new NotFoundError('Order number not found')
		}
		logger.info('order number fetched from DB')
		const orderNo = orderNumberDoc.orderNo + 1
		await OrderNumber.updateOne({}, { orderNo }, { session })
		logger.info('order number updated in DB')

		// Validate and calculate for each product
		let totalAmount = 0
		const processedProducts = []
		let totalQuantity = 0;
		let totalRemainingQuantity = 0;
		for (const p of products) {
			// Fetch product details
			const product = await Product.findById(p.productId)
			if (!product) throw new NotFoundError(`Product not found: ${p.productId}`)
			// Validate unitType
			if (!product.unitType || !p.unitType) throw new BadRequestError('Unit type missing')
			// Calculate amount (simple: ratePerUnit * quantity, can be extended)
			let amount = product.ratePerUnit * p.quantity
			let discountAmount = 0
			if (p.discount) {
				discountAmount = (amount * p.discount) / 100
				amount = amount - discountAmount
			}
			totalAmount += amount
			// Set remainingQuantity for each product
			const remainingQuantity = p.quantity;
			totalQuantity += p.quantity;
			totalRemainingQuantity += remainingQuantity;
			processedProducts.push({
				productId: p.productId,
				quantity: p.quantity,
				remainingQuantity,
				unitType: p.unitType,
				discount: p.discount || 0,
				amount,
			})
		}

		// Create the order
		const order = new Order({
			_id: uuid.v4(),
			orderNo: orderNo,
			date: new Date(),
			clientId: client._id,
			products: processedProducts,
			quantity: totalQuantity,
			remainingQuantity: totalRemainingQuantity,
			dueDate,
			status: orderStatusEnum.PENDING,
			// type, subOrders, transactions, txnStatus handled by schema defaults
		})
		console.log('order object created', order)

		const addition = await clientController.addOrderId(order._id, client._id)

		await order.save({ session })
		logger.info('order saved to DB')
		logger.info('order created successfully')
		await session.commitTransaction()
		session.endSession()

		logger.info('order created successfully with transaction')
		return { _id: order._id }
	} catch (error) {
		await session.abortTransaction()
		session.endSession()
		logger.error(`Error in creating order: ${error.message}`)
		throw error
	}
}

// get all orders
const getAllOrders = async (page = 1, limit = 10) => {
	try {
		const skip = (page - 1) * limit;
		
		// Get total count for pagination
		const totalOrders = await Order.countDocuments({});
		
		// Get paginated orders
		const orders = await Order.find({})
			.sort({ date: -1 }) // Sort by date descending (newest first)
			.skip(skip)
			.limit(limit)
			.lean();
			
		if (!orders) {
			logger.error('No orders found')
			throw new NotFoundError('No orders found')
		}

		// Gather all unique productIds
		const allProductIds = Array.from(new Set(orders.flatMap(order => order.products.map(p => p.productId))));
		const productsMap = {};
		if (allProductIds.length > 0) {
			const products = await Product.find({ _id: { $in: allProductIds } }, { _id: 1, name: 1, unitType: 1 });
			products.forEach(prod => {
				productsMap[prod._id] = { name: prod.name, unitType: prod.unitType };
			});
		}

		// Gather all unique clientIds
		const allClientIds = Array.from(new Set(orders.map(order => order.clientId)));
		const clientsMap = {};
		if (allClientIds.length > 0) {
			const clients = await require('../models/client').find({ _id: { $in: allClientIds } }, { _id: 1, name: 1 });
			clients.forEach(client => {
				clientsMap[client._id] = client.name;
			});
		}

		// Attach product and client details to each order
		const ordersWithProductDetails = orders.map(order => ({
			_id: order._id,
			orderNo: order.orderNo,
			date: order.date,
			clientId: order.clientId,
			clientName: clientsMap[order.clientId] || '-',
			products: order.products.map(p => ({
				productId: p.productId,
				productName: productsMap[p.productId]?.name || '-',
				unitType: productsMap[p.productId]?.unitType || p.unitType || '-',
				quantity: p.quantity,
				remainingQuantity: p.remainingQuantity,
				discount: p.discount,
				amount: p.amount,
			})),
			dueDate: order.dueDate,
			status: order.status,
			remQuantity: order.remQuantity,
			// Removed: subOrders, transactions, txnStatus, createdAt, updatedAt, __v
		}));

		logger.info('orders fetched from DB with product details')
		
		return {
			orders: ordersWithProductDetails,
			pagination: {
				currentPage: page,
				totalPages: Math.ceil(totalOrders / limit),
				totalOrders,
				hasNextPage: page < Math.ceil(totalOrders / limit),
				hasPrevPage: page > 1
			}
		}
	} catch (error) {
		logger.error(`Error in fetching orders: ${error.message}`)
		throw error
	}
}

// get order by id
const getOrderById = async (orderId) => {
	try {
		logger.info(
			`request received in order controller to get an order by id: ${orderId}`
		)
		const order = await Order.findOne(
			{ _id: orderId },
			{
				orderNo: 1,
				date: 1,
				clientId: 1,
				productId: 1,
				quantity: 1,
				remQuantity: 1,
				unitType: 1,
				status: 1,
				discount: 1,
				amount: 1,
				dueDate: 1,
				subOrders: 1,
				txnStatus: 1,
				transactions: 1,
			}
		)
		if (!order) {
			logger.error('order not found')
			throw new NotFoundError('Order not found')
		}
		logger.info('order fetched from DB')
		return order
	} catch (error) {
		logger.error(`Error in fetching order: ${error.message}`)
		throw error
	}
}

// get order by order number
const getOrderByOrderNo = async (orderNo) => {
	try {
		logger.info(
			`request received in order controller to get an order by order number: ${orderNo}`
		)
		const order = await Order.findOne(
			{ orderNo },
			{
				orderNo: 1,
				date: 1,
				clientId: 1,
				productId: 1,
				quantity: 1,
				remQuantity: 1,
				unitType: 1,
				status: 1,
			}
		)
		if (!order) {
			logger.error('order not found')
			throw new NotFoundError('Order not found')
		}
		logger.info('order fetched from DB')
		return order
	} catch (error) {
		logger.error(`Error in fetching order: ${error.message}`)
		throw error
	}
}

// get all orders by client id
const getAllOrdersByClientId = async (clientId) => {
	try {
		logger.info(
			`request received in order controller to get all orders by client id: ${clientId}`
		)
		const orders = await Order.find({ clientId })
			.populate('clientId', 'name')
			.populate('productId', 'name')
		if (!orders) {
			logger.error('No orders found')
			throw new NotFoundError('No orders found')
		}
		logger.info('orders fetched from DB')
		return orders
	} catch (error) {
		logger.error(`Error in fetching orders: ${error.message}`)
		throw error
	}
}

const deleteOrderById = async (id) => {
	const client = await Order.findOne(
		{_id: id},
		{clientId: 1,}
	)
	await clientController.deleteOrderId(id, client.clientId);
  	return await Order.findByIdAndDelete(id);
};

// In orderController.js
const updateOrderStatus = async (orderId, status) => {
  return await Order.findByIdAndUpdate(
    orderId,
    { status },
    { new: true, runValidators: true }
  );
};


const updateTXNStatus = async (orderId, transactionId, txnStatus) => {
	try{
		logger.info(`TXNSTATUS : ${txnStatus}`)
		await Order.findByIdAndUpdate(
			orderId,
			{ $push: { transactions: transactionId } },
			{ new: true, runValidators: true }
		);

		await Order.findByIdAndUpdate(
			orderId,
			{ txnStatus },
			{ new: true, runValidators: true }
		);

	}catch(error){
		logger.error(`Error in updating txn in orders: ${error.message}`)
		throw error
	}
}


const deleteTxnIdfromOrder = async(orderId, transactionId) => {
	await Order.findByIdAndUpdate(orderId, 
			{ $pull: { transactions: transactionId }}, 
			{ new: true, runValidators: true} 
		);
}

// get dashboard statistics
const getDashboardStats = async () => {
	try {
		logger.info('request received in order controller to get dashboard statistics')

		// Get counts using aggregation
		const stats = await Order.aggregate([
			{
				$group: {
					_id: null,
					totalOrders: { $sum: 1 },
					totalRevenue: { $sum: "$amount" },
					pendingOrders: {
						$sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] }
					},
					completedOrders: {
						$sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
					},
					dispatchedOrders: {
						$sum: { $cond: [{ $eq: ["$status", "DISPATCHED"] }, 1, 0] }
					},
					manufacturingOrders: {
						$sum: { $cond: [{ $eq: ["$status", "MANUFATURING"] }, 1, 0] }
					}
				}
			}
		]);

		// Get recent orders
		const recentOrders = await Order.find({})
			.sort({ date: -1 })
			.limit(5)
			.select('orderNo clientId productId quantity amount status date');

		logger.info('dashboard statistics fetched successfully')
		return {
			stats: stats[0] || {
				totalOrders: 0,
				totalRevenue: 0,
				pendingOrders: 0,
				completedOrders: 0,
				dispatchedOrders: 0,
				manufacturingOrders: 0
			},
			recentOrders
		}
	} catch (error) {
		logger.error(`Error in fetching dashboard stats: ${error.message}`)
		throw error
	}
}

const getOrderProductsByOrderNo = async (orderNo) => {
  const order = await Order.findOne({ orderNo }, { products: 1 });
  if (!order) throw new NotFoundError('Order not found');
  return order.products || [];
};

module.exports = {
	createNewOrder,
	getAllOrders,
	getOrderById,
	getOrderByOrderNo,
	getAllOrdersByClientId,
	deleteOrderById,
	updateOrderStatus,
	updateTXNStatus,
	deleteTxnIdfromOrder,
	getDashboardStats,
	getOrderProductsByOrderNo
}
