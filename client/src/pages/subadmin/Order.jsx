import React, { useEffect, useState, useMemo } from "react";
import useApi from "../../hooks/useApi";
import TableServerPagination from "../../components/ui/TableServerPagination";
import { createColumnHelper } from "@tanstack/react-table";
import Cookies from "universal-cookie";
import AddSubOrder from "../orderDetails/AddSubOrder";

const columnHelper = createColumnHelper();

const Order = () => {
  useEffect(() => {
    document.title = "Sub-Admin Panel";
  }, []);

  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [pageCount, setPageCount] = useState(1);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeOrder, setActiveOrder] = useState(null);

  const columns = useMemo(
    () => [
      columnHelper.accessor("orderNo", { 
        header: "Order No", 
        enableColumnFilter: false 
      }),
      columnHelper.accessor("clientName", { 
        header: "Client Name", 
        enableColumnFilter: false,
        cell: (info) => {
          const clientName = info.getValue();
          return clientName || "-";
        }
      }),
      columnHelper.accessor("products", {
        id: "productNames",
        header: "Products",
        enableColumnFilter: false,
        cell: (info) => {
          const orderProducts = info.getValue();
          if (!orderProducts || orderProducts.length === 0) return "-";
          return (
            <div className="whitespace-pre-line">
              {orderProducts.map((p, i) => (
                <div key={i}>{p.productName || p.productId || "-"}</div>
              ))}
            </div>
          );
        },
      }),
      columnHelper.accessor("products", {
        id: "quantities",
        header: "Quantities",
        enableColumnFilter: false,
        cell: (info) => {
          const products = info.getValue();
          if (!products || products.length === 0) return "-";
          return (
            <div className="whitespace-pre-line">
              {products.map((p, i) => (
                <div key={i}>{p.quantity}</div>
              ))}
            </div>
          );
        },
      }),
      columnHelper.accessor("products", {
        id: "unitTypes",
        header: "Unit Types",
        enableColumnFilter: false,
        cell: (info) => {
          const products = info.getValue();
          if (!products || products.length === 0) return "-";
          return (
            <div className="whitespace-pre-line">
              {products.map((p, i) => (
                <div key={i}>{p.unitType}</div>
              ))}
            </div>
          );
        },
      }),
      columnHelper.accessor("products", {
        id: "remainingQuantities",
        header: "Remaining Quantity",
        enableColumnFilter: false,
        cell: (info) => {
          const products = info.getValue();
          if (!products || products.length === 0) return "-";
          return (
            <div className="whitespace-pre-line">
              {products.map((p, i) => (
                <div key={i}>{typeof p.remainingQuantity !== 'undefined' ? p.remainingQuantity : '—'}</div>
              ))}
            </div>
          );
        },
      }),
      columnHelper.accessor("products", {
        id: "discounts",
        header: "Discount (%)",
        enableColumnFilter: false,
        cell: (info) => {
          const products = info.getValue();
          if (!products || products.length === 0) return "-";
          return (
            <div className="whitespace-pre-line">
              {products.map((p, i) => (
                <div key={i}>{p.discount ? p.discount + "%" : "—"}</div>
              ))}
            </div>
          );
        },
      }),
      columnHelper.accessor("products", {
        id: "amounts",
        header: "Amounts",
        enableColumnFilter: false,
        cell: (info) => {
          const products = info.getValue();
          if (!products || products.length === 0) return "-";
          return (
            <div className="whitespace-pre-line">
              {products.map((p, i) => (
                <div key={i}>{p.amount ? `₹${Number(p.amount).toLocaleString()}` : "—"}</div>
              ))}
            </div>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        enableColumnFilter: false,
        cell: (info) => {
          const status = info.getValue();
          if (status === "COMPLETED") {
            return <span className="text-green-600 font-semibold bg-green-50 rounded px-2 py-1">Completed</span>;
          } else if (status === "CLOSED") {
            return <span className="text-gray-600 font-semibold bg-gray-50 rounded px-2 py-1">Closed</span>;
          } else {
            return <span className="text-yellow-600 font-semibold bg-yellow-50 rounded px-2 py-1">Pending</span>;
          }
        },
      }),
      columnHelper.accessor("dueDate", {
        header: "Due Date",
        enableColumnFilter: false,
        cell: (info) => {
          const dueDate = info.getValue();
          if (!dueDate) return "-";
          const d = new Date(dueDate);
          if (isNaN(d)) return "-";
          return d.toLocaleDateString();
        },
      }),
      columnHelper.accessor("action", {
        header: "Actions",
        enableColumnFilter: false,
        cell: ({ row }) => {
          const order = row.original;
          return (
            <button
              className="btn btn-primary px-3 py-1 text-xs"
              onClick={() => setActiveOrder(order)}
            >
              Create Suborder
            </button>
          );
        },
      }),
    ],
    []
  );

  const fetchData = async () => {
    setTableDataLoading(true);
    try {
      const token = cookies.get("auth-token");
      const { pageIndex, pageSize } = pagination;
      const page = pageIndex + 1; // Convert to 1-based indexing for API
      
      const ordersRes = await apiCall("GET", `order/all?page=${page}&limit=${pageSize}`, null, token);
      
      if (ordersRes?.orders) {
        setOrders(ordersRes.orders);
        setPageCount(ordersRes.pagination?.totalPages || 1);
      } else {
        setOrders([]);
        setPageCount(1);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      setOrders([]);
      setPageCount(1);
    } finally {
      setTableDataLoading(false);
    }
  };

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    fetchData();
  }, [pagination, refreshTrigger]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Sub-Admin: Orders</h1>
      
      <TableServerPagination
        tableData={orders}
        columns={columns}
        onPaginationChange={setPagination}
        pageCount={pageCount}
        tableDataLoading={tableDataLoading}
        columnFilters={[]}
        setColumnFilters={() => {}}
      />

      {activeOrder && (
        <AddSubOrder
          orderNo={activeOrder.orderNo}
          orderId={activeOrder._id}
          clientId={activeOrder.clientId}
          products={activeOrder.products}
          onAddSuccess={() => {
            setActiveOrder(null);
            refreshData();
          }}
          open={true}
        />
      )}
    </div>
  );
};

export default Order; 