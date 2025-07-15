const mongoose = require('mongoose')
const Order = require('../models/order')
const SubOrder = require('../models/subOrder')
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
                if (order.remainingQuantity === 0) {
                  // Fetch all sub-orders for this order
                  const allSubOrders = await SubOrder.find({ orderId: order._id }).session(session);
                  const allCompleted = allSubOrders.length > 0 && allSubOrders.every(so => so.status === "COMPLETED");
                  if (allCompleted) {
                    order.status = "COMPLETED";
                    await order.save({ session });
                    logger.info('Order marked as COMPLETED');
                  }
                }
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
    // After updating sub-order status, check if parent order should be marked as COMPLETED
    const order = await Order.findById(updatedSubOrder.orderId);
    if (order && order.remainingQuantity === 0) {
      const allSubOrders = await SubOrder.find({ orderId: order._id });
      const allCompleted = allSubOrders.length > 0 && allSubOrders.every(so => so.status === "COMPLETED");
      if (allCompleted) {
        order.status = "COMPLETED";
        await order.save();
        logger.info('Order marked as COMPLETED after sub-order status update');
      }
    }
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
    validUpdatedSubOrders.forEach(subOrder => {
      if (!orderGroups[subOrder.orderId]) {
        orderGroups[subOrder.orderId] = [];
      }
      orderGroups[subOrder.orderId].push(subOrder);
    });

    // Check each order for completion
    for (const [orderId, subOrders] of Object.entries(orderGroups)) {
      try {
        const order = await Order.findById(orderId).session(session);
        if (order && order.remainingQuantity === 0) {
          const allSubOrders = await SubOrder.find({ orderId: order._id }).session(session);
          const allCompleted = allSubOrders.length > 0 && allSubOrders.every(so => so.status === "COMPLETED");
          if (allCompleted) {
            order.status = "COMPLETED";
            await order.save({ session });
            results.completedOrders.push(orderId);
            logger.info(`Order ${orderId} marked as COMPLETED after bulk sub-order status update`);
          }
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
    }
    // Recalculate order.remainingQuantity
    order.remainingQuantity = order.products.reduce((sum, p) => sum + p.remainingQuantity, 0);
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();
    return { success: true, subOrders: createdSubOrders };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
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
}