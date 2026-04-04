
"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  UtensilsCrossed, 
  Search, 
  ShoppingCart, 
  Table as TableIcon, 
  User as UserIcon,
  Plus, 
  Minus, 
  Trash2, 
  ChevronRight,
  ArrowLeft,
  X,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LayoutGrid
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { MenuItem, Table, MenuSection, Order, OrderItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// --- Types ---
type CartItem = MenuItem & { quantity: number };

function PosTerminal() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const tableIdFromQuery = searchParams.get("tableId");
  const { toast } = useToast();

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selection State
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [operator, setOperator] = useState<{ id: string, name: string } | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<"menu" | "tables">("tables");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // --- Data Fetching ---
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch Menu Items
        const { data: menuData, error: menuError } = await supabase
          .from("menu_items")
          .select("*")
          .eq("availability", true);
        
        if (menuError) throw menuError;
        setMenuItems(menuData || []);

        // Derive Categories
        const uniqueCategories = ["All", ...new Set(menuData?.map(item => item.category) || [])];
        setCategories(uniqueCategories);

        // Fetch Tables
        const { data: tableData, error: tableError } = await supabase
          .from("restaurant_tables")
          .select("*")
          .order("table_number", { ascending: true });
        
        if (tableError) throw tableError;
        setTables(tableData || []);

        // Pre-select table if tableId is in query
        if (tableIdFromQuery && tableData) {
          const tableToSelect = tableData.find(t => t.id === tableIdFromQuery);
          if (tableToSelect && tableToSelect.status === "available") {
            setSelectedTable(tableToSelect);
            setActiveTab("menu");
          }
        }

        // Fetch Current User (Manager/Operator)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from("users").select("name").eq("id", user.id).single();
          setOperator({ id: user.id, name: profile?.name || user.email?.split("@")[0] || "Operator" });
        } else {
          // If no user, we might want a simple "Guest Operator" for this demo/requirement
          setOperator({ id: "guest", name: "Guest Operator" });
        }

      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Setup Error",
          description: error.message || "Failed to load POS data.",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [supabase, toast]);

  // --- Logic ---
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const serviceCharge = subtotal * 0.1; // 10%
  const vat = (subtotal + serviceCharge) * 0.08; // 8%
  const total = subtotal + serviceCharge + vat;

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast({ title: "Added", description: `${item.name} added to cart.` });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === itemId) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const handleCheckout = async () => {
    if (!selectedTable) {
      toast({ variant: "destructive", title: "Table Required", description: "Please select a table before placing order." });
      setActiveTab("tables");
      return;
    }
    if (cart.length === 0) {
      toast({ variant: "destructive", title: "Empty Cart", description: "Add items to cart first." });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          table_id: selectedTable.id,
          table_number: selectedTable.table_number,
          status: "open",
          total_price: total,
          waiter_id: operator?.id === "guest" ? null : operator?.id,
          waiter_name: operator?.name || "System",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create Order Items
      const orderItemsData = cart.map(item => ({
        order_id: order.id,
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsData);

      if (itemsError) throw itemsError;

      // 3. Update Table Status
      await supabase
        .from("restaurant_tables")
        .update({ status: "occupied" })
        .eq("id", selectedTable.id);

      toast({
        title: "Order Placed",
        description: `Order #${order.id.slice(0, 8)} created successfully for Table ${selectedTable.table_number}.`,
      });

      // Reset
      setCart([]);
      setSelectedTable(null);
      setIsCheckoutOpen(false);
      setActiveTab("tables");

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Order Failed",
        description: error.message || "Something went wrong.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Helpers ---
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse">Initializing POS Terminal...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-muted/20">
      {/* Top Header */}
      <header className="bg-primary text-white p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
             <div className="bg-white/20 p-2 rounded-lg">
                <UtensilsCrossed className="h-6 w-6 text-white" />
             </div>
             <div>
                <h1 className="text-lg font-bold leading-none">POS Terminal</h1>
                <p className="text-[10px] uppercase tracking-widest opacity-70 mt-1">Oruthota Chalets</p>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium">{operator?.name}</span>
              <span className="text-[10px] opacity-60">Session Active</span>
           </div>
           <div className="h-10 w-10 rounded-full border-2 border-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
              <UserIcon className="h-5 w-5" />
           </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Section - Main Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Navigation Tabs */}
          <div className="flex bg-white border-b px-4 py-2 gap-4">
            <Button 
              variant={activeTab === "tables" ? "default" : "ghost"}
              onClick={() => setActiveTab("tables")}
              className="rounded-full px-6"
            >
              <TableIcon className="h-4 w-4 mr-2" />
              Tables
            </Button>
            <Button 
              variant={activeTab === "menu" ? "default" : "ghost"}
              onClick={() => setActiveTab("menu")}
              className="rounded-full px-6"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Menu
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "tables" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    Select a Table
                    <Badge variant="outline" className="ml-2 font-normal">{tables.length} Total</Badge>
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                  {tables.map(table => (
                    <Card 
                      key={table.id}
                      onClick={() => {
                        setSelectedTable(table);
                        setActiveTab("menu");
                      }}
                      className={cn(
                        "relative cursor-pointer transition-all duration-200 border-2",
                        selectedTable?.id === table.id 
                          ? "border-primary bg-primary/5 shadow-md scale-105" 
                          : "border-transparent hover:border-primary/20 hover:bg-muted/50",
                        table.status === "occupied" && "opacity-80 pointer-events-none"
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                         <div className={cn(
                           "h-12 w-12 rounded-full flex items-center justify-center mb-3",
                           table.status === "available" ? "bg-green-100 text-green-700" : 
                           table.status === "occupied" ? "bg-red-100 text-red-700" :
                           "bg-gray-100 text-gray-700"
                         )}>
                            <TableIcon className="h-6 w-6" />
                         </div>
                         <div className="text-3xl font-black mb-1">#{table.table_number}</div>
                         <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                           {table.status}
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "menu" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Search & Categories */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                      placeholder="Search menu items..." 
                      className="pl-12 h-12 rounded-xl border-2 focus:border-primary"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {categories.map(cat => (
                      <Button
                        key={cat}
                        variant={selectedCategory === cat ? "default" : "outline"}
                        className="rounded-full px-6 "
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredItems.map(item => (
                    <Card 
                      key={item.id}
                      className="group overflow-hidden hover:shadow-xl transition-all cursor-pointer border-2 hover:border-primary/20"
                      onClick={() => addToCart(item)}
                    >
                      <CardContent className="p-0">
                        <div className="relative h-40 w-full bg-muted">
                           <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                              <UtensilsCrossed className="h-12 w-12" />
                           </div>
                           <Badge className="absolute top-3 right-3 bg-white/90 text-black border-none font-bold">
                             Rs. {item.price.toLocaleString()}
                           </Badge>
                        </div>
                        <div className="p-4">
                          <h4 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{item.name}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-3">{item.description || "No description available"}</p>
                          <div className="flex items-center justify-between">
                             <Badge variant="secondary" className="text-[9px] uppercase tracking-tighter">{item.category}</Badge>
                             <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform">
                                <Plus className="h-5 w-5" />
                             </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredItems.length === 0 && (
                   <div className="text-center py-20">
                      <LayoutGrid className="h-16 w-16 text-muted/20 mx-auto mb-4" />
                      <p className="text-muted-foreground">No menu items found in this category.</p>
                   </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Order/Cart */}
        <aside className="w-[400px] bg-white border-l flex flex-col shadow-2xl z-20">
          <div className="p-6 border-b flex items-center justify-between bg-white sticky top-0">
            <div>
               <h2 className="text-xl font-bold font-headline">Current Order</h2>
               <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <TableIcon className="h-3 w-3" />
                  {selectedTable ? (
                    <span className="text-primary font-bold">Table #{selectedTable.table_number}</span>
                  ) : (
                    "No table selected"
                  )}
               </div>
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => setCart([])} title="Clear Cart">
               <Trash2 className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                 <ShoppingCart className="h-16 w-16 mb-4" />
                 <p className="text-lg font-medium">Cart is Empty</p>
                 <p className="text-sm">Select items from the menu to start order</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex items-center justify-between group">
                   <div className="flex-1 min-w-0 mr-4">
                      <h5 className="font-bold text-sm truncate">{item.name}</h5>
                      <span className="text-xs text-muted-foreground">Rs. {item.price.toLocaleString()}</span>
                   </div>
                   <div className="flex items-center bg-muted/50 rounded-full px-1 py-1">
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-white/50" onClick={() => updateQuantity(item.id, -1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-10 text-center text-sm font-bold">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-white/50" onClick={() => updateQuantity(item.id, 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                   </div>
                   <div className="w-20 text-right font-bold text-sm ml-4">
                     Rs. {(item.price * item.quantity).toLocaleString()}
                   </div>
                   <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors ml-2"
                    onClick={() => removeFromCart(item.id)}
                   >
                     <X className="h-5 w-5" />
                   </Button>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-muted/20 border-t space-y-3">
             <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">Rs. {subtotal.toLocaleString()}</span>
             </div>
             <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Charge (10%)</span>
                <span className="font-medium">Rs. {serviceCharge.toLocaleString()}</span>
             </div>
             <div className="flex justify-between text-sm font-bold border-t pt-3 text-lg">
                <span>Total Payable</span>
                <span className="text-primary font-black">Rs. {total.toLocaleString()}</span>
             </div>
             
             <Button 
              className="w-full h-14 mt-4 text-lg font-bold rounded-xl shadow-xl shadow-primary/20"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleCheckout}
             >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Place Order
                  </>
                )}
             </Button>
          </div>
        </aside>
      </div>

      {/* Footer Info */}
      <footer className="bg-white border-t px-6 py-2 flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
         <div className="flex gap-4">
            <span>Server: <span className="text-foreground">Online</span></span>
            <span>Database: <span className="text-foreground">Connected</span></span>
         </div>
         <div>Term ID: OC-POS-001</div>
      </footer>
    </div>
  );
}

export default function PosPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading POS Terminal...</p>
      </div>
    }>
      <PosTerminal />
    </Suspense>
  );
}
