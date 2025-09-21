import React, { useEffect, useState, useMemo } from "react";
import TableServerPagination from "../../components/ui/TableServerPagination";
import { createColumnHelper } from "@tanstack/react-table";
import useApi from "../../hooks/useApi";
import useToast from "../../hooks/useToast";
import Cookies from "universal-cookie";
import { useNavigate } from "react-router-dom";

const columnHelper = createColumnHelper();

const Invoice = () => {
    const { apiCall } = useApi();
    const { toastError } = useToast();
    const cookies = new Cookies();
    const navigate = useNavigate();

    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    const [pageCount, setPageCount] = useState(1);
    const [tableDataLoading, setTableDataLoading] = useState(false);

    const fetchClientsWithInvoices = async () => {
        setTableDataLoading(true);
        try {
            console.log('Starting fetchClientsWithInvoices...');
            const token = cookies.get("auth-token");
            console.log('Token exists:', !!token);
            console.log('Making API call to: sub-order/clients-with-invoices');
            
            const response = await apiCall("GET", "sub-order/clients-with-invoices", null, token);
            console.log('API Response:', response);

            if (response && response.success !== false) {
                console.log('Setting clients data:', response.clients);
                setData(response.clients || []);
                setPageCount(1);
            } else {
                console.log('API call failed:', response);
                throw new Error(response?.message || "Failed to fetch clients with invoices");
            }
        } catch (error) {
            console.error("Error fetching data:", error.message);
            console.error("Full error:", error);
            toastError("Failed to fetch clients with invoices");
            setData([]);
        } finally {
            setTableDataLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return '₹0';
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN');
    };

    // Handle row click to navigate to client invoices
    const handleRowClick = (row) => {
        navigate(`/invoice/client/${row.original._id}`);
    };

    useEffect(() => {
        fetchClientsWithInvoices();
    }, []);

    const columns = useMemo(
        () => [
            columnHelper.accessor("name", { 
                header: "Client Name", 
                enableColumnFilter: false,
                cell: (info) => (
                    <div className="font-medium text-blue-600 hover:text-blue-800">
                        {info.getValue() || "Unknown Client"}
                    </div>
                )
            }),

            columnHelper.accessor("email", {
                header: "Email",
                enableColumnFilter: false,
                cell: (info) => info.getValue() || "N/A"
            }),

            columnHelper.accessor("mobile", {
                header: "Mobile",
                enableColumnFilter: false,
                cell: (info) => info.getValue() || "N/A"
            }),

            columnHelper.accessor("totalInvoices", {
                header: "Total Invoices",
                enableColumnFilter: false,
                cell: (info) => info.getValue() || 0
            }),

            columnHelper.accessor("totalAmount", {
                header: "Total Dispatched Amount",
                enableColumnFilter: false,
                cell: (info) => formatCurrency(info.getValue())
            }),

            columnHelper.accessor("latestDispatchDate", {
                header: "Latest Dispatch",
                enableColumnFilter: false,
                cell: (info) => formatDate(info.getValue())
            }),

            columnHelper.accessor("action", {
                header: "Actions",
                enableColumnFilter: false,
                cell: ({ row }) => (
                    <div className="flex space-x-2">
                        <button
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent row click when button is clicked
                                navigate(`/invoice/client/${row.original._id}`);
                            }}
                        >
                            View Invoices
                        </button>
                    </div>
                ),
            }),
        ],
        [navigate]
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h4 className="text-xl font-semibold text-gray-900">Invoice Management</h4>
                    <p className="text-sm text-gray-600 mt-1">Clients with dispatch invoices</p>
                </div>
                <div className="text-sm text-gray-500">
                    Total Clients: {data.length}
                </div>
            </div>

            {data.length === 0 && !tableDataLoading && (
                <div className="text-center bg-white p-12 rounded-lg shadow-sm mb-6">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No Clients Found</h3>
                    <p className="mt-1 text-sm text-gray-500">No clients with dispatch invoices were found.</p>
                </div>
            )}

            <TableServerPagination
                tableData={data}
                columns={columns}
                pagination={pagination}
                onPaginationChange={setPagination}
                pageCount={pageCount}
                tableDataLoading={tableDataLoading}
                columnFilters={[]}
                setColumnFilters={() => {}}
                onRowClick={handleRowClick}
                rowClickable={true}
            />
        </div>
    );
};

export default Invoice;
