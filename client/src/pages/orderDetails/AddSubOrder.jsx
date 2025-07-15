import React, { useState, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";

const PRIMARY_COLOR = "#4669FA";

const AddSubOrder = ({ orderNo, orderId, clientId, products = [], onAddSuccess, open = false }) => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [showModal, setShowModal] = useState(open);
  const [quantities, setQuantities] = useState(() => products.map(() => ""));
  const [errors, setErrors] = useState(() => products.map(() => ""));
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    setShowModal(open);
  }, [open]);

  const handleClose = () => {
    setShowModal(false);
    setQuantities(products.map(() => ""));
    setErrors(products.map(() => ""));
    setSuccessMsg("");
  };

  const validate = (val, max) => {
    if (!val) return "";
    if (isNaN(val)) return "Enter a valid number";
    const num = Number(val);
    if (num <= 0) return "Must be > 0";
    if (num > max) return `Cannot exceed remaining (${max})`;
    return "";
  };

  const handleChange = (idx, val) => {
    const newQuantities = [...quantities];
    newQuantities[idx] = val;
    setQuantities(newQuantities);
    const newErrors = [...errors];
    newErrors[idx] = validate(val, products[idx].quantity);
    setErrors(newErrors);
  };

  const handleAdd = async () => {
    // Validate all
    const newErrors = products.map((p, i) => validate(quantities[i], p.quantity));
    setErrors(newErrors);
    if (newErrors.some(e => e)) return;
    // Prepare payload
    const subOrderLines = products
      .map((p, i) => ({
        productId: p.productId,
        quantity: Number(quantities[i]),
        unitType: p.unitType,
        remainingQuantity: typeof p.remainingQuantity !== 'undefined' ? p.remainingQuantity : p.quantity
      }))
      .filter(line => line.quantity > 0 && line.remainingQuantity > 0);
    if (subOrderLines.length === 0) {
      setSuccessMsg("");
      setErrors(products.map(() => "Enter at least one quantity"));
      return;
    }
    setLoading(true);
    setSuccessMsg("");
    try {
      const payload = {
        orderNo,
        orderId,
        clientId,
        subOrders: subOrderLines,
      };
      const token = cookies.get("auth-token");
      const res = await apiCall("POST", "sub-order/atomic", payload, token);
      if (res?.results) {
        // Map results to errors array
        const newErrors = products.map((p, i) => {
          const result = res.results.find(r => r.productId === p.productId);
          return result && !result.success ? result.message : "";
        });
        setErrors(newErrors);
        if (newErrors.every(e => !e)) {
          setSuccessMsg("Sub-order(s) added successfully!");
          if (onAddSuccess) onAddSuccess();
          setTimeout(() => { handleClose(); }, 1000);
        }
      } else {
        setErrors(products.map(() => res?.message || "Failed to add sub-order"));
      }
    } catch (e) {
      setErrors(products.map(() => "Failed to add sub-order"));
    } finally {
      setLoading(false);
    }
  };

  if (!products.length) return null;

  if (open) {
    return (
      showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl relative animate-fadeIn"
            style={{ minWidth: 440 }}
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between px-6 py-4 rounded-t-xl" style={{ background: PRIMARY_COLOR }}>
              <span className="text-white text-lg font-semibold">Create Sub Order</span>
              <button
                className="text-white text-2xl hover:text-gray-200 focus:outline-none"
                onClick={handleClose}
                disabled={loading}
                aria-label="Close"
                style={{ zIndex: 2 }}
              >
                &times;
              </button>
            </div>
            <div className="px-8 py-7 flex flex-col">
              <div className="mb-4 text-base text-gray-700">
                <div>
                  <span className="text-gray-500">Order No:</span> <span className="font-semibold">{orderNo}</span>
                </div>
              </div>
              <table className="w-full mb-4">
                <thead>
                  <tr className="text-left text-gray-700">
                    <th>Product</th>
                    <th>Remaining</th>
                    <th>Unit</th>
                    <th>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.productId}>
                      <td>{p.productName}</td>
                      <td>{typeof p.remainingQuantity !== 'undefined' ? p.remainingQuantity : p.quantity}</td>
                      <td>{p.unitType}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={typeof p.remainingQuantity !== 'undefined' ? p.remainingQuantity : p.quantity}
                          value={quantities[i]}
                          onChange={e => handleChange(i, e.target.value)}
                          className={`w-28 px-2 py-1 rounded-md border focus:outline-none transition-all duration-150 text-base bg-gray-50 ${errors[i] ? "border-red-500 focus:ring-2 focus:ring-red-200" : `border-gray-300 focus:border-[${PRIMARY_COLOR}] focus:ring-2 focus:ring-[${PRIMARY_COLOR}]`}`}
                          disabled={loading || (typeof p.remainingQuantity !== 'undefined' ? p.remainingQuantity === 0 : p.quantity === 0)}
                          placeholder={`max ${typeof p.remainingQuantity !== 'undefined' ? p.remainingQuantity : p.quantity}`}
                        />
                        {errors[i] && <div className="text-red-500 text-xs mt-1">{errors[i]}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {successMsg && <div className="text-green-600 text-sm mb-2">{successMsg}</div>}
              <div className="flex justify-end gap-4 mt-4 w-full">
                <button
                  className="px-6 py-2 rounded-md border border-gray-300 bg-white text-gray-700 font-semibold text-base hover:bg-gray-100 transition-all duration-150"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="px-6 py-2 rounded-md font-semibold text-base text-white shadow transition-all duration-150"
                  style={{ background: PRIMARY_COLOR }}
                  onClick={handleAdd}
                  disabled={loading || errors.some(e => !!e)}
                >
                  {loading ? "Adding..." : "Add"}
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
        </div>
      )
    );
  }
  // (For non-modal use, not needed here)
  return null;
};

export default AddSubOrder;
