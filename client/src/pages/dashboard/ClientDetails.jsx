import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Textinput from "../../components/ui/Textinput";
import Icon from "../../components/ui/Icon";
import { useNavigate } from "react-router-dom";
import useToast from "../../hooks/useToast";

const PAGE_SIZE = 5;

const transactionTypes = [
  { value: "cash", label: "Cash" },
  { value: "online", label: "Online" },
];
const paymentMethods = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "credit_card", label: "Credit Card" },
];

const ClientDetails = () => {
  const { id } = useParams();
  const { apiCall } = useApi();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const cookies = new Cookies();
  const navigate = useNavigate();

  // Core states
  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Analytics and Advanced Payment states
  const [analytics, setAnalytics] = useState(null);
  const [advancedPayments, setAdvancedPayments] = useState([]);

  // UI states
  const [expandedOrders, setExpandedOrders] = useState({});
  const [expandedTransactions, setExpandedTransactions] = useState({});
  const [expandedRemarks, setExpandedRemarks] = useState({});
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: '', title: '' });
  const [activeTab, setActiveTab] = useState('orders');

  // Transaction modal states
  const [showModal, setShowModal] = useState(false);
  const [modalOrder, setModalOrder] = useState(null);
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

  // Advanced Payment modal states
  const [showAdvancedPaymentModal, setShowAdvancedPaymentModal] = useState(false);
  const [advancedPaymentForm, setAdvancedPaymentForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    transactionType: "cash",
    paymentMethod: "",
    txnNumber: "",
    remarks: "",
    orderId: "",
  });
  const [advancedPaymentFormErrors, setAdvancedPaymentFormErrors] = useState({});
  const [advancedPaymentMediaFile, setAdvancedPaymentMediaFile] = useState(null);
  const [clientOrders, setClientOrders] = useState([]); // For order dropdown
  const [availableAdvancedBalance, setAvailableAdvancedBalance] = useState(0);

  // PDF Preview modal states
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [currentAdvancedPayment, setCurrentAdvancedPayment] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Transaction Receipt Preview modal states
  const [showTransactionReceiptModal, setShowTransactionReceiptModal] = useState(false);
  const [transactionPdfUrl, setTransactionPdfUrl] = useState(null);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [transactionPdfLoading, setTransactionPdfLoading] = useState({});

  // Ledger PDF Preview modal states
  const [showLedgerPreviewModal, setShowLedgerPreviewModal] = useState(false);
  const [ledgerPdfUrl, setLedgerPdfUrl] = useState(null);
  const [ledgerPdfLoading, setLedgerPdfLoading] = useState(false);

  // Filters and pagination
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [txnDateFrom, setTxnDateFrom] = useState("");
  const [txnDateTo, setTxnDateTo] = useState("");
  const [txnPage, setTxnPage] = useState(1);

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

  // Centralized function to handle PDF downloads with proper error handling
  const downloadPDF = async (endpoint, params = {}, filename = 'document.pdf') => {
    try {
      toastInfo("Loading PDF preview...");
      const token = cookies.get("auth-token");
      
      // Import centralized configuration
      const { apiEndpoint } = await import('../../constant/common');
      
      const response = await fetch(`${apiEndpoint}${endpoint}`, {
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
      console.error(`Error downloading ${filename}:`, error);
      toastError(`Failed to download ${filename}`);
    }
  };

  // Centralized function for advanced payment receipt downloads
  const downloadAdvancedPaymentReceipt = async (advancedPaymentId) => {
    await downloadPDF(`advanced-payment/receipt/${advancedPaymentId}`, {}, 'advanced payment receipt');
  };

  // Centralized function for transaction receipt downloads
  const downloadTransactionReceipt = async (transactionId) => {
    await downloadPDF(`transaction/receipt/${transactionId}`, {}, 'transaction receipt');
  };

  // Centralized function for ledger PDF downloads
  const downloadLedgerPDF = async () => {
    try {
      toastInfo("Generating ledger PDF...");
      const token = cookies.get("auth-token");
      
      // Import centralized configuration
      const { apiEndpoint } = await import('../../constant/common');
      
      const response = await fetch(`${apiEndpoint}order/client/${id}/ledger-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
      
      toastSuccess('Ledger PDF generated successfully');
      
    } catch (error) {
      console.error('Error generating ledger PDF:', error);
      toastError('Failed to generate ledger PDF');
    }
  };

  // Fetch client data
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

  //  all data when client is loaded
  useEffect(() => {
    if (!client) return;
    fetchAllData();
  }, [client, id]);

  const fetchAllData = async () => {
    setLoading(true);
    const token = cookies.get("auth-token");
    
    try {
      // Fetch orders and transactions
      const ordersRes = await apiCall("GET", "order/all-with-transactions", null, token);
      const allOrders = ordersRes.orders || [];
      const clientOrders = allOrders.filter(o => o.clientId === id);
      
      // Calculate totals for each order
      const ordersWithCalculations = clientOrders.map(order => {
        const orderTotal = order.totalAmount || 
          (Array.isArray(order.products) ? order.products.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) : 0);
        const orderPaid = (order.transactions || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const orderRemaining = Math.max(0, orderTotal - orderPaid);
        
        return {
          ...order,
          calculatedTotal: orderTotal,
          calculatedPaid: orderPaid,
          calculatedRemaining: orderRemaining
        };
      });
      
      setOrders(ordersWithCalculations);
      setClientOrders(ordersWithCalculations); // For order dropdown
      
      // Build transactions list
      let allTxns = [];
      let pendingTxns = [];
      ordersWithCalculations.forEach(order => {
        const txns = order.transactions || [];
        allTxns = allTxns.concat(txns.map(t => ({ ...t, orderNo: order.orderNo, orderId: order._id })));
        
        if (order.calculatedRemaining > 0 && order.status !== "CLOSED") {
          pendingTxns.push({ order, pendingAmount: order.calculatedRemaining });
        }
      });
      
      setTransactions(allTxns);
      setPending(pendingTxns);

      // Fetch analytics
      const analyticsRes = await apiCall("GET", `advanced-payment/analytics/${id}`, null, token);
      setAnalytics(analyticsRes.analytics);

      // Fetch advanced payments
      const advancedRes = await apiCall("GET", `advanced-payment/client/${id}`, null, token);
      setAdvancedPayments(advancedRes.advancedPayments || []);

      // Fetch available advanced payment balance
      const balanceRes = await apiCall("GET", `advanced-payment/balance/${id}`, null, token);
      setAvailableAdvancedBalance(balanceRes.availableBalance || 0);

    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage('Failed to load data');
    }
    setLoading(false);
  };

  // Toggle functions
  const toggleOrderExpansion = (orderId) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const toggleTransactionExpansion = (txnId) => {
    setExpandedTransactions(prev => ({ ...prev, [txnId]: !prev[txnId] }));
  };

  const toggleAdvancedPaymentExpansion = (apId) => {
    setExpandedTransactions(prev => ({ ...prev, [`ap-${apId}`]: !prev[`ap-${apId}`] }));
  };

  const toggleRemarksExpansion = (txnId) => {
    setExpandedRemarks(prev => ({ ...prev, [txnId]: !prev[txnId] }));
  };

  const openImageModal = (imageUrl, title) => {
    setSelectedImage({ url: imageUrl, title: title });
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage({ url: '', title: '' });
  };

  const downloadImage = async () => {
    try {
      // Use a different approach to avoid CORS issues
      const link = document.createElement('a');
      link.href = selectedImage.url;
      link.download = selectedImage.title || 'transaction-image';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // For S3 URLs, we'll open in new tab since direct download may be blocked by CORS
      if (selectedImage.url.includes('s3') || selectedImage.url.includes('amazonaws')) {
        // Try to trigger download, but if CORS blocks it, open in new tab
        try {
          const response = await fetch(selectedImage.url, { mode: 'no-cors' });
          // If we get here without error, try the blob approach
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          toastSuccess('Image download started');
        } catch (corsError) {
          // CORS blocked, open in new tab instead
          window.open(selectedImage.url, '_blank', 'noopener,noreferrer');
          toastInfo('Image opened in new tab. Right-click to save.');
        }
      } else {
        // For non-S3 URLs, try direct download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toastSuccess('Image download started');
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      // Fallback: open in new tab
      window.open(selectedImage.url, '_blank', 'noopener,noreferrer');
      toastError('Download failed. Image opened in new tab instead.');
    }
  };

  // Handle regular transaction
  const handleModalAddTransaction = async () => {
    const errors = {};
    const remaining = modalOrder ? modalOrder.calculatedRemaining : null;
    const amount = Number(txnForm.amount);
    
    if (!txnForm.amount || txnForm.amount.trim() === '') {
      errors.amount = "Amount is required";
    } else if (isNaN(amount)) {
      errors.amount = "Please enter a valid number";
    } else if (amount <= 0) {
      errors.amount = "Amount must be greater than 0";
    } else if (remaining !== null && amount > remaining) {
      errors.amount = `Amount cannot exceed remaining amount (₹${remaining.toLocaleString()})`;
    }
    
    if (!txnForm.date) errors.date = "Date is required";
    if (!txnForm.transactionType) errors.transactionType = "Transaction type is required";
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
    if (txnForm.remarks) formData.append("remarks", txnForm.remarks);
    if (mediaFile) formData.append("mediaFile", mediaFile);

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
        
        // Refresh data
        await fetchAllData();
      } else {
        throw new Error(res?.message || "Failed to add transaction");
      }
    } catch (err) {
      console.error("Error adding transaction:", err);
      const errorMessage = err.message || "Failed to add transaction";
      setMessage(errorMessage);
      toastError(errorMessage);
    }
    setLoading(false);
  };

  // Handle advanced payment
  const handleAdvancedPayment = async () => {
    const errors = {};
    const amount = Number(advancedPaymentForm.amount);
    
    if (!advancedPaymentForm.amount || advancedPaymentForm.amount.trim() === '') {
      errors.amount = "Amount is required";
    } else if (isNaN(amount)) {
      errors.amount = "Please enter a valid number";
    } else if (amount <= 0) {
      errors.amount = "Amount must be greater than 0";
    }
    
    if (!advancedPaymentForm.date) errors.date = "Date is required";
    if (!advancedPaymentForm.transactionType) errors.transactionType = "Transaction type is required";
    if (advancedPaymentForm.transactionType === "online" && !advancedPaymentForm.paymentMethod) {
      errors.paymentMethod = "Payment method is required";
    }
    
    setAdvancedPaymentFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setMessage("");
    const token = cookies.get("auth-token");
    const formData = new FormData();
    formData.append("clientId", id);
    if (advancedPaymentForm.orderId && advancedPaymentForm.orderId.trim() !== '') {
      formData.append("orderId", advancedPaymentForm.orderId);
    }
    formData.append("amount", Number(advancedPaymentForm.amount));
    formData.append("date", advancedPaymentForm.date);
    formData.append("transactionType", advancedPaymentForm.transactionType);
    if (advancedPaymentForm.transactionType === "online") {
      formData.append("paymentMethod", advancedPaymentForm.paymentMethod);
      if (advancedPaymentForm.txnNumber) formData.append("txnNumber", advancedPaymentForm.txnNumber);
    }
    if (advancedPaymentForm.remarks) formData.append("remarks", advancedPaymentForm.remarks);
    if (advancedPaymentMediaFile) formData.append("mediaFile", advancedPaymentMediaFile);

    try {
      // Import centralized configuration
      const { apiEndpoint } = await import('../../constant/common');
      
      const response = await fetch(`${apiEndpoint}advanced-payment/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // No Content-Type header - let browser handle multipart/form-data
        },
        body: formData
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/pdf')) {
          // Handle PDF download
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `advanced-payment-receipt-${Date.now()}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          const successMessage = "Advanced payment created successfully and receipt downloaded";
          setMessage(successMessage);
          toastSuccess(successMessage);
        } else {
          // Handle JSON response (fallback)
          const result = await response.json();
          const successMessage = result.message || "Advanced payment created successfully";
          setMessage(successMessage);
          toastSuccess(successMessage);
        }

        // Reset form and close modal
        setAdvancedPaymentForm({
          date: new Date().toISOString().slice(0, 10),
          amount: "",
          transactionType: "cash",
          paymentMethod: "",
          txnNumber: "",
          remarks: "",
          orderId: "",
        });
        setAdvancedPaymentMediaFile(null);
        setShowAdvancedPaymentModal(false);
        await fetchAllData();
        
        // Show success toast with enhanced message
        toastSuccess(`Advanced payment of ₹${advancedPaymentForm.amount} has been successfully recorded!`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error creating advanced payment:", error);
      const errorMessage = error.message || "Failed to create advanced payment. Please check your connection and try again.";
      setMessage(errorMessage);
      toastError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle advanced payment receipt viewing
  const handleViewAdvancedPaymentReceipt = async (advancedPayment) => {
    try {
      setPdfLoading(true);
      setCurrentAdvancedPayment(advancedPayment);
      
      // Show info toast for loading
      toastInfo("Loading receipt preview...");
      
      const token = cookies.get("auth-token");
      
      // Import centralized configuration
      const { apiEndpoint } = await import('../../constant/common');
      
      const response = await fetch(`${apiEndpoint}advanced-payment/receipt/${advancedPayment._id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        
        if (blob.size === 0) {
          throw new Error('Received empty PDF file');
        }
        
        const url = window.URL.createObjectURL(blob);
        setPdfPreviewUrl(url);
        setShowPdfPreviewModal(true);
        toastSuccess("Receipt loaded successfully!");
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error loading receipt:", error);
      const errorMessage = error.message || "Failed to load receipt. Please check your connection and try again.";
      toastError(errorMessage);
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle PDF download from preview modal
  const handleDownloadPdfFromPreview = () => {
    if (pdfPreviewUrl && currentAdvancedPayment) {
      const link = document.createElement('a');
      link.href = pdfPreviewUrl;
      link.download = `advanced-payment-receipt-${currentAdvancedPayment._id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastSuccess(`Receipt for ₹${currentAdvancedPayment.amount.toLocaleString()} downloaded successfully!`);
    }
  };

  // Close PDF preview modal and cleanup
  const closePdfPreviewModal = () => {
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    setShowPdfPreviewModal(false);
    setCurrentAdvancedPayment(null);
  };

  // Handle transaction receipt viewing
  const handleViewTransactionReceipt = async (transaction) => {
    try {
      setTransactionPdfLoading(prev => ({ ...prev, [transaction._id]: true }));
      setCurrentTransaction(transaction);
      setShowTransactionReceiptModal(true);
      
      // Show info toast for loading
      toastInfo("Loading transaction receipt preview...");
      
      const token = cookies.get("auth-token");
      
      // Import centralized configuration
      const { apiEndpoint } = await import('../../constant/common');
      
      const response = await fetch(`${apiEndpoint}transaction/receipt/${transaction._id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        
        if (blob.size === 0) {
          throw new Error('Received empty PDF file');
        }
        
        const url = window.URL.createObjectURL(blob);
        setTransactionPdfUrl(url);
        toastSuccess("Transaction receipt loaded successfully!");
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error loading transaction receipt:", error);
      const errorMessage = error.message || "Failed to load transaction receipt. Please check your connection and try again.";
      toastError(errorMessage);
      setShowTransactionReceiptModal(false);
    } finally {
      setTransactionPdfLoading(prev => ({ ...prev, [transaction._id]: false }));
    }
  };

  // Handle transaction PDF download from preview modal
  const handleDownloadTransactionPdfFromPreview = () => {
    if (transactionPdfUrl && currentTransaction) {
      const link = document.createElement('a');
      link.href = transactionPdfUrl;
      link.download = `transaction-receipt-${currentTransaction._id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastSuccess(`Transaction receipt for ₹${currentTransaction.amount.toLocaleString()} downloaded successfully!`);
    }
  };

  // Close transaction receipt preview modal and cleanup
  const closeTransactionReceiptModal = () => {
    if (transactionPdfUrl) {
      window.URL.revokeObjectURL(transactionPdfUrl);
      setTransactionPdfUrl(null);
    }
    setShowTransactionReceiptModal(false);
    setCurrentTransaction(null);
  };

  // Handle ledger PDF generation
  const handleGenerateLedgerPDF = async () => {
    if (!client) {
      toastError("No client data available");
      return;
    }

    setLedgerPdfLoading(true);
    try {
      toastInfo("Generating ledger PDF...");
      const token = cookies.get("auth-token");
      
      // Import centralized configuration
      const { apiEndpoint } = await import('../../constant/common');
      
      const response = await fetch(`${apiEndpoint}order/client/${id}/ledger-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Received empty PDF file');
      }

      // Create object URL for preview
      const url = window.URL.createObjectURL(blob);
      setLedgerPdfUrl(url);
      setShowLedgerPreviewModal(true);

      toastSuccess("Ledger PDF loaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      const errorMessage = error.message || "Failed to generate ledger PDF";
      toastError(errorMessage);
    } finally {
      setLedgerPdfLoading(false);
    }
  };

  // Handle ledger PDF download from preview modal
  const handleDownloadLedgerPdfFromPreview = () => {
    if (ledgerPdfUrl && client) {
      const link = document.createElement('a');
      link.href = ledgerPdfUrl;
      link.download = `${client.name}_Ledger_${new Date()
        .toISOString()
        .split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastSuccess(`Ledger for ${client.name} downloaded successfully!`);
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

  const filteredOrders = clientOrders.filter(order => {
    let pass = true;
    if (orderDateFrom) pass = pass && new Date(order.orderDate || order.date) >= new Date(orderDateFrom);
    if (orderDateTo) pass = pass && new Date(order.orderDate || order.date) <= new Date(orderDateTo);
    if (orderStatus) pass = pass && order.status === orderStatus;
    return pass;
  });
  const paginatedOrders = filteredOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);
  const orderPageCount = Math.ceil(filteredOrders.length / PAGE_SIZE);

  const filteredTxns = transactions.filter(txn => {
    let pass = true;
    if (txnDateFrom) pass = pass && new Date(txn.date) >= new Date(txnDateFrom);
    if (txnDateTo) pass = pass && new Date(txn.date) <= new Date(txnDateTo);
    
    // Filter out transactions that are advanced payment allocations or advanced payment transactions
    // These will be shown separately in the advanced payments section
    if (txn.advancedPaymentId || txn.transactionType === 'advanced_payment_allocation') pass = false;
    
    return pass;
  });
  const paginatedTxns = filteredTxns.slice((txnPage - 1) * PAGE_SIZE, txnPage * PAGE_SIZE);
  const txnPageCount = Math.ceil(filteredTxns.length / PAGE_SIZE);

  // Main loading state with professional loader
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Client Details</h3>
            <p className="text-gray-600 mb-4">Please wait while we fetch the client information...</p>
            <div className="flex justify-center space-x-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Client Not Found</h3>
            <p className="text-gray-600 mb-4">The requested client could not be found or may have been deleted.</p>
            <Button
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onClick={() => navigate('/clients')}
            >
              Back to Clients
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Details</h1>
          <p className="text-gray-600 mt-1">View and manage client information and orders.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex flex-col items-end">
            <Button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-semibold shadow"
              onClick={() => setShowAdvancedPaymentModal(true)}
            >
              Advanced Payment
            </Button>
            {availableAdvancedBalance > 0 && (
              <div className="text-xs text-green-600 font-medium mt-1">
                Available: ₹{availableAdvancedBalance.toLocaleString()}
              </div>
            )}
          </div>
          <Button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold shadow"
            onClick={() => navigate(`/order?clientId=${id}&clientName=${encodeURIComponent(client?.name || '')}`)}
          >
            Add Order
          </Button>
          <Button
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors font-semibold shadow"
            onClick={() => navigate(`/invoice/client/${id}`)}
          >
            <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Invoices
          </Button>
          <Button
            className={`px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors font-semibold shadow ${ledgerPdfLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
            onClick={handleGenerateLedgerPDF}
            disabled={ledgerPdfLoading}
          >
            {ledgerPdfLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Generating Ledger...
              </div>
            ) : (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ledger View
              </div>
            )}
          </Button>
        </div>
      </div>
      
      {message && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
          {message}
        </div>
      )}

      {/* Client Statistics Summary Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Orders Box */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-blue-800">
                {orders.length}
              </p>
            </div>
            <div className="p-2 bg-blue-200 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Order Amount Box */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">Total Order Amount</p>
              <p className="text-2xl font-bold text-green-800">
                ₹{orders.reduce((sum, order) => sum + (order.calculatedTotal || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-2 bg-green-200 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>

        {/* Remaining Amount Box */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600 mb-1">Remaining Amount</p>
              <p className="text-2xl font-bold text-orange-800">
                ₹{orders.reduce((sum, order) => sum + (order.calculatedRemaining || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-2 bg-orange-200 rounded-full">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Pending Orders Box */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 mb-1">Pending Orders</p>
              <p className="text-2xl font-bold text-purple-800">
                {pending.length}
              </p>
            </div>
            <div className="p-2 bg-purple-200 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

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
            <td className="py-2 px-4">{client.email || "N/A"}</td>
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
          <h2 className="text-xl font-semibold mb-2">Orders with Transaction Management</h2>
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
          
          <div className="space-y-3">
            {paginatedOrders.map(order => (
              <div key={order._id} className="bg-white rounded-lg shadow-md border border-gray-200">
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
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
                          Paid: ₹{order.calculatedPaid.toLocaleString()} • 
                          Remaining: ₹{order.calculatedRemaining.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          className="px-3 py-1 rounded bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition-colors text-sm"
                          onClick={() => navigate(`/order/edit/${order._id}`)}
                        >
                          Edit Order
                        </Button>
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
                            disabled={loading}
                          >
                            Add Transaction
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {expandedOrders[order._id] && (
                  <div className="p-3">
                    <h5 className="text-sm font-semibold mb-2 text-gray-700">Transactions</h5>
                    {(order.transactions || []).length === 0 ? (
                      <p className="text-sm text-gray-500">No transactions yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white rounded border border-gray-200 text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Payment Details</th>
                              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Remarks</th>
                              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Receipt</th>
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
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        txn.transactionType === 'cash' 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {txn.transactionType === 'cash' ? 'Cash' : 'Online'}
                                      </span>
                                      {(txn.txnNumber || txn.mediaFileUrl || (txn.transactionType === 'online' && txn.paymentMethod)) && (
                                        <button
                                          onClick={() => toggleTransactionExpansion(txn._id)}
                                          className="text-blue-600 hover:text-blue-800 text-xs bg-blue-50 rounded-full w-5 h-5 flex items-center justify-center border border-blue-200"
                                          title="View transaction details"
                                        >
                                          {expandedTransactions[txn._id] ? '−' : '+'}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-sm text-gray-900">
                                    {txn.transactionType === 'online' && txn.paymentMethod ? (
                                      <div>
                                        <div className="font-medium">{txn.paymentMethod}</div>
                                        {txn.txnNumber && <div className="text-xs text-gray-500">Ref: {txn.txnNumber}</div>}
                                      </div>
                                    ) : txn.transactionType === 'cash' && txn.txnNumber ? (
                                      <div>
                                        <div className="font-medium">Cash Payment</div>
                                        <div className="text-xs text-gray-500">Receipt: {txn.txnNumber}</div>
                                      </div>
                                    ) : txn.transactionType === 'cash' ? (
                                      <span className="font-medium">Cash Payment</span>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    {txn.remarks ? (
                                      <div className="text-xs text-gray-600">
                                        <span title={txn.remarks}>
                                          {expandedRemarks[txn._id] || txn.remarks.length <= 30 
                                            ? txn.remarks 
                                            : txn.remarks.substring(0, 10) + '...'}
                                        </span>
                                        {txn.remarks.length > 30 && (
                                          <button
                                            onClick={() => toggleRemarksExpansion(txn._id)}
                                            className="ml-1 text-blue-600 hover:text-blue-800 text-xs"
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
                                      className={`px-2 py-1 text-xs rounded transition-all duration-200 border ${
                                        transactionPdfLoading[txn._id] 
                                          ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed' 
                                          : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 hover:shadow-sm'
                                      }`}
                                      onClick={() => handleViewTransactionReceipt(txn)}
                                      disabled={transactionPdfLoading[txn._id]}
                                    >
                                      {transactionPdfLoading[txn._id] ? (
                                        <div className="flex items-center">
                                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-500 border-t-transparent mr-2"></div>
                                          <span className="text-xs">Loading Receipt...</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <Icon icon="heroicons:eye" className="w-3 h-3 mr-1" />
                                          Preview Receipt
                                        </div>
                                      )}
                                    </button>
                                  </td>
                                </tr>
                                {/* Expanded Transaction Details */}
                                {expandedTransactions[txn._id] && (
                                  <tr className={`${txn.transactionType === 'cash' ? 'bg-green-50' : 'bg-blue-50'} border-l-4 ${txn.transactionType === 'cash' ? 'border-green-400' : 'border-blue-400'}`}>
                                    <td colSpan="6" className="py-4 px-4">
                                      <div className="bg-white rounded-lg p-4 shadow-sm border">
                                        <h6 className="font-semibold text-gray-800 mb-3 flex items-center">
                                          <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          {txn.transactionType === 'cash' ? 'Cash Payment Details' : 'Online Payment Details'}
                                        </h6>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {/* Payment Method for Online */}
                                          {txn.transactionType === 'online' && txn.paymentMethod && (
                                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                              <div className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">Payment Method</div>
                                              <div className="text-sm font-medium text-blue-900 capitalize">{txn.paymentMethod?.replace('_', ' ')}</div>
                                            </div>
                                          )}
                                          
                                          {/* Transaction Number */}
                                          {txn.txnNumber && (
                                            <div className={`${txn.transactionType === 'cash' ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'} rounded-lg p-3 border`}>
                                              <div className={`text-xs font-semibold mb-1 uppercase tracking-wide ${txn.transactionType === 'cash' ? 'text-green-800' : 'text-purple-800'}`}>
                                                {txn.transactionType === 'cash' ? 'Receipt Number' : 'Transaction Reference'}
                                              </div>
                                              <div className={`text-sm font-mono font-medium ${txn.transactionType === 'cash' ? 'text-green-900' : 'text-purple-900'}`}>
                                                {txn.txnNumber}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Media File */}
                                          {txn.mediaFileUrl && (
                                            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                                              <div className="text-xs font-semibold text-orange-800 mb-2 uppercase tracking-wide">
                                                {txn.transactionType === 'cash' ? 'Receipt Image' : 'Attachment'}
                                              </div>
                                              <button
                                                onClick={() => openImageModal(txn.mediaFileUrl, `${txn.transactionType === 'cash' ? 'Receipt' : 'Transaction'}_${txn._id}`)}
                                                className="inline-flex items-center px-3 py-1.5 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors text-sm font-medium"
                                              >
                                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                View Image
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* Full Remarks */}
                                        {txn.remarks && txn.remarks.length > 30 && (
                                          <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
                                            <div className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Complete Remarks</div>
                                            <div className="text-sm text-gray-700 leading-relaxed">{txn.remarks}</div>
                                          </div>
                                        )}
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
          
          <div className="flex gap-2 items-center mb-4 mt-4">
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
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg shadow-lg border border-gray-200">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-100">
                <tr>
                  <th className="py-4 px-3 text-left font-semibold text-gray-700 border-b border-gray-200 w-32">Order No</th>
                  <th className="py-4 px-3 text-left font-semibold text-gray-700 border-b border-gray-200 w-28">Date</th>
                  <th className="py-4 px-3 text-right font-semibold text-gray-700 border-b border-gray-200 w-32">Amount</th>
                  <th className="py-4 px-3 text-center font-semibold text-gray-700 border-b border-gray-200 w-20">Type</th>
                  <th className="py-4 px-3 text-left font-semibold text-gray-700 border-b border-gray-200 w-40">Payment Details</th>
                  <th className="py-4 px-3 text-left font-semibold text-gray-700 border-b border-gray-200 w-36">Remarks</th>
                  <th className="py-4 px-3 text-center font-semibold text-gray-700 border-b border-gray-200 w-24">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Advanced Payments Section */}
                {advancedPayments.map(ap => (
                  <React.Fragment key={`ap-${ap._id}`}>
                    <tr className="bg-gradient-to-r from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 transition-all duration-200 border-l-4 border-yellow-400">
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-200 text-yellow-800 shadow-sm">
                            + Advanced Payment
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-700">
                        {new Date(ap.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold text-green-600 text-lg">+₹{ap.amount.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium shadow-sm ${
                            ap.transactionType === 'cash' 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {ap.transactionType === 'cash' ? 'Cash' : 'Online'}
                          </span>
                          {(ap.txnNumber || ap.mediaFileUrl || (ap.transactionType === 'online' && ap.paymentMethod)) && (
                            <button
                              onClick={() => toggleAdvancedPaymentExpansion(ap._id)}
                              className="text-yellow-600 hover:text-yellow-800 text-xs bg-yellow-100 hover:bg-yellow-200 rounded-full w-6 h-6 flex items-center justify-center border border-yellow-300 transition-colors duration-200 shadow-sm"
                              title="View advanced payment details"
                            >
                              {expandedTransactions[`ap-${ap._id}`] ? '−' : '+'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {ap.transactionType === 'online' ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-800 capitalize">{ap.paymentMethod?.replace('_', ' ')}</div>
                            {ap.txnNumber && <div className="text-gray-600 text-xs mt-1">#{ap.txnNumber}</div>}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-sm font-medium">Cash Payment</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {ap.remarks ? (
                          <div className="text-sm text-gray-700">
                            <span title={ap.remarks} className="block">
                              {expandedRemarks[`ap-${ap._id}`] || ap.remarks.length <= 25 
                                ? ap.remarks 
                                : ap.remarks.substring(0, 25) + '...'}
                            </span>
                            {ap.remarks.length > 25 && (
                              <button
                                onClick={() => toggleRemarksExpansion(`ap-${ap._id}`)}
                                className="mt-1 text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                              >
                                {expandedRemarks[`ap-${ap._id}`] ? 'Show less' : 'Read more'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 italic">No remarks</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          className={`px-3 py-2 text-xs rounded-lg font-medium transition-all duration-200 border shadow-sm ${
                            pdfLoading 
                              ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed' 
                              : 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200 hover:shadow-md'
                          }`}
                          onClick={() => handleViewAdvancedPaymentReceipt(ap)}
                          disabled={pdfLoading}
                        >
                          {pdfLoading ? (
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-500 border-t-transparent mr-2"></div>
                              <span className="text-xs">Loading Receipt...</span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <Icon icon="heroicons:eye" className="w-3 h-3 mr-1" />
                              View Receipt
                            </div>
                          )}
                        </button>
                      </td>
                  </tr>
                  {/* Expanded Advanced Payment Details */}
                  {expandedTransactions[`ap-${ap._id}`] && (
                    <tr className="bg-yellow-50 border-l-4 border-yellow-400">
                      <td colSpan="7" className="py-4 px-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm border">
                          <h6 className="font-semibold text-gray-800 mb-3 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            Advanced Payment Details
                          </h6>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Payment Method for Online */}
                            {ap.transactionType === 'online' && ap.paymentMethod && (
                              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                <div className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">Payment Method</div>
                                <div className="text-sm font-medium text-blue-900 capitalize">{ap.paymentMethod?.replace('_', ' ')}</div>
                              </div>
                            )}
                            
                            {/* Transaction Number */}
                            {ap.txnNumber && (
                              <div className={`${ap.transactionType === 'cash' ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'} rounded-lg p-3 border`}>
                                <div className={`text-xs font-semibold mb-1 uppercase tracking-wide ${ap.transactionType === 'cash' ? 'text-green-800' : 'text-purple-800'}`}>
                                  {ap.transactionType === 'cash' ? 'Receipt Number' : 'Transaction Reference'}
                                </div>
                                <div className={`text-sm font-mono font-medium ${ap.transactionType === 'cash' ? 'text-green-900' : 'text-purple-900'}`}>
                                  {ap.txnNumber}
                                </div>
                              </div>
                            )}
                            
                            {/* Media File */}
                            {ap.mediaFileUrl && (
                              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                                <div className="text-xs font-semibold text-orange-800 mb-2 uppercase tracking-wide">
                                  Payment Receipt Image
                                </div>
                                <button
                                  onClick={() => openImageModal(ap.mediaFileUrl, `Advanced_Payment_${ap._id}`)}
                                  className="inline-flex items-center px-3 py-1.5 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors text-sm font-medium"
                                >
                                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                                  </svg>
                                  View Image
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Full Remarks */}
                          {ap.remarks && ap.remarks.length > 30 && (
                            <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
                              <div className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Complete Remarks</div>
                              <div className="text-sm text-gray-700 leading-relaxed">{ap.remarks}</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              
                {/* Regular Transactions */}
                {paginatedTxns.map(txn => (
                  <React.Fragment key={txn._id}>
                    <tr className="bg-white hover:bg-gray-50 transition-all duration-200 border-l-4 border-blue-300">
                      <td className="py-3 px-3">
                        <span className="font-semibold text-blue-700">#{txn.orderNo}</span>
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-700">
                        {new Date(txn.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold text-blue-600 text-lg">₹{txn.amount.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium shadow-sm ${
                            txn.transactionType === 'cash' 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {txn.transactionType === 'cash' ? 'Cash' : 'Online'}
                          </span>
                          {(txn.txnNumber || txn.mediaFileUrl || (txn.transactionType === 'online' && txn.paymentMethod)) && (
                            <button
                              onClick={() => toggleTransactionExpansion(txn._id)}
                              className="text-blue-600 hover:text-blue-800 text-xs bg-blue-100 hover:bg-blue-200 rounded-full w-6 h-6 flex items-center justify-center border border-blue-300 transition-colors duration-200 shadow-sm"
                              title="View transaction details"
                            >
                              {expandedTransactions[txn._id] ? '−' : '+'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {txn.transactionType === 'online' && txn.paymentMethod ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-800 capitalize">{txn.paymentMethod}</div>
                            {txn.txnNumber && <div className="text-gray-600 text-xs mt-1">Ref: {txn.txnNumber}</div>}
                          </div>
                        ) : txn.transactionType === 'cash' && txn.txnNumber ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-800">Cash Payment</div>
                            <div className="text-gray-600 text-xs mt-1">Receipt: {txn.txnNumber}</div>
                          </div>
                        ) : txn.transactionType === 'cash' ? (
                          <span className="text-gray-600 text-sm font-medium">Cash Payment</span>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {txn.remarks ? (
                          <div className="text-sm text-gray-700">
                            <span title={txn.remarks} className="block">
                              {expandedRemarks[txn._id] || txn.remarks.length <= 25 
                                ? txn.remarks 
                                : txn.remarks.substring(0, 25) + '...'}
                            </span>
                            {txn.remarks.length > 25 && (
                              <button
                                onClick={() => toggleRemarksExpansion(txn._id)}
                                className="mt-1 text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                              >
                                {expandedRemarks[txn._id] ? 'Show less' : 'Read more'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 italic">No remarks</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          className="px-3 py-2 text-xs rounded-lg font-medium transition-all duration-200 border shadow-sm bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 hover:shadow-md"
                          onClick={() => downloadTransactionReceipt(txn._id)}
                        >
                          <div className="flex items-center">
                            <Icon icon="heroicons:eye" className="w-3 h-3 mr-1" />
                            Preview Receipt
                          </div>
                        </button>
                      </td>
                    </tr>
                  {/* Expanded Transaction Details */}
                  {expandedTransactions[txn._id] && (
                    <tr className={`${txn.transactionType === 'cash' ? 'bg-green-50' : 'bg-blue-50'} border-l-4 ${txn.transactionType === 'cash' ? 'border-green-400' : 'border-blue-400'}`}>
                      <td colSpan="7" className="py-4 px-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm border">
                          <h6 className="font-semibold text-gray-800 mb-3 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {txn.transactionType === 'cash' ? 'Cash Payment Details' : 'Online Payment Details'}
                          </h6>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Payment Method for Online */}
                            {txn.transactionType === 'online' && txn.paymentMethod && (
                              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                <div className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">Payment Method</div>
                                <div className="text-sm font-medium text-blue-900 capitalize">{txn.paymentMethod?.replace('_', ' ')}</div>
                              </div>
                            )}
                            
                            {/* Transaction Number */}
                            {txn.txnNumber && (
                              <div className={`${txn.transactionType === 'cash' ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'} rounded-lg p-3 border`}>
                                <div className={`text-xs font-semibold mb-1 uppercase tracking-wide ${txn.transactionType === 'cash' ? 'text-green-800' : 'text-purple-800'}`}>
                                  {txn.transactionType === 'cash' ? 'Receipt Number' : 'Transaction Reference'}
                                </div>
                                <div className={`text-sm font-mono font-medium ${txn.transactionType === 'cash' ? 'text-green-900' : 'text-purple-900'}`}>
                                  {txn.txnNumber}
                                </div>
                              </div>
                            )}
                            
                            {/* Media File */}
                            {txn.mediaFileUrl && (
                              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                                <div className="text-xs font-semibold text-orange-800 mb-2 uppercase tracking-wide">
                                  {txn.transactionType === 'cash' ? 'Receipt Image' : 'Attachment'}
                                </div>
                                <button
                                  onClick={() => openImageModal(txn.mediaFileUrl, `${txn.transactionType === 'cash' ? 'Receipt' : 'Transaction'}_${txn._id}`)}
                                  className="inline-flex items-center px-3 py-1.5 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors text-sm font-medium"
                                >
                                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  View Image
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Full Remarks */}
                          {txn.remarks && txn.remarks.length > 30 && (
                            <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
                              <div className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Complete Remarks</div>
                              <div className="text-sm text-gray-700 leading-relaxed">{txn.remarks}</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 items-center mb-4">
            <button className="px-2 py-1 rounded border" disabled={txnPage === 1} onClick={() => setTxnPage(p => Math.max(1, p - 1))}>Prev</button>
            <span>Page {txnPage} of {txnPageCount}</span>
            <button className="px-2 py-1 rounded border" disabled={txnPage === txnPageCount || txnPageCount === 0} onClick={() => setTxnPage(p => Math.min(txnPageCount, p + 1))}>Next</button>
          </div>
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
          />
          <div>
            <label className="block text-xs font-semibold mb-1">Transaction Type <span className="text-red-500">*</span></label>
            <select
              className="form-control py-2 w-full"
              value={txnForm.transactionType}
              onChange={e => setTxnForm(f => ({ ...f, transactionType: e.target.value, paymentMethod: "", txnNumber: "" }))}
            >
              {transactionTypes.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {txnForm.transactionType === "online" && (
            <div>
              <label className="block text-xs font-semibold mb-1">Payment Method <span className="text-red-500">*</span></label>
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
            </div>
          )}
          
          <Textinput
            label="Transaction Number (optional)"
            value={txnForm.txnNumber}
            onChange={e => setTxnForm(f => ({ ...f, txnNumber: e.target.value }))}
            placeholder={txnForm.transactionType === "cash" ? "Cash receipt number (optional)" : "Transaction reference number (optional)"}
          />
          <Textinput
            label="Remarks (optional)"
            value={txnForm.remarks}
            onChange={e => setTxnForm(f => ({ ...f, remarks: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-semibold mb-1">
              Transaction Media (optional)
              {txnForm.transactionType === "cash" && (
                <span className="text-gray-500 text-xs ml-1">- Upload receipt/proof image</span>
              )}
            </label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              onChange={e => setMediaFile(e.target.files[0])}
              className="form-control py-2 w-full"
            />
            {txnForm.transactionType === "cash" && (
              <p className="text-xs text-gray-500 mt-1">
                You can upload an image of the cash receipt or payment proof
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button 
              type="submit" 
              className={`btn btn-primary transition-all duration-200 ${loading ? 'opacity-75 cursor-not-allowed' : 'hover:shadow-md'}`} 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Adding Transaction...
                </div>
              ) : (
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Transaction
                </div>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Advanced Payment Modal */}
      <Modal activeModal={showAdvancedPaymentModal} onClose={() => setShowAdvancedPaymentModal(false)} title="Advanced Payment" className="max-w-lg" centered>
        <form onSubmit={e => { e.preventDefault(); handleAdvancedPayment(); }} className="space-y-4">
          <Textinput
            label={<span>Date <span className="text-red-500">*</span></span>}
            type="date"
            value={advancedPaymentForm.date}
            onChange={e => setAdvancedPaymentForm(f => ({ ...f, date: e.target.value }))}
            error={advancedPaymentFormErrors.date}
          />
          <Textinput
            label={<span>Amount <span className="text-red-500">*</span></span>}
            type="number"
            value={advancedPaymentForm.amount}
            onChange={e => {
              const value = e.target.value;
              const validatedValue = validateAmount(value);
              setAdvancedPaymentForm(f => ({ ...f, amount: validatedValue }));
              if (advancedPaymentFormErrors.amount) {
                setAdvancedPaymentFormErrors(prev => ({ ...prev, amount: '' }));
              }
            }}
            error={advancedPaymentFormErrors.amount}
            min="0.01"
            step="0.01"
            placeholder="Enter amount"
          />
          <div>
            <label className="block text-xs font-semibold mb-1">Transaction Type <span className="text-red-500">*</span></label>
            <select
              className="form-control py-2 w-full"
              value={advancedPaymentForm.transactionType}
              onChange={e => setAdvancedPaymentForm(f => ({ ...f, transactionType: e.target.value, paymentMethod: "", txnNumber: "" }))}
            >
              {transactionTypes.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {advancedPaymentForm.transactionType === "online" && (
            <div>
              <label className="block text-xs font-semibold mb-1">Payment Method <span className="text-red-500">*</span></label>
              <select
                className="form-control py-2 w-full"
                value={advancedPaymentForm.paymentMethod}
                onChange={e => setAdvancedPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))}
              >
                <option value="">Select Payment Method</option>
                {paymentMethods.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
          
          <Textinput
            label="Transaction Number (optional)"
            value={advancedPaymentForm.txnNumber}
            onChange={e => setAdvancedPaymentForm(f => ({ ...f, txnNumber: e.target.value }))}
            placeholder={advancedPaymentForm.transactionType === "cash" ? "Cash receipt number (optional)" : "Transaction reference number (optional)"}
          />
          <div>
            <label className="block text-xs font-semibold mb-1">Order (optional)</label>
            <select
              className="form-control py-2 w-full"
              value={advancedPaymentForm.orderId}
              onChange={e => setAdvancedPaymentForm(f => ({ ...f, orderId: e.target.value }))}
            >
              <option value="">No specific order (will auto-allocate to future orders)</option>
              {clientOrders.filter(order => order.calculatedRemaining > 0).map(order => (
                <option key={order._id} value={order._id}>
                  #{order.orderNo} - ₹{order.calculatedTotal.toLocaleString()} (Remaining: ₹{order.calculatedRemaining.toLocaleString()})
                </option>
              ))}
            </select>
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-blue-700">
                  <p className="font-medium mb-1">Auto-Allocation Information:</p>
                  <ul className="space-y-1 text-blue-600">
                    <li>• If no order is selected, this payment will be automatically allocated to future orders</li>
                    <li>• If an order is selected, payment will be immediately allocated to that order</li>
                    <li>• Existing available balance: ₹{availableAdvancedBalance.toLocaleString()}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <Textinput
            label="Remarks (optional)"
            value={advancedPaymentForm.remarks}
            onChange={e => setAdvancedPaymentForm(f => ({ ...f, remarks: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-semibold mb-1">
              Transaction Media (optional)
              {advancedPaymentForm.transactionType === "cash" && (
                <span className="text-gray-500 text-xs ml-1">- Upload receipt/proof image</span>
              )}
            </label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              onChange={e => setAdvancedPaymentMediaFile(e.target.files[0])}
              className="form-control py-2 w-full"
            />
            {advancedPaymentForm.transactionType === "cash" && (
              <p className="text-xs text-gray-500 mt-1">
                You can upload an image of the cash receipt or payment proof
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" className="btn btn-outline-secondary" onClick={() => setShowAdvancedPaymentModal(false)}>Cancel</Button>
            <Button 
              type="submit" 
              className={`btn btn-primary transition-all duration-200 ${loading ? 'opacity-75 cursor-not-allowed' : 'hover:shadow-md'}`} 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing Payment...
                </div>
              ) : (
                <div className="flex items-center">
                  <Icon icon="heroicons:plus-circle" className="w-4 h-4 mr-2" />
                  Add Advanced Payment
                </div>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Advanced Payment PDF Preview Modal */}
      <Modal 
        activeModal={showPdfPreviewModal} 
        onClose={closePdfPreviewModal} 
        title="Advanced Payment Receipt Preview" 
        className="max-w-6xl" 
        centered
      >
        <div className="space-y-4">
          {currentAdvancedPayment && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-green-800">
                    Advanced Payment Receipt
                  </h3>
                  <p className="text-sm text-green-600">
                    Amount: ₹{currentAdvancedPayment.amount.toLocaleString()} • 
                    Date: {new Date(currentAdvancedPayment.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-green-100 rounded-full">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {pdfPreviewUrl ? (
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <iframe
                src={pdfPreviewUrl}
                width="100%"
                height="600px"
                className="border-0"
                title="Advanced Payment Receipt Preview"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-200 border-t-green-600 mx-auto mb-4"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-green-600 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Receipt Preview</h3>
                <p className="text-gray-600 mb-4">Please wait while we prepare your advanced payment receipt...</p>
                <div className="flex justify-center space-x-1">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button 
              type="button" 
              className="btn btn-outline-secondary"
              onClick={closePdfPreviewModal}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close Preview
            </Button>
            <Button 
              type="button" 
              className="btn btn-primary bg-green-600 hover:bg-green-700"
              onClick={handleDownloadPdfFromPreview}
              disabled={!pdfPreviewUrl}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Receipt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Transaction Receipt Preview Modal */}
      <Modal 
        activeModal={showTransactionReceiptModal} 
        onClose={closeTransactionReceiptModal} 
        title="Transaction Receipt Preview" 
        className="max-w-6xl" 
        centered
      >
        <div className="space-y-4">
          {currentTransaction && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-800">
                    Transaction Receipt
                  </h3>
                  <p className="text-sm text-blue-600">
                    Amount: ₹{currentTransaction.amount.toLocaleString()} • 
                    Date: {new Date(currentTransaction.date).toLocaleDateString()} •
                    Type: {currentTransaction.transactionType === 'cash' ? 'Cash' : 'Online'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {transactionPdfUrl ? (
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <iframe
                src={transactionPdfUrl}
                width="100%"
                height="600px"
                className="border-0"
                title="Transaction Receipt Preview"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-purple-600 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Transaction Receipt</h3>
                <p className="text-gray-600 mb-4">Please wait while we prepare your transaction receipt...</p>
                <div className="flex justify-center space-x-1">
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button 
              type="button" 
              className="btn btn-outline-secondary"
              onClick={closeTransactionReceiptModal}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close Preview
            </Button>
            <Button 
              type="button" 
              className="btn btn-primary bg-blue-600 hover:bg-blue-700"
              onClick={handleDownloadTransactionPdfFromPreview}
              disabled={!transactionPdfUrl}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Receipt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Ledger PDF Preview Modal */}
      <Modal 
        activeModal={showLedgerPreviewModal} 
        onClose={closeLedgerPreviewModal} 
        title={`Client Ledger - ${client ? client.name : ''}`}
        className="max-w-4xl"
        centered
      >
        <div className="space-y-4">
          {ledgerPdfLoading ? (
            <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Generating Ledger PDF</h3>
                <p className="text-gray-600 mb-4">Please wait while we prepare your ledger document...</p>
                <div className="flex justify-center space-x-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
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
                  {client && (
                    <>
                      <span className="font-medium">Client:</span> {client.name} | 
                      <span className="font-medium ml-2">Orders:</span> {orders.length} | 
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
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Ledger
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-96 text-gray-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
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

      {/* Image Preview Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Transaction Image</h3>
                <p className="text-sm text-gray-500 mt-1">Preview and download transaction media</p>
              </div>
              <button
                onClick={closeImageModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-6 min-h-0">
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <img
                  src={selectedImage.url}
                  alt="Transaction Image"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  style={{ maxHeight: 'calc(95vh - 200px)' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden flex-col items-center justify-center text-gray-500 p-8">
                  <svg className="w-20 h-20 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-lg font-medium mb-2">Unable to load image</p>
                  <p className="text-sm text-gray-400 mb-4">The image file may be corrupted or unavailable</p>
                  <button
                    onClick={() => window.open(selectedImage.url, '_blank')}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try opening in new tab
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="inline-flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Right-click to save or use download button
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={downloadImage}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download
                  </button>
                  <button
                    onClick={closeImageModal}
                    className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDetails;