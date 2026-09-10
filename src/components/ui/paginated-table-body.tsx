'use client';

import { Children, type ComponentProps, useState } from 'react';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

/** Paginate rendered row groups without changing the source data used by totals or exports. */
export function PaginatedTableBody({ children, pageSize = 10, showSinglePage = false, ...props }: ComponentProps<typeof TableBody> & { pageSize?: number; showSinglePage?: boolean }) {
    const rows = Children.toArray(children);
    const rowKeys = JSON.stringify(rows.map((row, index) => typeof row === 'object' && row !== null && 'key' in row ? row.key : index));
    const [pagination, setPagination] = useState({ rowKeys, page: 1 });
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const currentPage = pagination.rowKeys === rowKeys ? Math.min(pagination.page, totalPages) : 1;

    return (
        <TableBody {...props}>
            {rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
            {(rows.length > pageSize || (showSinglePage && rows.length > 0)) && (
                <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={1000} className="p-0">
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={rows.length}
                            itemsPerPage={pageSize}
                            onPageChange={page => setPagination({ rowKeys, page })}
                        />
                    </TableCell>
                </TableRow>
            )}
        </TableBody>
    );
}
