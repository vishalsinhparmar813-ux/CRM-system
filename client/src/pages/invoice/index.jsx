import React, { useEffect, useState, useMemo } from "react";
import TableServerPagination from "../../components/ui/TableServerPagination";
import { createColumnHelper } from "@tanstack/react-table";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
const columnHelper = createColumnHelper();

const Invoice = () => {
    const { apiCall } = useApi();
    const cookies = new Cookies();

    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    const [pageCount, setPageCount] = useState(1);
    const [tableDataLoading, setTableDataLoading] = useState(false);

    const [clientMap, setClientMap] = useState({});
    const [productMap, setProductMap] = useState({});

    const fetchClientName = async (clientId) => {
        if (!clientId || clientMap[clientId]) return;
        try {
            const token = cookies.get("auth-token");
            const client = await apiCall("GET", `client/${clientId}`, null, token);
            if (client?.name) {
                setClientMap((prev) => ({ ...prev, [clientId]: client.name }));
            }
        } catch (err) {
            console.error(`Failed to fetch client (${clientId}):`, err.message);
        }
    };

    const fetchProductName = async (productId) => {
        if (!productId || productMap[productId]) return;
        try {
            const token = cookies.get("auth-token");
            const response = await apiCall("GET", `product/${productId}`, null, token);
            if (response?.product?.name) {
                setProductMap((prev) => ({ ...prev, [productId]: response.product.name }));
            }
        } catch (err) {
            console.error(`Failed to fetch product (${productId}):`, err.message);
        }
    };

    const fetchData = async () => {
        setTableDataLoading(true);
        try {
            const token = cookies.get("auth-token");
            const response = await apiCall("GET", "order/all", null, token);

            if (response?.orders) {
                // Filter only completed orders
                const completedOrders = response.orders.filter(order => order.status === "COMPLETED");

                setData(completedOrders);
                setPageCount(1);

                const uniqueClientIds = [...new Set(completedOrders.map((o) => o.clientId))];
                const uniqueProductIds = [...new Set(completedOrders.map((o) => o.productId))];

                await Promise.all([
                    ...uniqueClientIds.map(fetchClientName),
                    ...uniqueProductIds.map(fetchProductName),
                ]);
            } else {
                throw new Error(response.message || "Failed to fetch data");
            }
        } catch (error) {
            console.error("Error fetching data:", error.message);
            setData([]);
        } finally {
            setTableDataLoading(false);
        }
    };

    const handleGenerate = async (order) => {
        try {
            const token = cookies.get("auth-token");
            const response = await fetch(`http://localhost:3010/order/${order._id}/invoice`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            console.log("response", response)
            if (!response.ok) throw new Error("Failed to fetch invoice");

            const blob = await response.blob();
            const pdfUrl = URL.createObjectURL(blob);
            window.open(pdfUrl, "_blank");
        } catch (err) {
            console.error("Error generating invoice:", err.message);
            alert("Failed to generate invoice.");
        }
    };


    useEffect(() => {
        fetchData();
    }, [pagination]);

    const columns = useMemo(
        () => [
            columnHelper.accessor("orderNo", { header: "Order No", enableColumnFilter: false }),

            columnHelper.accessor("clientId", {
                header: "Client Name",
                enableColumnFilter: false,
                cell: (info) => clientMap[info.getValue()] || "Loading...",
            }),

            columnHelper.accessor("productId", {
                header: "Product",
                enableColumnFilter: false,
                cell: (info) => productMap[info.getValue()] || "Loading...",
            }),

            columnHelper.accessor("quantity", { header: "Quantity", enableColumnFilter: false }),

            columnHelper.accessor("amount", {
                header: "Amount",
                enableColumnFilter: false,
                cell: (info) => `₹${info.getValue().toLocaleString()}`,
            }),

            columnHelper.accessor("discount", { header: "Discount", enableColumnFilter: false }),

            columnHelper.accessor("dueDate", {
                header: "Due Date",
                enableColumnFilter: false,
                cell: (info) => new Date(info.getValue()).toLocaleDateString(),
            }),

            columnHelper.accessor("date", {
                header: "Order Date",
                enableColumnFilter: false,
                cell: (info) => new Date(info.getValue()).toLocaleDateString(),
            }),
            columnHelper.accessor("action", {
                header: "Actions",
                enableColumnFilter: false,
                cell: ({ row }) => (
                    <button
                        className="text-green-600 font-medium hover:underline"
                        onClick={() => handleGenerate(row.original)}
                    >
                        Generate
                    </button>
                ),
            }),

        ],
        [clientMap, productMap]
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-semibold">Invoice Data</h4>
            </div>

            <TableServerPagination
                tableData={data}
                columns={columns}
                pagination={pagination}
                onPaginationChange={setPagination}
                pageCount={pageCount}
                tableDataLoading={tableDataLoading}
                columnFilters={[]}
                setColumnFilters={() => { }}
            />
        </div>
    );
};

export default Invoice;
