import React, { useEffect, useState, useMemo, useCallback } from "react";
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
  const [editingClient, setEditingClient] = useState(null);
  const [paginationInfo, setPaginationInfo] = useState(null);
  const [allClients, setAllClients] = useState(() => {
    // Load from sessionStorage on initial load
    const cached = sessionStorage.getItem('client-cache');
    return cached ? JSON.parse(cached) : [];
  }); // Local storage for all fetched clients
  
  const [fetchedPages, setFetchedPages] = useState(() => {
    // Load from sessionStorage on initial load
    const cached = sessionStorage.getItem('client-fetched-pages');
    return cached ? new Set(JSON.parse(cached)) : new Set();
  }); // Track which pages are fetched
  

  


  const columns = useMemo(
    () => [
      columnHelper.accessor("clientNo", { 
        header: "Client No", 
        enableColumnFilter: false,
        cell: (info) => {
          const clientNo = info.getValue();
          return clientNo ? `#${clientNo}` : 'N/A';
        }
      }),
      columnHelper.accessor("name", { 
        header: "Name", 
        enableColumnFilter: false,
        cell: (info) => info.getValue() || 'N/A'
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
            <span className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingClient(row.original);
                  setShowAddClientForm(true);
                }}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/client/${row.original._id}`);
                }}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                View
              </button>
              <DeleteClient clientId={row.original._id} onDeleteSuccess={() => {
                clearCache();
                fetchData();
              }} />
            </span>
          );
        },
      }),
    ],
    [navigate]
  );

  // Function to clear cache
  const clearCache = useCallback(() => {
    setAllClients([]);
    setFetchedPages(new Set());
    sessionStorage.removeItem('client-cache');
    sessionStorage.removeItem('client-fetched-pages');
  }, []);

  const fetchData = useCallback(async (pageIndex = 0, pageSize = 10, forceRefresh = false) => {
    setTableDataLoading(true);
    try {
      const token = cookies.get("auth-token");
      const page = pageIndex + 1; // Convert to 1-based indexing for API
      
      console.log('DEBUG: Fetching clients with pagination:', { page, pageSize, forceRefresh });
      const response = await apiCall("GET", `client/all?page=${page}&limit=${pageSize}&sort=-createdAt`, null, token);
      console.log('DEBUG: Client API response:', response);
      
      if (response?.success) {
        let clientData = response.data;
        const paginationData = response.pagination;
        console.log('DEBUG: Client data:', clientData);
        console.log('DEBUG: Pagination data:', paginationData);
        
        // Sort clients by newest first (frontend sorting)
        clientData = clientData.sort((a, b) => {
          const dateA = new Date(a.createdAt || a._id);
          const dateB = new Date(b.createdAt || b._id);
          return dateB - dateA; // Newest first
        });
        
        // Add client numbers in descending order (newest client gets highest number)
        const totalClients = paginationData.totalClients || 0;
        const currentPage = paginationData.currentPage || 1;
        const limit = paginationData.limit || 10;
        const startIndex = (currentPage - 1) * limit;
        
        clientData = clientData.map((client, index) => ({
          ...client,
          clientNo: Math.max(1, totalClients - (startIndex + index))
        }));
        
        // Set current page data
        setData(clientData);
        setPageCount(paginationData.totalPages);
        
        // Set pagination info for enhanced component
        setPaginationInfo({
          currentPage: paginationData.currentPage,
          totalPages: paginationData.totalPages,
          totalItems: paginationData.totalClients,
          limit: paginationData.limit,
          hasNextPage: paginationData.hasNextPage,
          hasPrevPage: paginationData.hasPrevPage
        });
        
        // Update cache only after successful fetch
        setAllClients(clientData);
        sessionStorage.setItem('client-cache', JSON.stringify(clientData));
        
        // Log pagination state for debugging
        console.log('DEBUG: Current page:', paginationData.currentPage);
        console.log('DEBUG: Total pages:', paginationData.totalPages);
        console.log('DEBUG: Has next page:', paginationData.hasNextPage);
        console.log('DEBUG: Has prev page:', paginationData.hasPrevPage);
        console.log('DEBUG: Total clients:', paginationData.totalClients);
      } else {
        throw new Error(response.message || "Failed to fetch data");
      }
    } catch (error) {
      console.error("Error fetching data:", error.message);
      setData([]);
      setPageCount(1);
      setPaginationInfo(null);
    } finally {
      setTableDataLoading(false);
    }
  }, [apiCall, cookies]);

  // Initial load
  useEffect(() => {
    if (!showAddClientForm) {
      fetchData(0, 10);
    }
  }, [showAddClientForm]);

  // Handle pagination changes
  useEffect(() => {
    if (!showAddClientForm) {
      fetchData(pagination.pageIndex, pagination.pageSize);
    }
  }, [pagination.pageIndex, pagination.pageSize, showAddClientForm]);

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
            onClick={() => {
              setEditingClient(null);
              setShowAddClientForm(true);
            }}
          >
            Add Client
          </button>
        )}
      </div>

      {showAddClientForm ? (
        <AddClient 
          clientData={editingClient}
          onComplete={() => {
            clearCache();
            setShowAddClientForm(false);
            setEditingClient(null);
          }} 
        />
      ) : (
        <Card className="p-6">
          {/* Pagination Status Display */}
          {paginationInfo && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center text-sm text-blue-800">
                <span>
                  Showing <strong>{((paginationInfo.currentPage - 1) * paginationInfo.limit) + 1}</strong> to <strong>{Math.min(paginationInfo.currentPage * paginationInfo.limit, paginationInfo.totalItems)}</strong> of <strong>{paginationInfo.totalItems}</strong> clients
                </span>
                <span>
                  Page <strong>{paginationInfo.currentPage}</strong> of <strong>{paginationInfo.totalPages}</strong>
                </span>
              </div>
              <div className="mt-2 text-xs text-blue-600">
                Cached: <strong>{allClients.length}</strong> clients | Latest clients shown first
              </div>
            </div>
          )}
          
          <TableServerPagination
            tableData={data}
            columns={columns}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            tableDataLoading={tableDataLoading}
            columnFilters={[]}
            setColumnFilters={() => {}}
            paginationInfo={paginationInfo}
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