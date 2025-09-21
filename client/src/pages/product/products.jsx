import React, { useEffect, useState, useMemo, lazy, Suspense } from "react";
import TableServerPagination from "../../components/ui/TableServerPagination";
import { createColumnHelper } from "@tanstack/react-table";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import DeleteProduct from "./DeleteProduct";
import EditProduct from "./EditProduct";

// Lazy load AddProductForm to prevent unnecessary API calls
const AddProducts = lazy(() => import("./AddProductForm"));

const columnHelper = createColumnHelper();

const Products = () => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [pageCount, setPageCount] = useState(1);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [showAddProductForm, setShowAddProductForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const columns = useMemo(
    () => [
      // columnHelper.accessor("_id", {
      //   header: "ID",
      //   enableColumnFilter: false,
      // }),
      columnHelper.accessor("name", {
        header: "Name",
        enableColumnFilter: false,
      }),
      columnHelper.accessor("alias", {
        header: "Alias",
        enableColumnFilter: false,
      }),
      columnHelper.accessor("ratePerUnit", {
        header: "ratePerUnit",
        enableColumnFilter: false,
      }),
      columnHelper.accessor("unitType", {
        header: "unitType",
        enableColumnFilter: false,
      }),
      columnHelper.accessor(row => row.alternateUnits?.numberOfItems ?? '', {
        id: 'alternateUnits.numberOfItems',
        header: 'numberOfItems',
        enableColumnFilter: false,
      }),
      columnHelper.accessor(row => row.alternateUnits?.numberOfUnits ?? '', {
        id: 'alternateUnits.numberOfUnits',
        header: 'numberOfUnits',
        enableColumnFilter: false,
      }),
      columnHelper.accessor("action", {
        header: "Actions",
        enableColumnFilter: false,
        cell: ({ row }) => {
          return (
            <span className="flex gap-3">
              <EditProduct
                productId={row.original._id}
                data={row.original}
                onComplete={refreshData}
              />

              <DeleteProduct productId={row.original._id} onDeleteSuccess={refreshData} />

            </span>

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

      if (!token) throw new Error("No auth token found");

      // If you want to pass pagination (optional):
      // const { pageIndex, pageSize } = pagination;
      // const response = await apiCall("GET", `client/all?page=${pageIndex + 1}&limit=${pageSize}`, null, token);

      const response = await apiCall("GET", "product/all", null, token);

      if (response?.success || Array.isArray(response.products)) {
        const clientData = response.products.data || response.products; // depending on how the backend wraps it
        setData(clientData);
        setPageCount(1); // update to actual page count if paginating
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

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (!showAddProductForm) {
      fetchData();
    }
  }, [pagination, showAddProductForm, refreshTrigger]);

  // Keyboard shortcut Alt+C to open Add Product form (capture phase, stopPropagation)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.altKey && (
          e.code === "KeyC" ||
          e.key === "c" ||
          e.key === "C"
        )
      ) {
        if (!showAddProductForm) {
          e.preventDefault();
          e.stopPropagation();
          setShowAddProductForm(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [showAddProductForm]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xl font-semibold mb-4">product Data</h4>
        {!showAddProductForm && (
          <button
            className="btn btn-primary px-4 py-2"
            onClick={() => setShowAddProductForm(true)}
          >
            Add Products
          </button>
        )}
      </div>


      {showAddProductForm ? (
        <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
          <AddProducts onComplete={() => setShowAddProductForm(false)} />
        </Suspense>
      ) : (
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
      )}
    </div>
  );
};

export default Products;
