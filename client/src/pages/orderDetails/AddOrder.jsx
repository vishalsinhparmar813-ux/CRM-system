import React, { useEffect, useState, useRef } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Textinput from "../../components/ui/Textinput";
import Select from "../../components/ui/Select";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import useToast from "../../hooks/useToast";
import { v4 as uuidv4 } from 'uuid';

const UNIT_ENUM = {
  NOS: "NOS",
  SQUARE_METER: "SQUARE_METER",
  SQUARE_FEET: "SQUARE_FEET",
};

const AddOrder = ({ onComplete }) => {
  const cookies = new Cookies();
  const { apiCall } = useApi();
  const { toastSuccess, toastError } = useToast();

  // Form state
  // Initialize product rows with unique ids
  const [formData, setFormData] = useState({
    clientId: "",
    products: [
      { id: uuidv4(), productId: "", quantity: "", unitType: "", discount: "" }
    ],
    dueDate: "",
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
    discount: 0,
    final: 0,
  });
  const [clientSearch, setClientSearch] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const clientInputRef = useRef();

  // Add state for product search and suggestions for each row
  const [productSearch, setProductSearch] = useState({});
  const [productSuggestions, setProductSuggestions] = useState({});
  const [showProductSuggestions, setShowProductSuggestions] = useState({});

  // Fetch clients and products
  useEffect(() => {
    const fetchData = async () => {
      const token = cookies.get("auth-token");
      try {
        const [clientsRes, productsRes] = await Promise.all([
          apiCall("GET", "client/all", null, token),
          apiCall("GET", "product/all", null, token),
        ]);
        setClients(clientsRes?.data || clientsRes || []);
        setProducts(productsRes?.products || []);
      } catch (err) {
        alert("Failed to fetch client or product data");
      }
    };
    fetchData();
  }, []);

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
      setFormData(f => ({ ...f, quantity: "", discount: "" }));
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
        discount: "",
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
      const discountKey = `product_${p.id}_discount`;
      
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
      
      if (touched[discountKey] && p.discount) {
        const discountValue = parseFloat(p.discount);
        if (discountValue < 0 || discountValue > 100) {
          newErrors[discountKey] = "Discount must be between 0-100%";
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
    let discountTotal = 0;
    let finalTotal = 0;
    formData.products.forEach((p, idx) => {
      if (!p.productId || !p.quantity) {
        previews.push(null);
        return;
      }
      const prod = products.find(prod => prod._id === p.productId);
      if (!prod) {
        previews.push(null);
        return;
      }
      const quantity = parseFloat(p.quantity) || 0;
      const discount = parseFloat(p.discount) || 0;
      const rate = prod.ratePerUnit;
      const rowSubtotal = rate * quantity;
      const rowDiscount = (rowSubtotal * discount) / 100;
      const rowFinal = rowSubtotal - rowDiscount;
      previews.push({
        name: prod.name,
        unitType: prod.unitType,
        rate,
        quantity,
        discount,
        rowSubtotal,
        rowDiscount,
        rowFinal,
      });
      subtotal += rowSubtotal;
      discountTotal += rowDiscount;
      finalTotal += rowFinal;
    });
    setProductPreviews(previews);
    setGrandTotal({ subtotal, discount: discountTotal, final: finalTotal });
  }, [formData.products, products]);

  // Get valid units for dropdown
  function getValidUnits(product) {
    if (!product) return [];
    if (product.unitType === UNIT_ENUM.NOS) {
      return [{ value: UNIT_ENUM.NOS, label: "NOS" }];
    }
    if (
      (product.unitType === UNIT_ENUM.SQUARE_METER || product.unitType === UNIT_ENUM.SQUARE_FEET)
    ) {
      const units = [
        { value: product.unitType, label: product.unitType },
      ];
      if (product.alternateUnits) {
        units.push({ value: UNIT_ENUM.NOS, label: "NOS" });
        // Optionally allow the other area unit if alternateUnits exist
        if (product.unitType === UNIT_ENUM.SQUARE_METER) {
          units.push({ value: UNIT_ENUM.SQUARE_FEET, label: "SQUARE_FEET" });
        } else {
          units.push({ value: UNIT_ENUM.SQUARE_METER, label: "SQUARE_METER" });
        }
      }
      return units;
    }
    return [{ value: product.unitType, label: product.unitType }];
  }

  // Handle input changes
  const handleInputChange = (field, value) => {
    // Always use value (string) for dropdowns
    setFormData(prev => {
      // Reset quantity, discount on product change
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
      products: [...prev.products, { id: uuidv4(), productId: "", quantity: "", unitType: "", discount: "" }]
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
            return {
              ...p,
              productId: value,
              unitType: prod ? prod.unitType : "",
            };
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
      if (p.discount && (parseFloat(p.discount) < 0 || parseFloat(p.discount) > 100)) newErrors[`product_${p.id}_discount`] = "Discount must be 0-100";
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
        [`product_${p.id}_discount`]: true
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
      const response = await apiCall("POST", "order", {
        clientId: formData.clientId,
        products: formData.products.map(p => ({
          productId: p.productId,
          quantity: parseFloat(p.quantity),
          unitType: p.unitType,
          discount: p.discount ? parseFloat(p.discount) : 0,
        })),
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
      }, token);
      if (response?.orderId) {
        toastSuccess("Order created successfully!");
        setFormData({ clientId: "", products: [{ id: uuidv4(), productId: "", quantity: "", unitType: "", discount: "" }], dueDate: "" });
        setTouched({});
        setErrors({});
        onComplete?.();
      } else {
        throw new Error(response?.error || "Failed to create order");
      }
    } catch (err) {
      toastError(err.message || "An error occurred while creating the order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
          <p className="text-gray-600 mt-1">Add a new order with live pricing preview</p>
        </div>
        <Button onClick={onComplete} className="btn btn-outline-secondary">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Autocomplete client input */}
                <div className="relative">
                  <label className="block mb-2 text-sm font-medium">Client Name <span className="text-red-500">*</span></label>
                  <input
                    ref={clientInputRef}
                    type="text"
                    className={`form-control py-2 w-full ${touched.clientId && errors.clientId ? 'border-red-500' : ''}`}
                    placeholder="Type client name, alias, email, or mobile"
                    value={clientSearch || (clients.find(c => c._id === formData.clientId)?.name || "")}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      setFormData(f => ({ ...f, clientId: "" }));
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      setTouched(prev => ({ ...prev, clientId: true }));
                      setTimeout(() => setShowSuggestions(false), 150);
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
                  label="Due Date"
                  type="date"
                  value={formData.dueDate}
                  onChange={e => handleInputChange("dueDate", e.target.value)}
                  onBlur={() => handleFieldBlur("dueDate")}
                  error={errors.dueDate}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              {formData.products.map((p, idx) => (
                  <div key={p.id} className="grid grid-cols-5 gap-2 mb-2 items-end">
                    {/* Autocomplete product input */}
                    <div className="relative">
                      <label className="block mb-2 text-sm font-medium">Product <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        className={`form-control py-2 w-full ${touched[`product_${p.id}_productId`] && errors[`product_${p.id}_productId`] ? 'border-red-500' : ''}`}
                        placeholder="Type product name or alias"
                        value={productSearch[p.id] || (products.find(prod => prod._id === p.productId)?.name || "")}
                        onChange={e => {
                          setProductSearch(prev => ({ ...prev, [p.id]: e.target.value }));
                          handleProductInputChange(p.id, "productId", "");
                          setShowProductSuggestions(prev => ({ ...prev, [p.id]: true }));
                        }}
                        onFocus={() => setShowProductSuggestions(prev => ({ ...prev, [p.id]: true }))}
                        onBlur={() => {
                          setTouched(prev => ({ ...prev, [`product_${p.id}_productId`]: true }));
                          setTimeout(() => setShowProductSuggestions(prev => ({ ...prev, [p.id]: false })), 150);
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
                              <div className="text-xs text-gray-500">{product.unitType} | ₹{product.ratePerUnit}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {touched[`product_${p.id}_productId`] && errors[`product_${p.id}_productId`] && <div className="text-red-500 text-xs mt-1">{errors[`product_${p.id}_productId`]}</div>}
                    </div>
                    <Textinput
                      label={<span>Quantity <span className="text-red-500">*</span></span>}
                      type="number"
                      value={p.quantity}
                      onChange={e => handleProductInputChange(p.id, "quantity", e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, [`product_${p.id}_quantity`]: true }))}
                      error={touched[`product_${p.id}_quantity`] && errors[`product_${p.id}_quantity`] ? errors[`product_${p.id}_quantity`] : undefined}
                    />
                    <Textinput
                      label="Discount (%)"
                      type="number"
                      value={p.discount}
                      onChange={e => handleProductInputChange(p.id, "discount", e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, [`product_${p.id}_discount`]: true }))}
                      error={touched[`product_${p.id}_discount`] && errors[`product_${p.id}_discount`]}
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
                  {loading ? "Creating..." : "Create Order"}
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
                        <span>₹{preview.rate.toFixed(2)}/{preview.unitType}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Quantity:</span>
                        <span>{preview.quantity} {preview.unitType}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>₹{preview.rowSubtotal.toFixed(2)}</span>
                      </div>
                      {preview.discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Discount ({preview.discount}%):</span>
                          <span>-₹{preview.rowDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2">
                        <div className="flex justify-between font-semibold">
                          <span>Total:</span>
                          <span className="text-lg">₹{preview.rowFinal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null
                )}
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between font-bold text-base">
                    <span>Grand Total:</span>
                    <span>₹{grandTotal.final.toFixed(2)}</span>
                  </div>
                  {grandTotal.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Total Discount:</span>
                      <span>-₹{grandTotal.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>₹{grandTotal.subtotal.toFixed(2)}</span>
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
    </div>
  );
};

export default AddOrder;
