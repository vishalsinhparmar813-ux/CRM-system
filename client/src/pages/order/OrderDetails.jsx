import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import { getUnitLabel } from "../../utils/unitUtils";
import { toastError, toastSuccess } from "../../utils/toastUtils";

// -----------------------------
// Order Details (Dispatch Ready)
// -----------------------------
const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { apiCall } = useApi();
  const cookies = new Cookies();

  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientData, setClientData] = useState(null);

  const [showDispatch, setShowDispatch] = useState(false);
  const [submittingDispatch, setSubmittingDispatch] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFilename, setPdfFilename] = useState("");
  const [dispatchOrders, setDispatchOrders] = useState([]);
  
  // Dispatch date state - will be set to order date when order loads
  const [dispatchDate, setDispatchDate] = useState("");

  // Frontend Dispatch Form (kept in sync with the modal + PDF)
  const [dispatchForm, setDispatchForm] = useState({
    // invoice / logistics
    type: "By Road",          // By Road | Pickup | Courier
    destination: "",
    vehicleNo: "",
    // ship-to (consignee)
    consigneeName: "",
    consigneeAddress: "",
    consigneeContact: "",
    consigneeState: "",
    // bill-to (buyer)
    buyerName: "",
    buyerAddress: "",
    buyerContact: "",
    buyerState: "",
    // products
    lines: [],
    // GST enabled flag
    gstEnabled: false,
  });

  const [validationErrors, setValidationErrors] = useState({});

  // Production-ready PDF download helper function
  const downloadPDF = async (endpoint, data, token, method = 'POST') => {
    try {
      // Import centralized configuration
      const { apiEndpoint } = await import('../../constant/common');
      
      // Make standardized API call for PDF download
      const response = await fetch(`${apiEndpoint}${endpoint}`, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: method === 'GET' ? undefined : JSON.stringify(data || {})
      });

      // Handle authentication errors (session expired)
      if (response.status === 401) {
        cookies.remove("auth-token");
        toastError("Your session has expired. Please login again");
        navigate("/login");
        throw new Error('Session expired');
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      // Get PDF blob
      const blob = await response.blob();
      
      // Validate blob
      if (!blob || blob.size === 0) {
        throw new Error('Received empty PDF file');
      }

      // Validate content type
      if (!blob.type.includes('pdf')) {
        console.warn('Response may not be a PDF:', blob.type);
      }

      return blob;
    } catch (error) {
      console.error(`PDF Download Error [${endpoint}]:`, error);
      throw error;
    }
  };

  // -----------------------------
  // Helpers
  // -----------------------------
  const numberToWords = (num) => {
    const n = Math.floor(Number(num) || 0);
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];

    if (n === 0) return "Zero";
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`;
    if (n < 1000) {
      const rem = n % 100;
      return `${ones[Math.floor(n / 100)]} Hundred${rem ? " and " + numberToWords(rem) : ""}`;
    }
    if (n < 100000) {
      const rem = n % 1000;
      return `${numberToWords(Math.floor(n / 1000))} Thousand${rem ? " " + numberToWords(rem) : ""}`;
    }
    if (n < 10000000) {
      const rem = n % 100000;
      return `${numberToWords(Math.floor(n / 100000))} Lakh${rem ? " " + numberToWords(rem) : ""}`;
    }
    const rem = n % 10000000;
    return `${numberToWords(Math.floor(n / 10000000))} Crore${rem ? " " + numberToWords(rem) : ""}`;
  };

  const openDispatchModal = () => setShowDispatch(true);
  const closeDispatchModal = () => setShowDispatch(false);
  const openPdfPreview = () => setShowPdfPreview(true);
  const closePdfPreview = () => {
    setShowPdfPreview(false);
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setPdfFilename("");
  };

  const updateLineQty = (index, qty) => {
    setDispatchForm((prev) => {
      const lines = [...prev.lines];
      const max = Number(lines[index].remainingQuantity || 0);
      let value = Number(qty || 0);
      if (value < 0) value = 0;
      if (value > max) value = max;
      lines[index] = { ...lines[index], quantity: value };
      return { ...prev, lines };
    });
  };

  // -----------------------------
  // Data Fetch
  // -----------------------------
  useEffect(() => {
    if (orderId) fetchOrderDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = cookies.get("auth-token");
      const response = await apiCall("GET", `order/${orderId}`, null, token);

      if (response?.data) {
        const order = response.data;
        setOrderDetails(order);

        // Initialize modal/dispatch form lines from order products (respect remaining qty)
        const lines = (order.products || []).map((p) => ({
          productId: p.productId,
          productName: p.productName || p.productId || "Unknown Product",
          unitType: p.unitType || "-",
          ratePrice: Number(p.ratePrice || 0),
          remainingQuantity: Number(p.remainingQuantity ?? p.quantity ?? 0),
          numberOfItems: p.numberOfItems || 1,
          quantity: 0,
        }));

        // Set dispatch date to order creation date
        const orderDate = order.orderDate || order.date || order.createdAt;
        if (orderDate) {
          const formattedOrderDate = new Date(orderDate).toISOString().split('T')[0];
          setDispatchDate(formattedOrderDate);
        }

        // Initialize dispatch form with basic order data
        setDispatchForm({
          consigneeName: "",
          consigneeAddress: "",
          consigneeContact: "",
          consigneeState: "",
          // bill-to (buyer)
          buyerName: "",
          buyerAddress: "",
          buyerContact: "",
          buyerState: "",
          // products
          lines: lines,
          // dispatch details
          type: "By Road",
          destination: "",
          vehicleNo: "",
        });

        // Fetch client data to populate addresses AFTER form initialization
        if (order.clientId) {
          await fetchClientData(order.clientId, token);
        }

        // Fetch dispatch orders for this order
        await fetchDispatchOrders();
      } else {
        setError("Failed to fetch order details");
      }
    } catch (err) {
      setError(err?.message || "Error fetching order details");
      console.error("Error fetching order details:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch dispatch orders for this order
  const fetchDispatchOrders = async () => {
    try {
      const token = cookies.get("auth-token");
      const response = await apiCall("GET", `sub-order/invoices/${orderId}`, null, token);
      console.log("Dispatch orders response:", response);
      
      if (response?.success && response?.invoices) {
        setDispatchOrders(response.invoices);
      } else if (Array.isArray(response)) {
        setDispatchOrders(response);
      } else {
        setDispatchOrders([]);
      }
    } catch (err) {
      console.error("Error fetching dispatch orders:", err);
      setDispatchOrders([]);
    }
  };

  // Handle viewing dispatch PDF
  const handleViewDispatchPDF = async (dispatchId) => {
    try {
      const token = cookies.get("auth-token");
      
      // Use standardized approach for PDF download
      const blob = await downloadPDF(`sub-order/invoices/${dispatchId}/pdf`, null, token, 'GET');
      
      const url = window.URL.createObjectURL(blob);
      
      // Set PDF preview data
      setPdfUrl(url);
      setPdfFilename(`Dispatch_Invoice_${dispatchId}.pdf`);
      setShowPdfPreview(true);
      
      toastSuccess('Dispatch PDF loaded successfully!');
    } catch (error) {
      console.error('Error generating dispatch PDF:', error);
      toastError('Failed to generate dispatch PDF: ' + error.message);
    }
  };

  // Fetch client data including addresses
  const fetchClientData = async (clientId, token) => {
    try {
      const clientResponse = await apiCall("GET", `client/${clientId}`, null, token);
      console.log("DEBUG: Full client response:", JSON.stringify(clientResponse, null, 2));
      
      if (clientResponse?.name) {
        setClientData(clientResponse);
        
        // Format addresses for display
        const formatAddress = (addr) => {
          if (!addr) return "";
          const parts = [
            addr.area,
            addr.city,
            addr.state,
            addr.country,
            addr.postalCode
          ].filter(Boolean);
          return parts.join(", ");
        };

        // Use correspondence address as fallback if permanent address is missing
        const permanentAddr = clientResponse.permanentAddress || clientResponse.correspondenceAddress;
        console.log("DEBUG: Using permanent address:", permanentAddr);

        const correspondenceFormatted = formatAddress(clientResponse.correspondenceAddress);
        const permanentFormatted = formatAddress(permanentAddr);
        
        console.log("DEBUG: Formatted addresses - Correspondence:", correspondenceFormatted, "Permanent:", permanentFormatted);

        // Update dispatch form with client addresses
        setDispatchForm((prev) => ({
          ...prev,
          // Consignee (Ship to) - use correspondence address
          consigneeName: clientResponse.name || "",
          consigneeAddress: correspondenceFormatted,
          consigneeContact: clientResponse.mobile || "",
          consigneeState: clientResponse.correspondenceAddress?.state || "",
          
          // Buyer (Bill to) - use permanent address (or correspondence as fallback)
          buyerName: clientResponse.name || "",
          buyerAddress: permanentFormatted,
          buyerContact: clientResponse.mobile || "",
          buyerState: (clientResponse.permanentAddr?.state || clientResponse.correspondenceAddress)?.state || "",

          // Update destination to correspondence address
          destination: correspondenceFormatted,
        }));
      }
    } catch (err) {
      console.error("Error fetching client data:", err);
      // Don't throw error, just log it as client data is optional enhancement
    }
  };

  // -----------------------------
  // Submit Dispatch (PDF)
  // -----------------------------
  const submitDispatch = async () => {
    try {
      setSubmittingDispatch(true);
      setValidationErrors({});

      const token = cookies.get("auth-token");
      const payload = {
        orderNo: orderDetails.orderNo,
        orderId: orderDetails._id,
        clientId: orderDetails.clientId,

        // Dispatch product lines
        lines: (dispatchForm.lines || [])
          .filter((l) => Number(l.quantity) > 0)
          .map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity),
            unitType: l.unitType,
          })),

        // Dispatch details (flat, backend expects this)
        type: dispatchForm.type || "By Road",
        destination: dispatchForm.destination || "",
        vehicleNo: dispatchForm.vehicleNo || "",

        // Consignee (ship to)
        consigneeName: dispatchForm.consigneeName || "",
        consigneeAddress: dispatchForm.consigneeAddress || "",
        consigneeContact: dispatchForm.consigneeContact || "",
        consigneeState: dispatchForm.consigneeState || "",

        // Buyer (bill to)
        buyerName: dispatchForm.buyerName || orderDetails?.clientName || "",
        buyerAddress: dispatchForm.buyerAddress || orderDetails?.clientAddress || "",
        buyerContact: dispatchForm.buyerContact || orderDetails?.clientMobile || "",
        buyerState: dispatchForm.buyerState || orderDetails?.clientState || "",
        
        // GST enabled flag for backend - automatically true if order has GST
        gstEnabled: parseFloat(orderDetails.gst || 0) > 0,
        
        // Dispatch date from frontend date picker
        dispatchDate: dispatchDate,
      };

      // Validation
      const errors = {};

      // Check if at least one product has quantity
      if (payload.lines.length === 0) {
        errors.quantity = "Please enter quantity for at least one product";
        setError("Please enter quantity for at least one product");
        setSubmittingDispatch(false);
        return;
      }

      // Required field validations
      if (!payload.destination.trim()) {
        errors.destination = 'Destination is required';
      }

      if (!payload.vehicleNo.trim()) {
        errors.vehicleNo = 'Vehicle number is required';
      }

      // Make both addresses mandatory - require BOTH Ship to AND Bill to
      if (!payload.consigneeName.trim()) {
        errors.consigneeName = 'Consignee name is required';
      }
      if (!payload.consigneeAddress.trim()) {
        errors.consigneeAddress = 'Consignee address is required';
      }
      if (!payload.buyerName.trim()) {
        errors.buyerName = 'Buyer name is required';
      }
      if (!payload.buyerAddress.trim()) {
        errors.buyerAddress = 'Buyer address is required';
      }

      // If there are validation errors, show them and stop
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        setSubmittingDispatch(false);
        return;
      }

      // Use standardized approach for dispatch submission
      const blob = await downloadPDF("sub-order/dispatch", payload, token);
      const url = window.URL.createObjectURL(blob);
      const filename = `Invoice_${orderDetails.orderNo}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      setPdfUrl(url);
      setPdfFilename(filename);
      setShowDispatch(false);
      openPdfPreview();

      toastSuccess('Dispatch created successfully!');

      // Refresh to update remaining qty/amount and fetch dispatch orders
      await fetchOrderDetails();
      await fetchDispatchOrders();
    } catch (e) {
      const errorMessage = e.message || "Dispatch failed";
      setError(errorMessage);
      toastError(errorMessage);
    } finally {
      setSubmittingDispatch(false);
    }
  };

  // -----------------------------
  // UI
  // -----------------------------
  const handleBackToOrders = () => navigate("/order");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-red-600 font-medium text-lg mb-4">{error}</p>
          <div className="space-x-4">
            <button
              onClick={fetchOrderDetails}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleBackToOrders}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-4">No order details available</p>
          <button
            onClick={handleBackToOrders}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const productsTableData =
    orderDetails?.products?.map((product, index) => ({
      id: index,
      productName: product.productName || product.productId || "Unknown Product",
      quantity: product.quantity,
      remainingQuantity: product.remainingQuantity || product.quantity,
      unitType: product.unitType || "N/A",
      ratePrice: Number(product.ratePrice || 0),
      amount: Number(product.amount || 0),
      remainingAmount:
        Number(product.ratePrice || 0) * Number(product.remainingQuantity ?? product.quantity ?? 0),
    })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={handleBackToOrders}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-2"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Orders
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Order Details</h1>
          <p className="text-gray-600 mt-1">
            Order #{orderDetails.orderNo} - {orderDetails.clientName || "Client"}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            className="px-4 py-2 rounded bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition-colors"
            onClick={() => navigate(`/order/edit/${orderDetails._id}`)}
          >
            Edit Order
          </button>
          <button className="btn btn-primary" onClick={openDispatchModal}>
            Dispatch Order
          </button>
        </div>
      </div>

      {/* Order Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Order Number</p>
            <p className="text-2xl font-bold text-gray-900">#{orderDetails.orderNo}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Status</p>
            <span
              className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full mt-1 whitespace-nowrap ${
                orderDetails.status === "COMPLETED"
                  ? "bg-green-100 text-green-800"
                  : orderDetails.status === "PENDING"
                  ? "bg-yellow-100 text-yellow-800"
                  : orderDetails.status === "PARTIALLY_DISPATCHED"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {orderDetails.status === "PARTIALLY_DISPATCHED" 
                ? "Partial Dispatch" 
                : orderDetails.status === "COMPLETED"
                ? "Completed"
                : orderDetails.status === "PENDING"
                ? "Pending"
                : orderDetails.status
              }
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">
              ₹{Number(orderDetails.totalAmount || 0).toLocaleString()}
            </p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Remaining Amount</p>
            <p
              className={`text-2xl font-bold ${
                Number(orderDetails.remainingAmount || 0) > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              ₹{Number(orderDetails.remainingAmount || 0).toLocaleString()}
            </p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Products</p>
            <p className="text-2xl font-bold text-gray-900">{orderDetails.products?.length || 0}</p>
          </div>
        </Card>
      </div>

      {/* Products Table */}
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Products</h2>
          <p className="text-gray-600">List of products in this order</p>
        </div>

        {productsTableData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Original Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dispatched Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Original Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productsTableData.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{product.productName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{product.quantity}</td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600">
                      {product.quantity - product.remainingQuantity}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-medium ${
                        product.remainingQuantity === 0 ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {product.remainingQuantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{getUnitLabel(product.unitType)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      ₹{Number(product.ratePrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ₹{Number(product.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-medium ${
                        product.remainingAmount === 0 ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      ₹{Number(product.remainingAmount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No products found for this order</div>
        )}
      </Card>

      {/* Dispatch Orders History */}
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Dispatch Orders History</h2>
          <p className="text-gray-600">List of all dispatches made for this order</p>
        </div>

        {dispatchOrders.length > 0 ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="text-center">
                  <p className="text-sm text-blue-600">Total Dispatches</p>
                  <p className="text-2xl font-bold text-blue-800">{dispatchOrders.length}</p>
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-center">
                  <p className="text-sm text-green-600">Total Dispatched Amount</p>
                  <p className="text-2xl font-bold text-green-800">
                    ₹{dispatchOrders.reduce((sum, dispatch) => sum + (dispatch.totalAmount || 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="text-center">
                  <p className="text-sm text-purple-600">Latest Dispatch</p>
                  <p className="text-lg font-bold text-purple-800">
                    {dispatchOrders.length > 0 ? new Date(dispatchOrders[0].dispatchDate).toLocaleDateString() : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Dispatch Orders Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dispatch Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Products
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dispatchOrders.map((dispatch, index) => {
                    // Generate invoice number from dispatch data
                    const invoiceNumber = dispatch.invoiceNo || `DISP-${dispatch.orderNo || orderDetails?.orderNo || (index + 1)}`;
                    
                    // Get product details with proper fallback using order data
                    const products = dispatch.dispatchedProducts || [];
                    const orderProducts = orderDetails?.products || [];
                    
                    // Map dispatch products to order products to get actual names
                    const enrichedProducts = products.map(dispatchProduct => {
                      const orderProduct = orderProducts.find(op => op.productId === dispatchProduct.productId);
                      return {
                        ...dispatchProduct,
                        productName: orderProduct?.productName || dispatchProduct.productName || 'Unknown Product'
                      };
                    });
                    
                    // Calculate total quantity and get unit type
                    const totalQuantity = products.reduce((total, p) => total + (p.quantity || 0), 0) || dispatch.quantity || 0;
                    const unitType = products[0]?.unitType || dispatch.unitType || 'SQUARE_FEET';
                    
                    return (
                      <tr key={dispatch._id || index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {dispatch.dispatchDate ? new Date(dispatch.dispatchDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {invoiceNumber}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="space-y-1">
                            {enrichedProducts.length > 0 ? (
                              enrichedProducts.map((product, idx) => (
                                <div key={idx}>
                                  <span className="font-medium">{product.productName}</span>
                                </div>
                              ))
                            ) : (
                              <span>No Products</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="space-y-1">
                            {enrichedProducts.length > 0 ? (
                              enrichedProducts.map((product, idx) => (
                                <div key={idx}>
                                  <span>{product.quantity || 0}</span>
                                </div>
                              ))
                            ) : (
                              <span>-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {totalQuantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getUnitLabel(unitType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          ₹{dispatch.totalAmount?.toLocaleString() || '0'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewDispatchPDF(dispatch._id)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            View PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">No dispatches yet</p>
            <p className="text-sm">Dispatch orders will appear here after you create invoices</p>
          </div>
        )}
      </Card>

      {/* Dispatch Modal */}
      <Modal
        title="TAX INVOICE - Dispatch Order"
        activeModal={showDispatch}
        onClose={closeDispatchModal}
        labelClose="Close"
        themeClass="bg-white"
        className="max-w-4xl"
      >
        <div className="space-y-6">
          {/* Invoice Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-2xl font-bold text-gray-900">TAX INVOICE</h2>
            <p className="text-sm text-gray-600">(ORIGINAL FOR RECIPIENT)</p>
          </div>

          {/* Seller + Invoice Details */}
          <div className="grid grid-cols-2 gap-8">
            {/* Seller Info */}
            <div className="space-y-2 text-sm">
              <h3 className="font-bold text-gray-900">RAVI PRECAST</h3>
              <p>Jaliyamath, Block/Ser.No-125/002</p>
              <p>Jaliyamath Village, Dehgam-Rakhiyal Road</p>
              <p>Mo. 9726965264, 9825308702</p>
              <p>MSME / UDYAM-GJ-09-0005739</p>
              <p>State Name: Gujarat, Code: 24</p>
            </div>

            {/* Invoice Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-500">Invoice No.</label>
                <input
                  type="text"
                  readOnly
                  value={`DISP-${orderDetails?.orderNo || ""}`}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Dated</label>
                <input
                  type="date"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  min={orderDetails?.orderDate ? new Date(orderDetails.orderDate).toISOString().split('T')[0] : 
                       orderDetails?.date ? new Date(orderDetails.date).toISOString().split('T')[0] :
                       orderDetails?.createdAt ? new Date(orderDetails.createdAt).toISOString().split('T')[0] : ""}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Mode/Terms of Payment</label>
                <input
                  type="text"
                  readOnly
                  value="15 Days"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Dispatched through</label>
                <select
                  value={dispatchForm.type}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, type: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
                >
                  <option value="By Road">By Road</option>
                  <option value="Pickup">Pickup</option>
                  <option value="Courier">Courier</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Destination <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Enter destination (e.g., Limbadiya gam)"
                  value={dispatchForm.destination || ""}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value })}
                  className={`w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring focus:ring-blue-200 ${validationErrors.destination ? 'border-red-500' : ''}`}
                />
                {validationErrors.destination && <p className="text-red-500 text-xs mt-1">{validationErrors.destination}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Motor Vehicle No. <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Enter vehicle number"
                  value={dispatchForm.vehicleNo || ""}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNo: e.target.value })}
                  className={`w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring focus:ring-blue-200 ${validationErrors.vehicleNo ? 'border-red-500' : ''}`}
                />
                {validationErrors.vehicleNo && <p className="text-red-500 text-xs mt-1">{validationErrors.vehicleNo}</p>}
              </div>
            </div>
          </div>

          {/* Consignee + Buyer */}
          <div className="grid grid-cols-2 gap-8 text-sm">
            {/* Consignee (Ship to) */}
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900">Consignee (Ship to) <span className="text-red-500">*</span></h3>
              <input
                type="text"
                placeholder="Consignee Name (e.g., Farm House)"
                value={dispatchForm.consigneeName || ""}
                onChange={(e) => setDispatchForm({ ...dispatchForm, consigneeName: e.target.value })}
                className={`w-full rounded-md border px-3 py-2 ${validationErrors.consigneeName ? 'border-red-500' : ''}`}
              />
              {validationErrors.consigneeName && <p className="text-red-500 text-xs mt-1">{validationErrors.consigneeName}</p>}
              <input
                type="text"
                placeholder="Consignee Address (e.g., Limbadiya gam)"
                value={dispatchForm.consigneeAddress || ""}
                onChange={(e) => setDispatchForm({ ...dispatchForm, consigneeAddress: e.target.value })}
                className={`w-full rounded-md border px-3 py-2 ${validationErrors.consigneeAddress ? 'border-red-500' : ''}`}
              />
              {validationErrors.consigneeAddress && <p className="text-red-500 text-xs mt-1">{validationErrors.consigneeAddress}</p>}
              <input
                type="text"
                placeholder="Site / Contact Person (e.g., 9874597038 Yogeshbhai)"
                value={dispatchForm.consigneeContact || ""}
                onChange={(e) => setDispatchForm({ ...dispatchForm, consigneeContact: e.target.value })}
                className="w-full rounded-md border px-3 py-2"
              />
              <input
                type="text"
                placeholder="State Name & Code"
                value={dispatchForm.consigneeState || ""}
                onChange={(e) => setDispatchForm({ ...dispatchForm, consigneeState: e.target.value })}
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            {/* Buyer (Bill to) */}
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900">Buyer (Bill to) <span className="text-red-500">*</span></h3>
              <input
                type="text"
                placeholder="Buyer Name"
                value={dispatchForm.buyerName || ""}
                onChange={(e) => setDispatchForm({ ...dispatchForm, buyerName: e.target.value })}
                className={`w-full rounded-md border px-3 py-2 ${validationErrors.buyerName ? 'border-red-500' : ''}`}
              />
              {validationErrors.buyerName && <p className="text-red-500 text-xs mt-1">{validationErrors.buyerName}</p>}
              <input
                type="text"
                placeholder="Buyer Address"
                value={dispatchForm.buyerAddress || ""}
                onChange={(e) => setDispatchForm({ ...dispatchForm, buyerAddress: e.target.value })}
                className={`w-full rounded-md border px-3 py-2 ${validationErrors.buyerAddress ? 'border-red-500' : ''}`}
              />
              {validationErrors.buyerAddress && <p className="text-red-500 text-xs mt-1">{validationErrors.buyerAddress}</p>}
              <input
                type="text"
                placeholder="Buyer Contact"
                value={dispatchForm.buyerContact || ""}
                onChange={(e) => setDispatchForm({ ...dispatchForm, buyerContact: e.target.value })}
                className="w-full rounded-md border px-3 py-2"
              />
              <input
                type="text"
                placeholder="Buyer State Name & Code"
                value={dispatchForm.buyerState || ""}
                onChange={(e) => setDispatchForm({ ...dispatchForm, buyerState: e.target.value })}
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
          </div>

          {/* Terms of Delivery */}
          <div className="text-sm">
            <span className="font-semibold">Terms of Delivery:</span>
            <span className="ml-2">With Unloading, Within 5 Feet to Truck</span>
          </div>

          {/* Products Table (Editable Qty) */}
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Sl No.</th>
                  <th className="px-4 py-2 text-left">Description of Goods</th>
                  <th className="px-4 py-2 text-left">HSN/SAC</th>
                  <th className="px-4 py-2 text-left">Quantity</th>
                  <th className="px-4 py-2 text-left">Rate</th>
                  <th className="px-4 py-2 text-left">No.of PCS</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dispatchForm.lines.map((line, idx) => {
                  const rate = Number(line.ratePrice || 0);
                  const qty = Number(line.quantity || 0);
                  const amount = rate * qty;
                  return (
                    <tr key={line.productId}>
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2">{line.productName}</td>
                      <td className="px-4 py-2">68101190</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          max={line.remainingQuantity}
                          value={line.quantity || ""}
                          onChange={(e) => updateLineQty(idx, e.target.value)}
                          className="form-input w-24 rounded-md border border-gray-300 text-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                          placeholder={`Max ${line.remainingQuantity}`}
                        />
                        <span className="ml-1 text-xs text-gray-500">
                          {getUnitLabel(line.unitType)}
                        </span>
                      </td>
                      <td className="px-4 py-2">₹{rate.toFixed(2)}</td>
                      <td className="px-4 py-2">
                        {qty > 0 ? `${qty * (line.numberOfItems || 1)}` : '-'}
                      </td>
                      <td className="px-4 py-2 font-medium">₹{amount.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals + Taxes */}
          {(() => {
            const totalAmount = dispatchForm.lines.reduce(
              (sum, line) => sum + Number(line.ratePrice || 0) * Number(line.quantity || 0),
              0
            );
            // GST calculation using order's GST rate - only if order has GST
            const gstRate = parseFloat(orderDetails.gst) || 0;
            const gstAmount = gstRate > 0 ? totalAmount * (gstRate / 100) : 0;
            const grandTotal = totalAmount + gstAmount;

            // Group by unit
            const totalQuantitiesByUnit = dispatchForm.lines.reduce((acc, line) => {
              const qty = Number(line.quantity || 0);
              if (qty > 0) {
                acc[line.unitType] = (acc[line.unitType] || 0) + qty;
              }
              return acc;
            }, {});

            // For combined display like 10, 5 = 15 (Sq. M., Sq. Ft.)
            const qtyList = Object.values(totalQuantitiesByUnit);
            const totalQty = qtyList.reduce((a, b) => a + b, 0);
            const unitLabels = Object.keys(totalQuantitiesByUnit).map((u) => getUnitLabel(u));

            return (
              <div className="space-y-2 text-sm">
                {/* Only show GST row when GST can be applied */}
                {gstRate > 0 && (
                  <div className="flex justify-between">
                    <span>{gstRate}% GST:</span>
                    <span>₹{gstAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t pt-2">
                  {/* Total Qty formatted */}
                  <div className="flex justify-between font-semibold">
                    <span>Total Quantity:</span>
                    <span>
                      {qtyList.join(", ")} = {totalQty} ({unitLabels.join(", ")})
                    </span>
                  </div>

                  <div className="flex justify-between font-bold text-lg">
                    <span>Total Amount:</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500 text-right">E. & O.E</div>
                </div>
                <div>
                  <span className="font-semibold">Amount Chargeable (in words):</span>
                  <span className="ml-2">INR {numberToWords(grandTotal)} Only</span>
                </div>
              </div>
            );
          })()}

          {/* Declaration + condition */}
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="text-gray-600">
                You are requested to verify and calculate the goods then sign below. No argument will be
                valid later.
              </p>
              <p className="mt-2">Customer&apos;s Seal and Signature:</p>
            </div>

            {/* Terms & Conditions Box */}
            <div>
              <div className="border rounded-lg p-3 h-48 overflow-y-auto space-y-2">
                <p className="font-semibold">શબ્દ અને શરતો::</p>
                <p>
                  અમો ઉપર સહી કરનારે મટીરીયલ જોઈ, ચકાસી, ગણતરી કરી ને સહી કરેલ છે. લુઝ મટીરીયલ માં 5% અને પેકીંગ મટીરીયલ માં 3% ભાંગ-તૂટ ની છૂટ ટ્રાન્સપોર્ટ નિયમ અનુસાર માન્ય રાખવામાં આવે છે, જો તેનાથી વધારે પ્રમાણમાં ભાંગ-તૂટ જણાય તો (બિલ કોપી ઉપર) લેખિતમાં જાણ કરવી.
                </p>
                <p>
                  માલ ઉતારવામાં જો કોઈ દીવાલ, પગથિયાં, ગટર કે કોઈ અડચણ રૂપ વસ્તુ ને પાર કરી સામાન ઉતારી આપવા માં આવશે નહિ. 
                </p>
                <p>
                  વધેલું મટીરીયલ પાછું લેવામાં આવશે નહિ
                </p>
                <p className="font-bold underline">વધેલું મટીરીયલ પાછું લેવામાં આવશે નહિ</p>
                <p className="text-xs font-semibold">All Disputes Subject to Dehgam Jurisdiction Only.</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 border-t pt-4">
            <p>SUBJECT TO DEHGAM JURISDICTION</p>
            <p>This is a Computer Generated Invoice</p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3">
            <button className="btn btn-outline" onClick={closeDispatchModal}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={submitDispatch}
              disabled={submittingDispatch || dispatchForm.lines.every((l) => !l.quantity)}
            >
              {submittingDispatch ? "Generating Invoice..." : "Generate Tax Invoice PDF"}
            </button>
          </div>
        </div>
      </Modal>

      {/* PDF Preview Modal */}
      <Modal
        title="Invoice Preview"
        activeModal={showPdfPreview}
        onClose={closePdfPreview}
        labelClose="Close"
        themeClass="bg-white"
        className="max-w-6xl"
      >
        <div className="space-y-4">
          {/* Header with filename and download button */}
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Invoice Generated Successfully</h3>
              <p className="text-sm text-gray-600">{pdfFilename}</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  if (pdfUrl) {
                    const link = document.createElement('a');
                    link.href = pdfUrl;
                    link.download = pdfFilename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </button>
              <button
                onClick={closePdfPreview}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="relative">
            {pdfUrl ? (
              <div className="border rounded-lg overflow-hidden bg-gray-100">
                <iframe
                  src={pdfUrl}
                  className="w-full h-[600px]"
                  title="Invoice Preview"
                  style={{ border: 'none' }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[600px] bg-gray-100 border rounded-lg">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">No PDF available</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer with additional actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              <p>✅ Order dispatched successfully</p>
              <p>📄 Invoice PDF generated and ready for download</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  closePdfPreview();
                  navigate('/order');
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Back to Orders
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OrderDetails;
