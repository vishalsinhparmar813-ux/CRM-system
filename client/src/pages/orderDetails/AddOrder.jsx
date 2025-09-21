import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Textinput from "../../components/ui/Textinput";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import useToast from "../../hooks/useToast";
import { v4 as uuidv4 } from 'uuid';
import AddProductForm from "../product/AddProductForm";
import AddClient from "../dashboard/AddClient";
import { getUnitLabel } from "../../utils/unitUtils";

const UNIT_ENUM = {
  NOS: "NOS",
  SQUARE_METER: "Sq. M.",
  SQUARE_FEET: "Sq. Ft.",
  SET: "SET",
};

const AddOrder = ({ onComplete }) => {
  const cookies = new Cookies();
  const { apiCall } = useApi();
  const { toastSuccess, toastError } = useToast();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  
  // Check if we're in edit mode
  const isEditMode = !!orderId;
  const preSelectedClientId = searchParams.get('clientId');

  // Form state
  // Initialize product rows with unique ids
  const [formData, setFormData] = useState({
    clientId: preSelectedClientId || "",
    products: [
      { id: uuidv4(), productId: "", quantity: "", unitType: "", ratePrice: "",cashRate: ""}
    ],
    dueDate: "",
    gst: "",
    orderDate: new Date().toISOString().split('T')[0], // Default to today's date
  });
  // Data state
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  // Price preview state
  const [productPreviews, setProductPreviews] = useState([]);
  const [grandTotal, setGrandTotal] = useState({
    subtotal: 0,
    gstAmount: 0,
    final: 0,
  });
  const [clientSearch, setClientSearch] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const clientInputRef = useRef();
  const productInputRefs = useRef({});

  // Add state for product search and suggestions for each row
  const [productSearch, setProductSearch] = useState({});
  const [productSuggestions, setProductSuggestions] = useState({});
  const [showProductSuggestions, setShowProductSuggestions] = useState({});

  // Modal states for keyboard shortcuts
  const [showProductModal, setShowProductModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [activeProductRowId, setActiveProductRowId] = useState(null);
  const [activeClientField, setActiveClientField] = useState(false);

  // PDF Preview Modal States
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFilename, setPdfFilename] = useState("");
  const [orderData, setOrderData] = useState(null);

  // Order Success Modal States
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [createdOrderData, setCreatedOrderData] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Refs for scrolling
  const productFormRef = useRef(null);

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

  // Field-specific keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only Alt+C, context-aware based on focused field
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if client field is focused
        if (activeClientField) {
          setShowClientModal(true);
        }
        // Check if any product field is focused
        else if (activeProductRowId) {
          setShowProductModal(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeClientField, activeProductRowId]);

  // Fetch clients and products
  const fetchData = async () => {
    const token = cookies.get("auth-token");
    try {
      const [clientsRes, productsRes] = await Promise.all([
        apiCall("GET", "client/all", null, token),
        apiCall("GET", "product/all", null, token),
      ]);
      setClients(clientsRes?.data || clientsRes || []);
      const fetchedProducts = productsRes?.products || productsRes?.data || productsRes || [];
      console.log("Fetched products:", fetchedProducts);
      setProducts(fetchedProducts);
      return fetchedProducts;
    } catch (err) {
      console.error("Failed to fetch data:", err);
      alert("Failed to fetch client or product data");
      return [];
    }
  };

  // Fetch existing order data if in edit mode
  const fetchOrderData = async () => {
    if (!isEditMode || !orderId) return;
    
    const token = cookies.get("auth-token");
    try {
      const response = await apiCall("GET", `order/${orderId}`, null, token);
      if (response.success && response.data) {
        const order = response.data;
        
        // Transform order data to match form structure
        const transformedProducts = order.products.map(product => ({
          id: uuidv4(),
          productId: product.productId._id || product.productId,
          quantity: product.quantity.toString(),
          unitType: product.unitType,
          ratePrice: product.ratePrice.toString(),
          cashRate: product.cashRate?.toString() || ""
        }));
        
        setFormData({
          clientId: order.clientId._id || order.clientId,
          products: transformedProducts,
          dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split('T')[0] : "",
          gst: order.gst?.toString() || "",
          orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        });
        
        // Set client search to show selected client name
        if (order.clientName) {
          setClientSearch(order.clientName);
        } else if (order.clientId && typeof order.clientId === 'object' && order.clientId.name) {
          setClientSearch(order.clientId.name);
        }
        
        // Set product search display names
        const productSearchMap = {};
        if (order.products) {
          order.products.forEach((product, index) => {
            const productName = product.productName || 'Unknown Product';
            productSearchMap[transformedProducts[index]?.id] = productName;
          });
          setProductSearch(productSearchMap);
        }
      }
    } catch (error) {
      console.error("Failed to fetch order data:", error);
      toastError("Failed to load order data");
    }
  };

  useEffect(() => {
    fetchData().then(() => {
      if (isEditMode) {
        fetchOrderData();
      }
    });
  }, [isEditMode, orderId]);

  // Handle pre-selected client from URL params
  useEffect(() => {
    if (preSelectedClientId && !isEditMode) {
      setFormData(prev => ({
        ...prev,
        clientId: preSelectedClientId
      }));
    }
  }, [preSelectedClientId, isEditMode]);

  // Fetch client suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!clientSearch || clientSearch.length < 2) {
        setClientSuggestions([]);
        return;
      }
      const token = cookies.get("auth-token");
      try {
        const res = await apiCall("GET", `client/search/${encodeURIComponent(clientSearch)}?suggestion=true`, null, token);
        setClientSuggestions(res.data || []);
      } catch (err) {
        setClientSuggestions([]);
      }
    };
    fetchSuggestions();
  }, [clientSearch]);

  // Fetch product suggestions as user types (per row)
  useEffect(() => {
    Object.entries(productSearch).forEach(([rowId, search]) => {
      if (!search || search.length < 2) {
        setProductSuggestions(prev => ({ ...prev, [rowId]: [] }));
        return;
      }
      const fetchSuggestions = async () => {
        const token = cookies.get("auth-token");
        try {
          const res = await apiCall("GET", `product/search/${encodeURIComponent(search)}`, null, token);
          console.log("[Product Autocomplete] API response for rowId", rowId, search, res);
          setProductSuggestions(prev => ({ ...prev, [rowId]: Array.isArray(res) ? res : (res.products || []) }));
        } catch (err) {
          setProductSuggestions(prev => ({ ...prev, [rowId]: [] }));
        }
      };
      fetchSuggestions();
    });
  }, [productSearch]);

  // When product changes, reset dependent fields
  useEffect(() => {
    if (!formData.productId) {
      setSelectedProduct(null);
      setFormData(f => ({ ...f, quantity: "", ratePrice: "" }));
      return;
    }
    const prod = products.find(p => p._id === formData.productId);
    setSelectedProduct(prod || null);
    // Set default unitType to base unit if available
    if (prod) {
      const validUnits = getValidUnits(prod);
      setFormData(f => ({
        ...f,
        quantity: "",
        ratePrice: prod.ratePerUnit.toString(),
      }));
    }
  }, [formData.productId, products]);

  // Real-time validation for multi-product form
  useEffect(() => {
    const newErrors = {};
    
    // Client validation
    if (touched.clientId && !formData.clientId) {
      newErrors.clientId = "Client is required";
    }
    
    // Product validation for each row
    formData.products.forEach((p) => {
      const productKey = `product_${p.id}_productId`;
      const quantityKey = `product_${p.id}_quantity`;
      const unitTypeKey = `product_${p.id}_unitType`;
      const ratePriceKey = `product_${p.id}_ratePrice`;
      
      // Only validate if field has been touched
      if (touched[productKey] && !p.productId) {
        newErrors[productKey] = "Product is required";
      }
      
      if (touched[quantityKey]) {
        if (!p.quantity) {
          newErrors[quantityKey] = "Quantity is required";
        } else if (parseFloat(p.quantity) <= 0) {
          newErrors[quantityKey] = "Quantity must be greater than 0";
        }
      }
      
      if (touched[unitTypeKey] && !p.unitType) {
        newErrors[unitTypeKey] = "Unit type is required";
      }
      
      if (touched[ratePriceKey]) {
        if (!p.ratePrice) {
          newErrors[ratePriceKey] = "Rate price is required";
        } else if (parseFloat(p.ratePrice) <= 0) {
          newErrors[ratePriceKey] = "Rate price must be greater than 0";
        }
      }
    });
    
    // Only update errors if there are actual changes to prevent unnecessary re-renders
    const currentErrorKeys = Object.keys(errors);
    const newErrorKeys = Object.keys(newErrors);
    
    if (currentErrorKeys.length !== newErrorKeys.length || 
        !currentErrorKeys.every(key => newErrors[key] === errors[key])) {
      setErrors(newErrors);
    }
  }, [formData, touched]);

  // Price preview calculation
  useEffect(() => {
    let previews = [];
    let subtotal = 0;
    let gstAmount = 0;
    let finalTotal = 0;
    formData.products.forEach((p, idx) => {
      if (!p.productId || !p.quantity || !p.ratePrice) {
        previews.push(null);
        return;
      }
      const prod = products.find(prod => prod._id === p.productId);
      if (!prod) {
        previews.push(null);
        return;
      }
      const quantity = parseFloat(p.quantity) || 0;
      const ratePrice = parseFloat(p.ratePrice) || 0;
      const rowSubtotal = ratePrice * quantity;
      const gst = parseFloat(formData.gst) || 0;
      const rowGstAmount = gst > 0 ? rowSubtotal * gst / 100 : 0;
      const rowFinal = rowSubtotal + rowGstAmount;
      previews.push({
        name: prod.name,
        unitType: prod.unitType,
        rate: ratePrice,
        quantity,
        rowSubtotal,
        rowGstAmount,
        rowFinal,
      });
      subtotal += rowSubtotal;
      gstAmount += rowGstAmount;
      finalTotal += rowFinal;
    });
    setProductPreviews(previews);
    setGrandTotal({ subtotal, gstAmount, final: finalTotal });
  }, [formData.products, products, formData.gst]);

  // Get valid units for dropdown
  function getValidUnits(product) {
    if (!product) return [];
    
    // Start with the product's base unit
    const units = [{ value: product.unitType, label: product.unitType }];
    
    // Add alternate units if they exist
    if (product.alternateUnits) {
      if (product.unitType === UNIT_ENUM.SQUARE_METER || product.unitType === UNIT_ENUM.SQUARE_FEET) {
        // Area units can be converted to NOS
        units.push({ value: UNIT_ENUM.NOS, label: UNIT_ENUM.NOS });
        // Optionally allow the other area unit
        if (product.unitType === UNIT_ENUM.SQUARE_METER) {
          units.push({ value: UNIT_ENUM.SQUARE_FEET, label: UNIT_ENUM.SQUARE_FEET });
        } else {
          units.push({ value: UNIT_ENUM.SQUARE_METER, label: UNIT_ENUM.SQUARE_METER });
        }
      } else if (product.unitType === UNIT_ENUM.NOS) {
        // NOS can be converted to SET if alternate units exist
        units.push({ value: UNIT_ENUM.SET, label: UNIT_ENUM.SET });
      }
    }
    
    return units;
  }

  // Handle input changes
  const handleInputChange = (field, value) => {
    // Always use value (string) for dropdowns
    setFormData(prev => {
      // Reset quantity, ratePrice on product change
      if (field === "clientId") {
        return { ...prev, clientId: value };
      }
      return { ...prev, [field]: value };
    });
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Handle field blur
  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Create field objects for Select components
  const createFieldObject = (fieldName) => ({
    name: fieldName,
    value: formData[fieldName] || "",
    onChange: (e) => handleInputChange(fieldName, e.target.value),
    onBlur: () => handleFieldBlur(fieldName),
  });

  // Add handlers for adding/removing product rows
  const addProductRow = () => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { id: uuidv4(), productId: "", quantity: "", unitType: "", ratePrice: "" }]
    }));
  };
  const removeProductRow = (rowId) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== rowId)
    }));
    setTouched(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (key.startsWith(`product_${rowId}_`)) delete updated[key];
      });
      return updated;
    });
    setErrors(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (key.startsWith(`product_${rowId}_`)) delete updated[key];
      });
      return updated;
    });
  };

  // Update handleInputChange to support products array
  const handleProductInputChange = (rowId, field, value) => {
    setFormData(prev => {
      const updatedProducts = prev.products.map(p => {
        if (p.id === rowId) {
          if (field === "productId") {
            const prod = products.find(prod => prod._id === value);
            console.log("Found product for auto-population:", prod);
            if (prod) {
              // Transform backend unit type to display format
              let displayUnitType = prod.unitType;
              if (prod.unitType === "SQUARE_FEET") displayUnitType = "Sq. Ft.";
              else if (prod.unitType === "SQUARE_METER") displayUnitType = "Sq. M.";
              else if (prod.unitType === "NOS") displayUnitType = "NOS";
              else if (prod.unitType === "SET") displayUnitType = "SET";
              
              return {
                ...p,
                productId: value,
                unitType: displayUnitType,
                ratePrice: prod.ratePerUnit ? prod.ratePerUnit.toString() : "",
                // Keep existing quantity and cashRate
                quantity: p.quantity || "",
                cashRate: p.cashRate || ""
              };
            } else {
              console.warn("Product not found in products array:", value);
              return {
                ...p,
                productId: value,
                unitType: "",
                ratePrice: "",
              };
            }
          }
          return { ...p, [field]: value };
        }
        return p;
      });
      return { ...prev, products: updatedProducts };
    });
    
    // Only set touched, don't clear errors here
    // Errors should only be cleared when validation passes
    setTouched(prev => ({ ...prev, [`product_${rowId}_${field}`]: true }));
  };

  // Update validation for all product rows
  const validateForm = () => {
    const newErrors = {};
    if (!formData.clientId) newErrors.clientId = "Client is required";
    formData.products.forEach((p) => {
      if (!p.productId) newErrors[`product_${p.id}_productId`] = "Product is required";
      if (!p.quantity || parseFloat(p.quantity) <= 0) newErrors[`product_${p.id}_quantity`] = "Quantity must be greater than 0";
      if (!p.unitType) newErrors[`product_${p.id}_unitType`] = "Unit type is required";
      if (!p.ratePrice || parseFloat(p.ratePrice) <= 0) newErrors[`product_${p.id}_ratePrice`] = "Rate price must be greater than 0";
    });
    
    // Set both touched and errors in a single batch to avoid re-render issues
    const newTouched = {
      ...touched,
      clientId: true,
      ...formData.products.reduce((acc, p) => ({
        ...acc,
        [`product_${p.id}_productId`]: true,
        [`product_${p.id}_quantity`]: true,
        [`product_${p.id}_unitType`]: true,
        [`product_${p.id}_ratePrice`]: true
      }), {})
    };
    
    // Use React's batch update to set both states together
    setTouched(newTouched);
    setErrors(newErrors);
    
    return Object.keys(newErrors).length === 0;
  };

  // Submit handler
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    setLoading(true);
    try {
      const token = cookies.get("auth-token");
      const orderPayload = {
        clientId: formData.clientId,
        gst: formData.gst,
        products: formData.products.map(p => ({
          productId: p.productId,
          quantity: parseFloat(p.quantity),
          remainingQuantity: parseFloat(p.quantity), // Set remainingQuantity equal to quantity for updates
          unitType: p.unitType,
          ratePrice: parseFloat(p.ratePrice),
          cashRate: p.cashRate ? parseFloat(p.cashRate) : null 
        })),
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        orderDate: formData.orderDate ? new Date(formData.orderDate).toISOString() : new Date().toISOString(),
      };

      const response = isEditMode 
        ? await apiCall("PATCH", `order/${orderId}`, orderPayload, token)
        : await apiCall("POST", "order", orderPayload, token);
      if (response?.orderId || (isEditMode && response?.success)) {
        // Store complete order data for success modal
        const selectedClient = clients.find(c => c._id === formData.clientId);
        const orderDetails = {
          orderId: response.orderId || orderId,
          orderNo: response.orderNo ? `#${response.orderNo}` : `#${response.orderId || orderId}`,
          clientId: formData.clientId,
          clientName: selectedClient?.name || "Unknown Client",
          clientMobile: selectedClient?.mobile || "",
          totalAmount: grandTotal.final,
          productCount: formData.products.length,
          orderDate: formData.orderDate
        };
        
        setCreatedOrderData(orderDetails);
        setOrderData(orderDetails); // For PDF generation
        setShowOrderSuccess(true);
        
        if (!isEditMode) {
          // Reset form only for new orders
          setFormData({ 
            clientId: "", 
            products: [{ id: uuidv4(), productId: "", quantity: "", unitType: "", ratePrice: "", cashRate: "" }], 
            dueDate: "", 
            gst: "",
            orderDate: new Date().toISOString().split('T')[0] 
          });
          setTouched({});
          setErrors({});
          setClientSearch("");
          setProductSearch({});
        }
        
        toastSuccess(isEditMode ? "Order updated successfully!" : "Order created successfully!");
      } else {
        const errorMessage = response?.message || response?.error || (isEditMode ? "Failed to update order" : "Failed to create order");
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error("Order submission error:", err);
      const errorMessage = err.message || (isEditMode ? "An error occurred while updating the order" : "An error occurred while creating the order");
      toastError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOrderReceipt = async (orderId, clientId, orderNo) => {
    setIsGeneratingPdf(true);
    try {
      const token = cookies.get("auth-token");
      
      // Use standardized approach for PDF download
      const blob = await downloadPDF("order/receipt-pdf", {
        orderIds: orderId,
        clientId: clientId
      }, token);

      const url = window.URL.createObjectURL(blob);
      
      // Set PDF preview data
      setPdfUrl(url);
      setPdfFilename(`Order_Receipt_${orderNo || orderId}_${new Date().toISOString().split('T')[0]}.pdf`);
      setShowPdfPreview(true);
      setShowOrderSuccess(false); // Close success modal
      
      toastSuccess('Order receipt generated! Preview available.');
    } catch (error) {
      console.error('Error generating order receipt:', error);
      toastError('An error occurred while generating the order receipt');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handle order success modal actions
  const handleCreateAnother = () => {
    setShowOrderSuccess(false);
    setCreatedOrderData(null);
    // Form is already reset in onSubmit
  };

  const handleViewOrders = () => {
    setShowOrderSuccess(false);
    setCreatedOrderData(null);
    onComplete?.(); // Navigate back to orders list
  };

  const handleGenerateReceipt = () => {
    if (createdOrderData) {
      handleGenerateOrderReceipt(
        createdOrderData.orderId, 
        createdOrderData.clientId, 
        createdOrderData.orderNo
      );
    }
  };

  // Handle PDF preview close with cleanup
  const closePdfPreview = () => {
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
    }
    setShowPdfPreview(false);
    setPdfUrl(null);
    setPdfFilename("");
    setOrderData(null);
  };

  // Handle PDF download
  const downloadPdf = () => {
    if (pdfUrl && pdfFilename) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = pdfFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastSuccess('Order receipt downloaded successfully!');
    }
  };

  // Handle product creation completion
  const handleProductCreated = async (newProducts) => {
    setShowProductModal(false);
    
    // Handle both single product and multiple products
    const productsArray = Array.isArray(newProducts) ? newProducts : [newProducts];
    
    if (productsArray.length > 0) {
      // Fetch latest products data and wait for it to complete
      const updatedProducts = await fetchData();
      
      // Use a longer timeout to ensure state updates are complete
      setTimeout(() => {
        // If there's an active product field, populate the first product there
        if (activeProductRowId && productsArray[0]) {
          const firstProduct = productsArray[0];
          const productId = firstProduct._id || firstProduct.id;
          const productName = firstProduct.name;
          
          console.log("Auto-selecting first product:", { productId, productName, activeProductRowId });
          console.log("Available products after fetch:", updatedProducts);
          
          // Find the complete product data from the updated products list
          const completeProduct = updatedProducts.find(p => p._id === productId);
          
          if (completeProduct) {
            // Update product search display
            setProductSearch(prev => ({ 
              ...prev, 
              [activeProductRowId]: productName 
            }));
            
            // Update form data with complete product information
            setFormData(prev => {
              const updatedProducts = prev.products.map(p => {
                if (p.id === activeProductRowId) {
                  // Transform backend unit type to display format
                  let displayUnitType = completeProduct.unitType || "";
                  if (completeProduct.unitType === "SQUARE_FEET") displayUnitType = "Sq. Ft.";
                  else if (completeProduct.unitType === "SQUARE_METER") displayUnitType = "Sq. M.";
                  else if (completeProduct.unitType === "NOS") displayUnitType = "NOS";
                  else if (completeProduct.unitType === "SET") displayUnitType = "SET";
                  
                  return {
                    ...p,
                    productId: productId,
                    unitType: displayUnitType,
                    ratePrice: completeProduct.ratePerUnit ? completeProduct.ratePerUnit.toString() : "",
                    // Auto-populate cash rate: use product's cashRate if available, otherwise use ratePerUnit
                    quantity: p.quantity || "",
                    cashRate: completeProduct.cashRate ? completeProduct.cashRate.toString() : 
                             (completeProduct.ratePerUnit ? completeProduct.ratePerUnit.toString() : "")
                  };
                }
                return p;
              });
              return { ...prev, products: updatedProducts };
            });
          }
        }
        
        // Add additional rows for remaining products
        if (productsArray.length > 1) {
          const additionalProducts = productsArray.slice(1);
          const newRowIds = [];
          
          setFormData(prev => {
            const newProducts = [...prev.products];
            
            additionalProducts.forEach(product => {
              const newRowId = uuidv4();
              newRowIds.push(newRowId);
              const productId = product._id || product.id;
              const productName = product.name;
              
              // Find complete product data
              const completeProduct = updatedProducts.find(p => p._id === productId);
              
              // Transform backend unit type to display format for additional products
              let displayUnitType = completeProduct ? completeProduct.unitType : "";
              if (completeProduct && completeProduct.unitType === "SQUARE_FEET") displayUnitType = "Sq. Ft.";
              else if (completeProduct && completeProduct.unitType === "SQUARE_METER") displayUnitType = "Sq. M.";
              else if (completeProduct && completeProduct.unitType === "NOS") displayUnitType = "NOS";
              else if (completeProduct && completeProduct.unitType === "SET") displayUnitType = "SET";
              
              newProducts.push({
                id: newRowId,
                productId: productId,
                quantity: "",
                unitType: displayUnitType,
                ratePrice: completeProduct && completeProduct.ratePerUnit ? completeProduct.ratePerUnit.toString() : "",
                // Auto-populate cash rate: use product's cashRate if available, otherwise use ratePerUnit
                cashRate: completeProduct && completeProduct.cashRate ? completeProduct.cashRate.toString() : 
                         (completeProduct && completeProduct.ratePerUnit ? completeProduct.ratePerUnit.toString() : "")
              });
              
              // Set product search display
              setProductSearch(prevSearch => ({
                ...prevSearch,
                [newRowId]: productName
              }));
            });
            
            return { ...prev, products: newProducts };
          });
        }
        
        setShowProductSuggestions(prev => ({ 
          ...prev, 
          [activeProductRowId]: false 
        }));
      }, 300);
      
      // Removed toast notification - products are already visually confirmed in the modal
    } else {
      toastError("No products added");
    }
  };

  // Handle client creation completion
  const handleClientCreated = (newClient) => {
    setShowClientModal(false);
    fetchData().then(() => {
      // Auto-populate client field with new client
      if (newClient) {
        setFormData(f => ({ ...f, clientId: newClient._id || newClient.id }));
        setClientSearch(`${newClient.name} (${newClient.mobile})`);
      }
    });
    toastSuccess("Client added and selected in order!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? "Edit Order" : "Create New Order"}
          </h1>
          <p className="text-gray-600 mt-1">
            {isEditMode ? "Update order details with live pricing preview" : "Add a new order with live pricing preview"}
          </p>
        </div>
        <Button 
          onClick={() => onComplete ? onComplete() : navigate('/order')} 
          className="btn btn-outline-secondary"
        >
          <Icon icon="heroicons:arrow-left" className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Form */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Order Details</h2>
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Error summary at the top of the form */}
              {Object.keys(errors).length > 0 && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
                  <ul className="list-disc pl-5">
                    {Object.entries(errors).map(([key, msg]) => (
                      <li key={key}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Autocomplete client input */}
                <div className="relative">
                  <label className="block mb-2 text-sm font-medium">Client Name <span className="text-red-500">*</span></label>
                  <input
                    ref={clientInputRef}
                    type="text"
                    className={`form-control py-2 w-full ${touched.clientId && errors.clientId ? 'border-red-500' : ''}`}
                    placeholder="Type client name, alias, email, or mobile (Alt+C to add new)"
                    value={clientSearch || (clients.find(c => c._id === formData.clientId)?.name || "")}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      setFormData(f => ({ ...f, clientId: "" }));
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      setShowSuggestions(true);
                      setActiveClientField(true);
                      setActiveProductRowId(null);
                    }}
                    onBlur={() => {
                      setTouched(prev => ({ ...prev, clientId: true }));
                      setTimeout(() => {
                        setShowSuggestions(false);
                        setActiveClientField(false);
                      }, 150);
                    }}
                  />
                  {showSuggestions && clientSuggestions.length > 0 && (
                    <ul className="absolute z-10 bg-white border border-gray-200 w-full mt-1 rounded shadow max-h-56 overflow-y-auto">
                      {clientSuggestions.map(client => (
                        <li
                          key={client._id}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                          onMouseDown={() => {
                            setFormData(f => ({ ...f, clientId: client._id }));
                            setClientSearch(`${client.name} (${client.mobile})`);
                            setShowSuggestions(false);
                          }}
                        >
                          <div className="font-medium">{client.name} <span className="text-xs text-gray-500">({client.alias})</span></div>
                          <div className="text-xs text-gray-500">{client.email} | {client.mobile}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {touched.clientId && errors.clientId && <div className="text-red-500 text-xs mt-1">{errors.clientId}</div>}
                </div>
                <Textinput
                  label="Order Date"
                  type="date"
                  value={formData.orderDate}
                  onChange={e => handleInputChange("orderDate", e.target.value)}
                  onBlur={() => handleFieldBlur("orderDate")}
                  error={errors.orderDate}
                />
                <Textinput
                  label="Due Date"
                  type="date"
                  value={formData.dueDate}
                  onChange={e => handleInputChange("dueDate", e.target.value)}
                  onBlur={() => handleFieldBlur("dueDate")}
                  error={errors.dueDate}
                  min={formData.orderDate || new Date().toISOString().split('T')[0]}
                />
              </div>
              {/* GST Field */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Textinput
                  label="GST (%)"
                  type="number"
                  step="0.01"
                  placeholder="Enter GST percentage (e.g., 5, 18)"
                  value={formData.gst}
                  onChange={e => handleInputChange("gst", e.target.value)}
                  onBlur={() => handleFieldBlur("gst")}
                  error={errors.gst}
                />
              </div>
              {formData.products.map((p, idx) => (
                  <div key={p.id} className="grid grid-cols-5 gap-2 mb-2 items-end">
                    {/* Autocomplete product input */}
                    <div className="relative">
                      <label className="block mb-2 text-sm font-medium">Product <span className="text-red-500">*</span></label>
                      <input
                        ref={el => productInputRefs.current[p.id] = el}
                        type="text"
                        className={`form-control py-2 w-full ${touched[`product_${p.id}_productId`] && errors[`product_${p.id}_productId`] ? 'border-red-500' : ''}`}
                        placeholder="Type product name or alias (Alt+C to add new)"
                        value={productSearch[p.id] || (products.find(prod => prod._id === p.productId)?.name || "")}
                        onChange={e => {
                          setProductSearch(prev => ({ ...prev, [p.id]: e.target.value }));
                          handleProductInputChange(p.id, "productId", "");
                          setShowProductSuggestions(prev => ({ ...prev, [p.id]: true }));
                        }}
                        onFocus={() => {
                          setShowProductSuggestions(prev => ({ ...prev, [p.id]: true }));
                          setActiveProductRowId(p.id);
                          setActiveClientField(false);
                        }}
                        onBlur={() => {
                          setTouched(prev => ({ ...prev, [`product_${p.id}_productId`]: true }));
                          setTimeout(() => {
                            setShowProductSuggestions(prev => ({ ...prev, [p.id]: false }));
                            // Only clear activeProductRowId if modal is not open
                            if (!showProductModal) {
                              setActiveProductRowId(null);
                            }
                          }, 150);
                        }}
                      />
                      {showProductSuggestions[p.id] && productSuggestions[p.id] && productSuggestions[p.id].length > 0 && (
                        <ul className="absolute z-10 bg-white border border-gray-200 w-full mt-1 rounded shadow max-h-56 overflow-y-auto">
                          {productSuggestions[p.id].map(product => (
                            <li
                              key={product._id}
                              className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                              onMouseDown={() => {
                                setProductSearch(prev => ({ ...prev, [p.id]: product.name }));
                                handleProductInputChange(p.id, "productId", product._id);
                                setShowProductSuggestions(prev => ({ ...prev, [p.id]: false }));
                              }}
                            >
                              <div className="font-medium">{product.name} <span className="text-xs text-gray-500">({product.alias})</span></div>
                              <div className="text-xs text-gray-500">{getUnitLabel(product.unitType)} | ₹{product.ratePerUnit}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {touched[`product_${p.id}_productId`] && errors[`product_${p.id}_productId`] && <div className="text-red-500 text-xs mt-1">{errors[`product_${p.id}_productId`]}</div>}
                    </div>
<Textinput
  label={<span>Quantity <span className="text-red-500">*</span></span>}
  type="number"
  placeholder="Enter quantity"
  value={p.quantity}
  onChange={e => handleProductInputChange(p.id, "quantity", e.target.value)}
  onBlur={() => setTouched(prev => ({ ...prev, [`product_${p.id}_quantity`]: true }))}
  error={touched[`product_${p.id}_quantity`] && errors[`product_${p.id}_quantity`] ? errors[`product_${p.id}_quantity`] : undefined}
/>

<Textinput
  label={<span>Rate<span className="text-red-500">*</span></span>}
  type="number"
  step="0.01"
  placeholder="Enter rate per unit"
  value={p.ratePrice}
  onChange={e => handleProductInputChange(p.id, "ratePrice", e.target.value)}
  onBlur={() => setTouched(prev => ({ ...prev, [`product_${p.id}_ratePrice`]: true }))}
  error={touched[`product_${p.id}_ratePrice`] && errors[`product_${p.id}_ratePrice`]}
/>

                        {/* ✅ New Cash Rate */}
                  {/* ✅ Cash Rate (optional inline) */}
                  <Textinput
                    label={
                      <span>
                        Cash Rate <span className="text-gray-400 ml-1 text-xs">(optional)</span>
                      </span>
                    }
                    type="number"
                    step="0.01"
                    placeholder="Enter cash rate if any"
                    value={p.cashRate || ""}
                    onChange={e => handleProductInputChange(p.id, "cashRate", e.target.value)}
                  />


                    <div className="text-xs text-gray-500">{p.unitType}</div>
                    <Button type="button" className="btn btn-danger" onClick={() => removeProductRow(p.id)} disabled={formData.products.length === 1}>
                      <Icon icon="heroicons:trash" />
                    </Button>
                  </div>
                                ))}
              <Button type="button" className="btn btn-primary mb-4" onClick={addProductRow}>
                <Icon icon="heroicons:plus" /> Add Product
              </Button>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" onClick={onComplete} className="btn btn-outline-secondary">Cancel</Button>
                <Button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Icon icon={isEditMode ? "heroicons:pencil-square" : "heroicons:plus"} className="w-4 h-4 mr-2" />
                      {isEditMode ? "Update Order" : "Create Order"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
        {/* Price Preview */}
        <div className="lg:col-span-1">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Price Preview</h2>
            {productPreviews.filter(Boolean).length > 0 ? (
              <div className="space-y-4">
                {productPreviews.map((preview, idx) =>
                  preview ? (
                    <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                      <h3 className="font-medium text-gray-900">{preview.name}</h3>
                      <div className="flex justify-between text-sm">
                        <span>Rate:</span>
                        <span>₹{preview.rate.toFixed(2)}/{getUnitLabel(preview.unitType)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Quantity:</span>
                        <span>{preview.quantity} {getUnitLabel(preview.unitType)}</span>
                      </div>
                      <div className="border-t pt-2">
                        <div className="flex justify-between text-sm">
                          <span>GST ({formData.gst}%):</span>
                          <span>₹{preview.rowGstAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Total:</span>
                          <span className="text-lg">₹{preview.rowFinal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null
                )}
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>₹{grandTotal.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>GST ({formData.gst}%):</span>
                    <span>₹{grandTotal.gstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base">
                    <span>Grand Total:</span>
                    <span>₹{grandTotal.final.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Icon icon="heroicons:information-circle" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Select products and enter quantity to see pricing preview</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Product Management Modal */}
      <Modal
        activeModal={showProductModal}
        onClose={() => setShowProductModal(false)}
        title="Add New Product"
        className="max-w-4xl"
        centered
      >
        <AddProductForm onComplete={handleProductCreated} />
      </Modal>

      {/* Client Management Modal */}
      <Modal
        activeModal={showClientModal}
        onClose={() => setShowClientModal(false)}
        title="Add New Client"
        className="max-w-4xl"
        centered
      >
        <AddClient onComplete={handleClientCreated} />
      </Modal>

      {/* Order Success Modal */}
      <Modal
        activeModal={showOrderSuccess}
        onClose={() => setShowOrderSuccess(false)}
        title={isEditMode ? "Order Updated Successfully!" : "Order Created Successfully!"}
        className="max-w-2xl"
        centered
      >
        <div className="space-y-6">
          {/* Success Header */}
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon icon="heroicons:check" className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {isEditMode ? "Order Updated Successfully!" : "Order Created Successfully!"}
            </h3>
            <p className="text-gray-600">
              {isEditMode 
                ? "Your order has been updated successfully." 
                : "Your order has been created and is ready for processing."
              }
            </p>
          </div>

          {/* Order Details */}
          {createdOrderData && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Order Number</p>
                  <p className="font-semibold text-lg">{createdOrderData.orderNo}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="font-semibold text-lg text-green-600">₹{createdOrderData.totalAmount?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Client</p>
                  <p className="font-medium">{createdOrderData.clientName}</p>
                  <p className="text-sm text-gray-500">{createdOrderData.clientMobile}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Products</p>
                  <p className="font-medium">{createdOrderData.productCount} items</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {isEditMode ? (
              <>
                <Button
                  onClick={() => navigate(`/order/${createdOrderData?.orderId || orderId}`)}
                  className="btn btn-primary flex-1"
                >
                  <Icon icon="heroicons:eye" className="w-4 h-4 mr-2" />
                  View Order
                </Button>
                <Button
                  onClick={() => navigate('/order')}
                  className="btn btn-outline-secondary flex-1"
                >
                  <Icon icon="heroicons:arrow-left" className="w-4 h-4 mr-2" />
                  Back to Orders
                </Button>
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                <Button
                  onClick={() => navigate(`/order/${createdOrderData?.orderId}`)}
                  className="btn btn-success w-full"
                >
                  <Icon icon="heroicons:eye" className="w-4 h-4 mr-2" />
                  View Order
                </Button>
                <Button
                  onClick={handleGenerateReceipt}
                  className="btn btn-primary w-full"
                >
                  <Icon icon="heroicons:document-text" className="w-4 h-4 mr-2" />
                  Generate Receipt
                </Button>
                <Button
                  onClick={handleCreateAnother}
                  className="btn btn-outline-secondary w-full"
                >
                  <Icon icon="heroicons:plus" className="w-4 h-4 mr-2" />
                  Create Another
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* PDF Preview Modal */}
      <Modal
        activeModal={showPdfPreview}
        onClose={closePdfPreview}
        title="Order Receipt Preview"
        className="max-w-6xl"
        centered
      >
        <div className="space-y-4">
          {/* Order Information Header */}
          {orderData && (
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Order Receipt Generated</h3>
                  <p className="text-blue-100">Order {orderData.orderNo} for {orderData.clientName}</p>
                </div>
                <div className="text-right">
                  <p className="text-blue-100">Total Amount</p>
                  <p className="text-xl font-bold">₹{orderData.totalAmount?.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* PDF Viewer */}
          <div className="border rounded-lg overflow-hidden">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-[600px]"
                title="Order Receipt Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-[600px] bg-gray-50">
                <div className="text-center">
                  <Icon icon="heroicons:document" className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Loading PDF preview...</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              onClick={closePdfPreview}
              className="btn btn-outline-secondary"
            >
              <Icon icon="heroicons:x-mark" className="w-4 h-4 mr-2" />
              Close Preview
            </Button>
            <Button
              onClick={downloadPdf}
              className="btn btn-primary"
              disabled={!pdfUrl}
            >
              <Icon icon="heroicons:arrow-down-tray" className="w-4 h-4 mr-2" />
              Download Receipt
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AddOrder;
