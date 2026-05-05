'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { useUserContext } from '@/context/user-context';
import { cn } from "@/lib/utils";
import {
    ArrowLeft,
    History,
    Package,
    ArrowRight,
    Loader2,
    Clock
} from 'lucide-react';

export default function SimpleHistoryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptIdParam = searchParams.get('deptId');
    const { user } = useUserContext();
    const supabase = createClient();

    const [isLoading, setIsLoading] = useState(true);
    const [existingRequests, setExistingRequests] = useState<any[]>([]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/inventory-requests');
            const data = await res.json();
            if (data.requests) {
                setExistingRequests(data.requests);
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredRequests = useMemo(() => {
        return existingRequests.filter(r => {
            const matchesDept = !deptIdParam || r.action_metadata?.requesting_department_id === deptIdParam;
            // For non-admins, only show their own requests if no dept filter
            const isOwner = r.requested_by === user?.id;
            return matchesDept || isOwner;
        });
    }, [existingRequests, deptIdParam, user]);

    if (isLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium animate-pulse">Loading history...</p>
            </div>
        );
    }

    return (
        <div className="space-y-12 pb-20">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-12 text-white">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-primary/20 rounded-full blur-[100px]" />
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <Button 
                            variant="ghost" 
                            className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="h-5 w-5 mr-2" />
                            Back
                        </Button>
                        <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary px-4 py-1 rounded-full font-black text-[10px] uppercase tracking-widest">
                            Stock Request History
                        </Badge>
                    </div>
                    <h1 className="text-5xl font-black mb-4 tracking-tight">Request History</h1>
                    <p className="text-xl text-slate-400 max-w-2xl font-medium leading-relaxed">
                        View the status of your department's stock requests.
                    </p>
                </div>
            </div>

            {/* History Table */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                            {deptIdParam ? `Requests for ${existingRequests.find(r => r.action_metadata?.requesting_department_id === deptIdParam)?.action_metadata?.requesting_department_name || 'Department'}` : 'Recent Requests'}
                        </h2>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead className="py-6 pl-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Request Info</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Item</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Route</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Quantity</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRequests.map((req) => (
                                <TableRow key={req.id} className="group hover:bg-slate-50/30 transition-colors border-slate-50">
                                    <TableCell className="py-5 pl-8">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-800 text-sm">
                                                #{req.id.slice(0, 8).toUpperCase()}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                {new Date(req.created_at).toLocaleDateString(undefined, { 
                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                                                })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                                <Package className="h-5 w-5 text-slate-300" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-700 text-sm tracking-tight">{req.item?.name || 'Unknown Item'}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{req.item?.code || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-500">{req.action_metadata?.source_warehouse_name || 'Store'}</span>
                                            <ArrowRight className="h-3 w-3 text-slate-300" />
                                            <span className="text-xs font-black text-primary">
                                                {req.action_metadata?.requesting_department_name || req.requester?.department || 'Department'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-lg font-black text-slate-800">{req.requested_quantity}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{req.item?.unit?.name || 'Units'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge 
                                            className={cn(
                                                "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                                                req.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                req.status === 'PENDING' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                "bg-slate-50 text-slate-600 border-slate-100"
                                            )}
                                            variant="outline"
                                        >
                                            {req.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredRequests.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center">
                                                <Clock className="h-8 w-8 text-slate-200" />
                                            </div>
                                            <p className="text-slate-400 font-bold">No history found for the selected department.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
