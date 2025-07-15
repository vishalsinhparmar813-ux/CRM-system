import React, { useEffect, useState, useMemo } from "react";
import TableServerPagination from "../../components/ui/TableServerPagination";
import { createColumnHelper } from "@tanstack/react-table";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import AddClient from "./AddClient";
import DeleteClient from "./DeleteClient";
import Card from "../../components/ui/Card";
import { useNavigate } from "react-router-dom";

const columnHelper = createColumnHelper();

const Clients = () => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [pageCount, setPageCount] = useState(1);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [showAddClientForm, setShowAddClientForm] = useState(false);

  const columns = useMemo(
    () => [
      columnHelper.accessor("clientNo", { header: "Client No", enableColumnFilter: false }),
      columnHelper.accessor("name", { header: "Name", enableColumnFilter: false }),
      columnHelper.accessor("email", { header: "Email", enableColumnFilter: false }),
      columnHelper.accessor("mobile", { 
        header: "Mobile", 
        enableColumnFilter: false,
        cell: (info) => info.getValue() || "N/A"
      }),
      columnHelper.accessor("correspondenceAddress", {
        header: "Correspondence Address",
        enableColumnFilter: false,
        cell: (info) => {
          const address = info.getValue();
          if (!address) return "--";
          const { area = "-", city = "-", landmark = "-", state = "-", country = "-", postalCode = "-" } = address;
          return [area, city, landmark, state, country, postalCode].filter(Boolean).join(", ");
        },
      }),
      columnHelper.accessor("permanentAddress", {
        header: "Permanent Address",
        enableColumnFilter: false,
        cell: (info) => {
          const address = info.getValue();
          if (!address) return "-";
          const { area = "-", city = "-", landmark = "-", state = "-", country = "-", postalCode = "-" } = address;
          return [area, city, landmark, state, country, postalCode].filter(Boolean).join(", ");
        },
      }),
      columnHelper.accessor("action", {
        header: "Actions",
        enableColumnFilter: false,
        cell: ({ row }) => {
          return (
            <span className="flex gap-3">
              <DeleteClient clientId={row.original._id} onDeleteSuccess={fetchData} />
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
      const { pageIndex, pageSize } = pagination;
      const page = pageIndex + 1; // Convert to 1-based indexing for API
      
      const response = await apiCall("GET", `client/all?page=${page}&limit=${pageSize}`, null, token);
      if (response?.success) {
        const clientData = response.data;
        const paginationData = response.pagination;
        setData(clientData);
        setPageCount(paginationData.totalPages);
      } else {
        throw new Error(response.message || "Failed to fetch data");
      }
    } catch (error) {
      console.error("Error fetching data:", error.message);
      setData([]);
      setPageCount(1);
    } finally {
      setTableDataLoading(false);
    }
  };

  useEffect(() => {
    if (!showAddClientForm) fetchData();
  }, [pagination, showAddClientForm]);

  // Keyboard shortcut Alt+C to open Add Client form (capture phase, stopPropagation)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.altKey && (
          e.code === "KeyC" ||
          e.key === "c" ||
          e.key === "C"
        )
      ) {
        if (!showAddClientForm) {
          e.preventDefault();
          e.stopPropagation();
          setShowAddClientForm(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [showAddClientForm]);

  // Row click handler
  const handleRowClick = (row) => {
    navigate(`/client/${row.original._id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
          <p className="text-gray-600 mt-1">Manage your client information and details.</p>
        </div>
        {!showAddClientForm && (
          <button
            className="btn btn-primary px-4 py-2"
            onClick={() => setShowAddClientForm(true)}
          >
            Add Client
          </button>
        )}
      </div>

      {showAddClientForm ? (
        <AddClient onComplete={() => setShowAddClientForm(false)} />
      ) : (
        <Card className="p-6">
          <TableServerPagination
            tableData={data}
            columns={columns}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            tableDataLoading={tableDataLoading}
            columnFilters={[]}
            setColumnFilters={() => {}}
            getRowProps={row => ({
              onClick: () => handleRowClick(row),
              style: { cursor: "pointer", background: row.isSelected ? "#f0f4ff" : undefined },
              className: "hover:bg-blue-50"
            })}
          />
        </Card>
      )}
    </div>
  );
};

export default Clients; 