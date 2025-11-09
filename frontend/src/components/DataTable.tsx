import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

export type DataTableProps<T extends object> = {
  columns: ColumnDef<T, any>[];
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
};
export function DataTable<T extends object>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const totalPages = total && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const startIdx = total && page && pageSize ? Math.min(total, (page - 1) * pageSize + 1) : undefined;
  const endIdx = total && page && pageSize ? Math.min(total, page * pageSize) : undefined;

  return (
    <div className="rounded-xl border bg-white w-full overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th key={header.id} className="px-3 py-2 text-left font-medium">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages && page && pageSize && onPageChange && (
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-gray-600">
          <span>
            Mostrando {total === 0 ? 0 : startIdx}–{endIdx} de {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded border px-2 py-1"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span>
              Página {page} / {totalPages}
            </span>
            <button
              className="rounded border px-2 py-1"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
