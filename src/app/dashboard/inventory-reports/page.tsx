'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { Calendar as CalendarIcon, FileBarChart, ArrowUpCircle, ArrowDownCircle, AlertCircle, TrendingUp, Download, Loader2 } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InventoryTransaction } from '@/lib/types';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { usePagination } from '@/hooks/use-pagination';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { createClient } from '@/lib/supabase/client';

export default function InventoryReportsPage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  
  const supabase = createClient();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase.from('users').select('role, department').eq('id', user.id).single();
        setUserRole(userData?.role || null);
        setUserDepartment(userData?.department || null);
      }
    };
    getUser();
  }, [supabase]);

  useEffect(() => {
    if (userRole && userRole !== 'admin' && userDepartment && warehouses.length > 0) {
      const userWh = warehouses.find(w => 
         w.name.toLowerCase().includes(userDepartment.toLowerCase()) || 
         (w.department && w.department.name?.toLowerCase() === userDepartment.toLowerCase())
      );
      if (userWh) {
        setSelectedDepartment(userWh.id);
      }
    }
  }, [userRole, userDepartment, warehouses]);

  const fetchReportData = async (range: DateRange | undefined) => {
    if (!range?.from) return;
    setIsLoading(true);
    try {
      const startStr = range.from.toISOString();
      const endStr = (range.to || range.from).toISOString();
      
      const [resTx, resWh] = await Promise.all([
        fetch(`/api/admin/inventory-transactions?limit=5000&startDate=${startStr}&endDate=${endStr}`),
        fetch('/api/admin/inventory/warehouses')
      ]);
      
      const dataTx = await resTx.json();
      const dataWh = await resWh.json();
      
      if (dataTx.error) throw new Error(dataTx.error);
      
      setTransactions(dataTx.transactions || []);
      setWarehouses(dataWh.warehouses || []);
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData(date);
  }, [date]);

  // Quick Filters
  const setFilter = (type: 'week' | 'month' | 'year' | 'last30') => {
    const now = new Date();
    switch (type) {
      case 'week':
        setDate({ from: startOfWeek(now), to: endOfWeek(now) });
        break;
      case 'month':
        setDate({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case 'year':
        setDate({ from: startOfYear(now), to: endOfYear(now) });
        break;
      case 'last30':
        setDate({ from: subDays(now, 30), to: now });
        break;
    }
  };

  const filteredTransactions = useMemo(() => {
    if (selectedDepartment === 'all') return transactions;
    
    return transactions.filter(tx => {
      // For general filtering, include if the department is involved in any way
      const deptId = tx.department_id;
      const fromDept = tx.from_department_id;
      const toDept = tx.to_department_id;
      const refDept = tx.reference_department; // Legacy support
      
      if (selectedDepartment === 'none') {
        return (!deptId && !fromDept && !toDept && !refDept) || deptId === 'none' || refDept === 'none';
      }
      return deptId === selectedDepartment || fromDept === selectedDepartment || toDept === selectedDepartment || refDept === selectedDepartment;
    });
  }, [transactions, selectedDepartment]);

  // Metrics Calculation
  const metrics = useMemo(() => {
    let received = 0;
    let receivedCost = 0;
    let issued = 0;
    let issuedCost = 0;
    let damaged = 0;
    let damagedCost = 0;
    
    filteredTransactions.forEach(tx => {
      const unitPrice = tx.unit_price || tx.batch?.buying_price || 0;
      const cost = tx.quantity * unitPrice;

      // Handle Receives
      if (['receive', 'initial_stock'].includes(tx.transaction_type)) {
        if (selectedDepartment === 'all' || tx.department_id === selectedDepartment) {
          received += tx.quantity;
          receivedCost += cost;
        }
      } 
      // Handle Issues
      else if (tx.transaction_type === 'issue') {
        if (selectedDepartment === 'all' || tx.department_id === selectedDepartment || tx.from_department_id === selectedDepartment) {
          issued += tx.quantity;
          issuedCost += cost;
        }
      } 
      // Handle Damages
      else if (tx.transaction_type === 'damage') {
        if (selectedDepartment === 'all' || tx.department_id === selectedDepartment || tx.from_department_id === selectedDepartment) {
          damaged += tx.quantity;
          damagedCost += cost;
        }
      }
      // Handle Transfers
      else if (tx.transaction_type === 'transfer') {
        if (selectedDepartment !== 'all') {
          // If a specific department is selected, count transfers IN as receives, and transfers OUT as issues.
          if (tx.to_department_id === selectedDepartment) {
            received += tx.quantity;
            receivedCost += cost;
          }
          if (tx.from_department_id === selectedDepartment) {
            issued += tx.quantity;
            issuedCost += cost;
          }
        }
        // If 'all' is selected, internal transfers shouldn't affect the net overall Hotel Received/Issued counts.
      }
    });

    return { received, receivedCost, issued, issuedCost, damaged, damagedCost };
  }, [filteredTransactions, selectedDepartment]);

  // Department-wise Issues
  const departmentIssues = useMemo(() => {
    const deps: Record<string, { name: string; quantity: number; cost: number }> = {};
    
    filteredTransactions.forEach(tx => {
      if (tx.transaction_type === 'issue' || (tx.transaction_type === 'transfer' && selectedDepartment === 'all')) {
        const unitPrice = tx.unit_price || tx.batch?.buying_price || 0;
        const cost = tx.quantity * unitPrice;
        
        let deptId = tx.department_id || tx.from_department_id || tx.reference_department || 'unknown';
        let deptName = 'Unknown Department';
        
        if (deptId !== 'none' && deptId !== 'unknown') {
            const wh = warehouses.find(w => w.id === deptId);
            if (wh) deptName = wh.name;
        } else {
            deptName = 'Internal Use / General';
        }

        if (!deps[deptId]) {
            deps[deptId] = { name: deptName, quantity: 0, cost: 0 };
        }
        
        deps[deptId].quantity += tx.quantity;
        deps[deptId].cost += cost;
      }
    });

    return Object.values(deps).sort((a, b) => b.cost - a.cost);
  }, [filteredTransactions, warehouses, selectedDepartment]);

  // Chart Data Preparation (Group by Date)
  const chartData = useMemo(() => {
    const dailyData: Record<string, { date: string; in: number; out: number; damaged: number }> = {};
    
    filteredTransactions.forEach(tx => {
      if (!tx.created_at) return;
      const dateStr = format(new Date(tx.created_at), 'MMM dd');
      
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { date: dateStr, in: 0, out: 0, damaged: 0 };
      }
      
      if (['receive', 'initial_stock'].includes(tx.transaction_type)) {
        if (selectedDepartment === 'all' || tx.department_id === selectedDepartment) {
          dailyData[dateStr].in += tx.quantity;
        }
      } else if (tx.transaction_type === 'issue') {
        if (selectedDepartment === 'all' || tx.department_id === selectedDepartment || tx.from_department_id === selectedDepartment) {
          dailyData[dateStr].out += tx.quantity;
        }
      } else if (tx.transaction_type === 'damage') {
        if (selectedDepartment === 'all' || tx.department_id === selectedDepartment || tx.from_department_id === selectedDepartment) {
          dailyData[dateStr].damaged += tx.quantity;
        }
      } else if (tx.transaction_type === 'transfer' && selectedDepartment !== 'all') {
         if (tx.to_department_id === selectedDepartment) {
            dailyData[dateStr].in += tx.quantity;
         }
         if (tx.from_department_id === selectedDepartment) {
            dailyData[dateStr].out += tx.quantity;
         }
      }
    });

    const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a + ' 2024').getTime() - new Date(b + ' 2024').getTime());
    return sortedDates.map(date => dailyData[date]);
  }, [filteredTransactions, selectedDepartment]);

  const displayTransactions = useMemo(() => {
    return filteredTransactions.filter(tx => tx.transaction_type !== 'initial_stock');
  }, [filteredTransactions]);

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(displayTransactions, 15);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'receive': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Stock In</Badge>;
      case 'issue': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">Issued</Badge>;
      case 'transfer': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-none">Transfer</Badge>;
      case 'damage': return <Badge variant="destructive">Damaged</Badge>;
      case 'audit_adjustment': return <Badge variant="outline">Adjustment</Badge>;
      case 'initial_stock': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-none">Initial</Badge>;
      default: return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-900 flex items-center gap-3">
            <FileBarChart className="h-8 w-8 text-primary" />
            Inventory Reports
          </h1>
          <p className="text-muted-foreground">Comprehensive overview of stock movements, intake, and issues.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select 
            value={selectedDepartment} 
            onValueChange={setSelectedDepartment}
            disabled={userRole !== 'admin' && userRole !== null}
          >
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="none">Internal Use / General</SelectItem>
              {warehouses.map(wh => (
                <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setFilter('week')}>This Week</Button>
          <Button variant="outline" size="sm" onClick={() => setFilter('month')}>This Month</Button>
          <Button variant="outline" size="sm" onClick={() => setFilter('year')}>This Year</Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                size="sm"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="default" className="bg-primary" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-100 bg-green-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-green-700">Total Stock Received</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-700">{metrics.received} <span className="text-sm font-normal">units</span></div>
            <p className="text-sm text-green-800 mt-2 font-bold bg-green-100/50 inline-block px-2 py-0.5 rounded">
              LKR {metrics.receivedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-100 bg-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-blue-700">Total Stock Issued</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-700">{metrics.issued} <span className="text-sm font-normal">units</span></div>
            <p className="text-sm text-blue-800 mt-2 font-bold bg-blue-100/50 inline-block px-2 py-0.5 rounded">
              LKR {metrics.issuedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-100 bg-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-red-700">Damaged / Spoiled</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-red-700">{metrics.damaged} <span className="text-sm font-normal">units</span></div>
            <p className="text-sm text-red-800 mt-2 font-bold bg-red-100/50 inline-block px-2 py-0.5 rounded">
              LKR {metrics.damagedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Stock Movement Trends
            </CardTitle>
            <CardDescription>Daily intake and issue comparison for the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="in" name="Stock In" stroke="#16a34a" strokeWidth={2} fillOpacity={1} fill="url(#colorIn)" />
                    <Area type="monotone" dataKey="out" name="Stock Out" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorOut)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground italic">
                No trend data available for this period.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <FileBarChart className="h-5 w-5 text-primary" />
              Department-wise Issues
            </CardTitle>
            <CardDescription>Breakdown of stock consumed by department.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : departmentIssues.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground italic">
                No issues recorded for this period.
              </div>
            ) : (
              <div className="rounded-md border bg-white overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentIssues.map((dept, index) => (
                      <TableRow key={index} className="hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-slate-800">{dept.name}</TableCell>
                        <TableCell className="text-right">{dept.quantity}</TableCell>
                        <TableCell className="text-right font-bold text-slate-700">
                          {dept.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold">Transaction Log</CardTitle>
          <CardDescription>Detailed history of all stock movements.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-white overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[180px]">Date & Time</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Batch / Exp</TableHead>
                  <TableHead className="text-center">Change</TableHead>
                  <TableHead className="text-center">Balance</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">Loading transactions...</TableCell>
                  </TableRow>
                ) : paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No transactions found for the selected period.</TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {tx.created_at ? format(new Date(tx.created_at), "yyyy-MM-dd HH:mm") : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-sm text-slate-800">
                          {(tx.item as any)?.name || tx.remarks}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                          {(tx.item as any)?.category?.name || 'Uncategorized'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getTypeBadge(tx.transaction_type)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-[11px] font-mono text-slate-600">
                          {tx.batch?.batch_number || tx.batch_number || '-'}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {tx.batch?.expiry_date ? format(new Date(tx.batch.expiry_date), "MMM dd, yyyy") : '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-black text-sm ${['receive', 'initial_stock'].includes(tx.transaction_type) ? 'text-green-600' : 'text-red-600'}`}>
                          {['receive', 'initial_stock'].includes(tx.transaction_type) ? '+' : '-'}{tx.quantity}
                          <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">{(tx.item as any)?.unit?.name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-bold font-mono">
                        {tx.new_stock ?? '-'}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-xs text-muted-foreground" title={tx.remarks}>
                          {tx.remarks || '-'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {!isLoading && transactions.length > 0 && (
            <div className="mt-4">
              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
