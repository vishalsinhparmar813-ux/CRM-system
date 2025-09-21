import { useEffect, useMemo, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, getFilteredRowModel } from "@tanstack/react-table";
import Filter from "../AdvancedTable/Filter";
import { mkConfig, generateCsv, download } from "export-to-csv";
import Icon from "@/components/ui/Icon";
import Textinput from "@/components/ui/Textinput";
import Loading from "../../Loading";
import Cookies from "universal-cookie";
import useApi from "../../../hooks/useApi";
import useToast from "../../../hooks/useToast";
import { imageBaseUrl } from "../../../constant/common";

const fuzzyFilter = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);

  addMeta({
    itemRank,
  });

  return itemRank.passed;
};
const TableServerPagination = ({
  columns,
  tableData,
  csvFileName,
  additionalCsvData = [],
  onPaginationChange,
  pageCount,
  tableDataLoading,
  isActivityLog,
  columnFilters,
  setColumnFilters,
  isParticipantsData,
  isReferral,
  getRowProps,
  onRowClick,
}) => {
  const cookies = new Cookies();
  const { apiCall } = useApi();

  const data = useMemo(() => [...(tableData || [])], [tableData]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [localGoTo, setLocalGoTo] = useState(1);
  const { toastInfo, toastSuccess, toastError } = useToast();

  const exportAllUSer = async () => {
    await exportDownloadAllPlayersCSV();
  };

  const exportRequestAllUsers = async () => {
    await exportRequestAllUsersCSV();
  };

  const exportAllLogData = async () => {
    await exportDownloadAllLogCSV();
  };

  const exportRequestAllLog = async () => {
    await exportRequestAllLogCSV();
  };

  const csvConfig = mkConfig({
    fieldSeparator: ",",
    filename: csvFileName ?? "CSV-Download",
    decimalSeparator: ".",
    useKeysAsHeaders: true,
  });

  //   const exportExcel = (rows) => {
  //     const rowData = rows.map((row) => row.original);
  //     const mergedData = [...rowData, ...additionalCsvData];
  //     const csv = generateCsv(csvConfig)(mergedData);
  //     download(csvConfig)(csv);
  //   };

  // const exportExcel = (rows) => {
  //   console.log("ExcelRows")
  //   const rowData = rows.map((row) => {
  //     const flattenedRow = {};
  //     for (const key in row.original) {
  //       if (typeof row.original[key] === "object") {
  //         flattenedRow[key] = JSON.stringify(row.original[key]);
  //       } else {
  //         flattenedRow[key] = row.original[key];
  //       }
  //     }
  //     return flattenedRow;
  //   });

  //   // Merge with additional CSV data
  //   const mergedData = [...rowData, ...additionalCsvData];

  //   // Generate and download CSV
  //   const csv = generateCsv(csvConfig)(mergedData);
  //   download(csvConfig)(csv);
  // };

  const exportExcel = (rows) => {
    console.log("ExcelRows", rows);

    const allowedKeys = [
      "tg_id",
      "username",
      "playerId",
      "walletAddress",
      "sakeBalance",
      "healthBalance",
      "manaBalance",
      "referrals",
      "usedFreeAttempts",
      "totalTaps",
      "createdAt",
    ];


    const columnTitleMap = {
      tg_id: "Telegram ID",
      username: "Username",
      playerId: "Player ID",
      walletAddress: "Wallet Address",
      sakeBalance: "Sake Balance",
      healthBalance: "Health Balance",
      manaBalance: "Mana Balance",
      referrals: "Referral Count",
      usedFreeAttempts: "Used Free Attempts",
      totalTaps: "Total Taps",
      createdAt: "Created At",
    };

    const formatCustomValues = (value) => {
      if (Array.isArray(value)) {
        return value
          .map(
            (obj) =>
              `{${Object.entries(obj)
                .map(([key, val]) => `${key}:${typeof val === "string" ? `"${val}"` : val}`)
                .join(", ")}}`
          )
          .join("; ");
      } else if (typeof value === "object") {
        return `{${Object.entries(value)
          .map(([key, val]) => `${key}:${typeof val === "string" ? `"${val}"` : val}`)
          .join(", ")}}`;
      }
      return value;
    };

    const rowData = rows.map((row) => {
      const flattenedRow = {};

      for (const key in row.original) {
        if (allowedKeys.includes(key)) {
          const columnTitle = columnTitleMap[key] || key; // Use the mapped title or fallback to the key
          if (key === "Username" || key === "Wallet Address") {
            flattenedRow[columnTitle] = row.original[key] === 0 ? 0 : row.original[key] || "-";
          } else if (key === "New Value" || key === "Previous Value") {
            flattenedRow[columnTitle] = formatCustomValues(row.original[key]);
          } else {
            flattenedRow[columnTitle] =
              typeof row.original[key] === "object" ? JSON.stringify(row.original[key]) : row.original[key];
          }
        }
      }
      return flattenedRow;
    });

    const mergedData = [...rowData, ...additionalCsvData];
    console.log("mergedData", mergedData);

    const csv = generateCsv(csvConfig)(mergedData);
    download(csvConfig)(csv);
  };


  //for all users data when we click on Request Button
  const exportDownloadAllPlayersCSV = async () => {
    try {
      const response = await apiCall("GET", `admin/export-users`, {}, cookies.get("auth-token"));
      if (response?.success) {
        toastInfo(response?.message);
      } else {
        toastInfo("Request is already in the process. Please wait for some time!");
      }
    } catch (error) {
      console.log("fetch all Players", error.message);
    }
  };

  //for all users data when we click on Download Button

  const exportRequestAllUsersCSV = async () => {
    try {
      const response = await apiCall("GET", `admin/check-request-status`, {}, cookies.get("auth-token"));

      if (response?.success) {
        const s3FileUrl = `${imageBaseUrl}${response?.data}`;

        window.open(s3FileUrl, "_blank");

        toastSuccess("CSV File downloaded successfully!");
      } else {
        toastInfo(response?.message);
      }
    } catch (error) {
      console.log("fetch all Players", error.message);

      toastError("Failed to download the CSV file. Please try again.");
    }
  };

  //for all log data when we click on Request Button
  const exportDownloadAllLogCSV = async () => {
    try {
      const response = await apiCall("GET", `admin/export-logs`, {}, cookies.get("auth-token"));
      if (response?.success) {
        toastInfo(response?.message);
      } else {
        toastInfo("Request is already in the process. Please wait for some time!");
      }
    } catch (error) {
      console.log("fetch all log data", error.message);
    }
  };

  //for all log data when we click on Download Button

  const exportRequestAllLogCSV = async () => {
    try {
      const response = await apiCall("GET", `admin/check-logs-request-status`, {}, cookies.get("auth-token"));

      if (response?.success) {
        const s3FileUrl = `${imageBaseUrl}${response?.data}`;

        window.open(s3FileUrl, "_blank");

        toastSuccess("CSV File downloaded successfully!");
      } else {
        toastInfo(response?.message);
      }
    } catch (error) {
      console.log("fetch all Log data", error.message);

      toastError("Failed to download the CSV file. Please try again.");
    }
  };

  useEffect(() => {
    if (onPaginationChange) {
      onPaginationChange(pagination);
      setLocalGoTo(pagination.pageIndex + 1);
    }
  }, [pagination]);

  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    initialState: { pageIndex: 0, pageSize: 10 },
    state: {
      columnFilters,
      globalFilter,
      rowSelection,
      pagination,
    },
    manualPagination: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    pageCount,
    getRowCanExpand: row => row.original.subOrders?.length > 0,
    // getPaginationRowModel: getPaginationRowModel(),
    // globalFilterFn: fuzzyFilter,
  });

  return (
    <div className="overflow-x-auto ">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden ">
          <table className="min-w-[350px] w-full bg-white rounded-lg shadow-md my-6 mx-auto text-sm">
            <thead className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded-t-lg">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="table-tr">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} scope="col" className=" table-th ">
                      <span className="block whitespace-nowrap">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                      {header.column.getCanFilter() ? (
                        <div className="mt-1 ml-[-2px]">
                          <Filter column={header.column} table={table} />
                        </div>
                      ) : null}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`table-tr ${row.original.isSubOrder ? 'bg-gray-200' : ''} ${
                      onRowClick ? 'cursor-pointer hover:bg-blue-50 hover:shadow-sm transition-all duration-200' : ''
                    }`}
                    onClick={() => onRowClick && onRowClick(row)}
                    title={onRowClick ? 'Click to view details' : ''}
                    {...(getRowProps ? getRowProps(row) : {})}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="table-td">
                        <span className="block whitespace-nowrap">{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                      </td>
                    ))}
                  </tr>
                ))
              ) : tableDataLoading ? (
                <tr className="table-tr">
                  <td className="table-td" colSpan={100}>
                    <div className="text-lg font-bold" style={{ textAlign: "center" }}>
                      <Loading />
                    </div>
                  </td>
                </tr>
              ) : (
                <tr className="table-tr">
                  <td className="table-td" colSpan={100}>
                    <p className="text-lg font-bold" style={{ textAlign: "center" }}>
                      No Data Found
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="md:flex md:space-y-0 space-y-5 justify-between mx-3 my-3 items-center">
        <div className=" flex items-center space-x-3 rtl:space-x-reverse">
          <select
            className="form-control py-2 w-max"
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[10, 20, 30].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
          <span className="text-sm font-medium text-slate-300">
            Page{" "}
            <span>
              {table.getState().pagination.pageIndex + 1} of {table.getPageCount().toLocaleString()}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1 ">
          <span className="flex items-center gap-1 text-sm font-medium ">
            | Go to page:
            <input
              type="number"
              value={localGoTo}
              onChange={(e) => {
                const newValue = e.target.value;
                setLocalGoTo(newValue);
                if (newValue) {
                  const page = Number(newValue) - 1;
                  if (page >= 0 && page < pageCount) {
                    table.setPageIndex(page);
                  }
                }
              }}
              min={1}
              max={table.getPageCount()}
              className="border p-1 rounded w-16 text-slate-900"
            />
          </span>
          <ul className="flex items-center  space-x-3  rtl:space-x-reverse">
            <li className="text-xl leading-4 text-slate-900 dark:text-white rtl:rotate-180">
              <button
                className={` ${!table.getCanPreviousPage() ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => table.firstPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <Icon icon="heroicons:chevron-double-left-solid" />
              </button>
            </li>
            <li className="text-sm leading-4 text-slate-900 dark:text-white rtl:rotate-180">
              <button
                className={` ${!table.getCanPreviousPage() ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Prev
              </button>
            </li>
            {/* {pageOptions.map((page, pageIdx) => (
              <li key={pageIdx}>
                <button
                  href="#"
                  aria-current="page"
                  className={` ${
                    pageIdx === pageIndex
                      ? "bg-slate-900 dark:bg-slate-600  dark:text-slate-200 text-white font-medium "
                      : "bg-slate-100 dark:bg-slate-700 dark:text-slate-400 text-slate-900  font-normal  "
                  }    text-sm rounded leading-[16px] flex h-6 w-6 items-center justify-center transition-all duration-150`}
                  onClick={() => gotoPage(pageIdx)}
                >
                  {page + 1}
                </button>
              </li>
            ))} */}
            <li className="text-sm leading-4 text-slate-900 dark:text-white rtl:rotate-180">
              <button
                className={`${!table.getCanNextPage() ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </button>
            </li>
            <li className="text-xl leading-4 text-slate-900 dark:text-white rtl:rotate-180">
              <button
                className={` ${!table.getCanNextPage() ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => table.lastPage()}
                disabled={!table.getCanNextPage()}
              >
                <Icon icon="heroicons:chevron-double-right-solid" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TableServerPagination;
