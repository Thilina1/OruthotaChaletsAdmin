'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Clock, History, LogIn, LogOut, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Attendance } from '@/lib/types';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

export default function AttendancePage() {
    const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
    const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const supabase = createClient();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [clocking, setClocking] = useState(false);
    const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
    const [editingRecord, setEditingRecord] = useState<Partial<Attendance> | null>(null);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const getUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                const data = await res.json();
                if (data.user) {
                    setUserId(data.user.id);
                    setUserRole(data.user.role);
                }
            } catch (e) {
                console.error("Failed to fetch user:", e);
            }
        };
        getUser();
    }, []);

    const fetchAttendance = async () => {
        setLoading(true);
        setError(null);

        if (!userId) return;

        try {
            // Fetch My Attendance
            const res = await fetch(`/api/hrms/attendance?userId=${userId}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const history: Attendance[] = data.attendance || [];
            setAttendanceHistory(history);

            // Set today's record
            const today = new Date().toISOString().split('T')[0];
            const todayRec = history.find(a => a.date === today);
            setTodayRecord(todayRec || null);

        } catch (error) {
            console.error("Error fetching attendance:", error);
            const msg = (error as Error).message;
            setError(msg);
            toast({ variant: 'destructive', title: "Error", description: msg });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchAttendance();
        }
    }, [userId]);

    const handleClockAction = async (action: 'clock_in' | 'clock_out') => {
        setClocking(true);
        try {
            // Optional: Get Location
            let lat, long;
            if (navigator.geolocation) {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });
                    lat = position.coords.latitude;
                    long = position.coords.longitude;
                } catch (e) {
                    console.log("Location access denied or timed out");
                }
            }

            const res = await fetch('/api/hrms/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    action,
                    latitude: lat,
                    longitude: long
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({ title: action === 'clock_in' ? "Clocked In" : "Clocked Out", description: `Successfully recorded at ${new Date().toLocaleTimeString()}` });
            fetchAttendance();

        } catch (error) {
            console.error(`Error ${action}:`, error);
            toast({ variant: 'destructive', title: "Error", description: (error as Error).message });
        } finally {
            setClocking(false);
        }
    };

    // Admin View Data
    const [adminViewData, setAdminViewData] = useState<Attendance[]>([]);

    const {
        currentPage: myCurrentPage,
        totalPages: myTotalPages,
        totalItems: myTotalItems,
        paginatedItems: myPaginatedItems,
        itemsPerPage: myItemsPerPage,
        setCurrentPage: setMyCurrentPage,
    } = usePagination(attendanceHistory, 20);

    const {
        currentPage: adminCurrentPage,
        totalPages: adminTotalPages,
        totalItems: adminTotalItems,
        paginatedItems: adminPaginatedItems,
        itemsPerPage: adminItemsPerPage,
        setCurrentPage: setAdminCurrentPage,
    } = usePagination(adminViewData, 20);

    useEffect(() => {
        if (userRole === 'admin') {
            const fetchAdminData = async () => {
                try {
                    const res = await fetch(`/api/hrms/attendance?date=${dateFilter}`);
                    const data = await res.json();
                    if (!data.error) {
                        setAdminViewData(data.attendance || []);
                    }
                } catch (e) { console.error(e); }
            };
            fetchAdminData();
        }
    }, [userRole, dateFilter]); // Refetch on date change

    if (error && error.includes('relation "attendance" does not exist')) {
        return (
            <div className="p-10 text-center space-y-4">
                <h2 className="text-2xl font-bold text-red-600">Setup Required</h2>
                <p className="text-gray-600">The <strong>attendance</strong> table does not exist in your database.</p>
                <div className="p-4 bg-gray-100 rounded-md text-left mx-auto max-w-2xl overflow-auto">
                    <p className="mb-2 font-semibold">Please run the following SQL in your Supabase Dashboard:</p>
                    <pre className="text-xs">
                        {`-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'half-day')),
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all attendance" ON attendance FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can view own attendance" ON attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attendance" ON attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attendance" ON attendance FOR UPDATE USING (auth.uid() = user_id);
`}
                    </pre>
                </div>
                <Button onClick={fetchAttendance}>I've ran the SQL, Try Again</Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="md:flex justify-between items-center space-y-4 md:space-y-0">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Attendance</h1>
                    <p className="text-muted-foreground">Track your work hours and attendance.</p>
                </div>
                {/* Mobile Friendly Clock In/Out Card */}
                <Card className="w-full md:w-auto bg-primary/5 border-primary/20">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-muted-foreground">Today, {new Date().toLocaleDateString()}</span>
                            {!todayRecord?.clock_in ? (
                                <span className="text-lg font-bold text-gray-500">Not Clocked In</span>
                            ) : !todayRecord?.clock_out ? (
                                <span className="text-lg font-bold text-green-600">Clocked In</span>
                            ) : (
                                <span className="text-lg font-bold text-blue-600">Completed</span>
                            )}
                        </div>
                        <div className="ml-auto">
                            {!todayRecord?.clock_in ? (
                                <Button size="lg" onClick={() => handleClockAction('clock_in')} disabled={clocking} className="w-32 bg-green-600 hover:bg-green-700">
                                    <LogIn className="mr-2 h-5 w-5" /> Clock In
                                </Button>
                            ) : !todayRecord?.clock_out ? (
                                <Button size="lg" onClick={() => handleClockAction('clock_out')} disabled={clocking} className="w-32 bg-red-600 hover:bg-red-700">
                                    <LogOut className="mr-2 h-5 w-5" /> Clock Out
                                </Button>
                            ) : (
                                <Button size="lg" disabled variant="outline" className="w-32">
                                    <CheckCircle className="mr-2 h-5 w-5" /> Done
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="my-attendance">
                <TabsList>
                    <TabsTrigger value="my-attendance">My History</TabsTrigger>
                    {userRole === 'admin' && <TabsTrigger value="daily-log">Daily Log (Admin)</TabsTrigger>}
                </TabsList>

                <TabsContent value="my-attendance" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>My Attendance History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Clock In</TableHead>
                                        <TableHead>Clock Out</TableHead>
                                        <TableHead>Hours</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(!myPaginatedItems || myPaginatedItems.length === 0) ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No records found.</TableCell></TableRow>
                                    ) : (
                                        myPaginatedItems.map(record => {
                                            const inTime = record.clock_in ? new Date(record.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                                            const outTime = record.clock_out ? new Date(record.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                                            let duration = '-';
                                            if (record.clock_in && record.clock_out) {
                                                const diff = new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime();
                                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                duration = `${hours}h ${minutes}m`;
                                            }

                                            return (
                                                <TableRow key={record.id}>
                                                    <TableCell>{record.date}</TableCell>
                                                    <TableCell>{inTime}</TableCell>
                                                    <TableCell>{outTime}</TableCell>
                                                    <TableCell>{duration}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="capitalize">{record.status}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                            <DataTablePagination
                                currentPage={myCurrentPage}
                                totalPages={myTotalPages}
                                totalItems={myTotalItems}
                                itemsPerPage={myItemsPerPage}
                                onPageChange={setMyCurrentPage}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {userRole === 'admin' && (
                    <TabsContent value="daily-log" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>Daily Attendance Log</CardTitle>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            className="border rounded p-1 text-sm"
                                            value={dateFilter}
                                            onChange={(e) => setDateFilter(e.target.value)}
                                        />
                                        <Button size="sm" onClick={() => setEditingRecord({} as any)}>Add Record</Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Clock In</TableHead>
                                            <TableHead>Clock Out</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(!adminPaginatedItems || adminPaginatedItems.length === 0) ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No records for this date.</TableCell></TableRow>
                                        ) : (
                                            adminPaginatedItems.map(record => (
                                                <TableRow key={record.id}>
                                                    <TableCell>{record.users?.name || 'Unknown'}</TableCell>
                                                    <TableCell>{record.clock_in ? new Date(record.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                                                    <TableCell>{record.clock_out ? new Date(record.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="capitalize">{record.status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => setEditingRecord(record)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                <DataTablePagination
                                    currentPage={adminCurrentPage}
                                    totalPages={adminTotalPages}
                                    totalItems={adminTotalItems}
                                    itemsPerPage={adminItemsPerPage}
                                    onPageChange={setAdminCurrentPage}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>

            {/* Admin Add/Edit Dialog */}
            {editingRecord && (
                <AttendanceDialog
                    record={editingRecord}
                    onClose={() => setEditingRecord(null)}
                    onSuccess={() => {
                        setEditingRecord(null);
                        // Refresh data
                        if (userRole === 'admin') {
                            const fetchAdminData = async () => {
                                try {
                                    const res = await fetch(`/api/hrms/attendance?date=${dateFilter}`);
                                    const data = await res.json();
                                    if (!data.error) setAdminViewData(data.attendance || []);
                                } catch (e) { console.error(e); }
                            };
                            fetchAdminData();
                        }
                    }}
                />
            )}
        </div>
    );
}

// Dialog Component for Adding/Editing Attendance
function AttendanceDialog({ record, onClose, onSuccess }: { record: Partial<Attendance>, onClose: () => void, onSuccess: () => void }) {
    const isEdit = !!record.id;
    const [employees, setEmployees] = useState<{ id: string, name: string }[]>([]);
    const [formData, setFormData] = useState({
        user_id: record.user_id || '',
        date: record.date || new Date().toISOString().split('T')[0],
        clock_in: record.clock_in ? new Date(record.clock_in).toTimeString().slice(0, 5) : '',
        clock_out: record.clock_out ? new Date(record.clock_out).toTimeString().slice(0, 5) : '',
        status: record.status || 'present'
    });
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        // Fetch employees for dropdown
        fetch('/api/admin/users').then(r => r.json()).then(d => {
            if (d.users) setEmployees(d.users);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const url = '/api/hrms/attendance';
            const method = isEdit ? 'PUT' : 'POST';

            // Construct payload
            const payload: any = {
                status: formData.status
            };

            // Format dates
            const datePrefix = formData.date;
            if (formData.clock_in) payload.clock_in = new Date(`${datePrefix}T${formData.clock_in}`).toISOString();
            if (formData.clock_out) payload.clock_out = new Date(`${datePrefix}T${formData.clock_out}`).toISOString();

            if (isEdit) {
                payload.id = record.id;
            } else {
                payload.action = 'admin_create';
                payload.user_id = formData.user_id;
                payload.date = formData.date;
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({ title: "Success", description: "Record saved successfully." });
            onSuccess();

        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: (error as Error).message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{isEdit ? 'Edit Attendance' : 'Add Attendance'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isEdit && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Employee</label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.user_id}
                                    onChange={e => setFormData({ ...formData, user_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Date</label>
                            <input
                                type="date"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                required
                                disabled={isEdit}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Clock In</label>
                                <input
                                    type="time"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.clock_in}
                                    onChange={e => setFormData({ ...formData, clock_in: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Clock Out</label>
                                <input
                                    type="time"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.clock_out}
                                    onChange={e => setFormData({ ...formData, clock_out: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status</label>
                            <select
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value as 'present' | 'absent' | 'half-day' })}
                            >
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="half-day">Half Day</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

// Icon for check circle
function CheckCircle({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="m9 11 3 3L22 4" />
        </svg>
    )
}
