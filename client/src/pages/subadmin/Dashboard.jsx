import React, { useEffect, useState } from "react";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import Card from "../../components/ui/Card";
import TableServerPagination from "../../components/ui/TableServerPagination";
import { createColumnHelper } from "@tanstack/react-table";

const columnHelper = createColumnHelper();

const SubAdminDashboard = () => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  
  // Dashboard statistics for subadmin
  const [stats, setStats] = useState({
    totalSubOrders: 0,
    pendingSubOrders: 0,
    dispatchedSubOrders: 0,
    completedSubOrders: 0,
    totalOrders: 0,
    pendingOrders: 0
  });

  // Recent sub-orders for dashboard table
  const [recentSubOrders, setRecentSubOrders] = useState([]);
  const [subOrdersLoading, setSubOrdersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSubAdminStats = async () => {
    setStatsLoading(true);
    setError("");
    try {
      const token = cookies.get("auth-token");
      
      console.log("Fetching with token:", token ? "Token present" : "No token");
      
      // Fetch subadmin-specific stats
      const [subOrdersRes, ordersRes] = await Promise.all([
        apiCall("GET", "sub-order/all", null, token),
        apiCall("GET", "order/all", null, token)
      ]);

      console.log("Raw Sub-Orders Response:", subOrdersRes);
      console.log("Raw Orders Response:", ordersRes);

      // Handle sub-orders response - it can be an array or have a subOrders property
      let subOrders = [];
      if (subOrdersRes && Array.isArray(subOrdersRes)) {
        subOrders = subOrdersRes;
      } else if (subOrdersRes && Array.isArray(subOrdersRes.subOrders)) {
        subOrders = subOrdersRes.subOrders;
      } else if (subOrdersRes && subOrdersRes.success === false) {
        console.error("Sub-orders API error:", subOrdersRes.message);
        setError(`Sub-orders API error: ${subOrdersRes.message}`);
      }

      // Handle orders response - it has an orders property
      let orders = [];
      if (ordersRes && Array.isArray(ordersRes)) {
        orders = ordersRes;
      } else if (ordersRes && Array.isArray(ordersRes.orders)) {
        orders = ordersRes.orders;
      } else if (ordersRes && ordersRes.success === false) {
        console.error("Orders API error:", ordersRes.message);
        setError(`Orders API error: ${ordersRes.message}`);
      }

      console.log("Processed Sub-Orders:", subOrders);
      console.log("Processed Orders:", orders);

      // Calculate statistics
      const pendingSubOrders = subOrders.filter(so => so.status === "PENDING").length;
      const dispatchedSubOrders = subOrders.filter(so => so.status === "DISPATCHED").length;
      const completedSubOrders = subOrders.filter(so => so.status === "COMPLETED").length;
      const pendingOrders = orders.filter(order => order.status === "PENDING").length;

      setStats({
        totalSubOrders: subOrders.length,
        pendingSubOrders,
        dispatchedSubOrders,
        completedSubOrders,
        totalOrders: orders.length,
        pendingOrders
      });

      // Get recent sub-orders (last 10)
      const recentSubOrdersData = Array.isArray(subOrders) 
        ? subOrders
            .filter(so => so.date) // Only include items with date
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10)
        : [];
      
      setRecentSubOrders(recentSubOrdersData);

    } catch (error) {
      console.error("Error fetching subadmin stats:", error);
      setError("Failed to fetch dashboard data. Please try again.");
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubAdminStats();
  }, []);

  const recentSubOrdersColumns = [
    columnHelper.accessor("orderNo", { 
      header: "Order No", 
      enableColumnFilter: false 
    }),
    columnHelper.accessor("productId", {
      header: "Product",
      enableColumnFilter: false,
      cell: (info) => info.getValue()?.name || "N/A"
    }),
    columnHelper.accessor("clientId", {
      header: "Client",
      enableColumnFilter: false,
      cell: (info) => info.getValue()?.name || "N/A"
    }),
    columnHelper.accessor("quantity", {
      header: "Quantity",
      enableColumnFilter: false,
      cell: (info) => `${info.getValue()} ${info.row.original.unitType || ''}`
    }),
    columnHelper.accessor("status", {
      header: "Status",
      enableColumnFilter: false,
      cell: (info) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          info.getValue() === 'COMPLETED' ? 'bg-green-100 text-green-800' :
          info.getValue() === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
          info.getValue() === 'DISPATCHED' ? 'bg-blue-100 text-blue-800' :
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
          <h1 className="text-2xl font-bold text-gray-900">Sub-Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage orders and sub-orders efficiently.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchSubAdminStats}
            disabled={statsLoading}
            className="btn btn-outline-secondary"
          >
            {statsLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                Refreshing...
              </div>
            ) : (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </div>
            )}
          </button>
          <button 
            onClick={() => window.location.href = '/subadmin/orders'}
            className="btn btn-primary"
          >
            View Orders
          </button>
          <button 
            onClick={() => window.location.href = '/subadmin/suborders'}
            className="btn btn-outline-primary"
          >
            Manage Sub-Orders
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
          <button 
            onClick={fetchSubAdminStats}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sub-Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalSubOrders}</p>
              <p className="text-xs text-gray-500 mt-1">All sub-orders</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Sub-Orders</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pendingSubOrders}</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting dispatch</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Dispatched Sub-Orders</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.dispatchedSubOrders}</p>
              <p className="text-xs text-gray-500 mt-1">In transit</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed Sub-Orders</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.completedSubOrders}</p>
              <p className="text-xs text-gray-500 mt-1">Successfully delivered</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
              <p className="text-xs text-gray-500 mt-1">All orders</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Orders</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{stats.pendingOrders}</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting processing</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Sub-Orders Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Sub-Orders</h2>
          <button 
            onClick={() => window.location.href = '/subadmin/suborders'}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View All →
          </button>
        </div>
        
        {recentSubOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No sub-orders found</p>
            <p className="text-sm">Sub-orders will appear here once created from orders</p>
            <div className="mt-4">
              <button 
                onClick={() => window.location.href = '/subadmin/orders'}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
              >
                Go to Orders to create sub-orders →
              </button>
            </div>
          </div>
        ) : (
          <TableServerPagination
            columns={recentSubOrdersColumns}
            tableData={recentSubOrders || []}
            tableDataLoading={subOrdersLoading}
            pageSize={5}
            showPagination={false}
          />
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.href = '/subadmin/orders'}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">View All Orders</p>
                  <p className="text-sm text-gray-500">Browse and manage orders</p>
                </div>
              </div>
            </button>
            
            <button 
              onClick={() => window.location.href = '/subadmin/suborders'}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Manage Sub-Orders</p>
                  <p className="text-sm text-gray-500">Update status and track progress</p>
                </div>
              </div>
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Pending</span>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full" 
                    style={{ width: `${stats.totalSubOrders > 0 ? (stats.pendingSubOrders / stats.totalSubOrders) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.pendingSubOrders}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Dispatched</span>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${stats.totalSubOrders > 0 ? (stats.dispatchedSubOrders / stats.totalSubOrders) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.dispatchedSubOrders}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Completed</span>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${stats.totalSubOrders > 0 ? (stats.completedSubOrders / stats.totalSubOrders) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.completedSubOrders}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SubAdminDashboard; 