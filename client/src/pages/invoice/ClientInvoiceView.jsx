import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import Cookies from 'universal-cookie';
import useApi from "../../hooks/useApi";
import useToast from "../../hooks/useToast";

const ClientInvoiceView = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { apiCall } = useApi();
  const { toastError, toastSuccess } = useToast();
  const cookies = new Cookies();

  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderInvoices, setOrderInvoices] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState({}); // Track loading state per order
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [invoicePdfLoading, setInvoicePdfLoading] = useState({}); // Track PDF loading state per invoice

  // Production-ready PDF download helper function
  const downloadPDF = async (endpoint, data, token, method = 'GET') => {
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

  const fetchClientData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = cookies.get('auth-token');
      
      // Fetch client details
      const clientResponse = await apiCall("GET", `client/${clientId}`, null, token);
      
      if (clientResponse && clientResponse.success !== false) {
        setClient(clientResponse.client || clientResponse);
      } else {
        throw new Error(clientResponse?.message || 'Failed to fetch client data');
      }

      // Fetch client orders
      const ordersResponse = await apiCall("GET", `order/client/${clientId}`, null, token);
      
      if (ordersResponse && ordersResponse.success !== false) {
        setOrders(ordersResponse.orders || ordersResponse || []);
      } else {
        throw new Error(ordersResponse?.message || 'Failed to fetch orders');
      }
      
    } catch (err) {
      setError(err.message);
      toastError('Failed to fetch client data');
      console.error('Error fetching client data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderInvoices = async (orderId) => {
    setLoadingInvoices(prev => ({ ...prev, [orderId]: true }));
    
    try {
      const token = cookies.get('auth-token');
      // Fix: Use the correct API endpoint path
      const response = await apiCall("GET", `sub-order/invoices/${orderId}`, null, token);
      
      if (response && response.success !== false) {
        setOrderInvoices(prev => ({
          ...prev,
          [orderId]: response.invoices || []
        }));
      } else {
        // If no invoices found, set empty array instead of throwing error
        setOrderInvoices(prev => ({
          ...prev,
          [orderId]: []
        }));
      }
    } catch (err) {
      console.error('Error fetching order invoices:', err);
      // Set empty array on error instead of showing toast error
      setOrderInvoices(prev => ({
        ...prev,
        [orderId]: []
      }));
    } finally {
      setLoadingInvoices(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const downloadInvoicePDF = async (invoiceId, invoiceNo) => {
    try {
      const token = cookies.get('auth-token');
      
      // Use standardized approach for PDF download
      const blob = await downloadPDF(`sub-order/invoices/${invoiceId}/pdf`, null, token, 'GET');
      
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      
      toastSuccess('Invoice PDF downloaded successfully!');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toastError('Failed to download invoice PDF');
      throw err; // Re-throw to be handled by caller
    }
  };

  const toggleOrderExpansion = (orderId) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      if (!orderInvoices[orderId]) {
        fetchOrderInvoices(orderId);
      }
    }
  };

  const handleViewInvoice = async (invoiceId) => {
    try {
      // Set loading state for this specific invoice
      setInvoicePdfLoading(prev => ({ ...prev, [invoiceId]: true }));
      const token = cookies.get('auth-token');
      
      // Use standardized approach for PDF viewing
      const blob = await downloadPDF(`sub-order/invoices/${invoiceId}/pdf`, null, token, 'GET');
      
      const url = window.URL.createObjectURL(blob);
      setCurrentPdfUrl(url);
      setPdfModalOpen(true);
      
      toastSuccess('Invoice PDF loaded successfully!');
    } catch (error) {
      console.error('Error viewing invoice PDF:', error);
      toastError('Failed to view invoice PDF');
    } finally {
      // Clear loading state for this specific invoice
      setInvoicePdfLoading(prev => ({ ...prev, [invoiceId]: false }));
    }
  };

  const closePdfModal = () => {
    setPdfModalOpen(false);
    if (currentPdfUrl) {
      window.URL.revokeObjectURL(currentPdfUrl);
      setCurrentPdfUrl(null);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchClientData();
    }
  }, [clientId]);

  // Add ESC key handler for modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && pdfModalOpen) {
        closePdfModal();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [pdfModalOpen]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'PENDING': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      'PARTIALLY_DISPATCHED': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'COMPLETED': { bg: 'bg-green-100', text: 'text-green-800' },
      'CANCELLED': { bg: 'bg-red-100', text: 'text-red-800' }
    };
    
    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading client data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <button
                  onClick={() => navigate('/dashboard/clients')}
                  className="flex items-center text-blue-600 hover:text-blue-800 mb-2"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Clients
                </button>
                <h1 className="text-2xl font-bold text-gray-900">
                  {client?.name || 'Client'} - Orders & Invoices
                </h1>
                <p className="text-gray-600">View all orders and dispatch invoices for this client</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Client ID</p>
                <p className="font-medium">{clientId}</p>
              </div>
            </div>
          </div>

          {/* Client Info */}
          {client && (
            <div className="px-6 py-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{client.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Mobile</p>
                  <p className="font-medium">{client.mobile || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Orders</p>
                  <p className="font-medium">{orders.length}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Client Orders</h2>
          </div>

          {orders.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">No orders found</p>
              <p className="text-sm text-gray-400">This client has no orders yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {orders.map((order) => (
                <div key={order._id} className="px-6 py-4">
                  {/* Order Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-sm">#{order.orderNo}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900">Order #{order.orderNo}</h3>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formatDate(order.orderDate || order.date)}
                          </span>
                          <span className="flex items-center">
                            {/* <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg> */}
                            {formatCurrency(order.totalAmount)}
                          </span>
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            {order.products?.length || 0} Products
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Remaining Amount</div>
                        <div className="text-sm font-medium text-orange-600">
                          {formatCurrency(order.remainingAmount || 0)}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleOrderExpansion(order._id)}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        <svg 
                          className={`w-4 h-4 mr-2 transform transition-transform ${
                            expandedOrder === order._id ? 'rotate-180' : ''
                          }`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {expandedOrder === order._id ? 'Hide' : 'View'} Invoices
                        {orderInvoices[order._id] && orderInvoices[order._id].length > 0 && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {orderInvoices[order._id].length}
                          </span>
                        )}
                        {loadingInvoices[order._id] && (
                          <div className="ml-2 inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Order Products Summary */}
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      {order.products?.slice(0, 3).map((product, index) => {
                        // Handle different product data structures - backend populates productName
                        const productName = product.productName || product.name || product.product?.name || `Product ${product.productId || 'Unknown'}`;
                        const quantity = product.quantity || product.qty || 0;
                        const unitType = product.unitType || product.unit || product.product?.unitType || 'Sq. Ft.';
                        
                        return (
                          <span key={index} className="px-3 py-1 bg-blue-50 text-blue-800 text-sm rounded-full font-medium">
                            {productName} ({quantity} {unitType})
                          </span>
                        );
                      })}
                      {order.products?.length > 3 && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full font-medium">
                          +{order.products.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Invoices Section */}
                  {expandedOrder === order._id && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <h4 className="text-md font-medium text-gray-900 mb-3">Dispatch Invoices</h4>
                      
                      {loadingInvoices[order._id] ? (
                        <div className="p-4 text-center">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <p className="mt-2 text-gray-600">Loading invoices...</p>
                        </div>
                      ) : (
                        orderInvoices[order._id] && orderInvoices[order._id].length > 0 ? (
                          <div className="space-y-3">
                            {orderInvoices[order._id].map((invoice, idx) => (
                              <div key={invoice._id} className="bg-gray-50 p-4 rounded-lg border">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex-1">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium text-gray-700">Invoice No:</span>
                                        <p className="text-gray-900">DISP-{invoice.orderNo}</p>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Dispatch Date:</span>
                                        <p className="text-gray-900">{formatDate(invoice.dispatchDate)}</p>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Amount:</span>
                                        <p className="text-gray-900 font-semibold">{formatCurrency(invoice.totalAmount)}</p>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Destination:</span>
                                        <p className="text-gray-900">{invoice.dispatchInfo?.destination || 'N/A'}</p>
                                      </div>
                                    </div>
                                  
                                    {invoice.dispatchedProducts && invoice.dispatchedProducts.length > 0 && (
                                      <div className="mt-3">
                                        <span className="font-medium text-gray-700 text-sm">Products:</span>
                                        <div className="mt-1 text-sm text-gray-600">
                                          {invoice.dispatchedProducts.map((product, pIdx) => {
                                            // Handle different product data structures - backend populates productName
                                            const productName = product.productName || product.name || product.product?.name || `Product ${product.productId || 'Unknown'}`;
                                            const quantity = product.quantity || product.qty || 0;
                                            const unitType = product.unitType || product.unit || product.product?.unitType || 'Sq. Ft.';
                                            const amount = product.amount || product.totalAmount || 0;
                                            
                                            return (
                                              <div key={pIdx} className="flex justify-between py-1">
                                                <span className="font-medium text-gray-800">
                                                  {productName} ({quantity} {unitType})
                                                </span>
                                                <span className="text-gray-900 font-semibold">₹{amount.toLocaleString('en-IN')}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                        
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleViewInvoice(invoice._id)}
                                    disabled={invoicePdfLoading[invoice._id]}
                                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                  >
                                    {invoicePdfLoading[invoice._id] ? (
                                      <>
                                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Loading...
                                      </>
                                    ) : (
                                      'View Invoice'
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-yellow-800 text-sm">No dispatch invoices found for this order.</p>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Enhanced PDF Modal with Portal */}
        {pdfModalOpen && currentPdfUrl && typeof document !== 'undefined' && ReactDOM.createPortal(
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-2 sm:p-4" 
            style={{ 
              zIndex: 999999, 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0 
            }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full h-full flex flex-col animate-in fade-in duration-200" 
              style={{ 
                maxWidth: '95vw', 
                maxHeight: '95vh',
                width: '95vw',
                height: '95vh'
              }}
            >
              {/* Enhanced Modal Header */}
              <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Invoice PDF Viewer</h3>
                    <p className="text-sm text-gray-600">Dispatch Invoice Document</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Download Button */}
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = currentPdfUrl;
                      link.download = 'invoice.pdf';
                      link.click();
                    }}
                    className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    title="Download PDF"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download
                  </button>
                  
                  {/* Open in New Tab Button */}
                  <button
                    onClick={() => window.open(currentPdfUrl, '_blank')}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    title="Open in New Tab"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    New Tab
                  </button>
                  
                  {/* Close Button */}
                  <button
                    onClick={closePdfModal}
                    className="inline-flex items-center p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Close Modal"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Enhanced PDF Viewer */}
              <div className="flex-1 p-3 sm:p-4 bg-gray-50 overflow-hidden">
                <div className="h-full bg-white rounded-lg shadow-inner border border-gray-200 overflow-hidden">
                  <iframe
                    src={currentPdfUrl}
                    className="w-full h-full border-0"
                    title="Invoice PDF"
                    style={{ minHeight: '500px' }}
                  />
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="px-4 sm:px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>PDF loaded successfully</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span>Use Ctrl+Scroll to zoom</span>
                    <span>•</span>
                    <button
                      onClick={closePdfModal}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Press ESC to close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default ClientInvoiceView;
