import React, { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import useApi from "../../hooks/useApi";
import useToast from "../../hooks/useToast";
import Cookies from "universal-cookie";
import Loading from "@/components/Loading";

const DebtsList = () => {
  const { apiCall } = useApi();
  const { toastError } = useToast();
  const cookies = new Cookies();
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState([]);
  const [summary, setSummary] = useState({
    totalDebt: 0,
    totalClients: 0,
    averageDebt: 0,
  });

  useEffect(() => {
    fetchDebtsData();
  }, []);

  const fetchDebtsData = async () => {
    setLoading(true);
    try {
      const token = cookies.get("auth-token");
      
      // Fetch all orders, transactions, and clients
      const [ordersRes, transactionsRes, clientsRes] = await Promise.all([
        apiCall("GET", "order/all", null, token),
        apiCall("GET", "transaction/all", null, token),
        apiCall("GET", "client/all", null, token),
      ]);

      const orders = ordersRes?.orders || [];
      const transactions = transactionsRes?.transactions || [];
      const clients = clientsRes || [];

      // Calculate debts per client
      const clientDebts = calculateClientDebts(orders, transactions, clients);
      setDebts(clientDebts);

      // Calculate summary
      const totalDebt = clientDebts.reduce((sum, debt) => sum + debt.outstandingAmount, 0);
      const totalClients = clientDebts.length;
      const averageDebt = totalClients > 0 ? totalDebt / totalClients : 0;

      setSummary({
        totalDebt,
        totalClients,
        averageDebt,
      });
    } catch (error) {
      console.error("Error fetching debts data:", error);
      toastError("Failed to fetch debts data");
    } finally {
      setLoading(false);
    }
  };

  const calculateClientDebts = (orders, transactions, clients) => {
    const clientDebts = [];

    clients.forEach(client => {
      // Get all orders for this client
      const clientOrders = orders.filter(order => order.clientId === client._id);
      
      // Calculate total order amount
      const totalOrderAmount = clientOrders.reduce((sum, order) => {
        const orderAmount = order.amount || 0;
        const discount = order.discount || 0;
        return sum + (orderAmount - (orderAmount * discount / 100));
      }, 0);

      // Get all transactions for this client
      const clientTransactions = transactions.filter(txn => txn.clientId === client._id);
      
      // Calculate total paid amount
      const totalPaidAmount = clientTransactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);

      // Calculate outstanding amount
      const outstandingAmount = totalOrderAmount - totalPaidAmount;

      // Only include clients with outstanding debts
      if (outstandingAmount > 0) {
        clientDebts.push({
          clientId: client._id,
          clientName: client.name,
          clientAlias: client.alias,
          clientMobile: client.mobile,
          totalOrderAmount,
          totalPaidAmount,
          outstandingAmount,
          orderCount: clientOrders.length,
          transactionCount: clientTransactions.length,
        });
      }
    });

    // Sort by outstanding amount (highest first)
    return clientDebts.sort((a, b) => b.outstandingAmount - a.outstandingAmount);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debts List</h1>
          <p className="text-gray-600 mt-1">Overview of all outstanding debts by client</p>
        </div>
        <Button onClick={fetchDebtsData} className="btn btn-primary">
          <Icon icon="heroicons:arrow-path" className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 text-red-600">
              <Icon icon="heroicons:currency-rupee" className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalDebt)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Icon icon="heroicons:users" className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Clients with Debts</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalClients}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <Icon icon="heroicons:chart-bar" className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Average Debt</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.averageDebt)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Debts Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Outstanding Debts</h2>
          <div className="text-sm text-gray-500">
            {debts.length} client{debts.length !== 1 ? 's' : ''} with outstanding debts
          </div>
        </div>

        {debts.length === 0 ? (
          <div className="text-center py-12">
            <Icon icon="heroicons:check-circle" className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Outstanding Debts</h3>
            <p className="text-gray-600">All clients have paid their dues in full.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outstanding
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {debts.map((debt, index) => (
                  <tr key={debt.clientId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {debt.clientName}
                        </div>
                        {debt.clientAlias && (
                          <div className="text-sm text-gray-500">
                            Alias: {debt.clientAlias}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{debt.clientMobile}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{debt.orderCount}</div>
                      <div className="text-xs text-gray-500">
                        {debt.transactionCount} payments
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(debt.totalOrderAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-green-600">
                        {formatCurrency(debt.totalPaidAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-red-600">
                        {formatCurrency(debt.outstandingAmount)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DebtsList; 