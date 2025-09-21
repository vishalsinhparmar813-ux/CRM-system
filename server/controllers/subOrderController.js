const mongoose = require('mongoose')
const Order = require('../models/order')
const SubOrder = require('../models/subOrder')
const logger = require('../utils/logger');


const {
	BadRequestError,
	InternalServerError,
	NotFoundError,
} = require('../error/error')
const uuid = require('uuid')
const OrderNumber = require('../models/orderNumber')
const orderStatusEnum = require('../enums/orderStatus')
const productUnitEnum = require('../enums/productUnits')

// Helper function to check and mark order as COMPLETED or PENDING
const checkAndMarkOrderAsCompleted = async (orderId, session = null) => {
    try {
        logger.info(`🔍 Checking order completion for order: ${orderId}`);
        
        const order = await Order.findById(orderId).session(session);
        if (!order) {
            logger.error(`❌ Order not found for completion check: ${orderId}`);
            return false;
        }

        logger.info(`📊 Order ${orderId} (Order No: ${order.orderNo}) - Current status: ${order.status}, Remaining quantity: ${order.remainingQuantity}`);

        // Fetch all sub-orders for this order
        const allSubOrders = await SubOrder.find({ orderId: order._id }).session(session);
        logger.info(`📋 Order ${orderId} has ${allSubOrders.length} sub-orders`);
        
        // Check if there are any sub-orders
        if (allSubOrders.length === 0) {
            logger.info(`⚠️ Order ${orderId} (Order No: ${order.orderNo}) has no sub-orders, not marking as completed`);
            return false;
        }

        const completedSubOrders = allSubOrders.filter(so => so.status === "COMPLETED");
        const allCompleted = allSubOrders.every(so => so.status === "COMPLETED");
        
        logger.info(`📈 Sub-orders status: ${completedSubOrders.length}/${allSubOrders.length} completed`);
        
        // Check if order should be marked as COMPLETED
        if (allCompleted && order.remainingQuantity === 0) {
            if (order.status !== "COMPLETED") {
                order.status = "COMPLETED";
                await order.save({ session });
                logger.info(`✅ Order ${orderId} (Order No: ${order.orderNo}) marked as COMPLETED - all sub-orders completed and remaining quantity is 0`);
                return true;
            }
        } else {
            // If not all sub-orders are completed, mark order as PENDING
            if (order.status === "COMPLETED") {
                order.status = "PENDING";
                await order.save({ session });
                logger.info(`🔄 Order ${orderId} (Order No: ${order.orderNo}) reverted to PENDING - not all sub-orders are completed`);
                return true;
            }
        }
        
        return false;
    } catch (error) {
        logger.error(`❌ Error checking order completion for order ${orderId}: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
        return false;
    }
};

    // create a new sub-order
    const createNewSubOrder = async (orderNo, orderId, client, product, quantity, unitType) => {
        try {
            logger.info('request received in order controller to create a new sub-order')

            // create a transaction to create sub-order and add suborder id to order
            const session = await mongoose.startSession()
            session.startTransaction()
            
            try {
                const subOrder = new SubOrder({
                    _id: uuid.v4(),
                    orderNo,
                    orderId,
                    date: new Date(),
                    clientId: client._id,
                    productId: product._id,
                    quantity,
                    unitType,
                    status: orderStatusEnum && orderStatusEnum.PENDING ? orderStatusEnum.PENDING : "pending",

                })
                console.log("subOrder",subOrder)

                logger.info('sub-order object created')
                await subOrder.save({ session })
                logger.info('sub-order saved to DB')

                // Find the parent order and update product remainingQuantity
                const order = await Order.findById(orderId).session(session);
                if (!order) {
                    logger.error('order not found')
                    throw new NotFoundError('Order not found')
                }
                // Find the product in the order
                const orderProduct = order.products.find(p => p.productId === String(product._id));
                if (!orderProduct) {
                    logger.error('Product not found in order')
                    throw new NotFoundError('Product not found in order')
                }
                // Prevent sub-orders that would reduce remainingQuantity below zero
                if (orderProduct.remainingQuantity < quantity) {
                    logger.error('Not enough remaining quantity for sub-order')
                    throw new BadRequestError('Not enough remaining quantity for sub-order')
                }
                orderProduct.remainingQuantity -= quantity;
                if (orderProduct.remainingQuantity < 0) orderProduct.remainingQuantity = 0;
                // Add subOrder id to order
                order.subOrders.push(subOrder._id);
                // Recalculate order.remainingQuantity
                order.remainingQuantity = order.products.reduce((sum, p) => sum + p.remainingQuantity, 0);
                await order.save({ session });
                logger.info('sub-order id added to order and remaining quantities updated')

                // Check if order should be marked as COMPLETED
                await checkAndMarkOrderAsCompleted(order._id, session);
                await session.commitTransaction()
                session.endSession()
                logger.info('sub-order created successfully with transaction')
                return { _id: subOrder._id }
            }
            catch (error) {
                await session.abortTransaction()
                session.endSession()
                logger.error(`Error in creating sub-order: ${error.message}`)
                throw new InternalServerError('Internal server error')
            }
        } catch (error) {
            logger.error(`Error in creating sub-order: ${error.message}`)
            throw error
        }
    }

// get sub-order by id
const getSubOrderById = async (subOrderId) => {
    try {
        logger.info(`request received in order controller to get a sub-order by id: ${subOrderId}`)
        const subOrder = await SubOrder.findOne(
            { _id: subOrderId },
            {
                orderNo: 1,
                date: 1,
                clientId: 1,
                productId: 1,
                quantity: 1,
                unitType: 1,
                status: 1,
            }
        )
        if (!subOrder) {
            logger.error('sub-order not found')
            throw new NotFoundError('Sub-order not found')
        }
        logger.info('sub-order fetched from DB')
        return subOrder
    } catch (error) {
        logger.error(`Error in getting sub-order by id: ${error.message}`)
        throw error
    }
}

// get all sub-orders
const getAllSubOrders = async () => {
    try {
        logger.info('request received in order controller to get all sub-orders')
        const subOrders = await SubOrder.find({})
            .populate('clientId', 'name')
            .populate('productId', 'name')
        if (!subOrders) {
            logger.error('No sub-orders found')
            throw new NotFoundError('No sub-orders found')
        }
        logger.info('sub-orders fetched from DB')
        return subOrders
    } catch (error) {
        logger.error(`Error in fetching sub-orders: ${error.message}`)
        throw new InternalServerError('Internal server error')
    }
}

// get all sub-orders by order number
const getAllSubOrdersByOrderNo = async (orderNo) => {
    try {
        logger.info(`request received in order controller to get all sub-orders by order number: ${orderNo}`)
        const subOrders = await SubOrder.find({ orderNo })
            .populate('clientId', 'name')
            .populate('productId', 'name')
        if (!subOrders) {
            logger.error('No sub-orders found')
            throw new NotFoundError('No sub-orders found')
        }
        logger.info('sub-orders fetched from DB')
        return subOrders
    } catch (error) {
        logger.error(`Error in fetching sub-orders: ${error.message}`)
        throw new InternalServerError('Internal server error')
    }
}

// get all sub-orders by client id
const getAllSubOrdersByClientId = async (clientId) => {
    try {
        logger.info(`request received in order controller to get all sub-orders by client id: ${clientId}`)
        const subOrders = await SubOrder.find({ clientId })
            .populate('clientId', 'name')
            .populate('productId', 'name')
        if (!subOrders) {
            logger.error('No sub-orders found')
            throw new NotFoundError('No sub-orders found')
        }
        logger.info('sub-orders fetched from DB')
        return subOrders
    } catch (error) {
        logger.error(`Error in fetching sub-orders: ${error.message}`)
        throw new InternalServerError('Internal server error')
    }
}

// get all sub-orders by product id
const getAllSubOrdersByProductId = async (productId) => {
    try {
        logger.info(`request received in order controller to get all sub-orders by product id: ${productId}`)
        const subOrders = await SubOrder.find({ productId })
            .populate('clientId', 'name')
            .populate('productId', 'name')
        if (!subOrders) {
            logger.error('No sub-orders found')
            throw new NotFoundError('No sub-orders found')
        }
        logger.info('sub-orders fetched from DB')
        return subOrders
    } catch (error) {
        logger.error(`Error in fetching sub-orders: ${error.message}`)
        throw new InternalServerError('Internal server error')
    }
}

// get all sub-orders by status
const getAllSubOrdersByStatus = async (status) => {
    try {
        logger.info(`request received in order controller to get all sub-orders by status: ${status}`)
        const subOrders = await SubOrder.find({ status })
            .populate('clientId', 'name')
            .populate('productId', 'name')
        if (!subOrders) {
            logger.error('No sub-orders found')
            throw new NotFoundError('No sub-orders found')
        }
        logger.info('sub-orders fetched from DB')
        return subOrders
    } catch (error) {
        logger.error(`Error in fetching sub-orders: ${error.message}`)
        throw new InternalServerError('Internal server error')
    }
}

const updateSubOrderStatus = async (subOrderId, status) => {
  try {
    const updatedSubOrder = await SubOrder.findByIdAndUpdate(
      subOrderId,
      { status },
      { new: true, runValidators: true }
    );
     logger.info('Updated sub-order details:', updatedSubOrder);
    if (!updatedSubOrder) {
      throw { statusCode: 404, message: 'Sub-order not found' };
    }
    
    // Handle case where orderId might be missing (for existing sub-orders)
    let orderId = updatedSubOrder.orderId;
    if (!orderId) {
      logger.warn(`⚠️ Sub-order ${subOrderId} missing orderId, trying to find order by orderNo: ${updatedSubOrder.orderNo}`);
      // Try to find the order by orderNo as fallback
      const Order = require('../models/order');
      const order = await Order.findOne({ orderNo: updatedSubOrder.orderNo });
      if (order) {
        orderId = order._id;
        logger.info(`✅ Found order ${orderId} for sub-order ${subOrderId} using orderNo: ${updatedSubOrder.orderNo}`);
      } else {
        logger.error(`❌ Could not find order for sub-order ${subOrderId} with orderNo: ${updatedSubOrder.orderNo}`);
        return updatedSubOrder; // Return without checking completion
      }
    }
    
    // After updating sub-order status, check if parent order should be marked as COMPLETED
    await checkAndMarkOrderAsCompleted(orderId);
    return updatedSubOrder;
  } catch (error) {
    logger.error(`Error updating sub-order status: ${error.message}`);
    throw error;
  }
};

// Bulk update sub-order statuses
const bulkUpdateSubOrderStatus = async (subOrderIds, status) => {
  logger.info(`bulkUpdateSubOrderStatus called with:`, { subOrderIds, status });
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    logger.info(`Starting bulk status update for ${subOrderIds.length} sub-orders to status: ${status}`);
    
    const results = {
      successCount: 0,
      failedCount: 0,
      errors: [],
      updatedSubOrders: [],
      completedOrders: []
    };

    // Update all sub-orders in parallel within the transaction
    const updatePromises = subOrderIds.map(async (subOrderId) => {
      try {
        const updatedSubOrder = await SubOrder.findByIdAndUpdate(
          subOrderId,
          { status },
          { new: true, runValidators: true, session }
        );
        
        if (!updatedSubOrder) {
          results.failedCount++;
          results.errors.push({ subOrderId, error: 'Sub-order not found' });
          return null;
        }
        
        results.successCount++;
        results.updatedSubOrders.push(updatedSubOrder);
        return updatedSubOrder;
      } catch (error) {
        results.failedCount++;
        results.errors.push({ subOrderId, error: error.message });
        return null;
      }
    });

    const updatedSubOrders = await Promise.all(updatePromises);
    const validUpdatedSubOrders = updatedSubOrders.filter(so => so !== null);

    // Group updated sub-orders by orderId to check for order completion
    const orderGroups = {};
    
    for (const subOrder of validUpdatedSubOrders) {
      let orderId = subOrder.orderId;
      if (!orderId) {
        logger.warn(`⚠️ Sub-order ${subOrder._id} missing orderId, trying to find order by orderNo: ${subOrder.orderNo}`);
        // Try to find the order by orderNo as fallback
        const order = await Order.findOne({ orderNo: subOrder.orderNo });
        if (order) {
          orderId = order._id;
          logger.info(`✅ Found order ${orderId} for sub-order ${subOrder._id} using orderNo: ${subOrder.orderNo}`);
        } else {
          logger.error(`❌ Could not find order for sub-order ${subOrder._id} with orderNo: ${subOrder.orderNo}`);
          continue; // Skip this sub-order
        }
      }
      
      if (!orderGroups[orderId]) {
        orderGroups[orderId] = [];
      }
      orderGroups[orderId].push(subOrder);
    }

    // Check each order for completion
    for (const [orderId, subOrders] of Object.entries(orderGroups)) {
      try {
        const wasCompleted = await checkAndMarkOrderAsCompleted(orderId, session);
        if (wasCompleted) {
          results.completedOrders.push(orderId);
          logger.info(`Order ${orderId} marked as COMPLETED after bulk sub-order status update`);
        }
      } catch (error) {
        logger.error(`Error checking order completion for order ${orderId}: ${error.message}`);
        results.errors.push({ orderId, error: `Order completion check failed: ${error.message}` });
      }
    }

    await session.commitTransaction();
    session.endSession();
    
    logger.info(`Bulk status update completed. Success: ${results.successCount}, Failed: ${results.failedCount}`);
    logger.info(`Returning results:`, results);
    return results;
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Error in bulk updating sub-order status: ${error.message}`);
    logger.error(`Error stack:`, error.stack);
    throw error;
  }
};

// Create multiple sub-orders atomically (ACID transaction)
const createMultipleSubOrdersAtomic = async (orderNo, orderId, client, subOrders) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const createdSubOrders = [];
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new NotFoundError('Order not found');

    // Calculate total requested per product
    const requestedPerProduct = {};
    for (const line of subOrders) {
      logger.info(`line: ${JSON.stringify(line)}`)
      if (line.quantity <= 0) continue; // Skip zero or negative quantities
      if (!requestedPerProduct[line.productId]) requestedPerProduct[line.productId] = 0;
      requestedPerProduct[line.productId] += line.quantity;
    }
    // Check all at once before making any changes
    for (const productId in requestedPerProduct) {
      const orderProduct = order.products.find(p => String(p.productId) === String(productId));
      logger.info(`orderProduct: ${JSON.stringify(orderProduct)}`)
      if (!orderProduct) throw new NotFoundError('Product not found in order');
      logger.info(`orderProduct.remainingQuantity: ${orderProduct.remainingQuantity}, requestedPerProduct[productId]: ${requestedPerProduct[productId]}`)
      if (requestedPerProduct[productId] > orderProduct.remainingQuantity) {
        throw new BadRequestError('Not enough remaining quantity');
      }
    }

    let totalDispatchedAmount = 0;

    for (const line of subOrders) {
      const { productId, quantity, unitType } = line;
      if (quantity <= 0) continue; // Skip zero or negative quantities
      // Find the product in the order
      const orderProduct = order.products.find(p => String(p.productId) === String(productId));
      logger.info(`Checking productId=${productId}, orderProduct.remainingQuantity=${orderProduct ? orderProduct.remainingQuantity : 'NOT FOUND'}, requested quantity=${quantity}`);
      logger.info(`Type of orderProduct.remainingQuantity: ${orderProduct ? typeof orderProduct.remainingQuantity : 'NOT FOUND'}, Type of quantity: ${typeof quantity}`);
      logger.info(`Matched orderProduct: ${JSON.stringify(orderProduct)}`);
      if (!orderProduct) throw new NotFoundError('Product not found in order');
      if (orderProduct.unitType !== unitType) throw new BadRequestError('Invalid unit type');
      // (No need to check remainingQuantity here, already checked above)
      // Create sub-order
      const subOrder = new SubOrder({
        _id: uuid.v4(),
        orderNo,
        orderId,
        date: new Date(),
        clientId: client._id,
        productId,
        quantity,
        unitType,
        status: orderStatusEnum && orderStatusEnum.PENDING ? orderStatusEnum.PENDING : "pending",
      });
      await subOrder.save({ session });
      createdSubOrders.push(subOrder);
      // Update remaining quantity
      orderProduct.remainingQuantity -= quantity;
      if (orderProduct.remainingQuantity < 0) orderProduct.remainingQuantity = 0;
      order.subOrders.push(subOrder._id);

      // Accumulate dispatched amount using the order's ratePrice for this product
      const rate = Number(orderProduct.ratePrice) || 0;
      totalDispatchedAmount += rate * Number(quantity);
    }
    // Recalculate order.remainingQuantity
    order.remainingQuantity = order.products.reduce((sum, p) => sum + p.remainingQuantity, 0);
    // Recalculate remainingAmount (never below zero)
    const currentRemainingAmount = Number(order.remainingAmount || 0);
    const newRemainingAmount = currentRemainingAmount - totalDispatchedAmount;
    order.remainingAmount = newRemainingAmount > 0 ? newRemainingAmount : 0;
    await order.save({ session });

    // Check if order should be marked as COMPLETED
    await checkAndMarkOrderAsCompleted(orderId, session);

    await session.commitTransaction();
    session.endSession();
    return { success: true, subOrders: createdSubOrders };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// Function to check and update all existing orders that should be completed
const checkAndUpdateAllOrdersCompletion = async () => {
    try {
        logger.info('🔄 Starting bulk order completion check for all existing orders...');
        
        const Order = require('../models/order');
        
        // Get all orders that are not already COMPLETED or CLOSED
        const orders = await Order.find({
            status: { $nin: ['COMPLETED', 'CLOSED'] }
        });
        
        logger.info(`📋 Found ${orders.length} orders to check for completion`);
        
        const results = {
            totalOrders: orders.length,
            completedOrders: [],
            failedOrders: [],
            errors: []
        };
        
        for (const order of orders) {
            try {
                logger.info(`🔍 Checking order ${order._id} (Order No: ${order.orderNo}) for completion`);
                const wasCompleted = await checkAndMarkOrderAsCompleted(order._id);
                if (wasCompleted) {
                    results.completedOrders.push({
                        orderId: order._id,
                        orderNo: order.orderNo
                    });
                    logger.info(`✅ Order ${order._id} (Order No: ${order.orderNo}) marked as COMPLETED`);
                }
            } catch (error) {
                logger.error(`❌ Error checking order ${order._id}: ${error.message}`);
                results.failedOrders.push({
                    orderId: order._id,
                    orderNo: order.orderNo,
                    error: error.message
                });
            }
        }
        
        logger.info(`🎉 Bulk completion check finished. ${results.completedOrders.length} orders marked as completed out of ${results.totalOrders} checked.`);
        return results;
        
    } catch (error) {
        logger.error(`❌ Error in checkAndUpdateAllOrdersCompletion: ${error.message}`);
        throw error;
    }
};

module.exports = {
    createNewSubOrder,
    getSubOrderById,
    getAllSubOrders,
    getAllSubOrdersByOrderNo,
    getAllSubOrdersByClientId,
    getAllSubOrdersByProductId,
    getAllSubOrdersByStatus,
    updateSubOrderStatus,
    createMultipleSubOrdersAtomic,
    bulkUpdateSubOrderStatus,
    checkAndMarkOrderAsCompleted,
    checkAndUpdateAllOrdersCompletion,
}