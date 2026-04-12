import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Callers: [AdminPage, UsersPage, CategoriesPage, db, recycle]
 * Callees: []
 * Description: Handles the table layout component for the application.
 * Keywords: table, ui, component, auto-annotated
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

/**
 * Callers: [AdminPage, UsersPage, CategoriesPage, db, recycle]
 * Callees: []
 * Description: Handles the table header layout component for the application.
 * Keywords: tableheader, ui, component, auto-annotated
 */
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

/**
 * Callers: [AdminPage, UsersPage, CategoriesPage, db, recycle]
 * Callees: []
 * Description: Handles the table body layout component for the application.
 * Keywords: tablebody, ui, component, auto-annotated
 */
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

/**
 * Callers: []
 * Callees: []
 * Description: Handles the table footer layout component for the application.
 * Keywords: tablefooter, ui, component, auto-annotated
 */
const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

/**
 * Callers: [AdminPage, UsersPage, CategoriesPage, db, recycle]
 * Callees: []
 * Description: Handles the table row layout component for the application.
 * Keywords: tablerow, ui, component, auto-annotated
 */
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

/**
 * Callers: [AdminPage, UsersPage, CategoriesPage, db, recycle]
 * Callees: []
 * Description: Handles the table head layout component for the application.
 * Keywords: tablehead, ui, component, auto-annotated
 */
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

/**
 * Callers: [AdminPage, UsersPage, CategoriesPage, db, recycle]
 * Callees: []
 * Description: Handles the table cell layout component for the application.
 * Keywords: tablecell, ui, component, auto-annotated
 */
const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
      className
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

/**
 * Callers: []
 * Callees: []
 * Description: Handles the table caption layout component for the application.
 * Keywords: tablecaption, ui, component, auto-annotated
 */
const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
