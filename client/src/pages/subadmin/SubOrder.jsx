import React, { useEffect, useState } from "react";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";

const SubOrder = () => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [subOrders, setSubOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { id, toStatus }
  const [expandedOrders, setExpandedOrders] = useState(new Set()); // Track which orders are expanded
  const [selectedSubOrders, setSelectedSubOrders] = useState(new Set()); // Track selected sub-orders
  const [bulkAction, setBulkAction] = useState(""); // Selected bulk action
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const fetchSubOrders = async () => {
    setLoading(true);
    setError("");
    const token = cookies.get("auth-token");
    const res = await apiCall("GET", "sub-order/all", null, token);
    if (res && Array.isArray(res)) {
      setSubOrders(res);
    } else if (res && Array.isArray(res.subOrders)) {
      setSubOrders(res.subOrders);
    } else {
      setError(res?.message || "Failed to fetch sub-orders");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSubOrders();
    // eslint-disable-next-line
  }, []);

  const handleMarkDispatched = async (subOrderId) => {
    setActionLoading(true);
    setError("");
    const token = cookies.get("auth-token");
    const res = await apiCall(
      "PATCH",
      `sub-order/${subOrderId}/status`,
      { status: "DISPATCHED" },
      token
    );
    setActionLoading(false);
    setConfirmId(null);
    if (res && res.message && res.message.toLowerCase().includes("success")) {
      fetchSubOrders();
    } else {
      setError(res?.message || "Failed to update status");
    }
  };

  const handleStatusChange = async (subOrderId, toStatus) => {
    setActionLoading(true);
    setError("");
    const token = cookies.get("auth-token");
    const res = await apiCall(
      "PATCH",
      `sub-order/${subOrderId}/status`,
      { status: toStatus },
      token
    );
    setActionLoading(false);
    setConfirmAction(null);
    if (res && res.message && res.message.toLowerCase().includes("success")) {
      fetchSubOrders();
    } else {
      setError(res?.message || "Failed to update status");
    }
  };

  // Bulk status update
  const handleBulkStatusUpdate = async () => {
    if (!bulkAction || selectedSubOrders.size === 0) return;
    
    setBulkActionLoading(true);
    setError("");
    const token = cookies.get("auth-token");
    
    try {
      const response = await apiCall(
        "PATCH", 
        "sub-order/bulk/status", 
        { 
          subOrderIds: Array.from(selectedSubOrders),
          status: bulkAction 
        }, 
        token
      );
      
      console.log("Bulk update response:", response);
      console.log("Response type:", typeof response);
      console.log("Response keys:", response ? Object.keys(response) : 'null');
      
      if (response && response.success === false) {
        // API returned an error
        setError(response.message || "Failed to update sub-orders");
      } else if (response && response.message) {
        // Success case
        console.log("Bulk update result:", response.result);
        
        // Clear selection and refresh data
        setSelectedSubOrders(new Set());
        setBulkAction("");
        setShowBulkConfirm(false);
        fetchSubOrders();
        
        // Show success message and clear any previous errors
        if (response.result && response.result.successCount > 0) {
          setError(""); // Clear any previous errors
        }
      } else {
        console.error("Unexpected response format:", response);
        setError("Unexpected response format from server");
      }
    } catch (error) {
      console.error("Bulk update error:", error);
      setError(error.message || "Failed to update some sub-orders. Please try again.");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Toggle sub-order selection
  const toggleSubOrderSelection = (subOrderId) => {
    const newSelected = new Set(selectedSubOrders);
    if (newSelected.has(subOrderId)) {
      newSelected.delete(subOrderId);
    } else {
      newSelected.add(subOrderId);
    }
    setSelectedSubOrders(newSelected);
    console.log('Selected sub-orders:', Array.from(newSelected));
  };

  // Select all sub-orders in an order
  const selectAllInOrder = (orderSubOrders) => {
    const orderSubOrderIds = orderSubOrders.map(so => so._id);
    const newSelected = new Set(selectedSubOrders);
    
    // Check if all are already selected
    const allSelected = orderSubOrderIds.every(id => newSelected.has(id));
    
    if (allSelected) {
      // Deselect all
      orderSubOrderIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all
      orderSubOrderIds.forEach(id => newSelected.add(id));
    }
    
    setSelectedSubOrders(newSelected);
  };

  // Group sub-orders by order number
  const groupedSubOrders = subOrders.reduce((acc, subOrder) => {
    const orderNo = subOrder.orderNo;
    if (!acc[orderNo]) {
      acc[orderNo] = [];
    }
    acc[orderNo].push(subOrder);
    return acc;
  }, {});

  // Toggle expanded state for an order
  const toggleExpanded = (orderNo) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderNo)) {
      newExpanded.delete(orderNo);
    } else {
      newExpanded.add(orderNo);
    }
    setExpandedOrders(newExpanded);
  };

  // Get order summary stats
  const getOrderSummary = (orderSubOrders) => {
    const totalSubOrders = orderSubOrders.length;
    const pendingCount = orderSubOrders.filter(so => so.status === "PENDING").length;
    const dispatchedCount = orderSubOrders.filter(so => so.status === "DISPATCHED").length;
    const completedCount = orderSubOrders.filter(so => so.status === "COMPLETED").length;
    
    return { totalSubOrders, pendingCount, dispatchedCount, completedCount };
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Sub-Admin: Sub-Orders Management</h1>
      
      {/* Bulk Actions Bar */}
      {console.log('Rendering bulk actions bar. Selected count:', selectedSubOrders.size)}
      {selectedSubOrders.size > 0 && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-blue-900">
                🎯 {selectedSubOrders.size} sub-order{selectedSubOrders.size !== 1 ? 's' : ''} selected
              </span>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="border border-blue-300 rounded px-3 py-1 text-sm bg-white font-medium"
              >
                <option value="">Select Action</option>
                <option value="PENDING">Mark as Pending</option>
                <option value="DISPATCHED">Mark as Dispatched</option>
                <option value="COMPLETED">Mark as Completed</option>
              </select>
              {bulkAction && (
                <button
                  onClick={() => setShowBulkConfirm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 shadow-md"
                  disabled={bulkActionLoading}
                >
                  {bulkActionLoading ? "⏳ Updating..." : "✅ Apply"}
                </button>
              )}
            </div>
            <button
              onClick={() => setSelectedSubOrders(new Set())}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ❌ Clear Selection
            </button>
          </div>
        </div>
      )}
      
      {/* Debug Info - Remove this after testing */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mb-2">
          Debug: Selected count = {selectedSubOrders.size}, Selected IDs = {Array.from(selectedSubOrders).join(', ')}
          <br />
          Bulk Action: {bulkAction || 'None'}, Show Confirm: {showBulkConfirm ? 'Yes' : 'No'}
        </div>
      )}

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-500 mb-4">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[350px] w-full bg-white rounded-lg shadow-md my-8 mx-auto text-sm border border-slate-200">
            <thead className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-900 rounded-t-lg text-base font-bold">
              <tr>
                <th className="py-4 px-4 text-left font-bold">Order No</th>
                <th className="py-4 px-4 text-left font-bold">Client</th>
                <th className="py-4 px-4 text-left font-bold">Sub-Orders Summary</th>
                <th className="py-4 px-4 text-left font-bold">Status Overview</th>
                <th className="py-4 px-4 text-left font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(groupedSubOrders).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">No sub-orders found.</td>
                </tr>
              ) : (
                Object.entries(groupedSubOrders).map(([orderNo, orderSubOrders]) => {
                  const summary = getOrderSummary(orderSubOrders);
                  const isExpanded = expandedOrders.has(orderNo);
                  const clientName = orderSubOrders[0]?.clientId?.name || '-';
                  const orderSubOrderIds = orderSubOrders.map(so => so._id);
                  const selectedInOrder = orderSubOrderIds.filter(id => selectedSubOrders.has(id)).length;
                  const allSelectedInOrder = selectedInOrder === orderSubOrderIds.length && orderSubOrderIds.length > 0;
                  
                  return (
                    <React.Fragment key={orderNo}>
                      {/* Main Order Row */}
                      <tr className="border-b border-slate-100 hover:bg-slate-50 bg-gray-50">
                        <td className="py-3 px-4 font-semibold">
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleExpanded(orderNo)}
                              className="mr-2 text-blue-600 hover:text-blue-800 transition-transform"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            >
                              ▶
                            </button>
                            Order #{orderNo}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold">{clientName}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <span className="font-medium">{summary.totalSubOrders}</span> sub-orders
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 text-xs">
                            {summary.pendingCount > 0 && (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                {summary.pendingCount} Pending
                              </span>
                            )}
                            {summary.dispatchedCount > 0 && (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {summary.dispatchedCount} Dispatched
                              </span>
                            )}
                            {summary.completedCount > 0 && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                {summary.completedCount} Completed
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpanded(orderNo)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              {isExpanded ? 'Hide Details' : 'Show Details'}
                            </button>
                            {isExpanded && (
                              <button
                                onClick={() => selectAllInOrder(orderSubOrders)}
                                className={`text-xs px-2 py-1 rounded ${
                                  allSelectedInOrder 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {allSelectedInOrder ? 'Deselect All' : 'Select All'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Sub-Orders Rows (when expanded) */}
                      {isExpanded && orderSubOrders.map((so) => (
                        <tr key={so._id} className="border-b border-slate-100 hover:bg-slate-50 bg-white">
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <div className="w-4 mr-4"></div> {/* Indent */}
                              <input
                                type="checkbox"
                                checked={selectedSubOrders.has(so._id)}
                                onChange={() => toggleSubOrderSelection(so._id)}
                                className="mr-2 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-gray-500 text-xs">Sub-Order</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="ml-4">
                              <div className="font-medium">{so.productId?.name || '-'}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="ml-4">
                              <div className="font-medium">{so.quantity} {so.unitType}</div>
                              <div className="text-xs text-gray-500">
                                Date: {so.date ? new Date(so.date).toLocaleDateString() : '-'}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="ml-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                so.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                so.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                so.status === 'DISPATCHED' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {so.status}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="ml-4">
                              {so.status === "PENDING" || so.status === "DISPATCHED" || so.status === "COMPLETED" ? (
                                <>
                                  <button
                                    className={`px-3 py-1 rounded text-xs font-semibold ${
                                      so.status === "PENDING" ? "bg-blue-600 text-white hover:bg-blue-700" : 
                                      so.status === "DISPATCHED" ? "bg-yellow-500 text-white hover:bg-yellow-600" :
                                      "bg-green-600 text-white hover:bg-green-700"
                                    }`}
                                    onClick={() => setConfirmAction({ 
                                      id: so._id, 
                                      toStatus: so.status === "PENDING" ? "DISPATCHED" : 
                                               so.status === "DISPATCHED" ? "COMPLETED" : "PENDING" 
                                    })}
                                    disabled={actionLoading}
                                  >
                                    {so.status === "PENDING" ? "Mark as Dispatched" : 
                                     so.status === "DISPATCHED" ? "Mark as Completed" : "Mark as Pending"}
                                  </button>
                                  {confirmAction && confirmAction.id === so._id && (
                                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-6 relative animate-fadeIn">
                                        <div className="text-lg font-semibold mb-4">Confirm Status Update</div>
                                        <div className="mb-6">Are you sure you want to mark this sub-order as <b>{confirmAction.toStatus === "DISPATCHED" ? "Dispatched" : confirmAction.toStatus === "COMPLETED" ? "Completed" : "Pending"}</b>?</div>
                                        <div className="flex justify-end gap-4">
                                          <button
                                            className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold"
                                            onClick={() => setConfirmAction(null)}
                                            disabled={actionLoading}
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            className="px-4 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700"
                                            onClick={() => handleStatusChange(so._id, confirmAction.toStatus)}
                                            disabled={actionLoading}
                                          >
                                            {actionLoading ? "Updating..." : "Yes, Update"}
                                          </button>
                                        </div>
                                      </div>
                                      <style>{`
                                        @keyframes fadeIn {
                                          from { opacity: 0; transform: translateY(30px) scale(0.98); }
                                          to { opacity: 1; transform: translateY(0) scale(1); }
                                        }
                                        .animate-fadeIn { animation: fadeIn 0.25s cubic-bezier(.4,0,.2,1); }
                                      `}</style>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-green-600 font-semibold">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-fadeIn">
            <div className="text-lg font-semibold mb-4">Confirm Bulk Status Update</div>
            <div className="mb-6">
              Are you sure you want to mark <b>{selectedSubOrders.size} sub-order{selectedSubOrders.size !== 1 ? 's' : ''}</b> as <b>{bulkAction}</b>?
            </div>
            <div className="flex justify-end gap-4">
              <button
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold"
                onClick={() => setShowBulkConfirm(false)}
                disabled={bulkActionLoading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700"
                onClick={handleBulkStatusUpdate}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading ? "Updating..." : "Yes, Update All"}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(30px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .animate-fadeIn { animation: fadeIn 0.25s cubic-bezier(.4,0,.2,1); }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default SubOrder; 