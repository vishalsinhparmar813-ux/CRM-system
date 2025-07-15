import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";

const PAGE_SIZE = 5;

const ClientDetails = () => {
  const { id } = useParams();
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters and pagination
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderPage, setOrderPage] = useState(1);

  const [txnDateFrom, setTxnDateFrom] = useState("");
  const [txnDateTo, setTxnDateTo] = useState("");
  const [txnPage, setTxnPage] = useState(1);

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'transactions'

  useEffect(() => {
    const fetchClient = async () => {
      setLoading(true);
      const token = cookies.get("auth-token");
      const res = await apiCall("GET", `client/${id}`, null, token);
      setClient(res || null);
      setLoading(false);
    };
    fetchClient();
  }, [id]);

  useEffect(() => {
    if (!client) return;
    const fetchOrdersAndTxns = async () => {
      setLoading(true);
      const token = cookies.get("auth-token");
      const ordersRes = await apiCall("GET", `order/all`, null, token);
      const clientOrders = (ordersRes.orders || []).filter(o => o.clientId === id);
      setOrders(clientOrders);
      // Fetch transactions for each order
      let allTxns = [];
      let pendingTxns = [];
      for (const order of clientOrders) {
        const txnsRes = await apiCall("GET", `transaction/txns/${order._id}`, null, token);
        const txns = txnsRes.transactions?.transactions || [];
        allTxns = allTxns.concat(txns.map(t => ({ ...t, orderNo: order.orderNo })));
        const paid = txns.reduce((a, t) => a + t.amount, 0);
        if (txnsRes.transactions?.txnStatus === "PENDING" && order.amount - paid > 0) {
          pendingTxns.push({ order, pendingAmount: order.amount - paid });
        }
      }
      setTransactions(allTxns);
      setPending(pendingTxns);
      setLoading(false);
    };
    fetchOrdersAndTxns();
  }, [client, id]);

  // Filtering logic
  const filteredOrders = orders.filter(order => {
    let pass = true;
    if (orderDateFrom) pass = pass && new Date(order.date) >= new Date(orderDateFrom);
    if (orderDateTo) pass = pass && new Date(order.date) <= new Date(orderDateTo);
    if (orderStatus) pass = pass && order.status === orderStatus;
    return pass;
  });
  const paginatedOrders = filteredOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);
  const orderPageCount = Math.ceil(filteredOrders.length / PAGE_SIZE);

  const filteredTxns = transactions.filter(txn => {
    let pass = true;
    if (txnDateFrom) pass = pass && new Date(txn.date) >= new Date(txnDateFrom);
    if (txnDateTo) pass = pass && new Date(txn.date) <= new Date(txnDateTo);
    return pass;
  });
  const paginatedTxns = filteredTxns.slice((txnPage - 1) * PAGE_SIZE, txnPage * PAGE_SIZE);
  const txnPageCount = Math.ceil(filteredTxns.length / PAGE_SIZE);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!client) return <div className="p-6">Client not found.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Client Details</h1>
      <table className="min-w-[350px] w-full bg-white rounded-lg shadow-md my-6 mx-auto text-sm">
        <thead className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded-t-lg">
          <tr>
            <th className="py-3 px-4 text-left font-bold">Field</th>
            <th className="py-3 px-4 text-left font-bold">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          <tr className="even:bg-gray-50 hover:bg-gray-100 transition-colors">
            <td className="py-2 px-4 font-semibold">Name</td>
            <td className="py-2 px-4">{client.name}</td>
          </tr>
          <tr className="even:bg-gray-50 hover:bg-gray-100 transition-colors">
            <td className="py-2 px-4 font-semibold">Email</td>
            <td className="py-2 px-4">{client.email}</td>
          </tr>
          <tr className="even:bg-gray-50 hover:bg-gray-100 transition-colors">
            <td className="py-2 px-4 font-semibold">Mobile</td>
            <td className="py-2 px-4">{client.mobile || '-'}</td>
          </tr>
        </tbody>
      </table>
      <div className="flex gap-4 mb-6">
        <button
          className={`px-6 py-2 rounded font-semibold shadow transition-colors ${activeTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600'}`}
          onClick={() => setActiveTab('orders')}
        >
          View Orders
        </button>
        <button
          className={`px-6 py-2 rounded font-semibold shadow transition-colors ${activeTab === 'transactions' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600'}`}
          onClick={() => setActiveTab('transactions')}
        >
          View Transactions
        </button>
      </div>
      {activeTab === 'orders' && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Orders</h2>
          <div className="flex flex-wrap gap-4 mb-2">
            <div>
              <label className="block text-xs font-semibold mb-1">From</label>
              <input type="date" value={orderDateFrom} onChange={e => { setOrderDateFrom(e.target.value); setOrderPage(1); }} className="border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">To</label>
              <input type="date" value={orderDateTo} onChange={e => { setOrderDateTo(e.target.value); setOrderPage(1); }} className="border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Status</label>
              <select value={orderStatus} onChange={e => { setOrderStatus(e.target.value); setOrderPage(1); }} className="border rounded px-2 py-1">
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          <table className="min-w-[350px] w-full bg-white rounded-lg shadow-md my-6 mx-auto text-sm">
            <thead className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded-t-lg">
              <tr>
                <th className="py-3 px-4 text-left font-bold">Order No</th>
                <th className="py-3 px-4 text-left font-bold">Date</th>
                <th className="py-3 px-4 text-left font-bold">Amount</th>
                <th className="py-3 px-4 text-left font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedOrders.map(order => (
                <tr key={order._id} className="even:bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td className="py-2 px-4">#{order.orderNo}</td>
                  <td className="py-2 px-4">{order.date ? new Date(order.date).toLocaleDateString() : '-'}</td>
                  <td className="py-2 px-4">
                    ₹{Array.isArray(order.products)
                        ? order.products.reduce((sum, p) => sum + (p.amount || 0), 0)
                        : (order.amount || 0)}
                  </td>
                  <td className="py-2 px-4">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2 items-center mb-4">
            <button className="px-2 py-1 rounded border" disabled={orderPage === 1} onClick={() => setOrderPage(p => Math.max(1, p - 1))}>Prev</button>
            <span>Page {orderPage} of {orderPageCount}</span>
            <button className="px-2 py-1 rounded border" disabled={orderPage === orderPageCount || orderPageCount === 0} onClick={() => setOrderPage(p => Math.min(orderPageCount, p + 1))}>Next</button>
          </div>
        </div>
      )}
      {activeTab === 'transactions' && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Transactions</h2>
          <div className="flex flex-wrap gap-4 mb-2">
            <div>
              <label className="block text-xs font-semibold mb-1">From</label>
              <input type="date" value={txnDateFrom} onChange={e => { setTxnDateFrom(e.target.value); setTxnPage(1); }} className="border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">To</label>
              <input type="date" value={txnDateTo} onChange={e => { setTxnDateTo(e.target.value); setTxnPage(1); }} className="border rounded px-2 py-1" />
            </div>
          </div>
          <table className="min-w-[350px] w-full bg-white rounded-lg shadow-md my-6 mx-auto text-sm">
            <thead className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded-t-lg">
              <tr>
                <th className="py-3 px-4 text-left font-bold">Order No</th>
                <th className="py-3 px-4 text-left font-bold">Date</th>
                <th className="py-3 px-4 text-left font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedTxns.map(txn => (
                <tr key={txn._id} className="even:bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td className="py-2 px-4">#{txn.orderNo}</td>
                  <td className="py-2 px-4">{new Date(txn.date).toLocaleDateString()}</td>
                  <td className="py-2 px-4">₹{txn.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2 items-center mb-4">
            <button className="px-2 py-1 rounded border" disabled={txnPage === 1} onClick={() => setTxnPage(p => Math.max(1, p - 1))}>Prev</button>
            <span>Page {txnPage} of {txnPageCount}</span>
            <button className="px-2 py-1 rounded border" disabled={txnPage === txnPageCount || txnPageCount === 0} onClick={() => setTxnPage(p => Math.min(txnPageCount, p + 1))}>Next</button>
          </div>
        </div>
      )}
      {/* Pending Transactions Table (now only in transactions tab) */}
      {activeTab === 'transactions' && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Pending Transactions</h2>
          <table className="min-w-[350px] w-full bg-white rounded-lg shadow-md my-6 mx-auto text-sm">
            <thead className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded-t-lg">
              <tr>
                <th className="py-3 px-4 text-left font-bold">Order No</th>
                <th className="py-3 px-4 text-left font-bold">Pending Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pending.length === 0 ? (
                <tr><td className="py-2 px-4" colSpan={2}>No pending transactions.</td></tr>
              ) : (
                pending.map((p, i) => (
                  <tr key={i} className="even:bg-gray-50 hover:bg-gray-100 transition-colors">
                    <td className="py-2 px-4">#{p.order.orderNo}</td>
                    <td className="py-2 px-4">₹{p.pendingAmount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ClientDetails; 