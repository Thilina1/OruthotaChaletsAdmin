
"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Hotel, 
  CheckCircle, 
  Zap, 
  LogOut, 
  User, 
  Lock, 
  AtSign,
  Loader2,
  Table as TableIcon,
  Clock,
  ArrowLeft,
  ChevronRight,
  Plus
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Table, RestaurantSection } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Logo } from "@/components/icons";
import { useUserContext } from '@/context/user-context';
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function WaiterDashboard() {
    const supabase = createClient();
    const router = useRouter();
    const { toast } = useToast();
    const { user, loading, refreshUser } = useUserContext();
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginData, setLoginData] = useState({ email: "", password: "" });
    
    const [tables, setTables] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const background = PlaceHolderImages.find(p => p.id === 'login-background');

    // Waiter Login Logic
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggingIn(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Login failed");
            
            await refreshUser();
            toast({ title: "Welcome back!", description: "Initializing Waiter Dashboard..." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Authentication Failed", description: error.message });
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.reload();
    };

    // Data Fetching
    useEffect(() => {
        if (!user || loading) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch All Sections
                const { data: sData } = await supabase.from('restaurant_sections').select('*').order('name');
                setSections(sData || []);

                // Fetch All Tables
                const { data: tData } = await supabase.from('restaurant_tables').select('*').order('table_number');
                setTables(tData || []);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        const tableChannel = supabase.channel('waiter-tables-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(tableChannel); };
    }, [user, loading, supabase]);

    // Group tables by location (section name)
    const tablesBySection = useMemo(() => {
        const map: Record<string, any[]> = {};
        tables.forEach(table => {
            const loc = table.location || "Other";
            if (!map[loc]) map[loc] = [];
            map[loc].push(table);
        });
        return map;
    }, [tables]);

    // Expected Sections from User Feedback
    const displaySections = ["Bar", "Outdoor", "Sri Lankan", "vip longe", "Western"];

    // --- Render Login ---
    if (!loading && !user) {
        return (
            <div className="relative min-h-screen w-full flex items-center justify-center p-6 bg-background">
                {background && <Image src={background.imageUrl} alt="Resort" fill className="object-cover" priority />}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md"></div>
                
                <Card className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl p-8 rounded-[2rem]">
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-6">
                           <Logo className="h-32 w-32 text-white" />
                        </div>
                        <h1 className="text-3xl font-headline font-bold text-white mb-2">Staff Portal</h1>
                        <p className="text-white/50 text-sm">Please log in to your waiter account</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                           <label className="text-[10px] uppercase tracking-widest text-white/40 font-black ml-4">Email Address</label>
                           <div className="relative">
                              <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                              <Input 
                                 type="email" 
                                 placeholder="waiter@resort.com"
                                 className="h-14 pl-12 bg-white/5 border-white/10 text-white rounded-2xl focus:ring-primary/40 focus:border-primary"
                                 value={loginData.email}
                                 onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                                 required
                              />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] uppercase tracking-widest text-white/40 font-black ml-4">Security Key</label>
                           <div className="relative">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                              <Input 
                                 type="password" 
                                 placeholder="Your secret key"
                                 className="h-14 pl-12 bg-white/5 border-white/10 text-white rounded-2xl focus:ring-primary/40 focus:border-primary"
                                 value={loginData.password}
                                 onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                                 required
                              />
                           </div>
                        </div>
                        <Button 
                            className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 mt-4"
                            disabled={isLoggingIn}
                        >
                            {isLoggingIn ? <Loader2 className="h-6 w-6 animate-spin" /> : "Access Dashboard"}
                        </Button>
                    </form>
                    
                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                        <Link href="/app" className="text-white/40 hover:text-white text-xs transition-colors font-medium">
                            Back to Apps Launcher
                        </Link>
                    </div>
                </Card>
            </div>
        );
    }

    // --- Render Dashboard ---
    return (
        <div className="relative min-h-screen w-full bg-[#0a0a0a] overflow-x-hidden text-white pb-20">
            {background && <Image src={background.imageUrl} alt="Resort" fill className="object-cover opacity-10 pointer-events-none" />}
            
            {/* Header Section */}
            <header className="relative z-10 px-8 pt-10 pb-6 border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0">
                <Link href="/app" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-6 group">
                   <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                   <span className="text-xs uppercase tracking-widest font-black">Back to Apps</span>
                </Link>
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h2 className="text-primary text-[10px] uppercase tracking-[0.3em] font-black leading-none mb-2">Dashboard</h2>
                        <h1 className="text-4xl md:text-5xl font-headline font-bold mb-3 tracking-tight">Waiter Dashboard</h1>
                        <p className="text-white/40 text-sm md:text-base font-medium max-w-2xl">
                           Oversee all restaurant operations and manage tables.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-white/5 p-2 pr-6 rounded-full border border-white/10">
                        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                           <User className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col">
                           <span className="text-sm font-bold leading-none">{user?.name}</span>
                           <span className="text-[10px] text-white/30 uppercase font-black mt-1">Staff Member</span>
                        </div>
                        <Button variant="ghost" size="icon" className="ml-4 text-white/20 hover:text-destructive hover:bg-transparent" onClick={handleLogout}>
                           <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <main className="relative z-10 px-8 py-12 space-y-16 max-w-[1600px] mx-auto">
                {isLoading ? (
                    <div className="space-y-12">
                       {[1, 2].map(i => (
                           <div key={i} className="space-y-6">
                              <Skeleton className="h-8 w-48 bg-white/5 rounded-full" />
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                 {[1, 2, 3, 4].map(j => <Skeleton key={j} className="h-48 bg-white/5 rounded-3xl" />)}
                              </div>
                           </div>
                       ))}
                    </div>
                ) : (
                    displaySections.map(sectionName => (
                        <section key={sectionName} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                           <div className="flex items-center gap-4">
                              <h3 className="text-2xl font-bold font-headline">{sectionName}</h3>
                              <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                           </div>

                           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                              {tablesBySection[sectionName]?.length > 0 ? (
                                  tablesBySection[sectionName].map(table => (
                                      <Card key={table.id} className="bg-white/5 border-white/5 hover:border-primary/40 transition-all rounded-[1.5rem] overflow-hidden group shadow-2xl">
                                         <CardContent className="p-6 space-y-6">
                                            <div className="flex items-start justify-between">
                                               <div>
                                                  <h4 className="text-3xl font-black mb-1">Table {table.table_number}</h4>
                                                  <Badge className={cn(
                                                     "text-[10px] uppercase font-bold border-none px-3",
                                                     table.status === 'available' ? "bg-emerald-500/10 text-emerald-500" :
                                                     table.status === 'occupied' ? "bg-rose-500/10 text-rose-500" :
                                                     "bg-amber-500/10 text-amber-500"
                                                  )}>
                                                     {table.status}
                                                  </Badge>
                                               </div>
                                               <div className="h-12 w-12 rounded-2xl bg-white/5 flex flex-col items-center justify-center border border-white/5">
                                                  <span className="text-lg font-bold leading-none">{table.capacity}</span>
                                                  <span className="text-[7px] uppercase font-black text-white/30">Covers</span>
                                               </div>
                                            </div>

                                            <Button 
                                               className="w-full h-14 bg-white text-black hover:bg-primary hover:text-white font-bold rounded-2xl transition-all shadow-lg"
                                               onClick={() => router.push(`/app/pos?tableId=${table.id}`)}
                                            >
                                               View / Add Order
                                            </Button>
                                         </CardContent>
                                      </Card>
                                  ))
                              ) : (
                                  <div className="col-span-full py-12 px-8 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] flex items-center gap-4 text-white/30 italic">
                                     <Zap className="h-5 w-5" />
                                     <span>No tables found in this section.</span>
                                  </div>
                              )}
                           </div>
                        </section>
                    ))
                )}
            </main>

            {/* Bottom Info */}
            <footer className="relative z-10 px-8 py-4 border-t border-white/5 text-[9px] uppercase tracking-widest font-bold text-white/20 flex justify-between">
               <div className="flex gap-6">
                  <span>Service: <span className="text-emerald-500">Online</span></span>
                  <span>Terminal: <span className="text-white/40">OC-WTR-01</span></span>
               </div>
               <div>© 2026 Oruthota Chalets</div>
            </footer>
        </div>
    );
}
