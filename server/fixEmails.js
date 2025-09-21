// Simple one-time script to fix email duplicates
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables properly
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Also try loading from constants if env doesn't work
const constants = require('./constants');

async function fixEmails() {
    try {
        // Try to get MongoDB URI from multiple sources
        const mongoUri = process.env.MONGO_CONNECTION_URI || 
                         process.env.MONGO_URI || 
                         constants.MONGO_CONNECTION_URI;
        
        if (!mongoUri) {
            throw new Error('MongoDB connection URI not found. Please check your .env file or constants.js');
        }
        
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');
        
        // First, drop the existing email index
        try {
            await mongoose.connection.db.collection('clients').dropIndex('email_1');
            console.log('Dropped old email index');
        } catch (error) {
            console.log('Old email index may not exist:', error.message);
        }
        
        // Update all empty emails to null
        const result = await mongoose.connection.db.collection('clients').updateMany(
            { email: '' },
            { $set: { email: null } }
        );
        
        console.log(`Fixed ${result.modifiedCount} empty emails`);
        
        // Create new sparse unique index
        try {
            await mongoose.connection.db.collection('clients').createIndex(
                { email: 1 }, 
                { unique: true, sparse: true }
            );
            console.log('Created new sparse unique index for email');
        } catch (error) {
            console.log('Error creating index:', error.message);
        }
        
        console.log('Email fix completed!');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

fixEmails();
