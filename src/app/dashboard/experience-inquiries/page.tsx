'use client';

import { useEffect, useState } from 'react';
import { Calendar, Mail, MessageSquare, Search, Sparkles, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePagination } from '@/hooks/use-pagination';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

type InquiryStatus = 'pending' | 'contacted' | 'confirmed' | 'cancelled' | 'completed';

type ExperienceInquiry = {
  id: string;
  name: string | null;
  email: string | null;
  subject: string | null;
  message: string | null;
  experience_type: string | null;
  status: InquiryStatus;
  created_at: string;
};

const statuses: InquiryStatus[] = ['pending', 'contacted', 'confirmed', 'cancelled', 'completed'];

const formatLabel = (value: string | null) =>
  value ? value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Not specified';

const statusVariant = (status: InquiryStatus) => {
  if (status === 'confirmed' || status === 'completed') return 'default' as const;
  if (status === 'cancelled') return 'destructive' as const;
  return 'secondary' as const;
};

export default function ExperienceInquiriesPage() {
  const { toast } = useToast();
  const supabase = createClient();
  const [inquiries, setInquiries] = useState<ExperienceInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInquiry, setSelectedInquiry] = useState<ExperienceInquiry | null>(null);

  const fetchInquiries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .eq('inquiry_type', 'experience')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInquiries((data || []) as ExperienceInquiry[]);
    } catch (error) {
      console.error('Error fetching experience inquiries:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load experience inquiries.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const updateStatus = async (inquiry: ExperienceInquiry, status: InquiryStatus) => {
    setUpdatingId(inquiry.id);
    const previousStatus = inquiry.status;
    setInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, status } : item));
    setSelectedInquiry((current) => current?.id === inquiry.id ? { ...current, status } : current);

    const { error } = await supabase
      .from('contact_messages')
      .update({ status })
      .eq('id', inquiry.id)
      .eq('inquiry_type', 'experience');

    if (error) {
      setInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, status: previousStatus } : item));
      setSelectedInquiry((current) => current?.id === inquiry.id ? { ...current, status: previousStatus } : current);
      toast({ variant: 'destructive', title: 'Update failed', description: 'The inquiry status could not be saved.' });
    } else {
      toast({ title: 'Status updated', description: `Inquiry marked as ${formatLabel(status)}.` });
    }
    setUpdatingId(null);
  };

  const query = searchQuery.trim().toLowerCase();
  const filtered = inquiries.filter((inquiry) => {
    const matchesStatus = statusFilter === 'all' || inquiry.status === statusFilter;
    const matchesSearch = !query || [inquiry.name, inquiry.email, inquiry.subject, inquiry.message, inquiry.experience_type]
      .some((value) => value?.toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });

  const pagination = usePagination(filtered, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold">Experience Inquiries</h1>
        <p className="text-muted-foreground">Manage guest inquiries and booking requests for experiences.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Experience Booking Inquiries</CardTitle>
              <CardDescription>
                {isLoading ? 'Loading…' : `${pagination.totalItems} ${pagination.totalItems === 1 ? 'inquiry' : 'inquiries'} found`}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Filter status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((status) => <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search inquiries…"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? [...Array(6)].map((_, index) => (
                <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              )) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-14 text-center text-muted-foreground">
                    <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    {searchQuery || statusFilter !== 'all' ? 'No experience inquiries match your filters.' : 'No experience inquiries yet.'}
                  </TableCell>
                </TableRow>
              ) : pagination.paginatedItems.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell>
                    <div className="font-medium">{inquiry.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{inquiry.email || '—'}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline"><Sparkles className="mr-1 h-3 w-3" />{formatLabel(inquiry.experience_type)}</Badge></TableCell>
                  <TableCell className="max-w-64 truncate text-sm">{inquiry.subject || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(inquiry.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={inquiry.status}
                      disabled={updatingId === inquiry.id}
                      onValueChange={(value) => updateStatus(inquiry, value as InquiryStatus)}
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedInquiry(inquiry)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && filtered.length > 0 && (
            <DataTablePagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={pagination.setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedInquiry)} onOpenChange={(open) => !open && setSelectedInquiry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Experience Inquiry Details</DialogTitle></DialogHeader>
          {selectedInquiry && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline"><Sparkles className="mr-1 h-3 w-3" />{formatLabel(selectedInquiry.experience_type)}</Badge>
                <Badge variant={statusVariant(selectedInquiry.status)}>{formatLabel(selectedInquiry.status)}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Name</p><p className="flex items-center gap-2 font-medium"><User className="h-4 w-4" />{selectedInquiry.name || '—'}</p></div>
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Date</p><p className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4" />{new Date(selectedInquiry.created_at).toLocaleString()}</p></div>
              </div>
              <div><p className="text-xs font-medium uppercase text-muted-foreground">Email</p><p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4" />{selectedInquiry.email ? <a className="text-primary hover:underline" href={`mailto:${selectedInquiry.email}`}>{selectedInquiry.email}</a> : '—'}</p></div>
              <div><p className="text-xs font-medium uppercase text-muted-foreground">Subject</p><p className="font-medium">{selectedInquiry.subject || '—'}</p></div>
              <div><p className="text-xs font-medium uppercase text-muted-foreground">Message</p><div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">{selectedInquiry.message || '—'}</div></div>
              {selectedInquiry.email && (
                <div className="flex justify-end pt-2">
                  <Button asChild><a href={`mailto:${selectedInquiry.email}?subject=Re: ${encodeURIComponent(selectedInquiry.subject || 'Your Experience Inquiry')}`}><Mail className="mr-2 h-4 w-4" />Reply via Email</a></Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
