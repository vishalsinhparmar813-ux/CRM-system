import React, { useState, useEffect } from "react";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Textinput from "../../components/ui/Textinput";

const transactionTypes = [
  { value: "cash", label: "Cash" },
  { value: "online", label: "Online" },
];
const paymentMethods = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "credit_card", label: "Credit Card" },
];

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3010";

const Transactions = () => {
  console.log('DEBUG: Transactions component mounted');
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [orders, setOrders] = useState([]);
  const [transactionsMap, setTransactionsMap] = useState({}); // { orderId: [transactions] }
  const [amounts, setAmounts] = useState({}); // { orderId: amount }
  const [expanded, setExpanded] = useState({}); // { orderId: bool }
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalOrder, setModalOrder] = useState(null);
  const [txnForm, setTxnForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    transactionType: "cash",
    paymentMethod: "",
    txnNumber: "",
  });
  const [txnFormErrors, setTxnFormErrors] = useState({});
  const [previewReceiptTxnId, setPreviewReceiptTxnId] = useState(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState("");
  const [clients, setClients] = useState([]);
  const [mediaFile, setMediaFile] = useState(null);

  // Fetch all orders and clients on mount
  useEffect(() => {
    console.log('DEBUG: useEffect fetchOrders running');
    const fetchOrders = async () => {
      setLoading(true);
      const token = cookies.get("auth-token");
      const res = await apiCall("GET", "order/all", null, token);
      const clientsRes = await apiCall("GET", "client/all", null, token);
      console.log('DEBUG: fetchOrders result', res);
      setOrders(res.orders || []);
      setClients(clientsRes?.data || clientsRes || []);
      setLoading(false);
    };
    fetchOrders();
  }, []);

  // Build clientId to name map
  const clientMap = Object.fromEntries(clients.map(c => [c._id, c.name]));

  // Fetch transactions for all orders
  useEffect(() => {
    console.log('DEBUG: useEffect fetchAllTxns running, orders:', orders);
    const fetchAllTxns = async () => {
      setLoading(true);
      const token = cookies.get("auth-token");
      let txnsMap = {};
      for (const order of orders) {
        const res = await apiCall("GET", `transaction/txns/${order._id}`, null, token);
        txnsMap[order._id] = res.transactions?.transactions || [];
      }
      console.log('DEBUG: fetchAllTxns result', txnsMap);
      setTransactionsMap(txnsMap);
      setLoading(false);
    };
    if (orders.length > 0) fetchAllTxns();
  }, [orders]);

  // Add transaction for an order (modal version)
  const handleModalAddTransaction = async () => {
    // Validate
    const errors = {};
    const remaining = modalOrder ? getOrderStatus(modalOrder).remaining : null;
    if (!txnForm.amount || isNaN(Number(txnForm.amount)) || Number(txnForm.amount) <= 0) {
      errors.amount = "Please enter a valid amount";
    } else if (remaining !== null && Number(txnForm.amount) > remaining) {
      errors.amount = `Amount cannot exceed remaining amount (₹${remaining})`;
    }
    if (!txnForm.date) {
      errors.date = "Date is required";
    }
    if (!txnForm.transactionType) {
      errors.transactionType = "Transaction type is required";
    }
    if (txnForm.transactionType === "online" && !txnForm.paymentMethod) {
      errors.paymentMethod = "Payment method is required";
    }
    setTxnFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setMessage("");
    const token = cookies.get("auth-token");
    const formData = new FormData();
    formData.append("clientId", modalOrder.clientId);
    formData.append("orderId", modalOrder._id);
    formData.append("amount", Number(txnForm.amount));
    formData.append("date", txnForm.date);
    formData.append("transactionType", txnForm.transactionType);
    if (txnForm.transactionType === "online") {
      formData.append("paymentMethod", txnForm.paymentMethod);
      if (txnForm.txnNumber) formData.append("txnNumber", txnForm.txnNumber);
    }
    if (mediaFile) {
      formData.append("mediaFile", mediaFile);
    }
    try {
      const res = await apiCall("POST", "transaction/pay", formData, token, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res?.transactionId) {
        setMessage("Transaction added successfully");
        setTxnForm({
          date: new Date().toISOString().slice(0, 10),
          amount: "",
          transactionType: "cash",
          paymentMethod: "",
          txnNumber: "",
        });
        setMediaFile(null);
        setShowModal(false);
        // Refresh transactions for this order
        const txnsRes = await apiCall("GET", `transaction/txns/${modalOrder._id}`, null, token);
        setTransactionsMap(m => ({ ...m, [modalOrder._id]: txnsRes.transactions?.transactions || [] }));
        setAmounts(a => ({ ...a, [modalOrder._id]: "" }));
      } else {
        setMessage(res?.message || "Failed to add transaction");
      }
    } catch (err) {
      setMessage(err.message || "Failed to add transaction");
    }
    setLoading(false);
  };

  // Helper to calculate status and remaining
  const getOrderStatus = (order) => {
    const txns = transactionsMap[order._id] || [];
    const paid = txns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    // Calculate total order amount from products array
    const totalAmount = Array.isArray(order.products)
      ? order.products.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      : 0;
    if (paid >= totalAmount) return { status: "Completed", remaining: 0 };
    return { status: "Pending", remaining: totalAmount - paid };
  };

  const toggleExpand = (orderId) => {
    setExpanded(e => ({ ...e, [orderId]: !e[orderId] }));
  };

  // Helper to preview receipt
  const handlePreviewReceipt = async (txnId) => {
    console.log('DEBUG: About to fetch receipt from', `/transaction/receipt/${txnId}`);
    try {
      const token = cookies.get("auth-token");
      // Fetch the PDF as a blob
      const res = await fetch(`/transaction/receipt/${txnId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to generate receipt');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setPreviewReceiptTxnId(txnId);
      setPreviewReceiptUrl(url);
    } catch (err) {
      setMessage("Failed to preview receipt");
    }
  };
  const handleClosePreviewReceipt = () => {
    setPreviewReceiptTxnId(null);
    if (previewReceiptUrl) {
      window.URL.revokeObjectURL(previewReceiptUrl);
      setPreviewReceiptUrl("");
    }
  };
  const handleDownloadReceipt = () => {
    if (previewReceiptUrl && previewReceiptTxnId) {
      const a = document.createElement('a');
      a.href = previewReceiptUrl;
      a.download = `receipt_${previewReceiptTxnId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return (
    <div className="p-6">
      {console.log('DEBUG: Rendering Transaction Management, orders:', orders, 'transactionsMap:', transactionsMap)}
      <h1 className="text-2xl font-bold mb-4">Transaction Management</h1>
      {message && <div className="mb-4 text-blue-600">{message}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-[350px] w-full bg-white rounded-lg shadow-md my-8 mx-auto text-sm border border-slate-200">
          <thead className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-900 rounded-t-lg text-base font-bold">
            <tr>
              <th className="py-4 px-4 text-left font-bold"></th>
              <th className="py-4 px-4 text-left font-bold">Order No</th>
              <th className="py-4 px-4 text-left font-bold">Client Name</th>
              <th className="py-4 px-4 text-left font-bold">Total Amount</th>
              <th className="py-4 px-4 text-left font-bold">Status</th>
              <th className="py-4 px-4 text-left font-bold">Remaining</th>
              <th className="py-4 px-4 text-left font-bold">Add Transaction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {orders.length === 0 ? (
              <tr>
                <td className="py-4 px-4 text-center text-slate-500" colSpan={7}>No orders found.</td>
              </tr>
            ) : (
              orders.map(order => {
                const { status, remaining } = getOrderStatus(order);
                const txns = transactionsMap[order._id] || [];
                console.log('DEBUG: Rendering order row', order, 'status:', status, 'remaining:', remaining, 'txns:', txns);
                return (
                  <React.Fragment key={order._id}>
                    <tr
                      className={`transition-colors ${expanded[order._id] ? 'bg-blue-50/40' : ''} ${order._id % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-blue-50/60`}
                      style={{ minHeight: 48 }}
                    >
                      <td className="py-3 px-4 text-center align-middle">
                        <button onClick={() => toggleExpand(order._id)} className="text-blue-600 font-bold rounded border border-blue-200 px-2 py-1 bg-white hover:bg-blue-50 transition-colors">
                          {expanded[order._id] ? "-" : "+"}
                        </button>
                      </td>
                      <td className="py-3 px-4 align-middle">{order.orderNo}</td>
                      <td className="py-3 px-4 align-middle">{clientMap[order.clientId] || order.clientId || '-'}</td>
                      <td className="py-3 px-4 align-middle">
                        ₹ {
                          Array.isArray(order.products)
                            ? order.products.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toLocaleString()
                            : 0
                        }
                      </td>
                      <td className="py-3 px-4 align-middle font-bold" style={{ color: status === "Completed" ? "green" : "orange" }}>{status}</td>
                      <td className="py-3 px-4 align-middle">₹ {remaining}</td>
                      <td className="py-3 px-4 align-middle">
                        {status === "Completed" ? (
                          <span className="text-green-600 font-semibold">Paid in full</span>
                        ) : (
                          <Button
                            className="px-4 py-1 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition-colors"
                            onClick={() => { setShowModal(true); setModalOrder(order); }}
                            disabled={loading}
                          >
                            Add
                          </Button>
                        )}
                      </td>
                    </tr>
                    {expanded[order._id] && txns.length > 0 && (
                      <tr>
                        <td colSpan={7} className="bg-blue-50/60 border-t border-b border-blue-200">
                          <div className="py-4 px-2">
                            <div className="font-semibold mb-2 text-blue-900 text-base">Transactions:</div>
                            <table className="min-w-[300px] w-full bg-white rounded shadow text-sm border border-slate-200">
                              <thead className="bg-gradient-to-r from-blue-50 to-purple-50 text-blue-800 rounded-t-lg text-base font-bold">
                                <tr>
                                  <th className="py-3 px-4 text-left font-bold">Date</th>
                                  <th className="py-3 px-4 text-left font-bold">Amount</th>
                                  <th className="py-3 px-4 text-left font-bold">Receipt</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {txns.length === 0 ? (
                                  <tr>
                                    <td className="py-3 px-4 text-center text-slate-500" colSpan={3}>No transactions found.</td>
                                  </tr>
                                ) : (
                                  txns.map(txn => {
                                    console.log('DEBUG: Rendering txn row', txn);
                                    return (
                                      <tr key={txn._id} className="hover:bg-blue-50/40 transition-colors">
                                        <td className="py-3 px-4 align-middle">{new Date(txn.date).toLocaleDateString()}</td>
                                        <td className="py-3 px-4 align-middle">₹ {txn.amount}</td>
                                        <td className="py-3 px-4 align-middle">
                                          <button
                                            style={{ padding: '4px 8px', border: '1px solid #007bff', borderRadius: 4, background: '#fff', color: '#007bff', cursor: 'pointer' }}
                                            onClick={() => {
                                              const token = cookies.get("auth-token");
                                              const url = `${BACKEND_URL}/transaction/receipt/${txn._id}`;
                                              window.open(url + (token ? `?token=${encodeURIComponent(token)}` : ''), "_blank");
                                            }}
                                          >
                                            Preview Receipt
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {/* Transaction Modal */}
      <Modal activeModal={showModal} onClose={() => setShowModal(false)} title="Add Transaction" className="max-w-lg" centered>
        <form onSubmit={e => { e.preventDefault(); handleModalAddTransaction(); }} className="space-y-4">
          <Textinput
            label="Date"
            type="date"
            value={txnForm.date}
            onChange={e => setTxnForm(f => ({ ...f, date: e.target.value }))}
            error={txnFormErrors.date}
          />
          <Textinput
            label="Amount"
            type="number"
            value={txnForm.amount}
            onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))}
            error={txnFormErrors.amount}
            min={1}
            className={txnFormErrors.amount ? 'border-red-500' : ''}
          />
          <div>
            <label className="block mb-1 font-medium">Transaction Type</label>
            <select
              className="form-control py-2 w-full"
              value={txnForm.transactionType}
              onChange={e => setTxnForm(f => ({ ...f, transactionType: e.target.value, paymentMethod: "", txnNumber: "" }))}
            >
              {transactionTypes.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {txnFormErrors.transactionType && <div className="text-danger-500 text-sm mt-1">{txnFormErrors.transactionType}</div>}
          </div>
          {txnForm.transactionType === "online" && (
            <>
              <div>
                <label className="block mb-1 font-medium">Payment Method</label>
                <select
                  className="form-control py-2 w-full"
                  value={txnForm.paymentMethod}
                  onChange={e => setTxnForm(f => ({ ...f, paymentMethod: e.target.value }))}
                >
                  <option value="">Select Payment Method</option>
                  {paymentMethods.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {txnFormErrors.paymentMethod && <div className="text-danger-500 text-sm mt-1">{txnFormErrors.paymentMethod}</div>}
              </div>
              <Textinput
                label="Transaction Number (optional)"
                value={txnForm.txnNumber}
                onChange={e => setTxnForm(f => ({ ...f, txnNumber: e.target.value }))}
              />
            </>
          )}
          {/* Media File Upload - only show if not cash */}
          {txnForm.transactionType !== "cash" && (
            <div>
              <label className="block mb-1 font-medium">Transaction Media (optional)</label>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={e => setMediaFile(e.target.files[0])}
                className="form-control py-2 w-full"
              />
              {mediaFile && (
                <div className="text-xs text-gray-500 mt-1">Selected: {mediaFile.name}</div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Adding..." : "Add Transaction"}</Button>
          </div>
        </form>
      </Modal>
      {/* PDF Preview Modal */}
      {/* Removed modal for receipt preview, now opens in new tab */}
    </div>
  );
};

export default Transactions; 