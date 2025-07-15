import React, { useState } from "react";
import AddSubOrder from "../../pages/orderDetails/AddSubOrder";

const OrdersTable = ({ orders, showCreateSubOrder = false, onSubOrderCreated }) => {
  const [activeOrder, setActiveOrder] = useState(null);

  return (
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
            <th className="py-4 px-4 text-left font-bold">Created At</th>
            {showCreateSubOrder && <th className="py-4 px-4 text-left font-bold">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {orders && orders.length > 0 ? orders.map(order => (
            <tr key={order._id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-3 px-4">{order.orderNo || order.orderNumber || order._id || '-'}</td>
              <td className="py-3 px-4">{order.clientId?.name || order.clientName || '-'}</td>
              <td className="py-3 px-4 whitespace-pre-line">
                {order.products && order.products.map((p, i) => (
                  <div key={i}>{p.productId?.name || p.productName || '-'}</div>
                ))}
              </td>
              <td className="py-3 px-4 whitespace-pre-line">
                {order.products && order.products.map((p, i) => (
                  <div key={i}>{p.quantity}</div>
                ))}
              </td>
              <td className="py-3 px-4 whitespace-pre-line">
                {order.products && order.products.map((p, i) => (
                  <div key={i}>{p.productId?.unitType || p.unitType || '-'}</div>
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
              <td className="py-3 px-4">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-"}</td>
              {showCreateSubOrder && (
                <td className="py-3 px-4">
                  <button
                    className="btn btn-primary px-3 py-1 text-xs"
                    onClick={() => setActiveOrder(order)}
                  >
                    Create Suborder
                  </button>
                  {activeOrder && activeOrder._id === order._id && (
                    <AddSubOrder
                      orderNo={order.orderNo}
                      orderId={order._id}
                      clientId={order.clientId}
                      products={order.products}
                      onAddSuccess={() => {
                        setActiveOrder(null);
                        if (onSubOrderCreated) onSubOrderCreated();
                      }}
                      open={true}
                    />
                  )}
                </td>
              )}
            </tr>
          )) : (
            <tr>
              <td colSpan={showCreateSubOrder ? 11 : 10} className="py-6 text-center text-gray-400">No orders found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default OrdersTable; 