'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, Mail, User, Calendar, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

type ContactMessage = {
  id: string;
  name: string | null;
  email: string | null;
  subject: string | null;
  message: string | null;
  created_at: string;
};

export default function InquiriesPage() {
  const { toast } = useToast();
  const supabase = createClient();

  const [inquiries, setInquiries] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState<ContactMessage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchInquiries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInquiries(data || []);
    } catch (error) {
      console.error('Error fetching inquiries:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load inquiries.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const filtered = inquiries.filter((inq) => {
    const q = searchQuery.toLowerCase();
    return (
      inq.name?.toLowerCase().includes(q) ||
      inq.email?.toLowerCase().includes(q) ||
      inq.subject?.toLowerCase().includes(q) ||
      inq.message?.toLowerCase().includes(q)
    );
  });

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(filtered, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold">Inquiries</h1>
        <p className="text-muted-foreground">Guest messages submitted via the contact form.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>All Inquiries</CardTitle>
              <CardDescription>
                {isLoading ? 'Loading…' : `${totalItems} inquiry${totalItems !== 1 ? 's' : ''} found`}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, subject…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-14 text-muted-foreground">
                    <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-30" />
                    {searchQuery ? 'No inquiries match your search.' : 'No inquiries yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((inq) => (
                  <TableRow key={inq.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{inq.name || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{inq.email || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{inq.subject || '—'}</span>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-muted-foreground truncate">{inq.message || '—'}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground whitespace-nowrap">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {new Date(inq.created_at).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInquiry(inq);
                          setIsDialogOpen(true);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!isLoading && filtered.length > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Inquiry Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inquiry Details</DialogTitle>
          </DialogHeader>
          {selectedInquiry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</p>
                  <p className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selectedInquiry.name || '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</p>
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {new Date(selectedInquiry.created_at).toLocaleString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                <p className="text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {selectedInquiry.email ? (
                    <a href={`mailto:${selectedInquiry.email}`} className="text-primary hover:underline">
                      {selectedInquiry.email}
                    </a>
                  ) : '—'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</p>
                <p className="font-medium">{selectedInquiry.subject || '—'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message</p>
                <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedInquiry.message || '—'}
                </div>
              </div>

              {selectedInquiry.email && (
                <div className="flex justify-end pt-2">
                  <Button asChild>
                    <a
                      href={`mailto:${selectedInquiry.email}?subject=Re: ${encodeURIComponent(selectedInquiry.subject || 'Your Inquiry')}`}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Reply via Email
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
