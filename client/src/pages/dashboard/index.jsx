import React, { useEffect, useState } from "react";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import Icon from "../../components/ui/Icon";
import Card from "../../components/ui/Card";
import TableServerPagination from "../../components/ui/TableServerPagination";
import { createColumnHelper } from "@tanstack/react-table";

const columnHelper = createColumnHelper();

const Dashboard = () => {
  useEffect(() => {
    document.title = "Admin Panel";
  }, []);

  const { apiCall } = useApi();
  const cookies = new Cookies();
  
  // Dashboard statistics
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalClients: 0,
    totalProducts: 0,
    totalRevenue: 0,
    outstandingPayments: 0,
    completedOrders: 0,
    dispatchedOrders: 0
  });

  // Recent orders for dashboard table
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchDashboardStats = async () => {
    setStatsLoading(true);
    try {
      const token = cookies.get("auth-token");
      
      // Fetch dashboard stats and other required data
      const [dashboardRes, clientsRes, productsRes, transactionsRes] = await Promise.all([
        apiCall("GET", "order/dashboard/stats", null, token),
        apiCall("GET", "client/all", null, token),
        apiCall("GET", "product/all", null, token),
        apiCall("GET", "transaction/all", null, token)
      ]);

      const dashboardStats = dashboardRes?.stats || {};
      const clients = clientsRes?.data || clientsRes || [];
      const products = productsRes?.products || [];
      const transactions = transactionsRes?.transactions || [];
      const recentOrdersData = dashboardRes?.recentOrders || [];

      // Calculate outstanding payments
      const totalPaid = transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
      const outstandingPayments = dashboardStats.totalRevenue - totalPaid;

      setStats({
        totalOrders: dashboardStats.totalOrders || 0,
        pendingOrders: dashboardStats.pendingOrders || 0,
        totalClients: clients.length,
        totalProducts: products.length,
        totalRevenue: dashboardStats.totalRevenue || 0,
        outstandingPayments: outstandingPayments,
        completedOrders: dashboardStats.completedOrders || 0,
        dispatchedOrders: dashboardStats.dispatchedOrders || 0
      });

      setRecentOrders(recentOrdersData);

    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const recentOrdersColumns = [
    columnHelper.accessor("orderNo", { 
      header: "Order No", 
      enableColumnFilter: false 
    }),
    columnHelper.accessor("clientId", {
      header: "Client",
      enableColumnFilter: false,
      cell: (info) => info.getValue() || "N/A"
    }),
    columnHelper.accessor("amount", {
      header: "Amount",
      enableColumnFilter: false,
      cell: (info) => `₹${(info.getValue() || 0).toLocaleString()}`
    }),
    columnHelper.accessor("status", {
      header: "Status",
      enableColumnFilter: false,
      cell: (info) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          info.getValue() === 'COMPLETED' ? 'bg-green-100 text-green-800' :
          info.getValue() === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
          info.getValue() === 'DISPATCHED' ? 'bg-blue-100 text-blue-800' :
          info.getValue() === 'MANUFATURING' ? 'bg-purple-100 text-purple-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {info.getValue()}
        </span>
      )
    }),
    columnHelper.accessor("date", {
      header: "Date",
      enableColumnFilter: false,
      cell: (info) => new Date(info.getValue()).toLocaleDateString()
    })
  ];

  const StatCard = ({ title, value, icon, color, subtitle }) => (
    <Card className="p-6 bg-[#23263a] rounded-xl shadow text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {typeof value === 'number' && (title.toLowerCase().includes('revenue') || title.toLowerCase().includes('payment')) 
              ? `₹${value.toLocaleString()}` 
              : value.toLocaleString()}
          </p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
      </div>
    </Card>
  );

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your business.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => window.location.href = '/order'}
            className="btn btn-primary"
          >
            Create Order
          </button>
          <button 
            onClick={() => window.location.href = '/dashboard/clients'}
            className="btn btn-outline-primary"
          >
            Add Client
          </button>
          {/* Financial Tracking button is hidden */}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.pendingOrders} pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Outstanding Payments</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.outstandingPayments.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Pending collection</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Clients</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalClients}</p>
              <p className="text-xs text-gray-500 mt-1">Total registered</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Order Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Orders</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Dispatched</p>
              <p className="text-2xl font-bold text-blue-600">{stats.dispatchedOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completedOrders}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
          <button 
            onClick={() => window.location.href = '/order'}
            className="text-primary hover:underline"
          >
            View All Orders
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[350px] w-full rounded-lg text-sm border border-slate-200 bg-white text-gray-900">
            <thead className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-900 rounded-t-lg text-base font-bold">
              <tr>
                <th className="py-4 px-4 text-left font-bold">ORDER NO</th>
                <th className="py-4 px-4 text-left font-bold">CLIENT</th>
                <th className="py-4 px-4 text-left font-bold">AMOUNT</th>
                <th className="py-4 px-4 text-left font-bold">STATUS</th>
                <th className="py-4 px-4 text-left font-bold">DATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentOrders.length === 0 ? (
                <tr>
                  <td className="py-4 px-4 text-center text-slate-500" colSpan={5}>No orders found.</td>
                </tr>
              ) : (
                recentOrders.map(order => (
                  <tr key={order.orderNo}>
                    <td className="py-3 px-4 align-middle">{order.orderNo}</td>
                    <td className="py-3 px-4 align-middle">{order.clientId}</td>
                    <td className="py-3 px-4 align-middle">₹{order.amount?.toLocaleString()}</td>
                    <td className="py-3 px-4 align-middle">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'DISPATCHED' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'MANUFATURING' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 align-middle">{new Date(order.date).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
