import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";
import Filter from "./Filter";
import { mkConfig, generateCsv, download } from "export-to-csv";
import Icon from "@/components/ui/Icon";
import Textinput from "@/components/ui/Textinput";

const fuzzyFilter = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);

  addMeta({
    itemRank,
  });

  return itemRank.passed;
};
const AdvancedTable = ({ columns, tableData, csvFileName, additionalCsvData=[] }) => {
  const data = useMemo(() => [...tableData], [tableData]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const csvConfig = mkConfig({
    fieldSeparator: ",",
    filename: csvFileName??"CSV-Download",
    decimalSeparator: ".",
    useKeysAsHeaders: true,
  });

  const exportExcel = (rows) => {
    const rowData = rows.map((row) => row.original);
    const mergedData = [...rowData, ...additionalCsvData]
    const csv = generateCsv(csvConfig)(mergedData);
    download(csvConfig)(csv);
  };

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
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // globalFilterFn: fuzzyFilter,
  });

  return (
    <div className="border border-slate-800 rounded-lg bg-gray-600">
      <div className="flex justify-between items-center md:flex-row flex-col gap-2 px-5 py-3">
        <button
          type="button"
          className="border border-slate-300 rounded-[999px] text-sm p-2 inline-flex items-center"
          onClick={() => exportExcel(table.getFilteredRowModel().rows)}
        >
          Export CSV <Icon icon="ic:sharp-download" width={18} />
        </button>
        <Textinput
          value={globalFilter || ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="Search..."
        />
      </div>
      <div className="overflow-x-auto ">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden ">
            <table
              className="min-w-full divide-y divide-slate-100 table-fixed dark:divide-slate-700"
              // {...getTableProps}
            >
              <thead className=" border-t border-slate-800 bg-blue-500">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="table-tr">
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} scope="col" className=" table-th ">
                        <span className="block whitespace-nowrap">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}</span>
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
              <tbody className="bg-white divide-y divide-slate-100 dark:bg-slate-800 dark:divide-slate-700">
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="table-tr">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="table-td">
                          <span className="block whitespace-nowrap">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr className="table-tr">
                    <td className="table-td" colSpan={100}>
                      <p className="text-lg font-bold" style={{textAlign:"center"}}>No Data Found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
              {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount().toLocaleString()}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1 ">
          <span className="flex items-center gap-1 text-sm font-medium ">
            | Go to page:
            <input
              type="number"
              defaultValue={table.getState().pagination.pageIndex + 1}
              onChange={(e) => {
                const page = e.target.value ? Number(e.target.value) - 1 : 0;
                table.setPageIndex(page);
              }}
              min={1}
              max={table.getPageCount()}
              className="border p-1 rounded w-16 text-slate-900"
            />
          </span>
          <ul className="flex items-center  space-x-3  rtl:space-x-reverse">
            <li className="text-xl leading-4 text-slate-900 dark:text-white rtl:rotate-180">
              <button
                className={` ${
                  !table.getCanPreviousPage()
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
                onClick={() => table.firstPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <Icon icon="heroicons:chevron-double-left-solid" />
              </button>
            </li>
            <li className="text-sm leading-4 text-slate-900 dark:text-white rtl:rotate-180">
              <button
                className={` ${
                  !table.getCanPreviousPage()
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
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
                className={` ${
                  !table.getCanNextPage() ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </button>
            </li>
            <li className="text-xl leading-4 text-slate-900 dark:text-white rtl:rotate-180">
              <button
                className={` ${
                  !table.getCanNextPage() ? "opacity-50 cursor-not-allowed" : ""
                }`}
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

export default AdvancedTable;


