import React, { useEffect, useState } from "react";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import Card from "../../components/ui/Card";
import TableServerPagination from "../../components/ui/TableServerPagination";
import { createColumnHelper } from "@tanstack/react-table";
import Icon from "../../components/ui/Icon";

const columnHelper = createColumnHelper();

const FinancialTracking = () => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  
  const [financialData, setFinancialData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalOutstanding: 0,
    totalClients: 0,
    averageOutstanding: 0
  });

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const token = cookies.get("auth-token");
      
      // Fetch all required data
      const [ordersRes, clientsRes, transactionsRes] = await Promise.all([
        apiCall("GET", "order/all", null, token),
        apiCall("GET", "client/all", null, token),
        apiCall("GET", "transaction/all", null, token)
      ]);

      const orders = ordersRes?.orders || [];
      const clients = clientsRes?.data || clientsRes || [];
      const transactions = transactionsRes?.transactions || [];

      // Create client map for easy lookup
      const clientMap = {};
      clients.forEach(client => {
        clientMap[client._id] = client.name;
      });

      // Calculate financial data for each client
      const clientFinancials = [];
      const clientOrders = {};
      const clientPayments = {};

      // Group orders by client
      orders.forEach(order => {
        if (!clientOrders[order.clientId]) {
          clientOrders[order.clientId] = [];
        }
        clientOrders[order.clientId].push(order);
      });

      // Group payments by client
      transactions.forEach(txn => {
        if (!clientPayments[txn.clientId]) {
          clientPayments[txn.clientId] = [];
        }
        clientPayments[txn.clientId].push(txn);
      });

      // Calculate outstanding for each client
      Object.keys(clientOrders).forEach(clientId => {
        const clientName = clientMap[clientId] || "Unknown Client";
        const orders = clientOrders[clientId] || [];
        const payments = clientPayments[clientId] || [];

        const totalOrdered = orders.reduce((sum, order) => sum + (order.amount || 0), 0);
        const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const outstanding = totalOrdered - totalPaid;

        if (outstanding > 0) {
          clientFinancials.push({
            clientId,
            clientName,
            totalOrdered,
            totalPaid,
            outstanding,
            orderCount: orders.length,
            lastOrderDate: orders.length > 0 ? new Date(Math.max(...orders.map(o => new Date(o.date)))) : null
          });
        }
      });

      // Sort by outstanding amount (highest first)
      clientFinancials.sort((a, b) => b.outstanding - a.outstanding);

      setFinancialData(clientFinancials);

      // Calculate summary
      const totalOutstanding = clientFinancials.reduce((sum, client) => sum + client.outstanding, 0);
      setSummary({
        totalOutstanding,
        totalClients: clientFinancials.length,
        averageOutstanding: clientFinancials.length > 0 ? totalOutstanding / clientFinancials.length : 0
      });

    } catch (error) {
      console.error("Error fetching financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const columns = [
    columnHelper.accessor("clientName", {
      header: "Client Name",
      enableColumnFilter: false,
    }),
    columnHelper.accessor("totalOrdered", {
      header: "Total Ordered",
      enableColumnFilter: false,
      cell: (info) => `₹${(info.getValue() || 0).toLocaleString()}`
    }),
    columnHelper.accessor("totalPaid", {
      header: "Total Paid",
      enableColumnFilter: false,
      cell: (info) => `₹${(info.getValue() || 0).toLocaleString()}`
    }),
    columnHelper.accessor("outstanding", {
      header: "Outstanding",
      enableColumnFilter: false,
      cell: (info) => (
        <span className="font-semibold text-red-600">
          ₹{(info.getValue() || 0).toLocaleString()}
        </span>
      )
    }),
    columnHelper.accessor("orderCount", {
      header: "Orders",
      enableColumnFilter: false,
    }),
    columnHelper.accessor("lastOrderDate", {
      header: "Last Order",
      enableColumnFilter: false,
      cell: (info) => info.getValue() ? new Date(info.getValue()).toLocaleDateString() : "N/A"
    })
  ];

  const SummaryCard = ({ title, value, icon, color, subtitle }) => (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {title.toLowerCase().includes('outstanding') || title.toLowerCase().includes('amount')
              ? `₹${value.toLocaleString()}`
              : value.toLocaleString()}
          </p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon icon={icon} className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Tracking</h1>
          <p className="text-gray-600 mt-1">Track outstanding payments and client financial status</p>
        </div>
        <button 
          onClick={fetchFinancialData}
          className="btn btn-outline-primary"
        >
          <Icon icon="heroicons:arrow-path" className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          title="Total Outstanding"
          value={summary.totalOutstanding}
          icon="heroicons:exclamation-triangle"
          color="bg-red-500"
          subtitle="Pending collection"
        />
        <SummaryCard
          title="Clients with Outstanding"
          value={summary.totalClients}
          icon="heroicons:users"
          color="bg-orange-500"
          subtitle="Need follow-up"
        />
        <SummaryCard
          title="Average Outstanding"
          value={summary.averageOutstanding}
          icon="heroicons:calculator"
          color="bg-blue-500"
          subtitle="Per client"
        />
      </div>

      {/* Financial Data Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Outstanding Payments by Client</h3>
          <span className="text-sm text-gray-500">
            Showing {financialData.length} clients with outstanding payments
          </span>
        </div>
        
        {financialData.length > 0 ? (
          <TableServerPagination
            tableData={financialData}
            columns={columns}
            pagination={{ pageIndex: 0, pageSize: 10 }}
            onPaginationChange={() => {}}
            pageCount={1}
            tableDataLoading={false}
            columnFilters={[]}
            setColumnFilters={() => {}}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Icon icon="heroicons:check-circle" className="w-12 h-12 mx-auto mb-2 text-green-300" />
            <p>No outstanding payments found!</p>
            <p className="text-sm">All clients have paid their dues.</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FinancialTracking; 