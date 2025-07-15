import React, { useEffect, useState } from "react";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import AddOrder from "./AddOrder";

const Order = () => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [data, setData] = useState([]);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [step, setStep] = useState('init');
  const [error, setError] = useState(null);

  // Fetch orders only
  useEffect(() => {
    console.log('STEP 1: useEffect triggered, starting fetchData');
    setStep('fetching');
    const fetchData = async () => {
      try {
        const token = cookies.get("auth-token");
        console.log('STEP 2: Calling apiCall for order/all');
        const response = await apiCall("GET", "order/all", null, token);
        console.log('STEP 3: Response from apiCall:', response);
        if (response?.orders) {
          setData(response.orders);
          setStep('data received');
        } else {
          setData([]);
          setStep('no data');
        }
      } catch (error) {
        setData([]);
        setError(error.message || String(error));
        setStep('error');
        console.log('STEP 4: Error in fetchData:', error);
      }
    };
    fetchData();
  }, [showAddOrder]);

  console.log('STEP 5: Rendering component, step:', step, 'data:', data);

  return (
    <div>
      <div style={{background: 'red', color: 'white', fontWeight: 'bold', fontSize: 24, padding: 16, marginBottom: 16}}>
        DEBUG: THIS IS src/pages/order/index.jsx
      </div>
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
      <div style={{marginBottom: 16, color: 'blue'}}>
        <b>Debug Step:</b> {step}
        {error && <div style={{color: 'red'}}>Error: {error}</div>}
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
              {data && data.length > 0 ? data.map(order => (
                <tr key={order._id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">{order.orderNumber}</td>
                  <td className="py-3 px-4">{order.clientName || order.client?.name || "-"}</td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products && order.products.map((p, i) => (
                      <div key={i}>{p.productName || p.name || "-"}</div>
                    ))}
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products && order.products.map((p, i) => (
                      <div key={i}>{p.quantity}</div>
                    ))}
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products && order.products.map((p, i) => (
                      <div key={i}>{p.unitType}</div>
                    ))}
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products && order.products.map((p, i) => (
                      <div key={i}>{typeof p.remainingQuantity !== 'undefined' ? p.remainingQuantity : '—'}</div>
                    ))}
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products && order.products.map((p, i) => (
                      <div key={i}>{p.discount ? p.discount + "%" : "—"}</div>
                    ))}
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line">
                    {order.products && order.products.map((p, i) => (
                      <div key={i}>{p.amount ? `₹${Number(p.amount).toLocaleString()}` : "—"}</div>
                    ))}
                  </td>
                  <td className="py-3 px-4">
                    {order.status === "Completed" ? (
                      <span className="text-green-600 font-semibold bg-green-50 rounded px-2 py-1">Completed</span>
                    ) : (
                      <span className="text-yellow-600 font-semibold bg-yellow-50 rounded px-2 py-1">Pending</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{order.dueDate ? new Date(order.dueDate).toLocaleDateString() : "-"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="10" className="py-6 text-center text-gray-400">No orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Order;
