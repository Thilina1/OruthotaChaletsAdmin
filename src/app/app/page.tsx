
"use client";

import Image from "next/image";
import Link from "next/link";
import { 
  UtensilsCrossed, 
  Warehouse, 
  Hotel, 
  BarChart3, 
  Users, 
  Settings,
  ArrowLeft,
  LayoutGrid,
  Bell,
  Search,
  LogOut
} from "lucide-react";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

const apps = [
  {
    id: "pos",
    name: "Point of Sale",
    description: "Cloud-based restaurant POS for fast ordering and billing.",
    icon: UtensilsCrossed,
    color: "bg-orange-500",
    gradient: "from-orange-500/20 to-orange-600/20",
    href: "/app/pos", // We will build this
  },
  {
    id: "waiter-dashboard",
    name: "Waiter Dashboard",
    description: "Manage orders, tables, and service status in real-time.",
    icon: Hotel,
    color: "bg-emerald-500",
    gradient: "from-emerald-500/20 to-emerald-600/20",
    href: "/app/waiter",
  },
];

export default function AppsPage() {
  const loginImage = PlaceHolderImages.find(p => p.id === 'login-background');
  const [searchQuery, setSearchQuery] = useState("");

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Background with Overlay */}
      {loginImage && (
        <Image
          src={loginImage.imageUrl}
          alt={loginImage.description}
          fill
          className="object-cover"
          priority
        />
      )}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"></div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <Logo className="h-12 w-12 text-white" />
          <div>
            <h1 className="text-xl font-headline font-bold text-white leading-none">Oruthota Chalets</h1>
            <p className="text-xs text-white/60 tracking-widest uppercase mt-1">Command Center</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input 
              type="text" 
              placeholder="Search apps..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-64 pl-10 bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all backdrop-blur-md"
            />
          </div>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full"></span>
          </Button>
          <div className="h-10 w-10 rounded-full border-2 border-white/20 overflow-hidden">
             <Image src="https://api.dicebear.com/9.x/avataaars/png?seed=Alexander" alt="User" width={40} height={40} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-6 py-12">
        <div className="mb-12 text-center animate-fade-in-up">
          <h2 className="text-4xl md:text-5xl font-headline font-bold text-white mb-4">Choose Your Application</h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Access the integrated management modules designed for Oruthota Chalets staff and administrators.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {filteredApps.map((app, index) => (
            <Link key={app.id} href={app.href} className="group">
              <Card className={`glassy h-full overflow-hidden border-white/10 hover:border-white/30 transition-all duration-300 transform group-hover:-translate-y-2 group-hover:shadow-2xl animate-fade-in-up stagger-${index + 1}`}>
                <CardContent className="p-8 flex flex-col items-center text-center">
                  <div className={`p-5 rounded-2xl ${app.color} text-white shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <app.icon className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{app.name}</h3>
                  <p className="text-white/60 mb-8 line-clamp-2">
                    {app.description}
                  </p>
                  <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white hover:text-black transition-colors rounded-xl font-bold py-6">
                    Launch App
                  </Button>
                </CardContent>
                <div className={`absolute inset-0 bg-gradient-to-br ${app.gradient} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}></div>
              </Card>
            </Link>
          ))}
        </div>

        {filteredApps.length === 0 && (
          <div className="text-center py-20 animate-fade-in">
            <LayoutGrid className="h-16 w-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/50 text-xl font-medium">No apps found matching "{searchQuery}"</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="absolute bottom-8 left-0 w-full z-10 px-8 flex justify-between items-center">
        <p className="text-white/40 text-sm">© 2026 Oruthota Chalets - Eco Lanka Resorts (PVT) LTD.</p>
        <div className="flex gap-6">
          <Link href="/" className="text-white/40 hover:text-white transition-colors text-sm font-medium">Help Center</Link>
          <Link href="/" className="text-white/40 hover:text-white transition-colors text-sm font-medium">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
