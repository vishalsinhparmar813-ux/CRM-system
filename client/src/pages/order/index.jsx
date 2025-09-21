import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import TableServerPagination from "../../components/ui/TableServerPagination";
import { createColumnHelper } from "@tanstack/react-table";
import Card from "../../components/ui/Card";

const columnHelper = createColumnHelper();

const Order = () => {
  const navigate = useNavigate();
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [data, setData] = useState([]);
  const [step, setStep] = useState('init');
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [pageCount, setPageCount] = useState(1);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');

  const columns = useMemo(
    () => [
      columnHelper.accessor("clientName", {
        header: "Client Name",
        enableColumnFilter: false,
        cell: (info) => {
          const client = info.row.original;
          return (
            <div>
              <div className="font-medium text-gray-900">{client.clientName}</div>
              {client.clientAlias && (
                <div className="text-sm text-gray-500">({client.clientAlias})</div>
              )}
              <div className="text-sm text-gray-500">{client.clientEmail}</div>
            </div>
          );
        },
      }),
      columnHelper.accessor("totalOrders", {
        header: "Total Orders",
        enableColumnFilter: false,
        cell: (info) => {
          return (
            <span className="font-medium text-gray-900">
              {info.getValue()}
            </span>
          );
        },
      }),
      columnHelper.accessor("totalAmount", {
        header: "Total Amount",
        enableColumnFilter: false,
        cell: (info) => {
          return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
          }).format(info.getValue());
        },
      }),
      columnHelper.accessor("remainingAmount", {
        header: "Remaining Amount",
        enableColumnFilter: false,
        cell: (info) => {
          const amount = info.getValue();
          return (
            <span className={amount > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
              {new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR'
              }).format(amount)}
            </span>
          );
        },
      }),
      columnHelper.accessor("lastOrderDate", {
        header: "Last Order Date",
        enableColumnFilter: false,
        cell: (info) => {
          return new Date(info.getValue()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "View Orders",
        cell: (info) => {
          const client = info.row.original;
          return (
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={(e) => {
                e.stopPropagation();
                handleViewClientOrders(client.clientId);
              }}
            >
              View Orders
            </button>
          );
        },
      }),
    ],
    []
  );

  const handleViewClientOrders = (clientId) => {
    navigate(`/order/client/${clientId}`);
  };

  const fetchData = async () => {
    setTableDataLoading(true);
    setStep('fetching');
    try {
      const token = cookies.get("auth-token");
      const { pageIndex, pageSize } = pagination;
      const page = pageIndex + 1; // Convert to 1-based indexing for API
      
      const response = await apiCall("GET", `order/grouped-by-client?page=${page}&limit=${pageSize}`, null, token);
      
      if (response?.clients) {
        setData(response.clients);
        const totalPages = response.pagination?.totalPages || 1;
        setPageCount(totalPages);
        setStep('data received');
      } else {
        setData([]);
        setPageCount(1);
        setStep('no data');
      }
    } catch (error) {
      setData([]);
      setPageCount(1);
      setError(error.message || String(error));
      setStep('error');
    } finally {
      setTableDataLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination]);

  useEffect(() => {
    if (clientId) {
      navigate(`/order/add?clientId=${clientId}`);
    }
  }, [clientId, navigate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="text-gray-600 mt-1">Manage your orders and track their status.</p>
        </div>
        <button
          className="btn btn-primary px-4 py-2"
          onClick={() => navigate('/order/add')}
        >
          Add Order
        </button>
      </div>
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-600">Error: {error}</div>
        </div>
      )}
      <Card className="p-6">
        <TableServerPagination
          tableData={data}
          columns={columns}
          onPaginationChange={setPagination}
          pageCount={pageCount}
          tableDataLoading={tableDataLoading}
          columnFilters={[]}
          setColumnFilters={() => {}}
          onRowClick={(row) => handleViewClientOrders(row.original.clientId)}
        />
      </Card>
    </div>
  );
};

export default Order;
