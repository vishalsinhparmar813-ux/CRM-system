// DEBUG: This is the active Orders page for the Orders route.
// To confirm which file is rendered, add a big debug message here.
// If you see the message, this file is active. If not, check your router and other index.jsx files.

import React, { useEffect, useState, useMemo, useCallback } from "react";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import AddOrder from "./AddOrder";
import TableServerPagination from "../../components/ui/TableServerPagination";
import { createColumnHelper } from "@tanstack/react-table";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import useToast from "../../hooks/useToast";

const columnHelper = createColumnHelper();

const Order = () => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const { toastSuccess, toastError } = useToast();
  const [orders, setOrders] = useState([]);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [step, setStep] = useState('init');
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [pageCount, setPageCount] = useState(1);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [orderToClose, setOrderToClose] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
          const isAdmin = true; // TODO: Get this from user context/role
          
          if (order.status === "CLOSED") {
            return <span className="text-gray-500 text-sm">Already Closed</span>;
          }
          
          if (isAdmin) {
            return (
              <button
                className="btn btn-danger px-3 py-1 text-sm"
                onClick={() => handleCloseOrder(order._id)}
                disabled={loading}
              >
                Close Order
              </button>
            );
          }
          
          return <span className="text-gray-400 text-sm">No actions</span>;
        },
      }),
    ],
    []
  );

  const fetchData = async () => {
    setTableDataLoading(true);
    setStep('fetching');
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
      
      setStep('data received');
    } catch (error) {
      setOrders([]);
      setPageCount(1);
      setError(error.message || String(error));
      setStep('error');
    } finally {
      setTableDataLoading(false);
    }
  };

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (!showAddOrder) {
      fetchData();
    }
  }, [showAddOrder, pagination, refreshTrigger]);

  const handleCloseOrder = async (orderId) => {
    setOrderToClose(orderId);
    setShowCloseModal(true);
  };

  const confirmCloseOrder = async () => {
    if (!orderToClose) return;

    setLoading(true);
    try {
      const token = cookies.get("auth-token");
      const response = await apiCall("PATCH", `order/${orderToClose}/close`, null, token);
      
      if (response?.message) {
        toastSuccess(response.message);
        // Refresh the data
        refreshData();
      } else {
        toastError('Failed to close order');
      }
    } catch (error) {
      toastError(error.message || 'Failed to close order');
    } finally {
      setLoading(false);
      setShowCloseModal(false);
      setOrderToClose(null);
    }
  };

  const cancelCloseOrder = () => {
    setShowCloseModal(false);
    setOrderToClose(null);
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="text-gray-600 mt-1">Manage your orders and track their status.</p>
        </div>
        {!showAddOrder && (
          <button
            className="btn btn-primary px-4 py-2"
            onClick={() => setShowAddOrder(true)}
          >
            Add Order
          </button>
        )}
      </div>
      {showAddOrder ? (
        <AddOrder onComplete={() => setShowAddOrder(false)} />
      ) : (
        <Card className="p-6">
          <TableServerPagination
            tableData={orders}
            columns={columns}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            tableDataLoading={tableDataLoading}
            columnFilters={[]}
            setColumnFilters={() => {}}
          />
        </Card>
      )}

      {/* Close Order Confirmation Modal */}
      <Modal
        activeModal={showCloseModal}
        onClose={cancelCloseOrder}
        title="Close Order"
        themeClass="bg-red-600 dark:bg-red-700"
        className="max-w-md"
        footerContent={
          <>
            <button
              onClick={cancelCloseOrder}
              className="btn btn-outline-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={confirmCloseOrder}
              className="btn btn-danger"
              disabled={loading}
            >
              {loading ? "Closing..." : "Close Order"}
            </button>
          </>
        }
      >
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Close Order</h3>
          <p className="text-sm text-gray-500 mb-4">
            Are you sure you want to close this order? This action cannot be undone and will mark the order as closed.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Order;
