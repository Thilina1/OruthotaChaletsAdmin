'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarCheck, ListChecks, MapPin, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/user-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

export type EventModule = 'registrations' | 'budget' | 'workflows';
type EventRecord = { id: string; name: string; event_type: string; location_id: string | null; venue: string | null; starts_at: string; ends_at: string | null; capacity: number; status: string; notes: string | null };
type EventLocation = { id: string; name: string; address: string | null; capacity: number; is_active: boolean };
type Registration = { id: string; guest_name: string; email: string | null; phone: string | null; guests: number; amount: number; payment_status: string; booking_status: string };
type BudgetItem = { id: string; category: string; description: string; budget_type: string; estimated_amount: number; actual_amount: number; payment_status: string };
type WorkflowTask = { id: string; title: string; stage: string; assigned_name: string | null; due_at: string | null; priority: string; status: string; automation_rule: string | null };

const moduleConfig = {
  registrations: { title: 'Registration & Booking', icon: CalendarCheck, add: 'Add Registration' },
  budget: { title: 'Budget & Financial Management', icon: Banknote, add: 'Add Budget Item' },
  workflows: { title: 'Workflow Automation', icon: ListChecks, add: 'Add Task' },
};

const emptyEvent = { name: '', event_type: 'private', location_id: '', starts_at: '', ends_at: '', capacity: '0', status: 'draft', notes: '' };
const emptyLocation = { name: '', address: '', capacity: '0' };
const emptyRegistration = { guest_name: '', email: '', phone: '', guests: '1', amount: '0', payment_status: 'unpaid', booking_status: 'confirmed' };
const emptyBudget = { category: '', description: '', budget_type: 'expense', estimated_amount: '0', actual_amount: '0', payment_status: 'planned' };
const emptyTask = { title: '', stage: 'planning', assigned_name: '', due_at: '', priority: 'medium', status: 'todo', automation_rule: '' };

export function EventManagementClient({ module }: { module: EventModule }) {
  const supabase = createClient();
  const { toast } = useToast();
  const { user } = useUserContext();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [locations, setLocations] = useState<EventLocation[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [records, setRecords] = useState<Array<Registration | BudgetItem | WorkflowTask>>([]);
  const [loading, setLoading] = useState(true);
  const [eventDialog, setEventDialog] = useState(false);
  const [locationDialog, setLocationDialog] = useState(false);
  const [recordDialog, setRecordDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [locationForm, setLocationForm] = useState(emptyLocation);
  const [registrationForm, setRegistrationForm] = useState(emptyRegistration);
  const [budgetForm, setBudgetForm] = useState(emptyBudget);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const config = moduleConfig[module];
  const ModuleIcon = config.icon;

  const loadEvents = useCallback(async () => {
    const [eventResult, locationResult] = await Promise.all([
      supabase.from('events').select('*').order('starts_at', { ascending: true }),
      supabase.from('event_locations').select('*').eq('is_active', true).order('name'),
    ]);
    const { data, error } = eventResult;
    if (error) {
      toast({ variant: 'destructive', title: 'Could not load events', description: error.message });
      setLoading(false);
      return;
    }
    const next = (data || []) as EventRecord[];
    setEvents(next);
    if (!locationResult.error) setLocations((locationResult.data || []) as EventLocation[]);
    setSelectedEventId(current => current && next.some(event => event.id === current) ? current : next[0]?.id || '');
    setLoading(false);
  }, [supabase, toast]);

  const loadRecords = useCallback(async () => {
    if (!selectedEventId) { setRecords([]); return; }
    const table = module === 'registrations' ? 'event_registrations' : module === 'budget' ? 'event_budget_items' : 'event_workflow_tasks';
    const orderColumn = module === 'workflows' ? 'due_at' : 'created_at';
    const { data, error } = await supabase.from(table).select('*').eq('event_id', selectedEventId).order(orderColumn, { ascending: module === 'workflows' });
    if (error) toast({ variant: 'destructive', title: 'Could not load records', description: error.message });
    else setRecords((data || []) as any[]);
  }, [module, selectedEventId, supabase, toast]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const selectedEvent = events.find(event => event.id === selectedEventId);
  const registrationSummary = useMemo(() => {
    const rows = records as Registration[];
    return { bookings: rows.length, guests: rows.reduce((sum, row) => sum + Number(row.guests), 0), revenue: rows.reduce((sum, row) => sum + Number(row.amount), 0) };
  }, [records]);
  const budgetSummary = useMemo(() => {
    const rows = records as BudgetItem[];
    const income = rows.filter(row => row.budget_type === 'income').reduce((sum, row) => sum + Number(row.actual_amount), 0);
    const expenses = rows.filter(row => row.budget_type === 'expense').reduce((sum, row) => sum + Number(row.actual_amount), 0);
    return { estimated: rows.reduce((sum, row) => sum + Number(row.estimated_amount), 0), income, expenses };
  }, [records]);
  const workflowSummary = useMemo(() => {
    const rows = records as WorkflowTask[];
    return { total: rows.length, active: rows.filter(row => row.status === 'in_progress').length, done: rows.filter(row => row.status === 'done').length };
  }, [records]);

  const createEvent = async () => {
    if (!eventForm.name.trim() || !eventForm.location_id || !eventForm.starts_at || !eventForm.ends_at) return toast({ variant: 'destructive', title: 'Name, location, start and end times are required' });
    if (new Date(eventForm.ends_at) <= new Date(eventForm.starts_at)) return toast({ variant: 'destructive', title: 'End time must be after the start time' });
    setSaving(true);
    const selectedLocation = locations.find(location => location.id === eventForm.location_id);
    const { data, error } = await supabase.from('events').insert({
      ...eventForm,
      capacity: Number(eventForm.capacity) || 0,
      venue: selectedLocation?.name || null,
      notes: eventForm.notes || null,
      created_by: user?.id || null,
    }).select().single();
    setSaving(false);
    if (error) {
      const conflict = error.code === '23P01' || error.message.toLowerCase().includes('events_location_schedule_no_overlap');
      return toast({ variant: 'destructive', title: conflict ? 'Location is already booked' : 'Event creation failed', description: conflict ? 'Choose another time or location. Events at the same location cannot overlap.' : error.message });
    }
    setEvents(current => [...current, data as EventRecord].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    setSelectedEventId(data.id);
    setEventDialog(false);
    setEventForm(emptyEvent);
    toast({ title: 'Event created' });
  };

  const createLocation = async () => {
    if (!locationForm.name.trim()) return toast({ variant: 'destructive', title: 'Location name is required' });
    setSaving(true);
    const { data, error } = await supabase.from('event_locations').insert({ name: locationForm.name.trim(), address: locationForm.address || null, capacity: Number(locationForm.capacity) || 0 }).select().single();
    setSaving(false);
    if (error) return toast({ variant: 'destructive', title: 'Location creation failed', description: error.message });
    setLocations(current => [...current, data as EventLocation].sort((a, b) => a.name.localeCompare(b.name)));
    setEventForm(current => ({ ...current, location_id: data.id, capacity: String(data.capacity || 0) }));
    setLocationForm(emptyLocation);
    setLocationDialog(false);
    toast({ title: 'Location added' });
  };

  const addRecord = async () => {
    if (!selectedEventId) return;
    setSaving(true);
    let table = 'event_registrations';
    let payload: Record<string, unknown> = { event_id: selectedEventId };
    if (module === 'registrations') {
      if (!registrationForm.guest_name.trim()) { setSaving(false); return toast({ variant: 'destructive', title: 'Guest name is required' }); }
      payload = { ...payload, ...registrationForm, guests: Number(registrationForm.guests), amount: Number(registrationForm.amount) };
    } else if (module === 'budget') {
      table = 'event_budget_items';
      if (!budgetForm.category.trim() || !budgetForm.description.trim()) { setSaving(false); return toast({ variant: 'destructive', title: 'Category and description are required' }); }
      payload = { ...payload, ...budgetForm, estimated_amount: Number(budgetForm.estimated_amount), actual_amount: Number(budgetForm.actual_amount) };
    } else {
      table = 'event_workflow_tasks';
      if (!taskForm.title.trim()) { setSaving(false); return toast({ variant: 'destructive', title: 'Task title is required' }); }
      payload = { ...payload, ...taskForm, due_at: taskForm.due_at || null, assigned_name: taskForm.assigned_name || null, automation_rule: taskForm.automation_rule || null };
    }
    const { error } = await supabase.from(table).insert(payload);
    setSaving(false);
    if (error) return toast({ variant: 'destructive', title: 'Could not save', description: error.message });
    setRecordDialog(false);
    setRegistrationForm(emptyRegistration); setBudgetForm(emptyBudget); setTaskForm(emptyTask);
    await loadRecords();
    toast({ title: 'Saved successfully' });
  };

  const updateStatus = async (id: string, status: string) => {
    const table = module === 'registrations' ? 'event_registrations' : module === 'budget' ? 'event_budget_items' : 'event_workflow_tasks';
    const column = module === 'registrations' ? 'booking_status' : module === 'budget' ? 'payment_status' : 'status';
    const { error } = await supabase.from(table).update({ [column]: status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    setRecords(current => current.map(row => row.id === id ? { ...row, [column]: status } : row));
  };

  const removeRecord = async (id: string) => {
    const table = module === 'registrations' ? 'event_registrations' : module === 'budget' ? 'event_budget_items' : 'event_workflow_tasks';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return toast({ variant: 'destructive', title: 'Delete failed', description: error.message });
    setRecords(current => current.filter(row => row.id !== id));
  };

  const summary = module === 'registrations'
    ? [{ label: 'Bookings', value: registrationSummary.bookings }, { label: 'Registered guests', value: registrationSummary.guests }, { label: 'Booking value', value: `LKR ${registrationSummary.revenue.toFixed(2)}` }]
    : module === 'budget'
      ? [{ label: 'Estimated total', value: `LKR ${budgetSummary.estimated.toFixed(2)}` }, { label: 'Actual income', value: `LKR ${budgetSummary.income.toFixed(2)}` }, { label: 'Actual expenses', value: `LKR ${budgetSummary.expenses.toFixed(2)}` }]
      : [{ label: 'Total tasks', value: workflowSummary.total }, { label: 'In progress', value: workflowSummary.active }, { label: 'Completed', value: workflowSummary.done }];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold"><ModuleIcon className="h-6 w-6" />{config.title}</h1><p className="text-sm text-muted-foreground">Plan and operate resort events from one shared workspace.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setLocationDialog(true)}><MapPin className="mr-2 h-4 w-4" />Add Location</Button><Button variant="outline" onClick={() => setEventDialog(true)}><Plus className="mr-2 h-4 w-4" />New Event</Button><Button onClick={() => setRecordDialog(true)} disabled={!selectedEventId}><Plus className="mr-2 h-4 w-4" />{config.add}</Button></div>
      </div>

      <div className="flex flex-col gap-3 border-y py-3 sm:flex-row sm:items-center">
        <Select value={selectedEventId} onValueChange={setSelectedEventId}><SelectTrigger className="w-full sm:w-[360px]"><SelectValue placeholder={loading ? 'Loading events...' : 'Select an event'} /></SelectTrigger><SelectContent>{events.map(event => <SelectItem key={event.id} value={event.id}>{event.name} · {new Date(event.starts_at).toLocaleDateString()}</SelectItem>)}</SelectContent></Select>
        {selectedEvent && <div className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="outline">{selectedEvent.status}</Badge><span>{selectedEvent.venue || 'Venue not set'}</span><span className="text-muted-foreground">{new Date(selectedEvent.starts_at).toLocaleString()}</span></div>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">{summary.map(item => <Card key={item.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-xl font-bold">{item.value}</p></CardContent></Card>)}</div>

      <Card><CardHeader className="pb-3"><CardTitle className="text-base">{selectedEvent?.name || 'No event selected'}</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><Table><TableHeader>{module === 'registrations' ? <TableRow><TableHead>Guest</TableHead><TableHead>Contact</TableHead><TableHead>Guests</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow> : module === 'budget' ? <TableRow><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead>Estimated</TableHead><TableHead>Actual</TableHead><TableHead>Status</TableHead><TableHead /></TableRow> : <TableRow><TableHead>Task</TableHead><TableHead>Stage</TableHead><TableHead>Owner</TableHead><TableHead>Due</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead /></TableRow>}</TableHeader><TableBody>{records.length === 0 ? <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">{selectedEventId ? 'No records yet.' : 'Create or select an event to begin.'}</TableCell></TableRow> : records.map(row => module === 'registrations' ? <RegistrationRow key={row.id} row={row as Registration} onStatus={updateStatus} onDelete={removeRecord} /> : module === 'budget' ? <BudgetRow key={row.id} row={row as BudgetItem} onStatus={updateStatus} onDelete={removeRecord} /> : <WorkflowRow key={row.id} row={row as WorkflowTask} onStatus={updateStatus} onDelete={removeRecord} />)}</TableBody></Table></CardContent></Card>

      <Dialog open={eventDialog} onOpenChange={setEventDialog}><DialogContent><DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Field label="Event name"><Input value={eventForm.name} onChange={e => setEventForm({ ...eventForm, name: e.target.value })} /></Field><Field label="Type"><Input value={eventForm.event_type} onChange={e => setEventForm({ ...eventForm, event_type: e.target.value })} /></Field><Field label="Location"><Select value={eventForm.location_id} onValueChange={location_id => { const location = locations.find(item => item.id === location_id); setEventForm({ ...eventForm, location_id, capacity: eventForm.capacity === '0' && location ? String(location.capacity) : eventForm.capacity }); }}><SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger><SelectContent>{locations.map(location => <SelectItem key={location.id} value={location.id}>{location.name}{location.capacity ? ` · ${location.capacity} guests` : ''}</SelectItem>)}</SelectContent></Select></Field><Field label="Capacity"><Input type="number" min="0" value={eventForm.capacity} onChange={e => setEventForm({ ...eventForm, capacity: e.target.value })} /></Field><Field label="Starts"><Input type="datetime-local" value={eventForm.starts_at} onChange={e => setEventForm({ ...eventForm, starts_at: e.target.value })} /></Field><Field label="Ends"><Input type="datetime-local" value={eventForm.ends_at} onChange={e => setEventForm({ ...eventForm, ends_at: e.target.value })} /></Field><div className="sm:col-span-2"><Field label="Notes"><Textarea value={eventForm.notes} onChange={e => setEventForm({ ...eventForm, notes: e.target.value })} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setEventDialog(false)}>Cancel</Button><Button onClick={createEvent} disabled={saving}>Create Event</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={locationDialog} onOpenChange={setLocationDialog}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Add Event Location</DialogTitle></DialogHeader><div className="space-y-3"><Field label="Location name"><Input value={locationForm.name} onChange={e => setLocationForm({ ...locationForm, name: e.target.value })} placeholder="e.g. Lakeside Lawn" /></Field><Field label="Address or area"><Input value={locationForm.address} onChange={e => setLocationForm({ ...locationForm, address: e.target.value })} /></Field><Field label="Maximum capacity"><Input type="number" min="0" value={locationForm.capacity} onChange={e => setLocationForm({ ...locationForm, capacity: e.target.value })} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setLocationDialog(false)}>Cancel</Button><Button onClick={createLocation} disabled={saving}>Add Location</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={recordDialog} onOpenChange={setRecordDialog}><DialogContent><DialogHeader><DialogTitle>{config.add}</DialogTitle></DialogHeader>{module === 'registrations' ? <RegistrationForm value={registrationForm} onChange={setRegistrationForm} /> : module === 'budget' ? <BudgetForm value={budgetForm} onChange={setBudgetForm} /> : <TaskForm value={taskForm} onChange={setTaskForm} />}<DialogFooter><Button variant="outline" onClick={() => setRecordDialog(false)}>Cancel</Button><Button onClick={addRecord} disabled={saving}>Save</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function StatusSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { return <Select value={value} onValueChange={onChange}><SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option} value={option}>{option.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select>; }
function DeleteButton({ onClick }: { onClick: () => void }) { return <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onClick} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>; }
function RegistrationRow({ row, onStatus, onDelete }: { row: Registration; onStatus: (id: string, value: string) => void; onDelete: (id: string) => void }) { return <TableRow><TableCell className="font-medium">{row.guest_name}</TableCell><TableCell><div>{row.phone || '—'}</div><div className="text-xs text-muted-foreground">{row.email}</div></TableCell><TableCell>{row.guests}</TableCell><TableCell>LKR {Number(row.amount).toFixed(2)}</TableCell><TableCell><StatusSelect value={row.booking_status} options={['pending', 'confirmed', 'checked_in', 'cancelled']} onChange={value => onStatus(row.id, value)} /></TableCell><TableCell><DeleteButton onClick={() => onDelete(row.id)} /></TableCell></TableRow>; }
function BudgetRow({ row, onStatus, onDelete }: { row: BudgetItem; onStatus: (id: string, value: string) => void; onDelete: (id: string) => void }) { return <TableRow><TableCell>{row.category}</TableCell><TableCell className="font-medium">{row.description}</TableCell><TableCell><Badge variant={row.budget_type === 'income' ? 'default' : 'secondary'}>{row.budget_type}</Badge></TableCell><TableCell>LKR {Number(row.estimated_amount).toFixed(2)}</TableCell><TableCell>LKR {Number(row.actual_amount).toFixed(2)}</TableCell><TableCell><StatusSelect value={row.payment_status} options={['planned', 'approved', 'paid', 'received']} onChange={value => onStatus(row.id, value)} /></TableCell><TableCell><DeleteButton onClick={() => onDelete(row.id)} /></TableCell></TableRow>; }
function WorkflowRow({ row, onStatus, onDelete }: { row: WorkflowTask; onStatus: (id: string, value: string) => void; onDelete: (id: string) => void }) { return <TableRow><TableCell><div className="font-medium">{row.title}</div>{row.automation_rule && <div className="text-xs text-muted-foreground">Rule: {row.automation_rule}</div>}</TableCell><TableCell>{row.stage}</TableCell><TableCell>{row.assigned_name || 'Unassigned'}</TableCell><TableCell>{row.due_at ? new Date(row.due_at).toLocaleString() : '—'}</TableCell><TableCell><Badge variant={row.priority === 'urgent' ? 'destructive' : 'outline'}>{row.priority}</Badge></TableCell><TableCell><StatusSelect value={row.status} options={['todo', 'in_progress', 'blocked', 'done']} onChange={value => onStatus(row.id, value)} /></TableCell><TableCell><DeleteButton onClick={() => onDelete(row.id)} /></TableCell></TableRow>; }
function RegistrationForm({ value, onChange }: { value: typeof emptyRegistration; onChange: (value: typeof emptyRegistration) => void }) { return <div className="grid gap-3 sm:grid-cols-2"><Field label="Guest name"><Input value={value.guest_name} onChange={e => onChange({ ...value, guest_name: e.target.value })} /></Field><Field label="Phone"><Input value={value.phone} onChange={e => onChange({ ...value, phone: e.target.value })} /></Field><Field label="Email"><Input type="email" value={value.email} onChange={e => onChange({ ...value, email: e.target.value })} /></Field><Field label="Number of guests"><Input type="number" min="1" value={value.guests} onChange={e => onChange({ ...value, guests: e.target.value })} /></Field><Field label="Booking amount"><Input type="number" min="0" value={value.amount} onChange={e => onChange({ ...value, amount: e.target.value })} /></Field><Field label="Payment"><StatusSelect value={value.payment_status} options={['unpaid', 'partial', 'paid', 'refunded']} onChange={payment_status => onChange({ ...value, payment_status })} /></Field></div>; }
function BudgetForm({ value, onChange }: { value: typeof emptyBudget; onChange: (value: typeof emptyBudget) => void }) { return <div className="grid gap-3 sm:grid-cols-2"><Field label="Category"><Input value={value.category} onChange={e => onChange({ ...value, category: e.target.value })} /></Field><Field label="Type"><StatusSelect value={value.budget_type} options={['income', 'expense']} onChange={budget_type => onChange({ ...value, budget_type })} /></Field><div className="sm:col-span-2"><Field label="Description"><Input value={value.description} onChange={e => onChange({ ...value, description: e.target.value })} /></Field></div><Field label="Estimated amount"><Input type="number" min="0" value={value.estimated_amount} onChange={e => onChange({ ...value, estimated_amount: e.target.value })} /></Field><Field label="Actual amount"><Input type="number" min="0" value={value.actual_amount} onChange={e => onChange({ ...value, actual_amount: e.target.value })} /></Field></div>; }
function TaskForm({ value, onChange }: { value: typeof emptyTask; onChange: (value: typeof emptyTask) => void }) { return <div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Task title"><Input value={value.title} onChange={e => onChange({ ...value, title: e.target.value })} /></Field></div><Field label="Stage"><Input value={value.stage} onChange={e => onChange({ ...value, stage: e.target.value })} /></Field><Field label="Owner"><Input value={value.assigned_name} onChange={e => onChange({ ...value, assigned_name: e.target.value })} /></Field><Field label="Due date"><Input type="datetime-local" value={value.due_at} onChange={e => onChange({ ...value, due_at: e.target.value })} /></Field><Field label="Priority"><StatusSelect value={value.priority} options={['low', 'medium', 'high', 'urgent']} onChange={priority => onChange({ ...value, priority })} /></Field><div className="sm:col-span-2"><Field label="Automation rule"><Input placeholder="e.g. Notify owner 24 hours before due date" value={value.automation_rule} onChange={e => onChange({ ...value, automation_rule: e.target.value })} /></Field></div></div>; }
