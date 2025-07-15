// Create a new file SubOrderStatusUpdate.js
import React, { useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";

const SubOrderStatusUpdate = ({ subOrderId, currentStatus, onUpdateSuccess }) => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [status, setStatus] = useState(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === currentStatus) return;
    
    setIsUpdating(true);
    try {
      const token = cookies.get("auth-token");
      const response = await apiCall(
        "PATCH",
        `sub-order/${subOrderId}/status`,
        { status: newStatus },
        token
      );
      console.log("response",response)
      if (response?.message) {
        setStatus(newStatus);   
        onUpdateSuccess?.();
      }
    } catch (error) {
      console.error("Error updating status:", error.message);
      
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
       <select
      value={status}
      onChange={(e) => handleStatusChange(e.target.value)}
      className="text-sm border rounded p-1 bg-white"
    >
      <option value="PENDING">PENDING</option>
      <option value="DISPATCHED">DISPATCHED</option>
      <option value="COMPLETED">COMPLETED</option>
    </select>
    </div>
  );
};

export default SubOrderStatusUpdate;