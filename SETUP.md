# 🚀 Quick Setup Guide - Ravi Precast Order Management System

## Prerequisites
- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- npm or yarn

## 🛠️ Installation Steps

### 1. Clone the Repository
```bash
git clone <repository-url>
cd new
```

### 2. Backend Setup
```bash
cd NewBE
npm install
```

**Note:** If you get a nodemon error, install it globally:
```bash
npm install -g nodemon
```

Create `.env` file in `NewBE` directory:
```env
PORT=3010
MONGODB_URI=mongodb://localhost:27017/ravi_precast
JWT_SECRET=your_super_secret_jwt_key_here
NODE_ENV=development
```

### 3. Frontend Setup
```bash
cd ../NewFE
npm install
```

### 4. Start MongoDB
Make sure MongoDB is running on your system:
```bash
# On Windows
mongod

# On macOS/Linux
sudo systemctl start mongod
```

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd NewBE
npm run dev
```
Backend will run on: http://localhost:3010

**Terminal 2 - Frontend:**
```bash
cd NewFE
npm run dev
```
Frontend will run on: http://localhost:5173

## 🔐 Initial Login

1. Open http://localhost:5173 in your browser
2. You'll need to register a user first or check if there's a default admin user
3. Login with your credentials

## 📋 Default Data Setup

### Add Sample Products
You may need to add some sample products through the API or admin interface:

```json
{
  "name": "I-Shape",
  "unitType": "SQUARE_FEET",
  "ratePerUnit": 100,
  "alternateUnits": {
    "numberOfItems": 150,
    "numberOfUnits": 100
  }
}
```

### Add Sample Client
```json
{
  "name": "Sample Client",
  "email": "client@example.com",
  "mobile": "1234567890",
  "correspondenceAddress": {
    "city": "Mumbai",
    "state": "Maharashtra"
  }
}
```

## 🧪 Testing the Features

### 1. Dashboard Overview
- Visit: http://localhost:5173/dashboard
- Check statistics cards and recent orders

### 2. Client Management
- Visit: http://localhost:5173/dashboard/clients
- Add, view, and manage clients

### 3. Financial Tracking
- Visit: http://localhost:5173/dashboard/financial
- View outstanding payments and financial summary

### 4. Order Creation with Live Preview
- Visit: http://localhost:5173/order
- Create new order and see live unit conversion preview

### 5. Invoice Generation
- Visit: http://localhost:5173/invoice
- Generate PDF invoices for completed orders

## 🔧 Troubleshooting

### Common Issues:

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env file
   - Verify MongoDB port (default: 27017)

2. **Port Already in Use**
   - Change PORT in .env file
   - Kill existing processes on the port

3. **CORS Errors**
   - Check if backend is running on correct port
   - Verify API base URL in frontend

4. **JWT Token Issues**
   - Ensure JWT_SECRET is set in .env
   - Clear browser cookies/localStorage

### Logs
- Backend logs: Check terminal running backend
- Frontend logs: Check browser console (F12)

## 📱 API Testing

Use Postman or curl to test API endpoints:

```bash
# Test backend health
curl http://localhost:3010/

# Login
curl -X POST http://localhost:3010/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

## 🚀 Production Deployment

### Backend (Node.js)
- Deploy to Heroku, DigitalOcean, or AWS
- Set production environment variables
- Use MongoDB Atlas for database

### Frontend (React)
- Build: `npm run build`
- Deploy to Netlify, Vercel, or AWS S3
- Update API base URL for production

## 📞 Support

For issues or questions:
1. Check the logs for error messages
2. Verify all dependencies are installed
3. Ensure MongoDB is running
4. Check environment variables

## 🎯 Key Features to Test

1. **Live Unit Conversion**: Create order with different units
2. **Dashboard Statistics**: Verify numbers match your data
3. **Financial Tracking**: Check outstanding payments calculation
4. **PDF Generation**: Test invoice creation
5. **Role-based Access**: Test admin vs sub-admin permissions

---

**Happy Testing! 🎉** 