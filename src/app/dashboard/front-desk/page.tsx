'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, CheckCircle2 } from 'lucide-react';
import type { Reservation, ConsolidatedBill } from '@/lib/types';

export default function FrontDeskPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('check-in');
  
  // Check-In State
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [checkedInReservations, setCheckedInReservations] = useState<Reservation[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [isLoyalty, setIsLoyalty] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Billing State
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerForBill, setSelectedCustomerForBill] = useState<any | null>(null);
  const [billData, setBillData] = useState<ConsolidatedBill | null>(null);
  const [isLoadingBill, setIsLoadingBill] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isSettling, setIsSettling] = useState(false);

  useEffect(() => {
    if (activeTab === 'check-in' || activeTab === 'in-house') {
      fetchReservations();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'check-out' && customerSearch.length > 1) {
      const delayDebounceFn = setTimeout(() => {
        searchCustomers();
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [customerSearch, activeTab]);

  const fetchReservations = async () => {
    setIsLoadingReservations(true);
    try {
      const res = await fetch('/api/admin/reservations?status=confirmed,pending,checked-in');
      const data = await res.json();
      
      const allRes: Reservation[] = data.reservations || [];
      setReservations(allRes.filter(r => r.status === 'confirmed' || r.status === 'pending' || r.status === 'booked'));
      setCheckedInReservations(allRes.filter(r => r.status === 'checked-in'));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingReservations(false);
    }
  };

  const searchCustomers = async () => {
    try {
      const res = await fetch(`/api/admin/customers?search=${encodeURIComponent(customerSearch)}`);
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenCheckIn = (res: Reservation) => {
    setSelectedReservation(res);
    setCustomerName(res.guest_name || '');
    setEmail(res.guest_email || '');
    setPhone('');
    setIdNumber('');
    setAddress('');
    setIsLoyalty(false);
    setIsCheckInModalOpen(true);
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReservation) return;

    setIsCheckingIn(true);
    try {
      const res = await fetch('/api/admin/front-desk/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: selectedReservation.id,
          customer_name: customerName,
          phone,
          email,
          id_number: idNumber,
          address,
          is_loyalty: isLoyalty
        })
      });

      if (!res.ok) throw new Error('Check-in failed');
      
      toast({ title: "Checked In", description: "Guest has been successfully checked in and registered." });
      setIsCheckInModalOpen(false);
      fetchReservations();
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleSelectCustomerForBill = async (customer: any) => {
    setSelectedCustomerForBill(customer);
    setIsLoadingBill(true);
    try {
      const res = await fetch(`/api/admin/front-desk/billing?customer_id=${customer.id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBillData(data.bill);
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
      setIsLoadingBill(false);
    }
  };

  const handleSettleBill = async () => {
    if (!billData) return;
    setIsSettling(true);
    try {
      const res = await fetch('/api/admin/front-desk/settle-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: billData.customer.id,
          payment_method: paymentMethod
        })
      });

      if (!res.ok) throw new Error('Failed to settle bill');
      
      // Print before clearing
      window.print();
      
      toast({ title: "Bill Settled", description: "All outstanding balances have been marked as paid." });
      setBillData(null);
      setSelectedCustomerForBill(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto print:p-0 print:max-w-none">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Front Desk</h1>
          <p className="text-gray-500 mt-1">Manage check-ins, check-outs, and consolidated billing.</p>
        </div>
      </div>

      <div className="print:hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="check-in">Arrivals & Check-In</TabsTrigger>
            <TabsTrigger value="in-house">In-House Guests</TabsTrigger>
            <TabsTrigger value="check-out">Billing & Check-Out</TabsTrigger>
          </TabsList>

          <TabsContent value="check-in">
            <div className="bg-white rounded-lg shadow border p-4">
              <h2 className="text-lg font-semibold mb-4">Pending Arrivals</h2>
              {isLoadingReservations ? (
                <p className="text-muted-foreground py-8 text-center">Loading reservations...</p>
              ) : reservations.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No pending arrivals.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest Name</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((res) => (
                      <TableRow key={res.id}>
                        <TableCell className="font-medium">{res.guest_name}</TableCell>
                        <TableCell>{res.room?.title || 'Unassigned'}</TableCell>
                        <TableCell>{new Date(res.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(res.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => handleOpenCheckIn(res)}>
                            Check In
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="in-house">
            <div className="bg-white rounded-lg shadow border p-4">
              <h2 className="text-lg font-semibold mb-4">Checked-In Guests</h2>
              {isLoadingReservations ? (
                <p className="text-muted-foreground py-8 text-center">Loading guests...</p>
              ) : checkedInReservations.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No guests are currently checked in.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest Name</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkedInReservations.map((res) => (
                      <TableRow key={res.id}>
                        <TableCell className="font-medium">{res.guest_name}</TableCell>
                        <TableCell>{res.room?.title || 'Unassigned'}</TableCell>
                        <TableCell>
                          <div>{new Date(res.check_in_date).toLocaleDateString()}</div>
                          {res.check_in_time && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Time: {new Date(res.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{new Date(res.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => {
                            setCustomerSearch(res.guest_name);
                            setActiveTab('check-out');
                          }}>
                            View Bill
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="check-out">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1 bg-white rounded-lg shadow border p-4">
                <h2 className="text-lg font-semibold mb-4">Find Checked-In Guest</h2>
                <Input 
                  placeholder="Search by name, ID, or phone..." 
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="mb-4"
                />
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {customers.map(c => (
                    <div 
                      key={c.id} 
                      className={`p-3 border rounded-md cursor-pointer hover:bg-muted ${selectedCustomerForBill?.id === c.id ? 'bg-muted border-primary' : ''}`}
                      onClick={() => handleSelectCustomerForBill(c)}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone || c.id_number || 'No contact info'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                {isLoadingBill ? (
                  <div className="bg-white rounded-lg shadow border p-8 text-center text-muted-foreground">
                    Calculating consolidated bill...
                  </div>
                ) : billData ? (
                  <div className="bg-white rounded-lg shadow border p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h2 className="text-2xl font-bold">Consolidated Bill</h2>
                        <p className="text-muted-foreground">Customer: {billData.customer.name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary">LKR {billData.totalOutstanding.toFixed(2)}</div>
                        <p className="text-sm text-muted-foreground">Total Outstanding</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {billData.reservations.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Room Charges</h3>
                          <Table>
                            <TableBody>
                              {billData.reservations.map(res => (
                                <TableRow key={res.id}>
                                  <TableCell>{res.room?.title || 'Room'} ({new Date(res.check_in_date).toLocaleDateString()} to {new Date(res.check_out_date).toLocaleDateString()})</TableCell>
                                  <TableCell className="text-right">LKR {Number(res.total_cost || 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {billData.orders.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Restaurant Orders</h3>
                          <Table>
                            <TableBody>
                              {billData.orders.map(ord => (
                                <TableRow key={ord.id}>
                                  <TableCell>Order #{ord.id.substring(0,8).toUpperCase()} ({new Date(ord.created_at || '').toLocaleDateString()})</TableCell>
                                  <TableCell className="text-right">LKR {Number(ord.total_price || 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {billData.serviceIncomes.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Extra Services</h3>
                          <Table>
                            <TableBody>
                              {billData.serviceIncomes.map(svc => (
                                <TableRow key={svc.id}>
                                  <TableCell>{svc.service_type}: {svc.description} ({new Date(svc.date).toLocaleDateString()})</TableCell>
                                  <TableCell className="text-right">LKR {Number(svc.amount || 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {billData.totalOutstanding === 0 && (
                        <div className="text-center py-6 text-green-600 font-medium">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                          No outstanding balance.
                        </div>
                      )}

                      {billData.totalOutstanding > 0 && (
                        <div className="pt-6 border-t">
                          <Label className="mb-2 block">Payment Method for Settlement</Label>
                          <div className="flex items-center space-x-4 mb-6">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input type="radio" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="w-4 h-4 text-primary" />
                              <span>Cash</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input type="radio" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="w-4 h-4 text-primary" />
                              <span>Credit/Debit Card</span>
                            </label>
                          </div>
                          
                          <Button onClick={handleSettleBill} disabled={isSettling} className="w-full text-lg h-12">
                            <Printer className="mr-2 h-5 w-5" />
                            {isSettling ? 'Processing...' : 'Settle Bill & Print Invoice'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow border p-8 text-center text-muted-foreground">
                    Select a customer to view their bill.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Check-In Modal */}
      <Dialog open={isCheckInModalOpen} onOpenChange={setIsCheckInModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Formalize Check-in & Register Guest</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCheckInSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Guest Name</Label>
              <Input required value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ID / Passport Number</Label>
              <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} />
            </div>
            <div className="flex items-center space-x-2 pt-2 border-t mt-4">
              <Checkbox 
                id="loyalty" 
                checked={isLoyalty} 
                onCheckedChange={(checked) => setIsLoyalty(checked as boolean)}
              />
              <Label htmlFor="loyalty" className="font-medium">Register as Loyalty Customer</Label>
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isCheckingIn}>
                {isCheckingIn ? 'Processing...' : 'Complete Check-In'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Printable Master Invoice */}
      {billData && (
        <div className="hidden print:block font-sans text-black bg-white">
          <div className="flex justify-between items-start border-b pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-wider text-gray-900">MASTER FOLIO</h1>
              <p className="text-sm text-gray-500 mt-1">Date: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-900">Oruthota Chalets</h2>
              <p className="text-sm text-gray-500 mt-1">Digana, Kandy</p>
              <p className="text-sm text-gray-500">Sri Lanka</p>
              <p className="text-sm text-gray-500">+94 77 123 4567</p>
            </div>
          </div>
          
          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billed To</h3>
            <p className="font-medium text-lg text-gray-900">{billData.customer.name}</p>
            <p className="text-gray-600 mt-1">{billData.customer.phone || billData.customer.email}</p>
            {billData.customer.address && <p className="text-gray-600 mt-1">{billData.customer.address}</p>}
          </div>

          <table className="w-full mb-8 text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="py-3 px-2 font-bold text-gray-700 uppercase text-xs tracking-wider">Item Description</th>
                <th className="py-3 px-2 font-bold text-gray-700 uppercase text-xs tracking-wider text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {billData.reservations.map(res => (
                <tr key={res.id} className="border-b border-gray-100">
                  <td className="py-4 px-2 text-gray-800">Room Charge: {res.room?.title || 'Room'}</td>
                  <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {Number(res.total_cost || 0).toFixed(2)}</td>
                </tr>
              ))}
              {billData.orders.map(ord => (
                <tr key={ord.id} className="border-b border-gray-100">
                  <td className="py-4 px-2 text-gray-800">Restaurant Order #{ord.id.substring(0,8).toUpperCase()}</td>
                  <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {Number(ord.total_price || 0).toFixed(2)}</td>
                </tr>
              ))}
              {billData.serviceIncomes.map(svc => (
                <tr key={svc.id} className="border-b border-gray-100">
                  <td className="py-4 px-2 text-gray-800">{svc.service_type}: {svc.description}</td>
                  <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {Number(svc.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-12">
            <div className="w-1/3">
              <div className="flex justify-between py-2 border-t-2 border-gray-900 font-bold text-lg">
                <span>Total Settled</span>
                <span>LKR {billData.totalOutstanding.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 text-sm text-gray-500">
                <span>Payment Method</span>
                <span className="capitalize">{paymentMethod}</span>
              </div>
            </div>
          </div>
          
          <div className="text-center text-gray-500 text-sm mt-16 pt-8 border-t border-gray-200">
            <p>Thank you for staying with us!</p>
          </div>
        </div>
      )}
    </div>
  );
}
