const mongoose = require('mongoose');
const uuid = require('uuid');
const logger = require('./utils/logger');
const constants = require('./constants');

// Import models
const Client = require('./models/client');
const Product = require('./models/product');
const ProductGroup = require('./models/productGroup');
const Order = require('./models/order');
const OrderNumber = require('./models/orderNumber');
const ClientNumber = require('./models/clientNumber');

// Connect to MongoDB
mongoose.connect(constants.MONGO_CONNECTION_URI || 'mongodb+srv://friendjay24:mvsZwZg4o9YN78qp@cluster0.6xzvvho.mongodb.net/check', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Sample data arrays
const clientNames = [
    'ABC Corporation',
    'XYZ Industries',
    'Tech Solutions Ltd',
    'Global Manufacturing',
    'Innovation Systems',
    'Quality Products Inc',
    'Modern Enterprises',
    'Future Technologies',
    'Elite Solutions',
    'Prime Industries'
];

const productNames = [
    'Steel Beams',
    'Concrete Blocks',
    'Aluminum Sheets',
    'Copper Wire',
    'PVC Pipes',
    'Glass Panels',
    'Wooden Planks',
    'Ceramic Tiles',
    'Plastic Containers',
    'Metal Brackets'
];

const unitTypes = ['NOS', 'SQUARE_METER', 'SQUARE_FEET'];

const generateTestData = async () => {
    try {
        logger.info('Starting test data generation...');

        // Initialize order and client numbers if they don't exist
        await initializeNumbers();

        // Generate Product Groups first
        const productGroups = await generateProductGroups();
        logger.info(`Generated ${productGroups.length} product groups`);

        // Generate Products
        const products = await generateProducts(productGroups);
        logger.info(`Generated ${products.length} products`);

        // Generate Clients
        const clients = await generateClients();
        logger.info(`Generated ${clients.length} clients`);

        // Generate Orders for each client
        const orders = await generateOrders(clients, products);
        logger.info(`Generated ${orders.length} orders`);

        logger.info('Test data generation completed successfully!');
        
    } catch (error) {
        logger.error(`Test data generation failed: ${error.message}`);
        console.error(error);
    } finally {
        mongoose.connection.close();
    }
};

const initializeNumbers = async () => {
    try {
        // Initialize order number
        const existingOrderNumber = await OrderNumber.findOne({});
        if (!existingOrderNumber) {
            await OrderNumber.create({ orderNo: 0 });
            logger.info('Initialized order number to 0');
        }

        // Initialize client number
        const existingClientNumber = await ClientNumber.findOne({});
        if (!existingClientNumber) {
            await ClientNumber.create({ clientNo: 0 });
            logger.info('Initialized client number to 0');
        }
    } catch (error) {
        logger.error(`Error initializing numbers: ${error.message}`);
    }
};

const generateProductGroups = async () => {
    const groups = [
        { name: 'Construction Materials', description: 'Building and construction materials' },
        { name: 'Electrical Supplies', description: 'Electrical components and supplies' },
        { name: 'Plumbing Materials', description: 'Plumbing fixtures and materials' },
        { name: 'Raw Materials', description: 'Basic raw materials for manufacturing' }
    ];

    const createdGroups = [];
    for (const group of groups) {
        const newGroup = new ProductGroup({
            _id: uuid.v4(),
            name: group.name,
            description: group.description,
            isActive: true
        });
        await newGroup.save();
        createdGroups.push(newGroup);
    }

    return createdGroups;
};

const generateProducts = async (productGroups) => {
    const createdProducts = [];
    
    for (let i = 0; i < productNames.length; i++) {
        const product = new Product({
            _id: uuid.v4(),
            name: productNames[i],
            alias: productNames[i].toLowerCase().replace(/\s+/g, '_'),
            productGroupId: productGroups[i % productGroups.length]._id,
            unitType: unitTypes[i % unitTypes.length],
            ratePerUnit: Math.floor(Math.random() * 1000) + 100, // Random rate between 100-1100
            alternateUnits: {
                numberOfItems: Math.floor(Math.random() * 10) + 1,
                numberOfUnits: Math.floor(Math.random() * 5) + 1
            }
        });
        
        await product.save();
        createdProducts.push(product);
    }

    return createdProducts;
};

const generateClients = async () => {
    const createdClients = [];
    
    for (let i = 0; i < clientNames.length; i++) {
        // Get next client number
        const clientNumberDoc = await ClientNumber.findOne({});
        const clientNo = clientNumberDoc.clientNo + 1;
        await ClientNumber.updateOne({}, { clientNo });

        const client = new Client({
            _id: uuid.v4(),
            clientNo: clientNo,
            name: clientNames[i],
            alias: clientNames[i].toLowerCase().replace(/\s+/g, '_'),
            email: `${clientNames[i].toLowerCase().replace(/\s+/g, '.')}@example.com`,
            mobile: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
            correspondenceAddress: {
                area: `Area ${Math.floor(Math.random() * 999) + 1}`,
                city: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata'][Math.floor(Math.random() * 5)],
                state: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'West Bengal'][Math.floor(Math.random() * 5)],
                postalCode: (Math.floor(Math.random() * 900000) + 100000).toString(),
                country: 'India',
                landmark: `Landmark ${Math.floor(Math.random() * 999) + 1}`
            },
            permanentAddress: {
                area: `Permanent Area ${Math.floor(Math.random() * 999) + 1}`,
                city: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata'][Math.floor(Math.random() * 5)],
                state: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'West Bengal'][Math.floor(Math.random() * 5)],
                postalCode: (Math.floor(Math.random() * 900000) + 100000).toString(),
                country: 'India',
                landmark: `Permanent Landmark ${Math.floor(Math.random() * 999) + 1}`
            },
            orders: []
        });
        
        await client.save();
        createdClients.push(client);
    }

    return createdClients;
};

const generateOrders = async (clients, products) => {
    const createdOrders = [];
    
    for (const client of clients) {
        // Generate 1-3 orders per client
        const numOrders = Math.floor(Math.random() * 3) + 1;
        
        for (let orderIndex = 0; orderIndex < numOrders; orderIndex++) {
            // Get next order number
            const orderNumberDoc = await OrderNumber.findOne({});
            const orderNo = orderNumberDoc.orderNo + 1;
            await OrderNumber.updateOne({}, { orderNo });

            // Select 2-4 random products for this order
            const numProducts = Math.floor(Math.random() * 3) + 2; // 2-4 products
            const selectedProducts = [];
            const usedProductIds = new Set();
            
            while (selectedProducts.length < numProducts) {
                const randomProduct = products[Math.floor(Math.random() * products.length)];
                if (!usedProductIds.has(randomProduct._id)) {
                    usedProductIds.add(randomProduct._id);
                    selectedProducts.push(randomProduct);
                }
            }

            // Create order products with quantities and amounts
            const orderProducts = [];
            let totalAmount = 0;
            let totalQuantity = 0;
            let totalRemainingQuantity = 0;

            for (const product of selectedProducts) {
                const quantity = Math.floor(Math.random() * 50) + 10; // 10-59 quantity
                const ratePrice = product.ratePerUnit * (0.8 + Math.random() * 0.4); // 80%-120% of base rate
                const amount = ratePrice * quantity;
                
                totalAmount += amount;
                totalQuantity += quantity;
                totalRemainingQuantity += quantity;

                orderProducts.push({
                    productId: product._id,
                    quantity: quantity,
                    remainingQuantity: quantity,
                    unitType: product.unitType,
                    ratePrice: ratePrice,
                    amount: amount
                });
            }

            // Create the order
            const order = new Order({
                _id: uuid.v4(),
                orderNo: orderNo,
                date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000), // Random date within last 30 days
                clientId: client._id,
                products: orderProducts,
                quantity: totalQuantity,
                remainingQuantity: totalRemainingQuantity,
                totalAmount: totalAmount,
                remainingAmount: totalAmount, // Initially, remaining amount equals total amount
                dueDate: new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000), // Random due date within next 30 days
                status: 'PENDING',
                txnStatus: 'PENDING',
                subOrders: [],
                transactions: []
            });

            await order.save();
            createdOrders.push(order);

            // Update client with order ID
            await Client.findByIdAndUpdate(client._id, {
                $push: { orders: order._id }
            });

            logger.info(`Created order ${orderNo} for client ${client.name} with ${orderProducts.length} products, total amount: ₹${totalAmount.toLocaleString()}`);
        }
    }

    return createdOrders;
};

// Run the migration
generateTestData(); 