// DEBUG: This is the active Orders page for the Orders route.
// To confirm which file is rendered, add a big debug message here.
// If you see the message, this file is active. If not, check your router and other index.jsx files.

import React, { useEffect, useState } from "react";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import AddOrder from "./AddOrder";

const Order = () => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [step, setStep] = useState('init');
  const [error, setError] = useState(null);

  // Fetch orders, products, and clients
  useEffect(() => {
    setStep('fetching');
    const fetchData = async () => {
      try {
        const token = cookies.get("auth-token");
        const [ordersRes, productsRes, clientsRes] = await Promise.all([
          apiCall("GET", "order/all", null, token),
          apiCall("GET", "product/all", null, token),
          apiCall("GET", "client/all", null, token),
        ]);
        setOrders(ordersRes?.orders || []);
        setProducts(productsRes?.products || []);
        setClients(clientsRes?.data || clientsRes || []);
        setStep('data received');
      } catch (error) {
        setOrders([]);
        setProducts([]);
        setClients([]);
        setError(error.message || String(error));
        setStep('error');
      }
    };
    fetchData();
  }, [showAddOrder]);

  // Lookup maps
  const productMap = Object.fromEntries(products.map(p => [p._id, p.name]));
  const clientMap = Object.fromEntries(clients.map(c => [c._id, c.name]));

  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xl font-semibold">Order Data</h4>
        {!showAddOrder && (
          <button
            className="btn btn-primary px-4 py-2"
            onClick={() => setShowAddOrder(true)}
          >
            Add Order
          </button>
        )}
      </div>
      {showAddOrder ? (
        <AddOrder onComplete={() => setShowAddOrder(false)} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[350px] w-full bg-white rounded-lg shadow-md my-8 mx-auto text-sm border border-slate-200">
            <thead className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-900 rounded-t-lg text-base font-bold">
              <tr>
                <th className="py-4 px-4 text-left font-bold">Order No</th>
                <th className="py-4 px-4 text-left font-bold">Client Name</th>
                <th className="py-4 px-4 text-left font-bold">Products</th>
                <th className="py-4 px-4 text-left font-bold">Quantities</th>
                <th className="py-4 px-4 text-left font-bold">Unit Types</th>
                <th className="py-4 px-4 text-left font-bold">Remaining Quantity</th>
                <th className="py-4 px-4 text-left font-bold">Discount (%)</th>
                <th className="py-4 px-4 text-left font-bold">Amounts</th>
                <th className="py-4 px-4 text-left font-bold">Status</th>
                <th className="py-4 px-4 text-left font-bold">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={10} className="py-6 text-center text-gray-400">No orders found.</td></tr>
              ) : orders.map(order => (
                <tr key={order._id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium">{order.orderNo}</td>
                  <td className="py-3 px-4">{clientMap[order.clientId] || order.clientId}</td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products.map((p, idx) => <div key={idx}>{productMap[p.productId] || p.productId}</div>)}
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products.map((p, idx) => <div key={idx}>{p.quantity}</div>)}
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products.map((p, idx) => <div key={idx}>{p.unitType}</div>)}
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products.map((p, idx) => <div key={idx}>{typeof p.remainingQuantity !== 'undefined' ? p.remainingQuantity : '—'}</div>)}
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products.map((p, idx) => <div key={idx}>{p.discount ? p.discount : '—'}</div>)}
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products.map((p, idx) => <div key={idx}>{p.amount ? `₹${p.amount.toLocaleString?.() ?? p.amount}` : '—'}</div>)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-3 py-1 rounded font-semibold text-xs ${order.status === 'COMPLETED' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                      {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4">{formatDate(order.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Order;
