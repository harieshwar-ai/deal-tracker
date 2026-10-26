import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, OnChangeFn, SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './ui/button'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { cn } from '../lib/cn'

export function MarketTable<T>({
  data,
  columns,
  getRowId,
  sorting,
  onSortingChange,
  page,
  pageSize = 20,
  onPageChange,
  density,
  renderCard,
  caption,
  empty,
}: {
  data: T[]
  // TanStack's column value type is invariant, so a mixed table cannot name one value type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[]
  getRowId: (row: T) => string
  sorting: SortingState
  onSortingChange: (sorting: SortingState) => void
  page: number
  pageSize?: number
  onPageChange: (page: number) => void
  density: 'comfortable' | 'compact'
  renderCard: (row: T) => ReactNode
  caption: string
  empty: ReactNode
}) {
  const pageCount = Math.max(1, Math.ceil(data.length / pageSize))
  const pageIndex = Math.min(Math.max(page, 1), pageCount) - 1
  const handleSorting: OnChangeFn<SortingState> = (updater) => {
    onSortingChange(typeof updater === 'function' ? updater(sorting) : updater)
  }
  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination: { pageIndex, pageSize } },
    onSortingChange: handleSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
  })
  const rows = table.getRowModel().rows
  if (data.length === 0) return <>{empty}</>

  const pad = density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'

  return (
    <div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <div key={row.id}>{renderCard(row.original)}</div>
        ))}
      </div>
      <div className="hidden max-h-[70vh] overflow-auto rounded-xl border border-line md:block">
        <Table className="w-max min-w-[72rem]">
          <TableCaption>{caption}</TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="border-t-0">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  return (
                    <TableHead
                      key={header.id}
                      className={pad}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : canSort ? 'none' : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-left"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                          {sorted === 'desc' ? <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                          {sorted === false ? <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden="true" /> : null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cn(pad, 'whitespace-nowrap', density === 'compact' ? 'text-[13px]' : undefined)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
        <p>
          {data.length} {data.length === 1 ? 'row' : 'rows'}
          {pageCount > 1 ? ` · page ${pageIndex + 1} of ${pageCount}` : ''}
        </p>
        {pageCount > 1 ? (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={pageIndex === 0} onClick={() => onPageChange(pageIndex)}>
              Previous
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={pageIndex + 1 >= pageCount} onClick={() => onPageChange(pageIndex + 2)}>
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
