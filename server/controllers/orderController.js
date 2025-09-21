const mongoose = require('mongoose');
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
const Client = require('../models/client') // <-- Add proper client model import
const { generateClientLedgerPDF, generateOrderReceiptPDF, getUnitLabel } = require('../utils/pdfGenerator')
const { autoAllocateAdvancedPayments } = require('../utils/advancedPaymentAllocation')

const createNewOrder = async (
	client,
	products,
	dueDate,
	orderDate,
	gst,
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
			// Calculate amount using custom rate price instead of product's default rate
			let amount = p.ratePrice * p.quantity
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
				ratePrice: p.ratePrice,
							 // Initially, remaining amount equals total amount
                cashRate: p.cashRate ?? null,   // fixed
				amount,
			})
		}

		// Create the order
		const order = new Order({
			_id: uuid.v4(),
			orderNo: orderNo,
			date: new Date(),
			orderDate: orderDate ? new Date(orderDate) : new Date(),
			clientId: client._id,
			products: processedProducts,
			quantity: totalQuantity,
			remainingQuantity: totalRemainingQuantity,
			totalAmount: totalAmount,
			remainingAmount: totalAmount,
			dueDate,
			status: orderStatusEnum.PENDING,
			gst,
			// type, subOrders, transactions, txnStatus handled by schema defaults
		})
		console.log('order object created', order)

		const addition = await clientController.addOrderId(order._id, client._id)

		await order.save({ session })
		logger.info('order saved to DB')
		
		// Auto-allocate available advanced payments to this new order
		try {
			const allocatedAmount = await autoAllocateAdvancedPayments(client._id, order._id, order, session);
			if (allocatedAmount > 0) {
				// Update order's remaining amount after auto-allocation
				order.remainingAmount = Math.max(0, order.totalAmount - allocatedAmount);
				await order.save({ session });
				logger.info(`Auto-allocated ${allocatedAmount} from advanced payments to order ${order.orderNo}`);
			}
		} catch (allocationError) {
			logger.error(`Error in auto-allocation: ${allocationError.message}`);
			// Continue with order creation even if allocation fails
		}
		
		logger.info('order created successfully')
		await session.commitTransaction()
		session.endSession()

		logger.info('order created successfully with transaction')
		return { _id: order._id, orderNo: order.orderNo }
	} catch (error) {
		await session.abortTransaction()
		session.endSession()
		logger.error(`Error in creating order: ${error.message}`)
		throw error
	}
}

// get all orders grouped by client
const getOrdersGroupedByClient = async (page = 1, limit = 10) => {
	try {
		const skip = (page - 1) * limit;
		
		// Get all orders with client and product details
		const allOrders = await Order.find({})
			.sort({ date: -1 })
			.lean();
			
		if (!allOrders || allOrders.length === 0) {
			logger.error('No orders found')
			throw new NotFoundError('No orders found')
		}

		// Gather all unique productIds and clientIds
		const allProductIds = Array.from(new Set(allOrders.flatMap(order => order.products.map(p => p.productId))));
		const allClientIds = Array.from(new Set(allOrders.map(order => order.clientId).filter(Boolean)));
		
		// Create maps for products and clients
		const productsMap = {};
		const clientsMap = {};
		
		if (allProductIds.length > 0) {
			const products = await Product.find({ _id: { $in: allProductIds } }, { _id: 1, name: 1, unitType: 1 });
			products.forEach(prod => {
				productsMap[prod._id] = { name: prod.name, unitType: prod.unitType };
			});
		}

		if (allClientIds.length > 0) {
			try {
				const clients = await Client.find({ _id: { $in: allClientIds } }, { _id: 1, name: 1, alias: 1, email: 1, mobile: 1 });
				clients.forEach(client => {
					clientsMap[client._id] = client;
				});
			} catch (error) {
				logger.error(`Failed to fetch clients: ${error.message}`);
			}
		}

		// Group orders by client
		const clientGroups = {};
		
		allOrders.forEach(order => {
			const clientId = order.clientId;
			if (!clientId) return; // Skip orders without client
			
			if (!clientGroups[clientId]) {
				const client = clientsMap[clientId];
				clientGroups[clientId] = {
					clientId: clientId,
					clientName: client?.name || `Client ID: ${clientId}`,
					clientAlias: client?.alias || '',
					clientEmail: client?.email || '',
					clientMobile: client?.mobile || '',
					orders: [],
					totalOrders: 0,
					totalAmount: 0,
					remainingAmount: 0,
					lastOrderDate: null
				};
			}
			
			// Add order details
			const orderWithDetails = {
				_id: order._id,
				orderNo: order.orderNo,
				date: order.date,
				products: order.products.map(p => ({
					productId: p.productId,
					productName: productsMap[p.productId]?.name || '-',
					unitType: productsMap[p.productId]?.unitType || p.unitType || '-',
					quantity: p.quantity,
					remainingQuantity: p.remainingQuantity,
					ratePrice: p.ratePrice,
					amount: p.amount,
				})),
				dueDate: order.dueDate,
				status: order.status,
				totalAmount: order.totalAmount || 0,
				remainingAmount: order.remainingAmount || 0,
				txnStatus: order.txnStatus || 'PENDING',
			};
			
			clientGroups[clientId].orders.push(orderWithDetails);
			clientGroups[clientId].totalOrders += 1;
			clientGroups[clientId].totalAmount += (order.totalAmount || 0);
			clientGroups[clientId].remainingAmount += (order.remainingAmount || 0);
			
			// Update last order date
			if (!clientGroups[clientId].lastOrderDate || new Date(order.date) > new Date(clientGroups[clientId].lastOrderDate)) {
				clientGroups[clientId].lastOrderDate = order.date;
			}
		});

		// Convert to array and sort by last order date (newest first)
		const clientGroupsArray = Object.values(clientGroups).sort((a, b) => 
			new Date(b.lastOrderDate) - new Date(a.lastOrderDate)
		);

		// Apply pagination
		const totalClients = clientGroupsArray.length;
		const paginatedClients = clientGroupsArray.slice(skip, skip + limit);

		logger.info('orders grouped by client fetched from DB')
		
		return {
			clients: paginatedClients,
			pagination: {
				currentPage: page,
				totalPages: Math.ceil(totalClients / limit),
				totalClients,
				hasNextPage: page < Math.ceil(totalClients / limit),
				hasPrevPage: page > 1
			}
		}
	} catch (error) {
		logger.error(`Error in fetching orders grouped by client: ${error.message}`)
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
		const allClientIds = Array.from(new Set(orders.map(order => order.clientId).filter(Boolean)));
		const clientsMap = {};
		if (allClientIds.length > 0) {
			try {
				const clients = await Client.find({ _id: { $in: allClientIds } }, { _id: 1, name: 1 });
				clients.forEach(client => {
					clientsMap[client._id] = client.name;
				});
				
				// Check for missing clients
				const missingClientIds = allClientIds.filter(id => !clientsMap[id]);
				if (missingClientIds.length > 0) {
					logger.warn(`Missing clients for IDs: ${missingClientIds.join(', ')}`);
				}
			} catch (error) {
				logger.error(`Failed to fetch clients: ${error.message}`);
				// Continue with empty clientsMap
			}
		}

		// Attach product and client details to each order
		const ordersWithProductDetails = orders.map(order => {
			let clientName = clientsMap[order.clientId];
			if (!clientName) {
				if (!order.clientId) {
					clientName = 'No Client Assigned';
				} else {
					clientName = `Client ID: ${order.clientId}`;
				}
			}
			return {
				_id: order._id,
				orderNo: order.orderNo,
				date: order.date,
				orderDate: order.orderDate,
				clientId: order.clientId,
				clientName: clientName,
				products: order.products.map(p => ({
					productId: p.productId,
					productName: productsMap[p.productId]?.name || '-',
					unitType: productsMap[p.productId]?.unitType || p.unitType || '-',
					quantity: p.quantity,
					remainingQuantity: p.remainingQuantity,
					ratePrice: p.ratePrice,
					cashRate:p.cashRate,
					amount: p.amount,
				})),
				dueDate: order.dueDate,
				status: order.status,
				totalAmount: order.totalAmount || 0,
				remainingAmount: order.remainingAmount || 0,
				txnStatus: order.txnStatus || 'PENDING',
				// Removed: subOrders, transactions, createdAt, updatedAt, __v
			};
		});

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
				orderDate: 1,
				clientId: 1,
				products: 1,
				quantity: 1,
				remainingQuantity: 1,
				totalAmount: 1,
				remainingAmount: 1,
				status: 1,
				dueDate: 1,
				subOrders: 1,
				txnStatus: 1,
				transactions: 1,
				gst: 1,
			}
		).lean();
		
		if (!order) {
			logger.error('order not found')
			throw new NotFoundError('Order not found')
		}

		// Get client details
		let clientName = 'Unknown Client';
		if (order.clientId) {
			try {
				const client = await Client.findById(order.clientId, { name: 1 }).lean();
				if (client) {
					clientName = client.name;
				}
			} catch (error) {
				logger.error(`Failed to fetch client: ${error.message}`);
			}
		}

		// Get product details
		let productsWithDetails = [];
		if (order.products && order.products.length > 0) {
			try {
				const productIds = order.products.map(p => p.productId).filter(Boolean);
				if (productIds.length > 0) {
					const products = await Product.find({ _id: { $in: productIds } }, { _id: 1, name: 1, unitType: 1, alternateUnits: 1, numberOfUnits: 1 }).lean();
					const productsMap = {};
					products.forEach(prod => {
						productsMap[prod._id] = { 
							name: prod.name, 
							unitType: prod.unitType,
							numberOfItems: prod.alternateUnits?.numberOfItems || prod.numberOfUnits || 1
						};
					});

					productsWithDetails = order.products.map(product => ({
						...product,
						productName: productsMap[product.productId]?.name || 'Unknown Product',
						unitType: productsMap[product.productId]?.unitType || product.unitType || 'N/A',
						numberOfItems: productsMap[product.productId]?.numberOfItems || 1
					}));
				} else {
					productsWithDetails = order.products;
				}
			} catch (error) {
				logger.error(`Failed to fetch products: ${error.message}`);
				productsWithDetails = order.products;
			}
		}

		// Get transaction details if any
		let transactionsWithDetails = [];
		if (order.transactions && order.transactions.length > 0) {
			try {
				const Transaction = require('../models/transaction');
				const transactions = await Transaction.find({ _id: { $in: order.transactions } }).lean();
				transactionsWithDetails = transactions;
			} catch (error) {
				logger.error(`Failed to fetch transactions: ${error.message}`);
			}
		}

		const orderWithDetails = {
			...order,
			clientName,
			products: productsWithDetails,
			transactions: transactionsWithDetails
		};

		logger.info('order fetched from DB with details')
		return orderWithDetails
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
				orderDate: 1,
				clientId: 1,
				products: 1,
				quantity: 1,
				remainingQuantity: 1,
				status: 1,
				gst: 1,
				totalAmount: 1,
				_id: 1
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
			.sort({ date: -1 })
			.lean();
			
		if (!orders || orders.length === 0) {
			logger.error('No orders found')
			throw new NotFoundError('No orders found')
		}

		// Get all unique product IDs
		const allProductIds = Array.from(new Set(orders.flatMap(order => order.products.map(p => p.productId))));
		const productsMap = {};
		
		if (allProductIds.length > 0) {
			const products = await Product.find({ _id: { $in: allProductIds } }, { _id: 1, name: 1, unitType: 1 });
			products.forEach(prod => {
				productsMap[prod._id] = { name: prod.name, unitType: prod.unitType };
			});
		}

		// Transform orders to include product names
		const ordersWithProductDetails = orders.map(order => ({
			...order,
			products: order.products.map(product => ({
				...product,
				productName: productsMap[product.productId]?.name || 'Unknown Product'
			}))
		}));

		logger.info('orders fetched from DB with product details')
		return ordersWithProductDetails
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

// Close order (Admin only)
const closeOrder = async (orderId) => {
  try {
    logger.info(`request received in order controller to close order: ${orderId}`);
    
    const order = await Order.findById(orderId);
    if (!order) {
      logger.error('order not found');
      throw new NotFoundError('Order not found');
    }

    // Check if order is already closed
    if (order.status === 'CLOSED') {
      throw new BadRequestError('Order is already closed');
    }

    // Update order status to CLOSED
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status: 'CLOSED' },
      { new: true, runValidators: true }
    );

    logger.info('order closed successfully');
    return updatedOrder;
  } catch (error) {
    logger.error(`Error in closing order: ${error.message}`);
    throw error;
  }
};


// Update order by ID (production-ready with transactions)
const updateOrderById = async (orderId, updateData) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		logger.info(`request received in order controller to update order: ${orderId}`);

		// Validate order exists
		const existingOrder = await Order.findById(orderId).session(session);
		if (!existingOrder) {
			logger.error('order not found');
			throw new NotFoundError('Order not found');
		}

		// Validate client if provided
		if (updateData.clientId && updateData.clientId !== existingOrder.clientId.toString()) {
			const client = await Client.findById(updateData.clientId).session(session);
			if (!client) {
				logger.error('client not found');
				throw new NotFoundError('Client not found');
			}
		}

		// Process products if provided
		let processedProducts = existingOrder.products;
		let totalAmount = existingOrder.totalAmount;
		
		if (updateData.products && Array.isArray(updateData.products)) {
			processedProducts = [];
			totalAmount = 0;

			for (const p of updateData.products) {
				// Validate product exists
				const product = await Product.findById(p.productId).session(session);
				if (!product) {
					throw new NotFoundError(`Product not found: ${p.productId}`);
				}

				// Validate required fields
				if (!p.quantity || p.quantity <= 0) {
					throw new BadRequestError('Quantity is required and must be > 0');
				}
				if (!p.ratePrice || p.ratePrice <= 0) {
					throw new BadRequestError('Rate price is required and must be > 0');
				}
				if (!p.unitType) {
					throw new BadRequestError('Unit type is required');
				}

				const amount = parseFloat(p.quantity) * parseFloat(p.ratePrice);
				totalAmount += amount;

				processedProducts.push({
					productId: p.productId,
					quantity: parseFloat(p.quantity),
					remainingQuantity: parseFloat(p.quantity), // Initialize remaining quantity to full quantity
					unitType: p.unitType,
					ratePrice: parseFloat(p.ratePrice),
					cashRate: p.cashRate ? parseFloat(p.cashRate) : null,
					amount: amount
				});
			}

			// Apply GST if provided
			if (updateData.gst && parseFloat(updateData.gst) > 0) {
				const gstAmount = (totalAmount * parseFloat(updateData.gst)) / 100;
				totalAmount += gstAmount;
			} else if (existingOrder.gst && parseFloat(existingOrder.gst) > 0) {
				const gstAmount = (totalAmount * parseFloat(existingOrder.gst)) / 100;
				totalAmount += gstAmount;
			}
		}

		// Calculate total quantities
		let totalQuantity = 0;
		let totalRemainingQuantity = 0;
		if (updateData.products) {
			processedProducts.forEach(p => {
				totalQuantity += p.quantity;
				totalRemainingQuantity += p.remainingQuantity;
			});
		}

		// Prepare update object with only changed fields
		const updateFields = {
			updatedAt: new Date()
		};

		if (updateData.clientId) updateFields.clientId = updateData.clientId;
		if (updateData.products) {
			updateFields.products = processedProducts;
			updateFields.totalAmount = totalAmount;
			updateFields.quantity = totalQuantity;
			updateFields.remainingQuantity = totalRemainingQuantity;
			updateFields.remainingAmount = totalAmount; // Reset remaining amount to total when order is updated
		}
		if (updateData.dueDate !== undefined) {
			updateFields.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
		}
		if (updateData.orderDate) updateFields.orderDate = new Date(updateData.orderDate);
		if (updateData.gst !== undefined) updateFields.gst = updateData.gst ? parseFloat(updateData.gst) : null;

		// Update the order
		const updatedOrder = await Order.findByIdAndUpdate(
			orderId,
			updateFields,
			{ new: true, runValidators: true, session }
		);

		if (!updatedOrder) {
			throw new InternalServerError('Failed to update order');
		}

		await session.commitTransaction();
		logger.info('order updated successfully');
		return updatedOrder;

	} catch (error) {
		await session.abortTransaction();
		logger.error(`Error in updating order: ${error.message}`);
		throw error;
	} finally {
		session.endSession();
	}
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

// New method to update order with transaction details
const updateOrderWithTransaction = async (orderId, transactionId, remainingAmount, txnStatus, session) => {
	try{
		logger.info(`Updating order ${orderId} with transaction ${transactionId}, remaining amount: ${remainingAmount}, status: ${txnStatus}`)
		
		await Order.findByIdAndUpdate(
			orderId,
			{ 
				$push: { transactions: transactionId },
				remainingAmount: Math.max(0, remainingAmount), // Ensure remaining amount doesn't go below 0
				txnStatus 
			},
			{ new: true, runValidators: true, session }
		);

		logger.info('Order updated successfully with transaction details')
	}catch(error){
		logger.error(`Error in updating order with transaction: ${error.message}`)
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
					totalRevenue: { $sum: "$totalAmount" },
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
			.select('orderNo clientId products quantity status date totalAmount remainingAmount txnStatus');

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

  if (!order.products || order.products.length === 0) return [];

  const productIds = order.products.map(p => p.productId);

  // fetch product details
  const products = await Product.find({ _id: { $in: productIds } }).lean();

  const productMap = {};
  products.forEach(prod => {
    productMap[prod._id] = prod;
  });

  // merge with order products
  return order.products.map(p => ({
    ...p.toObject(),
    productName: productMap[p.productId]?.name || 'UNKNOWN PRODUCT',
    unitType: p.unitType || productMap[p.productId]?.unitType || '',
    ratePrice: p.ratePrice || productMap[p.productId]?.ratePerUnit || 0,
    numberOfItems: productMap[p.productId]?.alternateUnits?.numberOfItems || productMap[p.productId]?.numberOfUnits || 1
  }));
};


// Get all orders with transactions included
const getAllOrdersWithTransactions = async (page = 1, limit = 10) => {
	try {
		logger.info('request received in order controller to get all orders with transactions')
		
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
		const allClientIds = Array.from(new Set(orders.map(order => order.clientId).filter(Boolean)));
		const clientsMap = {};
		if (allClientIds.length > 0) {
			try {
				const clients = await Client.find({ _id: { $in: allClientIds } }, { _id: 1, name: 1 });
				clients.forEach(client => {
					clientsMap[client._id] = client.name;
				});
				
				// Check for missing clients
				const missingClientIds = allClientIds.filter(id => !clientsMap[id]);
				if (missingClientIds.length > 0) {
					logger.warn(`Missing clients for IDs: ${missingClientIds.join(', ')}`);
				}
			} catch (error) {
				logger.error(`Failed to fetch clients: ${error.message}`);
				// Continue with empty clientsMap
			}
		}

		// Gather all transaction IDs from all orders
		const allTransactionIds = Array.from(new Set(orders.flatMap(order => order.transactions || [])));
		const transactionsMap = {};
		if (allTransactionIds.length > 0) {
			try {
				const Transaction = require('../models/transaction');
				const transactions = await Transaction.find({ _id: { $in: allTransactionIds } }).lean();
				transactions.forEach(txn => {
					transactionsMap[txn._id] = txn;
				});
			} catch (error) {
				logger.error(`Failed to fetch transactions: ${error.message}`);
				// Continue with empty transactionsMap
			}
		}

		// Attach product, client, and transaction details to each order
		const ordersWithDetails = orders.map(order => {
			let clientName = clientsMap[order.clientId];
			if (!clientName) {
				if (!order.clientId) {
					clientName = 'No Client Assigned';
				} else {
					clientName = `Client ID: ${order.clientId}`;
				}
			}
			
			// Get transactions for this order
			const orderTransactions = (order.transactions || [])
				.map(txnId => transactionsMap[txnId])
				.filter(txn => txn); // Remove any null/undefined transactions
			
			return {
				_id: order._id,
				orderNo: order.orderNo,
				date: order.date,
				orderDate: order.orderDate,
				clientId: order.clientId,
				clientName: clientName,
				products: order.products.map(p => ({
					productId: p.productId,
					productName: productsMap[p.productId]?.name || '-',
					unitType: productsMap[p.productId]?.unitType || p.unitType || '-',
					quantity: p.quantity,
					remainingQuantity: p.remainingQuantity,
					ratePrice: p.ratePrice,
					amount: p.amount,
				})),
				dueDate: order.dueDate,
				status: order.status,
				totalAmount: order.totalAmount || 0,
				remainingAmount: order.remainingAmount || 0,
				txnStatus: order.txnStatus || 'PENDING',
				transactions: orderTransactions, // Include actual transaction objects
				// Removed: subOrders, createdAt, updatedAt, __v
			};
		});

		logger.info('orders with transactions fetched from DB')
		
		return {
			orders: ordersWithDetails,
			pagination: {
				currentPage: page,
				limit,
				totalPages: Math.ceil(totalOrders / limit),
				totalOrders,
				hasNextPage: page < Math.ceil(totalOrders / limit),
				hasPrevPage: page > 1
			}
		}
	} catch (error) {
		logger.error(`Error in fetching orders with transactions: ${error.message}`)
		throw error
	}
};

const getOrdersByClientId = async (clientId, page = 1, limit = 10) => {
	try {
		logger.info(`Fetching orders for client: ${clientId}`)
		
		const skip = (page - 1) * limit
		const orders = await Order.find({ clientId: clientId })
			.populate('clientId', 'name email mobile')
			.sort({ date: -1 }) // Newest first
			.skip(skip)
			.limit(parseInt(limit))
			.lean()

		if (!orders || orders.length === 0) {
			logger.info(`No orders found for client: ${clientId}`)
			return []
		}

		// Populate product names for each order
		for (let order of orders) {
			if (order.products && order.products.length > 0) {
				for (let product of order.products) {
					try {
						const productDetails = await Product.findById(product.productId).lean()
						if (productDetails) {
							product.productName = productDetails.name
							product.productAlias = productDetails.alias
						} else {
							product.productName = `Product ${product.productId}`
						}
					} catch (err) {
						logger.warn(`Failed to fetch product details for ${product.productId}: ${err.message}`)
						product.productName = `Product ${product.productId}`
					}
				}
			}
		}

		logger.info(`Found ${orders.length} orders for client: ${clientId}`)
		return orders
	} catch (error) {
		logger.error(`Error fetching orders by client ID: ${error.message}`)
		throw new InternalServerError('Failed to fetch orders by client ID')
	}
}

const generateOrderReceiptPDFController = async (orderIds, clientId) => {
  try {
    logger.info(`request received in order controller to generate order receipt PDF for orders: ${orderIds}`);
    
    // Convert single orderId to array
    const orderIdArray = Array.isArray(orderIds) ? orderIds : [orderIds];
    
    // Fetch client data
    const client = await Client.findById(clientId);
    if (!client) {
      logger.error('client not found');
      throw new NotFoundError('Client not found');
    }

    // Fetch orders with product details
    const orders = await Order.find({ _id: { $in: orderIdArray } }).lean();
    if (!orders || orders.length === 0) {
      logger.error('No orders found');
      throw new NotFoundError('No orders found');
    }

    // Fetch product details for all orders
    const allProductIds = Array.from(new Set(orders.flatMap(order => order.products.map(p => p.productId))));
    const productsMap = {};
    
    if (allProductIds.length > 0) {
      const products = await Product.find({ _id: { $in: allProductIds } }, { _id: 1, name: 1, unitType: 1 });
      products.forEach(prod => {
        productsMap[prod._id] = { 
          name: prod.name, 
          unitType: prod.unitType,
          unitTypeLabel: getUnitLabel(prod.unitType)
        };
      });
    }

    // Fetch transactions for all orders
    const Transaction = require('../models/transaction');
    const orderIdsArray = orders.map(order => order._id);
    const transactions = await Transaction.find({ 
      orderId: { $in: orderIdsArray } 
    }).sort({ date: -1 });

    // Group transactions by orderId
    const transactionsByOrder = {};
    transactions.forEach(txn => {
      if (!transactionsByOrder[txn.orderId]) {
        transactionsByOrder[txn.orderId] = [];
      }
      transactionsByOrder[txn.orderId].push(txn);
    });

    // Add product details and transaction data to orders
    const ordersWithDetails = orders.map(order => {
      const orderTransactions = transactionsByOrder[order._id] || [];
      const totalPaid = orderTransactions.reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
      
      return {
        ...order,
        products: order.products.map(p => ({
          ...p,
          productName: productsMap[p.productId]?.name || 'Unknown Product',
          unitType: productsMap[p.productId]?.unitType || p.unitType || 'N/A',
          unitTypeLabel: productsMap[p.productId]?.unitTypeLabel || getUnitLabel(p.unitType) || '-'
        })),
        transactions: orderTransactions,
        totalPaid,
        remainingAmount: Number(order.totalAmount || 0) - totalPaid
      };
    });

    // Format client data for PDF
    const clientData = {
      name: client.name,
      mobile: client.mobile || '',
      email: client.email || ''
    };

    logger.info(`Generating order receipt PDF for client: ${clientData.name} with ${ordersWithDetails.length} orders`);

    // Import the PDF generator function
    const { generateOrderReceiptPDF } = require('../utils/pdfGenerator');
    
    // Generate PDF
    const pdfBuffer = await generateOrderReceiptPDF(ordersWithDetails, clientData);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF generation failed - empty buffer');
    }

    logger.info('order receipt PDF generated successfully');
    return pdfBuffer;
  } catch (error) {
    logger.error(`Error in generating order receipt PDF: ${error.message}`);
    throw error;
  }
};

const generateClientLedgerPDFController = async (clientId) => {
  try {
    logger.info(`request received in order controller to generate client ledger PDF for client: ${clientId}`);
    
    // Fetch client data
    const client = await Client.findById(clientId);
    if (!client) {
      logger.error('client not found');
      throw new NotFoundError('Client not found');
    }

    // Fetch orders with product details
    const orders = await getAllOrdersByClientId(clientId);
    if (!orders || orders.length === 0) {
      logger.error('No orders found for client');
      throw new NotFoundError('No orders found for this client');
    }

    // Fetch transactions for all orders
    const Transaction = require('../models/transaction');
    const orderIds = orders.map(order => order._id);
    const transactions = await Transaction.find({ 
      orderId: { $in: orderIds } 
    }).sort({ date: -1 });

    // Fetch advanced payments for the client
    const AdvancedPayment = require('../models/advancedPayment');
    const advancedPayments = await AdvancedPayment.find({ 
      clientId: clientId 
    }).sort({ date: -1 });

    // Fetch dispatch data for all orders
    const SubOrder = require('../models/subOrder');
    const dispatches = await SubOrder.find({
      orderId: { $in: orderIds },
      isDispatchInvoice: true
    }).sort({ dispatchDate: -1 });

    logger.info(`Found ${transactions.length} transactions and ${dispatches.length} dispatches for ${orders.length} orders`);

    // Group transactions by orderId
    const transactionsByOrder = {};
    transactions.forEach(txn => {
      if (!transactionsByOrder[txn.orderId]) {
        transactionsByOrder[txn.orderId] = [];
      }
      transactionsByOrder[txn.orderId].push(txn);
    });

    // Group dispatches by orderId
    const dispatchesByOrder = {};
    dispatches.forEach(dispatch => {
      if (!dispatchesByOrder[dispatch.orderId]) {
        dispatchesByOrder[dispatch.orderId] = [];
      }
      dispatchesByOrder[dispatch.orderId].push(dispatch);
    });

    // Calculate total advanced payment amount
    const totalAdvancedAmount = advancedPayments.reduce((sum, ap) => sum + Number(ap.amount || 0), 0);

    // Add transaction and dispatch data to orders
    const ordersWithTransactions = orders.map(order => {
      const orderTransactions = transactionsByOrder[order._id] || [];
      const orderDispatches = dispatchesByOrder[order._id] || [];
      const totalPaid = orderTransactions.reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
      const remainingAmount = Number(order.totalAmount || 0) - totalPaid;
      
      return {
        ...order,
        transactions: orderTransactions,
        dispatches: orderDispatches,
        totalPaid,
        remainingAmount,
        paymentStatus: remainingAmount <= 0 ? 'Paid' : remainingAmount === Number(order.totalAmount || 0) ? 'Unpaid' : 'Partial'
      };
    });

    // Format client data for PDF with advanced payments
    const clientDataForPDF = {
      name: client.name,
      mobile: client.mobile || '',
      email: client.email || '',
      advancedPayments: advancedPayments,
      totalAdvancedAmount: totalAdvancedAmount
    };

    logger.info(`Generating PDF for client: ${clientDataForPDF.name} with ${ordersWithTransactions.length} orders and transaction data`);

    // Generate PDF with transaction data
    const pdfBuffer = await generateClientLedgerPDF(clientDataForPDF, ordersWithTransactions);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF generation failed - empty buffer');
    }

    logger.info('client ledger PDF generated successfully');
    return pdfBuffer;
  } catch (error) {
    logger.error(`Error in generating client ledger PDF: ${error.message}`);
    throw error;
  }
};

module.exports = {
	createNewOrder,
	getAllOrders,
	getAllOrdersWithTransactions,
	getOrdersGroupedByClient,
	getOrderById,
	getOrderByOrderNo,
	getAllOrdersByClientId,
	getOrdersByClientId,
	deleteOrderById,
	updateOrderStatus,
	closeOrder,
	updateTXNStatus,
	updateOrderWithTransaction,
	deleteTxnIdfromOrder,
	getDashboardStats,
	getOrderProductsByOrderNo,
	generateClientLedgerPDFController,
	generateOrderReceiptPDFController,
	updateOrderById
}
