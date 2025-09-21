import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  
  // Search functionality state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
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
      const outstandingPayments = Math.max(0, (dashboardStats.totalRevenue || 0) - totalPaid);

      setStats({
        totalOrders: dashboardStats.totalOrders || 0,
        pendingOrders: dashboardStats.pendingOrders || 0,
        totalClients: clients.length || 0,
        totalProducts: products.length || 0,
        totalRevenue: dashboardStats.totalRevenue || 0,
        outstandingPayments: outstandingPayments,
        completedOrders: dashboardStats.completedOrders || 0,
        dispatchedOrders: dashboardStats.dispatchedOrders || 0
      });

      // Fetch client names for recent orders
      const ordersWithClientNames = await Promise.all(
        recentOrdersData.map(async (order) => {
          let clientName = 'Unknown Client';
          
          if (order.clientId && typeof order.clientId === 'string') {
            try {
              const clientResponse = await apiCall("GET", `client/${order.clientId}`, null, token);
              if (clientResponse?.name) {
                clientName = clientResponse.name;
              } else if (clientResponse?.data?.name) {
                clientName = clientResponse.data.name;
              }
            } catch (error) {
              console.log("Could not fetch client details for dashboard:", error);
              clientName = 'Client ID: ' + order.clientId.substring(0, 8) + '...';
            }
          }
          
          return {
            ...order,
            clientName: clientName
          };
        })
      );

      setRecentOrders(ordersWithClientNames);

    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.search-container')) {
        setShowSearchResults(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setShowSearchResults(false);
        setSearchQuery("");
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  // Search functionality
  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Input validation
    if (query.length > 100) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    try {
      const token = cookies.get("auth-token");
      
      // Check if the query looks like an order number (e.g., "#10" or "10")
      const orderNumberPattern1 = /^#?(\d+)$/;
      const orderNumberMatch = query.match(orderNumberPattern1);
      
      if (orderNumberMatch) {
        const orderNumber = orderNumberMatch[1];
        
        // Try to find the specific order by order number first
        try {
          const specificOrderResult = await apiCall("GET", `order/by-number/${orderNumber}`, null, token);
          
          if (specificOrderResult && specificOrderResult.success && specificOrderResult.data) {
            const order = specificOrderResult.data;
            const statusBadge = order.status === 'PENDING' ? '🟡' : 
                               order.status === 'PARTIALLY_DISPATCHED' ? '🟠' :
                               order.status === 'DISPATCHED' ? '🟢' : '⚪';
            
            // Extract client name - clientId is always a string in this system
            let clientName = 'Unknown Client';
            
            if (order.clientId && typeof order.clientId === 'string') {
              try {
                const clientResponse = await apiCall("GET", `client/${order.clientId}`, null, token);
                if (clientResponse?.name) {
                  clientName = clientResponse.name;
                } else if (clientResponse?.data?.name) {
                  clientName = clientResponse.data.name;
                }
              } catch (error) {
                console.log("Could not fetch client details:", error);
                clientName = 'Client ID: ' + order.clientId.substring(0, 8) + '...';
              }
            }
            
            // Show the exact order found
            setSearchResults([{
              id: order._id,
              type: 'order',
              orderNo: order.orderNo,
              title: `${statusBadge} Order #${order.orderNo}`,
              subtitle: `${clientName} - ₹${(order.totalAmount || 0).toLocaleString()}`,
              status: order.status,
              canDispatch: ['PENDING', 'PARTIALLY_DISPATCHED'].includes(order.status),
              clientName: clientName
            }]);
            setShowSearchResults(true);
            setSearchLoading(false);
            return;
          }
        } catch (error) {
          // Order not found by number, continue with general search
        }
      }
      
      // General search for orders and clients with pagination
      const searchParams = new URLSearchParams({
        q: query,
        limit: '10' // Limit results for dropdown
      });

      const orderSearchPromise = apiCall("GET", `order/search?${searchParams}`, null, token);
      const clientSearchPromise = apiCall("GET", `client/search/${encodeURIComponent(query)}`, null, token);

      const [orderResults, clientResults] = await Promise.all([
        orderSearchPromise.catch(() => ({ success: false, data: [] })),
        clientSearchPromise.catch(() => ({ success: false, data: [] }))
      ]);

      const results = [];

      // Add order results with enhanced metadata and better sorting
      if (orderResults?.success && orderResults?.data && Array.isArray(orderResults.data)) {
        // Sort orders by relevance - exact matches first, then partial matches
        const sortedOrders = orderResults.data.sort((a, b) => {
          const queryNum = query.replace(/[#]/g, '');
          const aOrderStr = a.orderNo.toString();
          const bOrderStr = b.orderNo.toString();
          
          // Exact match gets highest priority
          if (aOrderStr === queryNum && bOrderStr !== queryNum) return -1;
          if (bOrderStr === queryNum && aOrderStr !== queryNum) return 1;
          
          // Then by order number (ascending)
          return a.orderNo - b.orderNo;
        });

        // Process orders and fetch client names if needed
        for (const order of sortedOrders) {
          const statusBadge = order.status === 'PENDING' ? '🟡' : 
                             order.status === 'PARTIALLY_DISPATCHED' ? '🟠' :
                             order.status === 'DISPATCHED' ? '🟢' : '⚪';
          
          // Extract client name - clientId is always a string in this system
          let clientName = 'Unknown Client';
          
          if (order.clientId && typeof order.clientId === 'string') {
            try {
              const clientResponse = await apiCall("GET", `client/${order.clientId}`, null, token);
              if (clientResponse?.name) {
                clientName = clientResponse.name;
              } else if (clientResponse?.data?.name) {
                clientName = clientResponse.data.name;
              }
            } catch (error) {
              console.log("Could not fetch client details:", error);
              clientName = 'Client ID: ' + order.clientId.substring(0, 8) + '...';
            }
          }
          
          results.push({
            id: order._id,
            type: 'order',
            orderNo: order.orderNo,
            title: `${statusBadge} Order #${order.orderNo}`,
            subtitle: `${clientName} - ₹${(order.totalAmount || 0).toLocaleString()}`,
            status: order.status,
            canDispatch: order.canDispatch || ['PENDING', 'PARTIALLY_DISPATCHED'].includes(order.status),
            isOverdue: order.isOverdue || false,
            orderDate: order.orderDate,
            clientName: clientName
          });
        }
      }

      // Add client results
      if (clientResults?.success && clientResults?.data) {
        clientResults.data.forEach(client => {
          results.push({
            id: client._id,
            type: 'client',
            title: `👤 ${client.name}`,
            subtitle: client.alias ? `Alias: ${client.alias}` : client.email || client.mobile || 'No contact info',
            status: null
          });
        });
      }

      // Add helpful message for order number searches
      const orderNumberPattern2 = /^#?(\d+)$/;
      const isOrderNumberSearch = orderNumberPattern2.test(query);
      
      if (isOrderNumberSearch && results.filter(r => r.type === 'order').length === 0) {
        results.push({
          id: 'no-order-found',
          type: 'info',
          title: `🔍 No order found for "${query}"`,
          subtitle: 'Try searching without # or check the order number',
          action: 'info'
        });
      } else if (isOrderNumberSearch && results.filter(r => r.type === 'order').length > 0) {
        // Add info about multiple matches for partial order numbers
        const queryNum = query.replace(/[#]/g, '');
        const orderResults = results.filter(r => r.type === 'order');
        const exactMatch = orderResults.find(r => r.orderNo && r.orderNo.toString() === queryNum);
        
        if (exactMatch) {
          // Move exact match to the top
          const exactIndex = results.findIndex(r => r.id === exactMatch.id);
          if (exactIndex > 0) {
            const [exactResult] = results.splice(exactIndex, 1);
            results.unshift(exactResult);
          }
        } else if (orderResults.length > 1) {
          results.unshift({
            id: 'multiple-matches',
            type: 'info',
            title: `📋 Found ${orderResults.length} orders matching "${query}"`,
            subtitle: 'Select the order you want to view',
            action: 'info'
          });
        }
      }

      // Show "Load More" option if there are more results
      if (orderResults?.pagination?.hasMore) {
        results.push({
          id: 'load-more-orders',
          type: 'action',
          title: `📄 View all ${orderResults.pagination.totalResults} orders...`,
          subtitle: 'Click to see complete search results',
          action: 'load-more'
        });
      }

      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([{
        id: 'error',
        type: 'error',
        title: '❌ Search failed',
        subtitle: 'Please try again or check your connection',
        status: null
      }]);
      setShowSearchResults(true);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchResultClick = (result) => {
    if (result.type === 'order') {
      // Navigate to order details for dispatch - ensure we have valid order ID
      if (result.id && result.id !== 'no-order-found' && result.id !== 'multiple-matches') {
        navigate(`/order/${result.id}`);
        setShowSearchResults(false);
        setSearchQuery("");
      }
    } else if (result.type === 'client') {
      // Navigate to client orders page
      navigate(`/order/client/${result.id}`);
      setShowSearchResults(false);
      setSearchQuery("");
    } else if (result.type === 'action' && result.action === 'load-more') {
      // Handle load more functionality
      navigate(`/orders?search=${encodeURIComponent(searchQuery)}`);
      setShowSearchResults(false);
      setSearchQuery("");
    } else if (result.type === 'info') {
      // Don't navigate for info messages, just close dropdown
      setShowSearchResults(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      handleSearch(query);
    }, 300);
  };

  const recentOrdersColumns = [
    columnHelper.accessor("orderNo", { 
      header: "Order No", 
      enableColumnFilter: false 
    }),
    columnHelper.accessor("clientName", {
      header: "Client",
      enableColumnFilter: false,
      cell: (info) => info.getValue() || "N/A"
    }),
    columnHelper.accessor((row) => row.amount || row.totalAmount || 0, {
      id: "amount",
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
        <div className="flex gap-2 items-center">
          {/* Quick Search Field */}
          <div className="relative search-container">
            <div className="relative flex">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const query = searchQuery.trim();
                    if (!query) return;
                    
                    // Check if it's an order number search
                    const orderNumberPattern4 = /^#?(\d+)$/;
                    const orderNumberMatch = query.match(orderNumberPattern4);
                    
                    if (orderNumberMatch) {
                      const orderNumber = orderNumberMatch[1];
                      
                      try {
                        const token = cookies.get("auth-token");
                        const specificOrderResult = await apiCall("GET", `order/by-number/${orderNumber}`, null, token);
                        
                        if (specificOrderResult && specificOrderResult.success && specificOrderResult.data) {
                          const order = specificOrderResult.data;
                          // Direct navigation to the order
                          navigate(`/order/${order._id}`);
                          setShowSearchResults(false);
                          setSearchQuery("");
                          return;
                        }
                      } catch (error) {
                        console.log("Order not found:", error);
                      }
                    }
                    
                    // Fallback to dropdown results if available
                    if (searchResults.length > 0) {
                      const firstOrder = searchResults.find(r => r.type === 'order');
                      if (firstOrder) {
                        handleSearchResultClick(firstOrder);
                      } else {
                        handleSearchResultClick(searchResults[0]);
                      }
                    }
                  }
                }}
                placeholder="Search orders (#34) or clients (name/alias)..."
                className="w-80 px-4 py-2 pl-10 pr-12 text-sm border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searchLoading ? (
                <div className="absolute inset-y-0 right-12 pr-3 flex items-center">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              ) : null}
              <button
                onClick={async () => {
                  const query = searchQuery.trim();
                  if (!query) return;
                  
                  // Check if it's an order number search
                  const orderNumberPattern3 = /^#?(\d+)$/;
                  const orderNumberMatch = query.match(orderNumberPattern3);
                  
                  if (orderNumberMatch) {
                    const orderNumber = orderNumberMatch[1];
                    
                    try {
                      const token = cookies.get("auth-token");
                      const specificOrderResult = await apiCall("GET", `order/by-number/${orderNumber}`, null, token);
                      
                      if (specificOrderResult && specificOrderResult.success && specificOrderResult.data) {
                        const order = specificOrderResult.data;
                        // Direct navigation to the order
                        navigate(`/order/${order._id}`);
                        setShowSearchResults(false);
                        setSearchQuery("");
                        return;
                      }
                    } catch (error) {
                      console.log("Order not found:", error);
                    }
                  }
                  
                  // Fallback to dropdown results if available
                  if (searchResults.length > 0) {
                    const firstOrder = searchResults.find(r => r.type === 'order');
                    if (firstOrder) {
                      handleSearchResultClick(firstOrder);
                    } else {
                      handleSearchResultClick(searchResults[0]);
                    }
                  } else {
                    // Trigger search if no results yet
                    handleSearch(query);
                  }
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-r-lg border border-l-0 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                disabled={searchLoading}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No results found for "{searchQuery}"
                  </div>
                ) : (
                  <div className="py-2">
                    {searchResults.map((result, index) => (
                      <div
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSearchResultClick(result)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        {result.type === 'order' ? (
                          <div className="flex items-center justify-between hover:bg-blue-50 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-900">{result.title}</span>
                                {result.status && (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    result.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                    result.status === 'PARTIALLY_DISPATCHED' ? 'bg-blue-100 text-blue-800' :
                                    result.status === 'DISPATCHED' ? 'bg-green-100 text-green-800' :
                                    result.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {result.status}
                                  </span>
                                )}
                                {result.canDispatch && (
                                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                    Ready to Dispatch
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {result.subtitle}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className="text-xs text-gray-400">Click to view</span>
                              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        ) : result.type === 'client' ? (
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{result.title}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                {result.subtitle}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                Client Orders
                              </span>
                              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        ) : result.type === 'action' ? (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-blue-600">{result.title}</div>
                              <div className="text-sm text-gray-600 mt-1">{result.subtitle}</div>
                            </div>
                            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        ) : result.type === 'info' ? (
                          <div className="flex items-center justify-between bg-blue-50 rounded-md p-2 cursor-default">
                            <div>
                              <div className="font-medium text-blue-800">{result.title}</div>
                              <div className="text-sm text-blue-600 mt-1">{result.subtitle}</div>
                            </div>
                            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        ) : result.type === 'error' ? (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-red-600">{result.title}</div>
                              <div className="text-sm text-gray-600 mt-1">{result.subtitle}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <button 
            onClick={() => window.location.href = '/order/add'}
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
                    <td className="py-3 px-4 align-middle">{order.clientName || 'Unknown Client'}</td>
                    <td className="py-3 px-4 align-middle">₹{(order.amount || order.totalAmount || 0).toLocaleString()}</td>
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
                    <td className="py-3 px-4 align-middle">{new Date(order.orderDate || order.date).toLocaleDateString()}</td>
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
