'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Clock, Save, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface OtSettings {
  id: string;
  calculation_method: 'multiplier' | 'flat_rate';
  ot_multiplier: number;
  flat_rate_per_hour: number;
  standard_hours_per_day: number;
  requires_manager_approval: boolean;
  max_ot_hours_per_month: number;
}

interface UserLimit {
  id: string;
  name: string;
  job_title?: string;
  department?: string;
  limit_id: string | null;
  max_ot_hours_per_month: number;
}

export default function OtSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Global settings form state
  const [method, setMethod] = useState<'multiplier' | 'flat_rate'>('multiplier');
  const [multiplier, setMultiplier] = useState('1.5');
  const [flatRate, setFlatRate] = useState('0');
  const [hoursPerDay, setHoursPerDay] = useState('8');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [globalMax, setGlobalMax] = useState('0');

  // Per-user limits
  const [users, setUsers] = useState<UserLimit[]>([]);
  const [limitInputs, setLimitInputs] = useState<Record<string, string>>({});
  const [savingLimits, setSavingLimits] = useState<Record<string, boolean>>({});
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetch('/api/hrms/ot-settings')
      .then(r => r.json())
      .then(d => {
        if (d.settings) {
          const s = d.settings as OtSettings;
          setMethod(s.calculation_method);
          setMultiplier(String(s.ot_multiplier));
          setFlatRate(String(s.flat_rate_per_hour));
          setHoursPerDay(String(s.standard_hours_per_day));
          setRequiresApproval(s.requires_manager_approval);
          setGlobalMax(String(s.max_ot_hours_per_month ?? 0));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchUsers = () => {
    setLoadingUsers(true);
    fetch('/api/hrms/ot-user-limits')
      .then(r => r.json())
      .then(d => {
        const list: UserLimit[] = d.users ?? [];
        setUsers(list);
        const inputs: Record<string, string> = {};
        list.forEach(u => { inputs[u.id] = String(u.max_ot_hours_per_month); });
        setLimitInputs(inputs);
      })
      .finally(() => setLoadingUsers(false));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/hrms/ot-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculation_method: method,
          ot_multiplier: Number(multiplier),
          flat_rate_per_hour: Number(flatRate),
          standard_hours_per_day: Number(hoursPerDay),
          requires_manager_approval: requiresApproval,
          max_ot_hours_per_month: Number(globalMax),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: 'OT Settings Saved' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLimit = async (userId: string) => {
    setSavingLimits(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch('/api/hrms/ot-user-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, max_ot_hours_per_month: Number(limitInputs[userId] ?? 0) }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: 'Limit Saved', description: 'OT hour limit updated for this employee.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSavingLimits(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Preview calculation
  const exampleBasic = 100000;
  const exampleWorkingDays = 22;
  const exampleOtHours = 3;
  const hourlyRate = exampleBasic / exampleWorkingDays / Number(hoursPerDay || 8);
  const previewPay = method === 'multiplier'
    ? hourlyRate * Number(multiplier || 1) * exampleOtHours
    : Number(flatRate || 0) * exampleOtHours;

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Clock className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-headline font-bold">OT Settings</h1>
          <p className="text-muted-foreground text-sm">Configure overtime pay calculation, approval flow, and per-employee limits.</p>
        </div>
      </div>

      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global">Global Settings</TabsTrigger>
          <TabsTrigger value="limits" onClick={fetchUsers}>
            <Users className="h-3.5 w-3.5 mr-1" /> Employee Limits
          </TabsTrigger>
        </TabsList>

        {/* ── Global Settings ── */}
        <TabsContent value="global">
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Calculation Method</CardTitle>
                <CardDescription>How OT pay is computed for each approved hour.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={method} onValueChange={v => setMethod(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiplier">Hourly Rate × Multiplier (e.g. 1.5×)</SelectItem>
                      <SelectItem value="flat_rate">Flat Rate per OT Hour (fixed LKR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {method === 'multiplier' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>OT Multiplier</Label>
                      <Input type="number" step="0.1" min="1" max="5" value={multiplier} onChange={e => setMultiplier(e.target.value)} placeholder="1.5" />
                      <p className="text-xs text-muted-foreground">1.5 = time-and-a-half, 2.0 = double time</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Standard Hours / Day</Label>
                      <Input type="number" step="0.5" min="1" max="24" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} placeholder="8" />
                      <p className="text-xs text-muted-foreground">Used to derive hourly rate from daily salary</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Flat Rate per OT Hour (LKR)</Label>
                    <Input type="number" step="1" min="0" value={flatRate} onChange={e => setFlatRate(e.target.value)} placeholder="500" />
                  </div>
                )}

                <div className="rounded-lg bg-muted/40 p-4 text-sm space-y-1 border">
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Preview (example employee)</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Basic Salary</span><span>LKR 100,000</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Working Days</span><span>22 days</span></div>
                  {method === 'multiplier' && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Hourly Rate</span><span>LKR {hourlyRate.toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">OT Hours</span><span>3 hours</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1 text-blue-600">
                    <span>OT Pay</span><span>LKR {previewPay.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Approval Flow</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Require Manager Approval (Step 1)</p>
                    <p className="text-xs text-muted-foreground">Manager approves first, then admin does final approval.</p>
                  </div>
                  <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Default OT Hours Limit</CardTitle>
                <CardDescription>Maximum OT hours per employee per month. Set 0 for no limit. Individual employee limits override this.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Input type="number" step="0.5" min="0" value={globalMax} onChange={e => setGlobalMax(e.target.value)} className="w-32" placeholder="0" />
                  <span className="text-sm text-muted-foreground">hours / month &nbsp;(0 = no limit)</span>
                </div>
              </CardContent>
            </Card>

            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </form>
        </TabsContent>

        {/* ── Per-User Limits ── */}
        <TabsContent value="limits">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-Employee OT Limits</CardTitle>
              <CardDescription>Set a maximum OT hours per month for each employee. 0 = use global default.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingUsers ? (
                <p className="text-sm text-muted-foreground py-10 text-center">Loading employees...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Max OT Hours / Month</TableHead>
                      <TableHead className="text-right">Save</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.job_title}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.department || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number" step="0.5" min="0"
                              value={limitInputs[u.id] ?? '0'}
                              onChange={e => setLimitInputs(prev => ({ ...prev, [u.id]: e.target.value }))}
                              className="w-24 h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">h (0 = global default)</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="h-7 px-3 text-xs"
                            disabled={savingLimits[u.id]}
                            onClick={() => handleSaveLimit(u.id)}>
                            {savingLimits[u.id] ? 'Saving...' : 'Save'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
