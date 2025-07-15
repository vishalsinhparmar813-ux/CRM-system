// eraseAllData.js
// Usage: node eraseAllData.js
const mongoose = require('mongoose');
const constants = require('./constants');

const models = [
  // 'client',
  'order',
  'product',
  'productGroup',
  'subOrder',
  'transaction',
  // 'user',
  'orderNumber',
  'clientNumber',
];

const MONGO_URI = constants.MONGO_URI || 'mongodb+srv://friendjay24:mvsZwZg4o9YN78qp@cluster0.6xzvvho.mongodb.net/check';
console.log(MONGO_URI);

async function eraseAllData() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
    for (const modelName of models) {
      try {
        const model = require(`./models/${modelName}`);
        const res = await model.deleteMany({});
        console.log(`Erased ${res.deletedCount} documents from ${modelName}`);
      } catch (err) {
        console.error(`Error erasing ${modelName}:`, err.message);
      }
    }
    await mongoose.disconnect();
    console.log('All data erased. Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1);
  }
}
eraseAllData(); 