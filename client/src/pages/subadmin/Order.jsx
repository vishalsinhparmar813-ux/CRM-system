import React, { useEffect, useState } from "react";
import useApi from "../../hooks/useApi";
import OrdersTable from "../../components/shared/OrdersTable";
import Cookies from "universal-cookie";

const Order = () => {
  useEffect(() => {
    document.title = "Sub-Admin Panel";
  }, []);

  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [orders, setOrders] = useState([]);
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      const token = cookies.get("auth-token");
      const res = await apiCall("GET", "order/all", null, token);
      setOrders(res.orders || []);
    };
    fetchOrders();
  }, [refresh]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Sub-Admin: Orders</h1>
      <OrdersTable
        orders={orders}
        showCreateSubOrder
        onSubOrderCreated={() => setRefresh(r => !r)}
      />
    </div>
  );
};

export default Order; 