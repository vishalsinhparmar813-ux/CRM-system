import React from 'react'
import DebouncedInput from "./DebouncedInput"

function Filter({
    column,
    table,
  }) {
    const firstValue = table
      .getPreFilteredRowModel()
      .flatRows[0]?.getValue(column.id)
  
    const columnFilterValue = column.getFilterValue()
  
    const sortedUniqueValues = React.useMemo(
      () =>
        typeof firstValue === 'number'
          ? []
          : Array.from(column.getFacetedUniqueValues().keys()).sort(),
      [column.getFacetedUniqueValues()]
    )
  
    return typeof firstValue === 'number' ? (
      <>
        <div className="flex gap-1">
          <DebouncedInput
            type="number"
            min={Number(column.getFacetedMinMaxValues()?.[0] ?? '')}
            max={Number(column.getFacetedMinMaxValues()?.[1] ?? '')}
            value={(columnFilterValue)?.[0] ?? ''}
            onChange={value =>
              column.setFilterValue((old) => [value, old?.[1]])
            }
            placeholder={`Min ${
              column.getFacetedMinMaxValues()?.[0]
                ? `(${column.getFacetedMinMaxValues()?.[0]})`
                : ''
            }`}
            className="w-14 border shadow rounded"
          />
          <DebouncedInput
            type="number"
            min={Number(column.getFacetedMinMaxValues()?.[0] ?? '')}
            max={Number(column.getFacetedMinMaxValues()?.[1] ?? '')}
            value={(columnFilterValue)?.[1] ?? ''}
            onChange={value =>
              column.setFilterValue((old) => [old?.[0], value])
            }
            placeholder={`Max ${
              column.getFacetedMinMaxValues()?.[1]
                ? `(${column.getFacetedMinMaxValues()?.[1]})`
                : ''
            }`}
            className="w-14 border shadow rounded"
          />
        </div>
        <div className="h-1" />
      </>
    ) : (
      <>
        <datalist id={column.id + 'list'}>
          {sortedUniqueValues.slice(0, 5000).map((value) => (
            <option value={value} key={value} />
          ))}
        </datalist>
        <DebouncedInput
          type="text"
          value={(columnFilterValue ?? '')}
          onChange={value => column.setFilterValue(value)}
          placeholder={`Search... (${column.getFacetedUniqueValues().size})`}
          className="w-20 border shadow rounded"
          list={column.id + 'list'}
        />
        <div className="h-1" />
      </>
    )
}

export default Filter