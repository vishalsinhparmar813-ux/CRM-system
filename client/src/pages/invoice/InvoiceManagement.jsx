import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import useToast from '../../hooks/useToast';
import Cookies from 'universal-cookie';

const InvoiceManagement = () => {
  const { apiCall } = useApi();
  const { toastError, toastSuccess } = useToast();
  const navigate = useNavigate();
  const cookies = new Cookies();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderInvoices, setOrderInvoices] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState({});

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

  const fetchClientsWithInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = cookies.get('auth-token');
      const response = await apiCall('GET', 'sub-order/clients-with-invoices', null, token);

      if (response && response.success !== false) {
        setClients(response.clients || []);
      } else {
        throw new Error(response?.message || 'Failed to fetch clients with invoices');
      }
    } catch (err) {
      setError(err.message);
      toastError('Failed to fetch data');
      console.error('Error fetching clients with invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderInvoices = async (orderId) => {
    setLoadingInvoices(prev => ({ ...prev, [orderId]: true }));
    try {
      const token = cookies.get('auth-token');
      const response = await apiCall('GET', `sub-order/invoices/${orderId}`, null, token);

      if (response && response.success !== false) {
        setOrderInvoices(prev => ({
          ...prev,
          [orderId]: response.invoices || [],
        }));
      } else {
        setOrderInvoices(prev => ({ ...prev, [orderId]: [] }));
      }
    } catch (err) {
      console.error('Error fetching order invoices:', err);
      setOrderInvoices(prev => ({ ...prev, [orderId]: [] }));
    } finally {
      setLoadingInvoices(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const downloadInvoicePDF = async (invoiceId) => {
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
    }
  };

  useEffect(() => {
    fetchClientsWithInvoices();
  }, []);

  const toggleClientExpansion = (clientId) => {
    setExpandedClient(expandedClient === clientId ? null : clientId);
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '₹0';
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex justify-center items-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading Client Invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Invoice Management</h1>
          <p className="text-gray-600">Clients with dispatched invoices</p>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            <p>{error}</p>
          </div>
        )}

        {clients.length === 0 && !loading && (
          <div className="text-center bg-white p-12 rounded-lg shadow-sm">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Clients Found</h3>
            <p className="mt-1 text-sm text-gray-500">No clients with dispatch invoices were found.</p>
          </div>
        )}

        <div className="space-y-4">
          {clients.map(client => (
            <div key={client._id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Client Header */}
              <div className="px-6 py-4 flex justify-between items-center cursor-pointer" onClick={() => toggleClientExpansion(client._id)}>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{client.name}</h2>
                  <p className="text-sm text-gray-500">{client.mobile}</p>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div>
                    <p className="text-gray-500">Total Invoices</p>
                    <p className="font-medium text-gray-900">{client.totalInvoices}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Amount</p>
                    <p className="font-medium text-gray-900">{formatCurrency(client.totalAmount)}</p>
                  </div>
                  <svg className={`w-5 h-5 text-gray-500 transform transition-transform ${expandedClient === client._id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Client Content - Orders */}
              {expandedClient === client._id && (
                <div className="bg-gray-50/50 p-4 border-t border-gray-200">
                  <h3 className="px-2 pb-2 text-md font-medium text-gray-800">Orders</h3>
                  <div className="space-y-3">
                    {client.orders.map(order => (
                      <div key={order.orderId} className="bg-white p-4 rounded-lg border">
                        {/* Order Header */}
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-gray-800">Order #{order.orderNo}</h4>
                            <p className="text-sm text-gray-500">Total Invoiced: {formatCurrency(order.totalInvoicedAmount)}</p>
                          </div>
                          <button
                            onClick={() => toggleOrderExpansion(order.orderId)}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <svg className={`w-4 h-4 mr-2 transform transition-transform ${expandedOrder === order.orderId ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            {expandedOrder === order.orderId ? 'Hide' : 'View'} Invoices ({order.invoiceCount})
                            {loadingInvoices[order.orderId] && <div className="ml-2 inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
                          </button>
                        </div>

                        {/* Expanded Order Content - Invoices */}
                        {expandedOrder === order.orderId && (
                          <div className="mt-4 border-t pt-4">
                            {loadingInvoices[order.orderId] ? (
                              <div className="text-center p-4">Loading Invoices...</div>
                            ) : (
                              orderInvoices[order.orderId] && orderInvoices[order.orderId].length > 0 ? (
                                <div className="space-y-3">
                                  {orderInvoices[order.orderId].map(invoice => (
                                    <div key={invoice._id} className="bg-gray-50 p-3 rounded-md border">
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                        <div><span className="font-medium">Invoice No:</span> {invoice.invoiceNo}</div>
                                        <div><span className="font-medium">Date:</span> {formatDate(invoice.dispatchDate)}</div>
                                        <div><span className="font-medium">Amount:</span> {formatCurrency(invoice.totalAmount)}</div>
                                        <div><span className="font-medium">Destination:</span> {invoice.dispatchInfo?.destination || 'N/A'}</div>
                                      </div>
                                      <button
                                        onClick={() => downloadInvoicePDF(invoice._id)}
                                        className="mt-3 w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                                      >
                                        View Invoice PDF
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : <div className="text-center p-4 text-sm text-gray-500">No invoices found for this order.</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InvoiceManagement;