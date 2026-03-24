'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    BarChart3,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    Download,
    DollarSign,
    Package,
    Search,
    TrendingDown,
} from 'lucide-react';
import type { HotelInventoryItem, InventoryDepartment } from '@/lib/types';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';

// Extended type — the API returns category + unit on the joined item
type InventoryTransactionFull = {
    id: string;
    item_id: string;
    item?: { name: string; unit: string; category: string };
    transaction_type: string;
    quantity: number;
    previous_stock?: number;
    new_stock?: number;
    reference_department?: string;
    reason?: string;
    remarks?: string;
    user?: { name: string };
    created_at?: string;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function StockStatusBadge({ item }: { item: HotelInventoryItem }) {
    const isCritical = item.current_stock <= item.safety_stock;
    const isLow = item.current_stock <= item.reorder_level;
    if (isCritical) return <Badge className="bg-red-100 text-red-700 border-red-200">Critical</Badge>;
    if (isLow) return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Needs Reorder</Badge>;
    return <Badge className="bg-green-100 text-green-700 border-green-200">Healthy</Badge>;
}

function txnTypeLabel(type: string) {
    const labels: Record<string, string> = {
        receive: 'Receive',
        issue: 'Issue',
        damage: 'Damage',
        audit_adjustment: 'Audit Adjustment',
        initial_stock: 'Initial Stock',
    };
    return labels[type] || type;
}

function txnTypeBadge(type: string) {
    if (['receive', 'initial_stock'].includes(type))
        return <Badge className="bg-green-100 text-green-700 border-green-200">{txnTypeLabel(type)}</Badge>;
    if (['issue', 'damage'].includes(type))
        return <Badge className="bg-red-100 text-red-700 border-red-200">{txnTypeLabel(type)}</Badge>;
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200">{txnTypeLabel(type)}</Badge>;
}

const SkeletonRows = ({ cols }: { cols: number }) => (
    <>
        {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
                <TableCell colSpan={cols}><Skeleton className="h-8 w-full" /></TableCell>
            </TableRow>
        ))}
    </>
);

const PAGE_SIZE = 15;

function ExpandableDepartmentCell({ item }: { item: any }) {
    const [isOpen, setIsOpen] = useState(false);
    
    if (item.isGrouped && item.departmentBreakdown) {
        return (
            <div>
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex text-left items-center gap-2 w-full max-w-[200px] text-sm font-medium hover:text-primary transition-colors group"
                >
                    <span>{item.departmentBreakdown.length} Departments</span>
                    {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                </button>
                {isOpen && (
                    <div className="flex flex-col gap-1 pl-3 border-l-2 border-muted mt-2 mb-1">
                        {item.departmentBreakdown.map((d: any) => (
                            <div key={d.deptName} className="text-xs text-muted-foreground flex justify-between gap-4 max-w-[180px]">
                                <span className="font-medium text-foreground">{d.deptName}</span>
                                <span className="shrink-0">{d.stock}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    return <span className="text-sm">{item.department?.name}</span>;
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function InventoryReportsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [items, setItems] = useState<HotelInventoryItem[]>([]);
    const [transactions, setTransactions] = useState<InventoryTransactionFull[]>([]);
    const [departments, setDepartments] = useState<InventoryDepartment[]>([]);

    // filters
    const [stockSearch, setStockSearch] = useState('');
    const [stockDept, setStockDept] = useState('all');
    const [txnSearch, setTxnSearch] = useState('');
    const [txnType, setTxnType] = useState('all');
    const [costDept, setCostDept] = useState('all');

    // Month/Year period filter for transactions
    const currentDate = new Date();
    const [filterYear, setFilterYear] = useState<string>('all');
    const [filterMonth, setFilterMonth] = useState<string>('all');

    const years = Array.from({ length: 5 }, (_, i) => String(currentDate.getFullYear() - i));
    const months = [
        { value: '1', label: 'January' }, { value: '2', label: 'February' },
        { value: '3', label: 'March' }, { value: '4', label: 'April' },
        { value: '5', label: 'May' }, { value: '6', label: 'June' },
        { value: '7', label: 'July' }, { value: '8', label: 'August' },
        { value: '9', label: 'September' }, { value: '10', label: 'October' },
        { value: '11', label: 'November' }, { value: '12', label: 'December' },
    ];

    // Compute date range from year/month selectors
    const computeDateRange = (year: string, month: string) => {
        if (year === 'all') return { from: '', to: '' };
        const y = parseInt(year);
        if (month === 'all') {
            return { from: `${y}-01-01`, to: `${y}-12-31` };
        }
        const m = parseInt(month);
        const lastDay = new Date(y, m, 0).getDate();
        return {
            from: `${y}-${String(m).padStart(2, '0')}-01`,
            to: `${y}-${String(m).padStart(2, '0')}-${lastDay}`,
        };
    };

    const applyPreset = (preset: 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'all') => {
        const now = new Date();
        if (preset === 'all') {
            setFilterYear('all'); setFilterMonth('all');
            fetchData('', '');
        } else if (preset === 'this_month') {
            const y = String(now.getFullYear()); const m = String(now.getMonth() + 1);
            setFilterYear(y); setFilterMonth(m);
            const { from, to } = computeDateRange(y, m); fetchData(from, to);
        } else if (preset === 'last_month') {
            const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const y = String(d.getFullYear()); const m = String(d.getMonth() + 1);
            setFilterYear(y); setFilterMonth(m);
            const { from, to } = computeDateRange(y, m); fetchData(from, to);
        } else if (preset === 'this_year') {
            const y = String(now.getFullYear());
            setFilterYear(y); setFilterMonth('all');
            fetchData(`${y}-01-01`, `${y}-12-31`);
        } else if (preset === 'last_year') {
            const y = String(now.getFullYear() - 1);
            setFilterYear(y); setFilterMonth('all');
            fetchData(`${y}-01-01`, `${y}-12-31`);
        }
    };

    const handleYearChange = (y: string) => {
        setFilterYear(y);
        setFilterMonth('all');
        const { from, to } = computeDateRange(y, 'all');
        fetchData(from, to);
    };

    const handleMonthChange = (m: string) => {
        setFilterMonth(m);
        const y = filterYear === 'all' ? String(currentDate.getFullYear()) : filterYear;
        if (filterYear === 'all') setFilterYear(y);
        const { from, to } = computeDateRange(y, m);
        fetchData(from, to);
    };

    const periodLabel = useMemo(() => {
        if (filterYear === 'all') return 'All Time';
        const mLabel = filterMonth === 'all' ? '' : months.find(m => m.value === filterMonth)?.label + ' ';
        return `${mLabel}${filterYear}`;
    }, [filterYear, filterMonth]);

    const fetchData = async (from = '', to = '') => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (from) params.set('date_from', from);
            if (to) params.set('date_to', to);
            const res = await fetch(`/api/admin/inventory-reports?${params}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setItems(data.items || []);
            setTransactions(data.transactions || []);
            setDepartments(data.departments || []);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load report data.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Stock Overview ────────────────────────────────────────────────────────
    const filteredStockItems = useMemo(() => {
        let filtered = items.filter(item => {
            const matchSearch = item.name.toLowerCase().includes(stockSearch.toLowerCase());
            const matchDept = stockDept === 'all' || item.department_id === stockDept;
            return matchSearch && matchDept;
        });

        if (stockDept === 'all') {
            const grouped = new Map<string, HotelInventoryItem & { isGrouped?: boolean, departmentBreakdown?: { deptName: string; stock: number }[] }>();
            filtered.forEach(item => {
                const key = `${item.name}_${item.category}_${item.unit}`;
                if (grouped.has(key)) {
                    const existing = grouped.get(key)!;
                    existing.current_stock += item.current_stock;
                    existing.safety_stock += item.safety_stock;
                    existing.reorder_level += item.reorder_level;
                    existing.maximum_level += item.maximum_level;
                    existing.departmentBreakdown!.push({
                        deptName: item.department?.name || 'Unknown',
                        stock: item.current_stock
                    });
                } else {
                    grouped.set(key, {
                        ...item,
                        isGrouped: true,
                        departmentBreakdown: [{
                            deptName: item.department?.name || 'Unknown',
                            stock: item.current_stock
                        }]
                    });
                }
            });
            filtered = Array.from(grouped.values());
        }

        return filtered;
    }, [items, stockSearch, stockDept]);

    const stockPagination = usePagination(filteredStockItems, PAGE_SIZE);

    const stockStats = useMemo(() => ({
        total: items.length,
        critical: items.filter(i => i.current_stock <= i.safety_stock).length,
        low: items.filter(i => i.current_stock <= i.reorder_level && i.current_stock > i.safety_stock).length,
        healthy: items.filter(i => i.current_stock > i.reorder_level).length,
    }), [items]);

    // Reset stock page when filters change
    useEffect(() => { stockPagination.setCurrentPage(1); }, [stockSearch, stockDept]);

    const handleExportStock = () => {
        exportCSV('stock-overview.csv',
            ['Item', 'Category', 'Department', 'Unit', 'Current Stock', 'Safety Stock', 'Reorder Level', 'Max Level', 'Status'],
            filteredStockItems.map(item => {
                const isCritical = item.current_stock <= item.safety_stock;
                const isLow = item.current_stock <= item.reorder_level;
                
                const deptStr = (item as any).isGrouped && (item as any).departmentBreakdown
                    ? ((item as any).departmentBreakdown as { deptName: string; stock: number }[]).map(d => `${d.deptName}: ${d.stock}`).join(' | ')
                    : item.department?.name || '';

                return [
                    item.name, item.category, deptStr, item.unit,
                    item.current_stock, item.safety_stock, item.reorder_level, item.maximum_level,
                    isCritical ? 'Critical' : isLow ? 'Needs Reorder' : 'Healthy',
                ];
            })
        );
    };

    // ── Transaction History ───────────────────────────────────────────────────
    const filteredTxns = useMemo(() => transactions.filter(txn => {
        const matchSearch = txn.item?.name?.toLowerCase().includes(txnSearch.toLowerCase()) || false;
        const matchType = txnType === 'all' || txn.transaction_type === txnType;
        return matchSearch && matchType;
    }), [transactions, txnSearch, txnType]);

    const txnPagination = usePagination(filteredTxns, PAGE_SIZE);

    // Reset txn page when filters change
    useEffect(() => { txnPagination.setCurrentPage(1); }, [txnSearch, txnType]);




    const handleExportTxn = () => {
        exportCSV('transaction-history.csv',
            ['Date', 'Item', 'Type', 'Quantity', 'Previous Stock', 'New Stock', 'Reason', 'Performed By'],
            filteredTxns.map(txn => [
                format(new Date(txn.created_at!), 'yyyy-MM-dd HH:mm'),
                txn.item?.name || '', txnTypeLabel(txn.transaction_type), txn.quantity,
                txn.previous_stock ?? '', txn.new_stock ?? '',
                txn.reason || txn.remarks || '', txn.user?.name || '',
            ])
        );
    };

    // ── Low Stock Alerts ──────────────────────────────────────────────────────
    const lowStockItems = useMemo(() =>
        items
            .filter(i => i.current_stock <= i.reorder_level)
            .sort((a, b) => {
                const aCritical = a.current_stock <= a.safety_stock ? 0 : 1;
                const bCritical = b.current_stock <= b.safety_stock ? 0 : 1;
                if (aCritical !== bCritical) return aCritical - bCritical;
                return (a.current_stock - a.reorder_level) - (b.current_stock - b.reorder_level);
            }),
        [items]
    );

    const lowStockPagination = usePagination(lowStockItems, PAGE_SIZE);

    const handleExportLowStock = () => {
        exportCSV('low-stock-alerts.csv',
            ['Item', 'Department', 'Current Stock', 'Safety Stock', 'Reorder Level', 'Deficit', 'Status'],
            lowStockItems.map(item => [
                item.name, item.department?.name || '',
                `${item.current_stock} ${item.unit}`,
                item.safety_stock, item.reorder_level,
                item.reorder_level - item.current_stock,
                item.current_stock <= item.safety_stock ? 'Critical' : 'Needs Reorder',
            ])
        );
    };

    // ── Cost Analysis ─────────────────────────────────────────────────────────
    const costItems = useMemo(() =>
        items
            .filter(i => costDept === 'all' || i.department_id === costDept)
            .map(i => ({ ...i, stockValue: (i.buying_price || 0) * i.current_stock }))
            .sort((a, b) => b.stockValue - a.stockValue),
        [items, costDept]
    );

    const costPagination = usePagination(costItems, PAGE_SIZE);

    // Reset cost page when filter changes
    useEffect(() => { costPagination.setCurrentPage(1); }, [costDept]);

    const totalValue = useMemo(() => costItems.reduce((sum, i) => sum + i.stockValue, 0), [costItems]);

    const deptBreakdown = useMemo(() => {
        const map: Record<string, { name: string; value: number; count: number }> = {};
        costItems.forEach(i => {
            const key = i.department_id;
            if (!map[key]) map[key] = { name: i.department?.name || 'Unknown', value: 0, count: 0 };
            map[key].value += i.stockValue;
            map[key].count += 1;
        });
        return Object.values(map).sort((a, b) => b.value - a.value);
    }, [costItems]);

    const handleExportCost = () => {
        exportCSV('cost-analysis.csv',
            ['Item', 'Category', 'Department', 'Unit', 'Buying Price (LKR)', 'Current Stock', 'Stock Value (LKR)'],
            costItems.map(i => [
                i.name, i.category, i.department?.name || '', i.unit,
                i.buying_price, i.current_stock, i.stockValue.toFixed(2),
            ])
        );
    };

    // ─── render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Inventory Reports</h1>
                <p className="text-muted-foreground">Comprehensive insights into stock levels, movements, and valuations.</p>
            </div>

            <Tabs defaultValue="stock-overview">
                <TabsList className="grid grid-cols-4 w-full max-w-2xl">
                    <TabsTrigger value="stock-overview" className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Stock
                    </TabsTrigger>
                    <TabsTrigger value="transactions" className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" /> Transactions
                    </TabsTrigger>
                    <TabsTrigger value="low-stock" className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Alerts
                    </TabsTrigger>
                    <TabsTrigger value="cost-analysis" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" /> Cost
                    </TabsTrigger>
                </TabsList>

                {/* ── Tab 1: Stock Overview ─────────────────────────────────── */}
                <TabsContent value="stock-overview" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Items', value: stockStats.total, color: 'text-foreground', icon: <Package className="h-5 w-5 text-muted-foreground" /> },
                            { label: 'Healthy', value: stockStats.healthy, color: 'text-green-600', icon: <ArrowUp className="h-5 w-5 text-green-600" /> },
                            { label: 'Needs Reorder', value: stockStats.low, color: 'text-orange-500', icon: <TrendingDown className="h-5 w-5 text-orange-500" /> },
                            { label: 'Critical Stock', value: stockStats.critical, color: 'text-red-600', icon: <AlertTriangle className="h-5 w-5 text-red-600" /> },
                        ].map(card => (
                            <Card key={card.label}>
                                <CardContent className="pt-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground">{card.label}</p>
                                            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                                        </div>
                                        {card.icon}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search items…" className="pl-8" value={stockSearch} onChange={e => setStockSearch(e.target.value)} />
                        </div>
                        <Select value={stockDept} onValueChange={setStockDept}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={handleExportStock} className="gap-2">
                            <Download className="h-4 w-4" /> Export CSV
                        </Button>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Current Stock</TableHead>
                                    <TableHead>Safety / Reorder</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <SkeletonRows cols={5} /> :
                                    stockPagination.paginatedItems.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No items found.</TableCell></TableRow>
                                    ) : stockPagination.paginatedItems.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-muted-foreground">{item.category}</div>
                                            </TableCell>
                                            <TableCell>
                                                <ExpandableDepartmentCell item={item} />
                                            </TableCell>
                                            <TableCell>
                                                <span className={`font-bold ${item.current_stock <= item.safety_stock ? 'text-red-600' : item.current_stock <= item.reorder_level ? 'text-orange-500' : ''}`}>
                                                    {item.current_stock}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs text-muted-foreground">Safety: {item.safety_stock} {item.unit}</div>
                                                <div className="text-xs text-muted-foreground">Reorder: {item.reorder_level} {item.unit}</div>
                                            </TableCell>
                                            <TableCell><StockStatusBadge item={item} /></TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                        {!isLoading && (
                            <DataTablePagination
                                currentPage={stockPagination.currentPage}
                                totalPages={stockPagination.totalPages}
                                totalItems={stockPagination.totalItems}
                                itemsPerPage={stockPagination.itemsPerPage}
                                onPageChange={stockPagination.setCurrentPage}
                            />
                        )}
                    </div>
                </TabsContent>

                {/* ── Tab 2: Transaction History ───────────────────────────── */}
                <TabsContent value="transactions" className="space-y-4 mt-4">

                    <div className="flex flex-wrap gap-2 items-center">
                        {/* Quick Presets */}
                        <div className="flex flex-wrap gap-1.5">
                            {(['all', 'this_month', 'last_month', 'this_year', 'last_year'] as const).map(preset => {
                                const labels: Record<string, string> = {
                                    all: 'All Time', this_month: 'This Month',
                                    last_month: 'Last Month', this_year: 'This Year', last_year: 'Last Year'
                                };
                                const isActive =
                                    preset === 'all' ? filterYear === 'all' :
                                        preset === 'this_month' ? filterYear === String(currentDate.getFullYear()) && filterMonth === String(currentDate.getMonth() + 1) :
                                            preset === 'last_month' ? (() => { const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1); return filterYear === String(d.getFullYear()) && filterMonth === String(d.getMonth() + 1); })() :
                                                preset === 'this_year' ? filterYear === String(currentDate.getFullYear()) && filterMonth === 'all' :
                                                    filterYear === String(currentDate.getFullYear() - 1) && filterMonth === 'all';
                                return (
                                    <Button key={preset} size="sm" variant={isActive ? 'default' : 'outline'}
                                        className="h-8 text-xs" onClick={() => applyPreset(preset)}>
                                        {labels[preset]}
                                    </Button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2 ml-auto flex-wrap">
                            {/* Year picker */}
                            <Select value={filterYear} onValueChange={handleYearChange}>
                                <SelectTrigger className="w-[110px] h-9">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Years</SelectItem>
                                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {/* Month picker */}
                            <Select value={filterMonth} onValueChange={handleMonthChange}>
                                <SelectTrigger className="w-[130px] h-9">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Months</SelectItem>
                                    {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Second filter row: search + type + export */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 min-w-[160px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search item name…" className="pl-8" value={txnSearch} onChange={e => setTxnSearch(e.target.value)} />
                        </div>
                        <Select value={txnType} onValueChange={setTxnType}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="receive">Receive</SelectItem>
                                <SelectItem value="issue">Issue</SelectItem>
                                <SelectItem value="damage">Damage</SelectItem>
                                <SelectItem value="audit_adjustment">Audit Adjustment</SelectItem>
                                <SelectItem value="initial_stock">Initial Stock</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{periodLabel}</span>
                            <span>· {filteredTxns.length} record{filteredTxns.length !== 1 ? 's' : ''}</span>
                        </div>
                        <Button variant="outline" onClick={handleExportTxn} className="gap-2 ml-auto">
                            <Download className="h-4 w-4" /> Export CSV
                        </Button>
                    </div>

                    {/* ── Charts Section ── */}
                    {!isLoading && (() => {
                        // Aggregated stats from ALL filtered transactions (not just current page)
                        const received = filteredTxns.filter(t => ['receive', 'initial_stock'].includes(t.transaction_type));
                        const issued = filteredTxns.filter(t => t.transaction_type === 'issue');
                        const damaged = filteredTxns.filter(t => t.transaction_type === 'damage');
                        const audited = filteredTxns.filter(t => t.transaction_type === 'audit_adjustment');

                        const sumQty = (arr: typeof filteredTxns) => arr.reduce((s, t) => s + Math.abs(t.quantity), 0);

                        const receivedQty = sumQty(received);
                        const issuedQty = sumQty(issued);
                        const damagedQty = sumQty(damaged);
                        const auditedQty = sumQty(audited);

                        // Pie data — counts of each type
                        const pieData = [
                            { name: 'Received', value: received.length, fill: '#22c55e' },
                            { name: 'Issued', value: issued.length, fill: '#3b82f6' },
                            { name: 'Damaged', value: damaged.length, fill: '#ef4444' },
                            { name: 'Audit Adj', value: audited.length, fill: '#f59e0b' },
                        ].filter(d => d.value > 0);

                        // Bar data — top 8 most-transacted items
                        const itemQtyMap: Record<string, { received: number; issued: number; damaged: number }> = {};
                        filteredTxns.forEach(t => {
                            const name = t.item?.name || 'Unknown';
                            if (!itemQtyMap[name]) itemQtyMap[name] = { received: 0, issued: 0, damaged: 0 };
                            if (['receive', 'initial_stock'].includes(t.transaction_type)) itemQtyMap[name].received += t.quantity;
                            if (t.transaction_type === 'issue') itemQtyMap[name].issued += t.quantity;
                            if (t.transaction_type === 'damage') itemQtyMap[name].damaged += t.quantity;
                        });
                        const barData = Object.entries(itemQtyMap)
                            .map(([name, v]) => ({ name: name.length > 14 ? name.slice(0, 13) + '…' : name, ...v }))
                            .sort((a, b) => (b.received + b.issued + b.damaged) - (a.received + a.issued + a.damaged))
                            .slice(0, 8);

                        if (filteredTxns.length === 0) return null;

                        return (
                            <>
                                {/* Stat cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {[
                                        { label: 'Total Transactions', value: filteredTxns.length, color: 'text-foreground', bg: '' },
                                        { label: 'Received (qty)', value: receivedQty, color: 'text-green-600', bg: 'bg-green-50' },
                                        { label: 'Issued (qty)', value: issuedQty, color: 'text-blue-600', bg: 'bg-blue-50' },
                                        { label: 'Damaged (qty)', value: damagedQty, color: 'text-red-600', bg: 'bg-red-50' },
                                        { label: 'Audit Adj (qty)', value: auditedQty, color: 'text-amber-600', bg: 'bg-amber-50' },
                                    ].map(c => (
                                        <Card key={c.label} className={c.bg}>
                                            <CardContent className="pt-4 pb-3">
                                                <p className="text-xs text-muted-foreground">{c.label}</p>
                                                <p className={`text-2xl font-bold mt-0.5 ${c.color}`}>{c.value.toLocaleString()}</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                {/* Pie + Bar side-by-side */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Pie chart — transaction type distribution */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-semibold">Transaction Type Distribution</CardTitle>
                                            <CardDescription className="text-xs">Count of transactions by type ({periodLabel})</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={{
                                                Received: { label: 'Received', color: '#22c55e' },
                                                Issued: { label: 'Issued', color: '#3b82f6' },
                                                Damaged: { label: 'Damaged', color: '#ef4444' },
                                                'Audit Adj': { label: 'Audit Adj', color: '#f59e0b' },
                                            }} className="h-[220px]">
                                                <PieChart>
                                                    <Pie data={pieData} dataKey="value" nameKey="name"
                                                        cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                                                        paddingAngle={3} label={({ name, percent }) =>
                                                            percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                                                        }>
                                                        {pieData.map((entry, i) => (
                                                            <Cell key={i} fill={entry.fill} stroke="transparent" />
                                                        ))}
                                                    </Pie>
                                                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                                                </PieChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>

                                    {/* Bar chart — top items by quantity */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-semibold">Top Items by Quantity</CardTitle>
                                            <CardDescription className="text-xs">Received vs Issued vs Damaged ({periodLabel})</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={{
                                                received: { label: 'Received', color: '#22c55e' },
                                                issued: { label: 'Issued', color: '#3b82f6' },
                                                damaged: { label: 'Damaged', color: '#ef4444' },
                                            }} className="h-[220px]">
                                                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                                                    <YAxis tick={{ fontSize: 10 }} />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Bar dataKey="received" fill="#22c55e" radius={[3, 3, 0, 0]} />
                                                    <Bar dataKey="issued" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                                    <Bar dataKey="damaged" fill="#ef4444" radius={[3, 3, 0, 0]} />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        );
                    })()}

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date & Time</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Stock Change</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Performed By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <SkeletonRows cols={7} /> :
                                    txnPagination.paginatedItems.length === 0 ? (
                                        <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No transactions found.</TableCell></TableRow>
                                    ) : txnPagination.paginatedItems.map(txn => {
                                        const isIncrease = ['receive', 'initial_stock'].includes(txn.transaction_type);
                                        const isDecrease = ['issue', 'damage'].includes(txn.transaction_type);
                                        return (
                                            <TableRow key={txn.id}>
                                                <TableCell className="whitespace-nowrap">
                                                    <div>{format(new Date(txn.created_at!), 'dd MMM yyyy')}</div>
                                                    <div className="text-xs text-muted-foreground">{format(new Date(txn.created_at!), 'HH:mm')}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{txn.item?.name}</div>
                                                    <div className="text-xs text-muted-foreground">{txn.item?.category}</div>
                                                </TableCell>
                                                <TableCell>{txnTypeBadge(txn.transaction_type)}</TableCell>
                                                <TableCell>
                                                    <span className={`font-semibold ${isIncrease ? 'text-green-600' : isDecrease ? 'text-red-600' : 'text-blue-600'}`}>
                                                        {isIncrease ? '+' : isDecrease ? '-' : '±'}{Math.abs(txn.quantity)} {txn.item?.unit}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {txn.previous_stock !== undefined && txn.new_stock !== undefined ? (
                                                        <div className="flex items-center gap-1 text-sm">
                                                            <span>{txn.previous_stock}</span>
                                                            {isIncrease ? <ArrowUp className="h-3 w-3 text-green-600" /> : <ArrowDown className="h-3 w-3 text-red-600" />}
                                                            <span className="font-semibold">{txn.new_stock}</span>
                                                        </div>
                                                    ) : <span className="text-muted-foreground text-xs">–</span>}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{txn.reason || txn.remarks || '–'}</TableCell>
                                                <TableCell className="text-sm">{txn.user?.name || '–'}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                            </TableBody>
                        </Table>
                        {!isLoading && (
                            <DataTablePagination
                                currentPage={txnPagination.currentPage}
                                totalPages={txnPagination.totalPages}
                                totalItems={txnPagination.totalItems}
                                itemsPerPage={txnPagination.itemsPerPage}
                                onPageChange={txnPagination.setCurrentPage}
                            />
                        )}
                    </div>
                </TabsContent>

                {/* ── Tab 3: Low Stock Alerts ──────────────────────────────── */}
                <TabsContent value="low-stock" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} require attention.
                        </p>
                        <Button variant="outline" onClick={handleExportLowStock} className="gap-2">
                            <Download className="h-4 w-4" /> Export CSV
                        </Button>
                    </div>

                    {!isLoading && lowStockItems.length === 0 && (
                        <Card>
                            <CardContent className="py-16 text-center text-muted-foreground">
                                <Package className="h-10 w-10 mx-auto mb-4 opacity-30" />
                                <p className="font-medium">All stock levels are healthy!</p>
                                <p className="text-sm">No items are at or below their reorder level.</p>
                            </CardContent>
                        </Card>
                    )}

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Current Stock</TableHead>
                                    <TableHead>Safety Stock</TableHead>
                                    <TableHead>Reorder Level</TableHead>
                                    <TableHead>Deficit</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <SkeletonRows cols={7} /> :
                                    lowStockPagination.paginatedItems.length === 0 ? null :
                                        lowStockPagination.paginatedItems.map(item => {
                                            const deficit = item.reorder_level - item.current_stock;
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium">{item.name}</TableCell>
                                                    <TableCell>{item.department?.name}</TableCell>
                                                    <TableCell>
                                                        <span className={`font-bold ${item.current_stock <= item.safety_stock ? 'text-red-600' : 'text-orange-500'}`}>
                                                            {item.current_stock} {item.unit}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{item.safety_stock} {item.unit}</TableCell>
                                                    <TableCell className="text-muted-foreground">{item.reorder_level} {item.unit}</TableCell>
                                                    <TableCell>
                                                        <span className="font-semibold text-red-600">+{deficit} {item.unit} needed</span>
                                                    </TableCell>
                                                    <TableCell><StockStatusBadge item={item} /></TableCell>
                                                </TableRow>
                                            );
                                        })}
                            </TableBody>
                        </Table>
                        {!isLoading && lowStockItems.length > 0 && (
                            <DataTablePagination
                                currentPage={lowStockPagination.currentPage}
                                totalPages={lowStockPagination.totalPages}
                                totalItems={lowStockPagination.totalItems}
                                itemsPerPage={lowStockPagination.itemsPerPage}
                                onPageChange={lowStockPagination.setCurrentPage}
                            />
                        )}
                    </div>
                </TabsContent>

                {/* ── Tab 4: Cost Analysis ─────────────────────────────────── */}
                <TabsContent value="cost-analysis" className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="sm:col-span-1">
                            <CardHeader className="pb-2">
                                <CardDescription>Total Inventory Value</CardDescription>
                                <CardTitle className="text-2xl flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-primary" />
                                    LKR {totalValue.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">Based on buying price × current stock quantity.</p>
                            </CardContent>
                        </Card>

                        <Card className="sm:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">By Department</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
                                ) : (
                                    <div className="space-y-2">
                                        {deptBreakdown.map(dept => (
                                            <div key={dept.name} className="flex items-center justify-between text-sm">
                                                <span className="font-medium">{dept.name}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-muted-foreground text-xs">{dept.count} items</span>
                                                    <span className="font-semibold">LKR {dept.value.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex gap-3">
                        <Select value={costDept} onValueChange={setCostDept}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={handleExportCost} className="gap-2 ml-auto">
                            <Download className="h-4 w-4" /> Export CSV
                        </Button>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">Buying Price</TableHead>
                                    <TableHead className="text-right">Current Stock</TableHead>
                                    <TableHead className="text-right">Stock Value (LKR)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <SkeletonRows cols={6} /> :
                                    costPagination.paginatedItems.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No items found.</TableCell></TableRow>
                                    ) : costPagination.paginatedItems.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-muted-foreground">{item.category}</div>
                                            </TableCell>
                                            <TableCell>{item.department?.name}</TableCell>
                                            <TableCell>{item.unit}</TableCell>
                                            <TableCell className="text-right">
                                                {item.buying_price ? `LKR ${item.buying_price.toFixed(2)}` : <span className="text-muted-foreground text-xs">N/A</span>}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{item.current_stock}</TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {item.stockValue > 0
                                                    ? `LKR ${item.stockValue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
                                                    : <span className="text-muted-foreground text-xs">–</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                        {!isLoading && (
                            <DataTablePagination
                                currentPage={costPagination.currentPage}
                                totalPages={costPagination.totalPages}
                                totalItems={costPagination.totalItems}
                                itemsPerPage={costPagination.itemsPerPage}
                                onPageChange={costPagination.setCurrentPage}
                            />
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
