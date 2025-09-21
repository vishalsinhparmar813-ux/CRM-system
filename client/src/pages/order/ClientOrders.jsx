import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { Icon } from "@iconify/react";
import { getUnitLabel } from "../../utils/unitUtils";
import { toastError, toastSuccess } from "../../utils/toastUtils";

const ClientOrders = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Ledger PDF Preview modal states
  const [showLedgerPreviewModal, setShowLedgerPreviewModal] = useState(false);
  const [ledgerPdfUrl, setLedgerPdfUrl] = useState(null);

  // Order Receipt PDF Preview modal states
  const [currentOrderForReceipt, setCurrentOrderForReceipt] = useState(null);
  const [orderReceiptLoading, setOrderReceiptLoading] = useState({});
  const [orderReceiptPdfUrl, setOrderReceiptPdfUrl] = useState(null);
  const [showOrderReceiptModal, setShowOrderReceiptModal] = useState(false);

  // Production-ready PDF download helper function
  const downloadPDF = async (endpoint, data, token) => {
    try {
      // Import centralized configuration
      const { apiEndpoint } = await import('../../constant/common');
      
      // Make standardized API call for PDF download
      const response = await fetch(`${apiEndpoint}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data || {})
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

  useEffect(() => {
    fetchClientOrders();
  }, [clientId]);

  const fetchClientOrders = async () => {
    setLoading(true);
    try {
      const token = cookies.get("auth-token");
      const response = await apiCall("GET", `order/all`, null, token);

      if (response?.data) {
        const clientOrders = response.data.filter(
          (order) => order.clientId === clientId
        );

        if (clientOrders.length > 0) {
          const firstOrder = clientOrders[0];
          setClientData({
            clientId: firstOrder.clientId,
            clientName: firstOrder.clientName,
            orders: clientOrders,
          });
        } else {
          setError("No orders found for this client");
        }
      } else {
        setError("Failed to fetch orders");
      }
    } catch (error) {
      setError(error.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = (orderId) => {
    navigate(`/order/${orderId}`);
  };

  const handleGenerateOrderReceipt = async (orderId) => {
    try {
      setOrderReceiptLoading(prev => ({ ...prev, [orderId]: true }));
      
      // Find the order data for the modal
      const orderData = clientData?.orders.find(order => order._id === orderId);
      setCurrentOrderForReceipt(orderData);

      const token = cookies.get("auth-token");
      
      // Use standardized approach for PDF download
      const blob = await downloadPDF("order/receipt-pdf", {
        orderIds: orderId,
        clientId: clientId
      }, token);

      const url = window.URL.createObjectURL(blob);
      setOrderReceiptPdfUrl(url);
      setShowOrderReceiptModal(true);
      toastSuccess('Order receipt loaded successfully!');
    } catch (error) {
      console.error('Error generating order receipt:', error);
      toastError('An error occurred while generating the order receipt');
    } finally {
      setOrderReceiptLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Handle order receipt PDF download from preview modal
  const handleDownloadOrderReceiptFromPreview = () => {
    if (orderReceiptPdfUrl && currentOrderForReceipt) {
      const link = document.createElement('a');
      link.href = orderReceiptPdfUrl;
      link.download = `order_receipt_${currentOrderForReceipt._id}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastSuccess(`Order receipt for #${currentOrderForReceipt.orderNo} downloaded successfully!`);
    }
  };

  // Close order receipt preview modal and cleanup
  const closeOrderReceiptModal = () => {
    if (orderReceiptPdfUrl) {
      window.URL.revokeObjectURL(orderReceiptPdfUrl);
      setOrderReceiptPdfUrl(null);
    }
    setShowOrderReceiptModal(false);
    setCurrentOrderForReceipt(null);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: {
        classes: "bg-yellow-100 text-yellow-800 border border-yellow-300",
        text: "Pending",
      },
      COMPLETED: {
        classes: "bg-green-100 text-green-800 border border-green-300",
        text: "Completed",
      },
      CANCELLED: {
        classes: "bg-red-100 text-red-800 border border-red-300",
        text: "Cancelled",
      },
    };

    const config = statusConfig[status] || {
      classes: "bg-gray-100 text-gray-800 border border-gray-300",
      text: status,
    };

    return (
      <Badge
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.classes}`}
      >
        {config.text}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    if (amount == null || isNaN(amount)) return "-";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const calculateTotals = () => {
    if (!clientData?.orders) return { grossTotal: 0, grossCash: 0 };

    let grossTotal = 0;
    let grossCash = 0;

    clientData.orders.forEach((order) => {
      grossTotal += Number(order.totalAmount || 0);

      order.products.forEach((p) => {
        if (p.cashRate != null) {
          grossCash += Number(p.cashRate) * Number(p.quantity || 0);
        }
      });
    });

    return { grossTotal, grossCash };
  };

  const handleGenerateLedgerPDF = async () => {
    if (!clientData) {
      toastError("No client data available");
      return;
    }

    setPdfLoading(true);
    try {
      const token = cookies.get("auth-token");
      
      // Use standardized approach for PDF download
      const blob = await downloadPDF(`order/client/${clientId}/ledger-pdf`, {}, token);

      // Create object URL for preview
      const url = window.URL.createObjectURL(blob);
      setLedgerPdfUrl(url);
      setShowLedgerPreviewModal(true);

      toastSuccess("Ledger PDF loaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toastError(`Failed to generate ledger PDF: ${error.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle ledger PDF download from preview modal
  const handleDownloadLedgerPdfFromPreview = () => {
    if (ledgerPdfUrl && clientData) {
      const link = document.createElement('a');
      link.href = ledgerPdfUrl;
      link.download = `${clientData.clientName}_Ledger_${new Date()
        .toISOString()
        .split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastSuccess(`Ledger for ${clientData.clientName} downloaded successfully!`);
    }
  };

  // Close ledger preview modal and cleanup
  const closeLedgerPreviewModal = () => {
    if (ledgerPdfUrl) {
      window.URL.revokeObjectURL(ledgerPdfUrl);
      setLedgerPdfUrl(null);
    }
    setShowLedgerPreviewModal(false);
  };

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
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600">Error: {error}</div>
        <button
          className="btn btn-sm btn-outline-primary mt-2"
          onClick={() => navigate("/order")}
        >
          Back to Orders
        </button>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-yellow-600">No client data found</div>
        <button
          className="btn btn-sm btn-outline-primary mt-2"
          onClick={() => navigate("/order")}
        >
          Back to Orders
        </button>
      </div>
    );
  }

  const { grossTotal, grossCash } = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Orders for {clientData.clientName}
          </h1>
          <p className="text-gray-600 mt-1">
            Total Orders: {clientData.orders.length}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-success px-4 py-2"
            onClick={handleGenerateLedgerPDF}
            disabled={pdfLoading}
          >
            {pdfLoading ? "Generating..." : " Ledger View"}
          </button>
          <button
            className="btn btn-outline-primary"
            onClick={() => navigate("/order")}
          >
            Back to Orders
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-600">Gross Bill Total</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(grossTotal)}
          </p>
        </Card>

        <Card className="p-4 text-center">
          <p className="text-sm text-gray-600">Gross Cash Total</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(grossCash)}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="table-auto w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">
                  Order No
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">
                  Date
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">
                  Products
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">
                  Quantity
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                  Rate
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                  Cash Rate
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                  Cash Total
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">
                  Gross Total Bill amount
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">
                  Status
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {clientData.orders.map((order) => (
                <tr
                  key={order._id}
                  className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-all duration-200 hover:shadow-sm"
                  onClick={() => handleViewOrder(order._id)}
                  title={`Click to view order #${order.orderNo} details`}
                >
                  <td className="py-3 px-4 font-medium text-gray-900">
                    #{order.orderNo}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {formatDate(order.orderDate || order.date)}
                  </td>

                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      {order.products
                        .filter((product) => Number(product.quantity) > 0)
                        .map((product, index) => (
                          <div key={index} className="text-sm text-gray-900 font-medium">
                            {product.productName}
                          </div>
                        ))}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="space-y-1">
                      {order.products
                        .filter((product) => Number(product.quantity) > 0)
                        .map((product, index) => (
                          <div key={index} className="text-sm text-gray-700">
                            {product.quantity} {getUnitLabel(product.unitType)}
                          </div>
                        ))}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="space-y-1">
                      {order.products.map((product, index) => (
                        <div key={index} className="text-sm text-gray-700">
                          {product.ratePrice != null
                            ? `${formatCurrency(product.ratePrice)} / ${getUnitLabel(
                                product.unitType
                              )}`
                            : "-"}
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="space-y-1">
                      {order.products.map((product, index) => (
                        <div key={index} className="text-sm text-gray-700">
                          {product.cashRate != null
                            ? `${formatCurrency(product.cashRate)} / ${getUnitLabel(
                                product.unitType
                              )}`
                            : "-"}
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="space-y-1">
                      {order.products.map((product, index) => {
                        const cashTotal =
                          product.cashRate != null
                            ? Number(product.cashRate) * Number(product.quantity || 0)
                            : null;
                        return (
                          <div
                            key={index}
                            className="text-sm text-gray-900 font-medium"
                          >
                            {cashTotal != null ? formatCurrency(cashTotal) : "-"}
                          </div>
                        );
                      })}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(order.totalAmount)}
                  </td>

                  <td className="py-3 px-4">{getStatusBadge(order.status)}</td>

                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 rounded bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition-colors text-sm"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click when clicking button
                          navigate(`/order/edit/${order._id}`);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click when clicking button
                          handleViewOrder(order._id);
                        }}
                      >
                        View Details
                      </button>
                      <button
                        className={`btn btn-sm transition-all duration-200 ${
                          orderReceiptLoading[order._id] 
                            ? 'btn-outline-secondary cursor-not-allowed' 
                            : 'btn-outline-success hover:shadow-sm'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click when clicking receipt button
                          handleGenerateOrderReceipt(order._id);
                        }}
                        disabled={orderReceiptLoading[order._id]}
                        title="Generate Order Receipt"
                      >
                        {orderReceiptLoading[order._id] ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500 mr-1"></div>
                            Loading...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Icon icon="heroicons:document-text" className="w-3 h-3 mr-1" />
                            Receipt
                          </div>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Ledger PDF Preview Modal */}
      <Modal 
        activeModal={showLedgerPreviewModal} 
        onClose={closeLedgerPreviewModal} 
        title={`Client Ledger - ${clientData ? clientData.clientName : ''}`}
        className="max-w-4xl"
        centered
      >
        <div className="space-y-4">
          {pdfLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading ledger...</span>
            </div>
          ) : ledgerPdfUrl ? (
            <>
              {/* PDF Viewer */}
              <div className="bg-gray-100 rounded-lg p-4">
                <iframe
                  src={ledgerPdfUrl}
                  className="w-full h-96 border-0 rounded"
                  title="Client Ledger Preview"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-gray-600">
                  {clientData && (
                    <>
                      <span className="font-medium">Client:</span> {clientData.clientName} | 
                      <span className="font-medium ml-2">Orders:</span> {clientData.orders.length} | 
                      <span className="font-medium ml-2">Generated:</span> {new Date().toLocaleDateString()}
                    </>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    className="btn btn-outline-secondary"
                    onClick={closeLedgerPreviewModal}
                  >
                    Close
                  </Button>
                  <Button 
                    type="button" 
                    className="btn btn-primary hover:shadow-md transition-all duration-200"
                    onClick={handleDownloadLedgerPdfFromPreview}
                  >
                    <Icon icon="heroicons:arrow-down-tray" className="w-4 h-4 mr-2" />
                    Download Ledger
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-96 text-gray-500">
              <div className="text-center">
                <Icon icon="heroicons:document-text" className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Failed to load ledger preview</p>
                <Button 
                  type="button" 
                  className="btn btn-outline-primary mt-3"
                  onClick={closeLedgerPreviewModal}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Order Receipt PDF Preview Modal */}
      <Modal 
        activeModal={showOrderReceiptModal} 
        onClose={closeOrderReceiptModal} 
        title={`Order Receipt - ${currentOrderForReceipt ? `#${currentOrderForReceipt.orderNo}` : ''}`}
        className="max-w-4xl"
        centered
      >
        <div className="space-y-4">
          {currentOrderForReceipt && orderReceiptLoading[currentOrderForReceipt._id] ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading receipt...</span>
            </div>
          ) : orderReceiptPdfUrl ? (
            <>
              {/* PDF Viewer */}
              <div className="bg-gray-100 rounded-lg p-4">
                <iframe
                  src={orderReceiptPdfUrl}
                  className="w-full h-96 border-0 rounded"
                  title="Order Receipt Preview"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-gray-600">
                  {currentOrderForReceipt && (
                    <>
                      <span className="font-medium">Order:</span> #{currentOrderForReceipt.orderNo} | 
                      <span className="font-medium ml-2">Date:</span> {formatDate(currentOrderForReceipt.orderDate || currentOrderForReceipt.date)} | 
                      <span className="font-medium ml-2">Amount:</span> {formatCurrency(currentOrderForReceipt.totalAmount)}
                    </>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    className="btn btn-outline-secondary"
                    onClick={closeOrderReceiptModal}
                  >
                    Close
                  </Button>
                  <Button 
                    type="button" 
                    className="btn btn-primary hover:shadow-md transition-all duration-200"
                    onClick={handleDownloadOrderReceiptFromPreview}
                  >
                    <Icon icon="heroicons:arrow-down-tray" className="w-4 h-4 mr-2" />
                    Download Receipt
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-96 text-gray-500">
              <div className="text-center">
                <Icon icon="heroicons:document-text" className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Failed to load receipt preview</p>
                <Button 
                  type="button" 
                  className="btn btn-outline-primary mt-3"
                  onClick={closeOrderReceiptModal}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ClientOrders;
