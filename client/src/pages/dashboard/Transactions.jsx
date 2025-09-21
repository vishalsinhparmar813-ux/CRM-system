import React, { useState, useEffect } from "react";
import useApi from "../../hooks/useApi";
import useToast from "../../hooks/useToast";
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


const Transactions = () => {
  const { apiCall } = useApi();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const cookies = new Cookies();
  const [clientsWithOrders, setClientsWithOrders] = useState([]);
  const [expandedClients, setExpandedClients] = useState({});
  const [expandedOrders, setExpandedOrders] = useState({});
  const [expandedTransactions, setExpandedTransactions] = useState({});
  const [expandedRemarks, setExpandedRemarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalOrder, setModalOrder] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [txnForm, setTxnForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    transactionType: "cash",
    paymentMethod: "",
    txnNumber: "",
    remarks: "",
  });
  const [txnFormErrors, setTxnFormErrors] = useState({});
  const [mediaFile, setMediaFile] = useState(null);
  const [addTransactionLoading, setAddTransactionLoading] = useState(false);

  // Helper function to validate and format amount
  const validateAmount = (value) => {
    const cleaned = value.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length === 2 && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].substring(0, 2);
    }
    return cleaned;
  };

  // Centralized function to handle PDF downloads
  const downloadTransactionReceipt = async (transactionId) => {
    try {
      toastInfo("Loading transaction receipt preview...");
      const token = cookies.get("auth-token");
      
      // Import centralized configuration
      const { apiEndpoint } = await import('../../constant/common');
      
      const response = await fetch(`${apiEndpoint}transaction/receipt/${transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Received empty PDF file');
      }

      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      
    } catch (error) {
      console.error('Error downloading transaction receipt:', error);
      toastError('Failed to download transaction receipt');
    }
  };

  // Centralized function to process orders data into clients structure
  const processOrdersData = (orders) => {
    const clientsMap = {};
    
    orders.forEach(order => {
      const clientId = order.clientId;
      const clientName = order.clientName || 'Unknown Client';
      
      if (!clientsMap[clientId]) {
        clientsMap[clientId] = {
          clientId,
          clientName,
          orders: [],
          totalOrders: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalRemaining: 0,
          pendingOrders: 0
        };
      }
      
      // Calculate order totals
      const orderTotal = order.totalAmount || 
        (Array.isArray(order.products) ? order.products.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) : 0);
      const orderPaid = (order.transactions || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const orderRemaining = Math.max(0, orderTotal - orderPaid);
      
      clientsMap[clientId].orders.push({
        ...order,
        calculatedTotal: orderTotal,
        calculatedPaid: orderPaid,
        calculatedRemaining: orderRemaining
      });
      
      clientsMap[clientId].totalOrders += 1;
      clientsMap[clientId].totalAmount += orderTotal;
      clientsMap[clientId].totalPaid += orderPaid;
      clientsMap[clientId].totalRemaining += orderRemaining;
      
      if (orderRemaining > 0 && order.status !== "CLOSED") {
        clientsMap[clientId].pendingOrders += 1;
      }
    });
    
    // Convert to array and sort by client name
    return Object.values(clientsMap).sort((a, b) => 
      a.clientName.localeCompare(b.clientName)
    );
  };

  // Centralized function to fetch and refresh data
  const fetchTransactionData = async () => {
    setLoading(true);
    setMessage("");
    const token = cookies.get("auth-token");
    
    try {
      const res = await apiCall("GET", "order/all-with-transactions", null, token);
      
      if (res.success === false) {
        throw new Error(res.message || 'Failed to fetch transaction data');
      }
      
      const orders = res.orders || [];
      const clientsArray = processOrdersData(orders);
      setClientsWithOrders(clientsArray);
      
    } catch (error) {
      console.error('Error fetching clients with orders:', error);
      const errorMessage = error.message || 'Failed to load transaction data';
      setMessage(errorMessage);
      toastError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all orders with transactions grouped by clients
  useEffect(() => {
    fetchTransactionData();
  }, []);

  // Toggle client expansion
  const toggleClientExpansion = (clientId) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  // Toggle order expansion within client
  const toggleOrderExpansion = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Toggle transaction expansion for online payment details
  const toggleTransactionExpansion = (txnId) => {
    setExpandedTransactions(prev => ({
      ...prev,
      [txnId]: !prev[txnId]
    }));
  };

  // Toggle remarks expansion for read more functionality
  const toggleRemarksExpansion = (txnId) => {
    setExpandedRemarks(prev => ({
      ...prev,
      [txnId]: !prev[txnId]
    }));
  };

  // Add transaction for an order
  const handleModalAddTransaction = async () => {
    const errors = {};
    const remaining = modalOrder ? modalOrder.calculatedRemaining : null;
    const amount = Number(txnForm.amount);
    
    // Amount validation
    if (!txnForm.amount || txnForm.amount.trim() === '') {
      errors.amount = "Amount is required";
    } else if (isNaN(amount)) {
      errors.amount = "Please enter a valid number";
    } else if (amount <= 0) {
      errors.amount = "Amount must be greater than 0";
    } else if (remaining !== null && amount > remaining) {
      errors.amount = `Amount cannot exceed remaining amount (₹${remaining.toLocaleString()})`;
    } else if (amount > 999999999) {
      errors.amount = "Amount is too large";
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

    setAddTransactionLoading(true);
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
    if (txnForm.remarks) {
      formData.append("remarks", txnForm.remarks);
    }
    if (mediaFile) {
      formData.append("mediaFile", mediaFile);
    }

    try {
      const res = await apiCall("POST", "transaction/pay", formData, token, "multipart/form-data");
      
      if (res.success === false) {
        throw new Error(res.message || "Failed to add transaction");
      }
      
      if (res?.transactionId) {
        const successMessage = res?.message || "Transaction added successfully";
        setMessage(successMessage);
        toastSuccess(successMessage);
        
        // Reset form
        setTxnForm({
          date: new Date().toISOString().slice(0, 10),
          amount: "",
          transactionType: "cash",
          paymentMethod: "",
          txnNumber: "",
          remarks: "",
        });
        setMediaFile(null);
        setShowModal(false);
        setTxnFormErrors({});
        
        // Refresh data using centralized function
        await fetchTransactionData();
      } else {
        throw new Error(res?.message || "Failed to add transaction");
      }
    } catch (err) {
      console.error("Error adding transaction:", err);
      const errorMessage = err.message || "Failed to add transaction";
      setMessage(errorMessage);
      toastError(errorMessage);
    }
    setAddTransactionLoading(false);
  };

  const handleCloseOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to close this order? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setMessage("");
    
    try {
      const token = cookies.get("auth-token");
      const response = await apiCall("PATCH", `order/${orderId}/close`, null, token);
      
      if (response.success === false) {
        throw new Error(response.message || 'Failed to close order');
      }
      
      const successMessage = response?.message || 'Order closed successfully';
      setMessage(successMessage);
      toastSuccess(successMessage);
      
      // Refresh data using centralized function instead of page reload
      await fetchTransactionData();
      
    } catch (error) {
      console.error('Error closing order:', error);
      const errorMessage = error.message || 'Failed to close order';
      setMessage(errorMessage);
      toastError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaction Management</h1>
          <p className="text-gray-600 mt-1">Manage transactions organized by clients and their orders.</p>
        </div>
        <Button
          onClick={fetchTransactionData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Refreshing...
            </div>
          ) : (
            "Refresh Data"
          )}
        </Button>
      </div>
      
      {message && (
        <div className={`mb-4 p-3 rounded-lg border ${
          message.includes('successfully') || message.includes('Success')
            ? 'bg-green-50 border-green-200 text-green-800'
            : message.includes('Failed') || message.includes('Error')
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-blue-600 bg-blue-50 border border-blue-200">
            <div className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            Loading transaction data...
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {clientsWithOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No transaction data found.</div>
          ) : (
            clientsWithOrders.map(client => (
              <div key={client.clientId} className="bg-white rounded-lg shadow-md border border-gray-200">
                {/* Client Header */}
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => toggleClientExpansion(client.clientId)}
                        className="text-blue-600 font-bold rounded border border-blue-200 px-3 py-1 bg-white hover:bg-blue-50 transition-colors"
                      >
                        {expandedClients[client.clientId] ? "−" : "+"}
                      </button>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{client.clientName}</h3>
                        <p className="text-sm text-gray-600">
                          {client.totalOrders} orders • {client.pendingOrders} pending
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        Total: ₹{client.totalAmount.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">
                        Paid: ₹{client.totalPaid.toLocaleString()} • 
                        Remaining: ₹{client.totalRemaining.toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedClient(client);
                        setExpandedClients(prev => ({ ...prev, [client.clientId]: true }));
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold"
                    >
                      View Details
                    </button>
                  </div>
                </div>

                {/* Client Orders (Expandable) */}
                {expandedClients[client.clientId] && (
                  <div className="p-4">
                    <h4 className="text-md font-semibold mb-3 text-gray-800">Orders</h4>
                    <div className="space-y-3">
                      {client.orders.map(order => (
                        <div key={order._id} className="border border-gray-200 rounded-lg">
                          {/* Order Header */}
                          <div className="p-3 bg-gray-50 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => toggleOrderExpansion(order._id)}
                                  className="text-blue-600 font-bold rounded border border-blue-200 px-2 py-1 bg-white hover:bg-blue-50 transition-colors text-sm"
                                >
                                  {expandedOrders[order._id] ? "−" : "+"}
                                </button>
                                <div>
                                  <span className="font-semibold">Order #{order.orderNo}</span>
                                  <span className="ml-3 text-sm text-gray-600">
                                    {(order.orderDate || order.date) ? new Date(order.orderDate || order.date).toLocaleDateString() : 'No date'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-4">
                                <div className="text-right text-sm">
                                  <div>Total: ₹{order.calculatedTotal.toLocaleString()}</div>
                                  <div className="text-gray-600">
                                    Remaining: ₹{order.calculatedRemaining.toLocaleString()}
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  {order.status === "CLOSED" ? (
                                    <span className="text-gray-600 font-semibold text-sm">Order Closed</span>
                                  ) : order.calculatedRemaining <= 0 ? (
                                    <span className="text-green-600 font-semibold text-sm">Paid in full</span>
                                  ) : (
                                    <Button
                                      className="px-3 py-1 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition-colors text-sm"
                                      onClick={() => { 
                                        setShowModal(true); 
                                        setModalOrder(order); 
                                      }}
                                      disabled={addTransactionLoading}
                                    >
                                      {addTransactionLoading ? (
                                        <div className="flex items-center justify-center">
                                          <div className="spinner-border animate-spin inline-block w-4 h-4 border-2 rounded-full text-white" role="status">
                                            <span className="sr-only">Loading...</span>
                                          </div>
                                          <span className="ml-2">Adding...</span>
                                        </div>
                                      ) : (
                                        "Add Transaction"
                                      )}
                                    </Button>
                                  )}
                                  {order.status !== "CLOSED" && (
                                    <Button
                                      className="px-3 py-1 rounded bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition-colors text-sm"
                                      onClick={() => handleCloseOrder(order._id)}
                                      disabled={loading}
                                    >
                                      Close Order
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Order Transactions (Expandable) */}
                          {expandedOrders[order._id] && (
                            <div className="p-3">
                              <h5 className="text-sm font-semibold mb-2 text-gray-700">Transactions</h5>
                              {(order.transactions || []).length === 0 ? (
                                <p className="text-sm text-gray-500">No transactions yet.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full bg-white rounded border border-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700">Date</th>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700">Amount</th>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700">Type</th>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700">Payment Details</th>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700">Remarks</th>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700">Receipt</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {order.transactions.map(txn => (
                                        <React.Fragment key={txn._id}>
                                          <tr className="hover:bg-gray-50">
                                            <td className="py-2 px-3">{new Date(txn.date).toLocaleDateString()}</td>
                                            <td className="py-2 px-3 font-semibold">₹{txn.amount.toLocaleString()}</td>
                                            <td className="py-2 px-3">
                                              <div className="flex items-center space-x-2">
                                                {txn.transactionType === 'online' && (
                                                  <button
                                                    onClick={() => toggleTransactionExpansion(txn._id)}
                                                    className="text-blue-600 font-bold text-sm hover:text-blue-800 transition-colors"
                                                    title="View online payment details"
                                                  >
                                                    {expandedTransactions[txn._id] ? "−" : "+"}
                                                  </button>
                                                )}
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                  txn.transactionType === 'cash' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                  {txn.transactionType === 'cash' ? 'Cash' : 'Online'}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-2 px-3">
                                              {txn.transactionType === 'online' ? (
                                                <div className="text-xs">
                                                  <div className="font-medium capitalize">{txn.paymentMethod?.replace('_', ' ')}</div>
                                                  {txn.txnNumber && <div className="text-gray-600">#{txn.txnNumber}</div>}
                                                </div>
                                              ) : (
                                                <span className="text-gray-500 text-xs">Cash Payment</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3">
                                              {txn.remarks ? (
                                                <div className="text-xs">
                                                  <span 
                                                    className="text-gray-700 cursor-pointer" 
                                                    title={txn.remarks}
                                                  >
                                                    {expandedRemarks[txn._id] || txn.remarks.length <= 30 
                                                      ? txn.remarks 
                                                      : `${txn.remarks.substring(0, 30)}...`}
                                                  </span>
                                                  {txn.remarks.length > 30 && (
                                                    <button
                                                      onClick={() => toggleRemarksExpansion(txn._id)}
                                                      className="ml-1 text-blue-600 hover:text-blue-800 font-medium"
                                                    >
                                                      {expandedRemarks[txn._id] ? 'Show less' : 'Read more'}
                                                    </button>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-xs text-gray-500">No remarks</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3">
                                              <button
                                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors border border-blue-300"
                                                onClick={() => downloadTransactionReceipt(txn._id)}
                                              >
                                                Preview Receipt
                                              </button>
                                            </td>
                                          </tr>
                                          {/* Expandable Online Payment Details Row */}
                                          {txn.transactionType === 'online' && expandedTransactions[txn._id] && (
                                            <tr className="bg-blue-50">
                                              <td colSpan="6" className="py-3 px-3">
                                                <div className="bg-white rounded-lg p-3 border border-blue-200">
                                                  <h6 className="text-sm font-semibold text-blue-900 mb-2">Online Payment Details</h6>
                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                    <div>
                                                      <span className="font-medium text-gray-700">Payment Method:</span>
                                                      <span className="ml-2 capitalize">{txn.paymentMethod?.replace('_', ' ') || 'Not specified'}</span>
                                                    </div>
                                                    {txn.txnNumber && (
                                                      <div>
                                                        <span className="font-medium text-gray-700">Transaction Number:</span>
                                                        <span className="ml-2 font-mono">{txn.txnNumber}</span>
                                                      </div>
                                                    )}
                                                    {txn.mediaFileUrl && (
                                                      <div>
                                                        <span className="font-medium text-gray-700">Attachment:</span>
                                                        <a 
                                                          href={txn.mediaFileUrl} 
                                                          target="_blank" 
                                                          rel="noopener noreferrer"
                                                          className="ml-2 text-blue-600 hover:text-blue-800 underline"
                                                        >
                                                          View File
                                                        </a>
                                                      </div>
                                                    )}
                                                    {txn.remarks && (
                                                      <div className="md:col-span-2">
                                                        <span className="font-medium text-gray-700">Full Remarks:</span>
                                                        <div className="ml-2 mt-1 text-gray-600 bg-gray-50 p-2 rounded border">
                                                          {txn.remarks}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Transaction Modal */}
      <Modal activeModal={showModal} onClose={() => setShowModal(false)} title="Add Transaction" className="max-w-lg" centered>
        <form onSubmit={e => { e.preventDefault(); handleModalAddTransaction(); }} className="space-y-4">
          {modalOrder && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-900">Order #{modalOrder.orderNo}</span>
                <span className="text-sm text-blue-700">
                  Remaining Amount: <span className="font-bold">₹{modalOrder.calculatedRemaining.toLocaleString()}</span>
                </span>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Total Amount: ₹{modalOrder.calculatedTotal.toLocaleString()}
              </div>
            </div>
          )}
          
          <Textinput
            label={<span>Date <span className="text-red-500">*</span></span>}
            type="date"
            value={txnForm.date}
            onChange={e => setTxnForm(f => ({ ...f, date: e.target.value }))}
            error={txnFormErrors.date}
          />
          <Textinput
            label={<span>Amount <span className="text-red-500">*</span></span>}
            type="number"
            value={txnForm.amount}
            onChange={e => {
              const value = e.target.value;
              const validatedValue = validateAmount(value);
              setTxnForm(f => ({ ...f, amount: validatedValue }));
              if (txnFormErrors.amount) {
                setTxnFormErrors(prev => ({ ...prev, amount: '' }));
              }
            }}
            error={txnFormErrors.amount}
            min="0.01"
            max={modalOrder ? modalOrder.calculatedRemaining : undefined}
            step="0.01"
            placeholder={modalOrder ? `Max: ₹${modalOrder.calculatedRemaining.toLocaleString()}` : "Enter amount"}
            className={txnFormErrors.amount ? 'border-red-500' : ''}
          />
          <div>
            <label className="block mb-1 font-medium">Transaction Type <span className="text-red-500">*</span></label>
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
                <label className="block mb-1 font-medium">Payment Method <span className="text-red-500">*</span></label>
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
          <div>
            <label className="block mb-1 font-medium">Remarks (optional)</label>
            <textarea
              className="form-control py-2 w-full resize-vertical"
              rows="3"
              value={txnForm.remarks}
              onChange={e => setTxnForm(f => ({ ...f, remarks: e.target.value }))}
              placeholder="Add any notes or purpose for this transaction..."
            />
          </div>
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
            <Button type="submit" className="btn btn-primary" disabled={addTransactionLoading}>
              {addTransactionLoading ? (
                <div className="flex items-center justify-center">
                  <div className="spinner-border animate-spin inline-block w-4 h-4 border-2 rounded-full text-white" role="status">
                    <span className="sr-only">Loading...</span>
                  </div>
                  <span className="ml-2">Adding...</span>
                </div>
              ) : (
                "Add Transaction"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Transactions;