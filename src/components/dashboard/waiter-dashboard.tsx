
'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Utensils, Users } from "lucide-react";
import type { Table, TableSection, RestaurantSection } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderModal } from './waiter/order-modal';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';

const statusStyles: Record<string, { badge: string, border: string }> = {
  'occupied': { badge: 'bg-yellow-500', border: 'border-yellow-500' },
  'available': { badge: 'bg-green-500', border: 'border-green-500' },
  'reserved': { badge: 'bg-purple-500', border: 'border-purple-500' },
};

export default function WaiterDashboard() {
  const supabase = createClient();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [sections, setSections] = useState<RestaurantSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tablesRes, sectionsRes] = await Promise.all([
          supabase.from('restaurant_tables').select('*'),
          fetch('/api/admin/restaurant-sections').then(res => res.json())
        ]);

        if (tablesRes.error) {
          console.error("Error fetching tables:", tablesRes.error);
        } else {
          setTables(tablesRes.data as any as Table[]);
        }

        if (sectionsRes.error) {
          console.error("Error fetching sections:", sectionsRes.error);
        } else {
          setSections(sectionsRes.sections || []);
        }

      } catch (e) {
        console.error("Error in fetchData:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Realtime subscription
    const channel = supabase.channel('table-updates-waiter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, payload => {
        // Simple refetch or optimistic update
        supabase.from('restaurant_tables').select('*').then(({ data }) => {
          if (data) setTables(data as any as Table[]);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const tablesBySection = useMemo(() => {
    if (!tables) return {};
    return tables.reduce((acc, table) => {
      const section = (table as any).location || 'Sri Lankan'; // Use location as section
      if (!acc[section]) {
        acc[section] = [];
      }
      acc[section].push(table);
      return acc;
    }, {} as Record<string, Table[]>);
  }, [tables]);

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
  };

  const handleCloseModal = () => {
    setSelectedTable(null);
  };

  if (!isLoading && sections.length === 0) {
    return <div className="p-8 text-center">No restaurant sections found. Please contact admin.</div>
  }

  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-headline font-bold">Waiter Dashboard</h1>
          <p className="text-muted-foreground">Oversee tables and manage orders efficiently.</p>
        </div>

        {/* Ensure we have sections before rendering Tabs */}
        {sections.length > 0 ? (
          <Tabs defaultValue={sections[0].name} className="w-full">
            <ScrollArea>
              <TabsList className="mb-4 flex w-full">
                {sections.map(section => (
                  <TabsTrigger className="flex-1" key={section.id} value={section.name}>{section.name}</TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>

            {sections.map(section => (
              <TabsContent value={section.name} key={section.id}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}

                  {!isLoading && tablesBySection[section.name] && tablesBySection[section.name].map(table => (
                    <Card
                      key={table.id}
                      className={`hover:shadow-lg transition-shadow border-2 h-full flex flex-col justify-between ${statusStyles[table.status]?.border || 'border-gray-300'}`}
                    >
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-bold font-headline">Table {table.table_number}</CardTitle>
                        <Badge className={`text-white capitalize ${statusStyles[table.status]?.badge || 'bg-gray-500'}`}>
                          {table.status}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-2 flex-grow">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Users className="w-4 h-4 mr-2" />
                          <span>{table.capacity} Covers</span>
                        </div>
                      </CardContent>
                      <div className="p-4 pt-0">
                        <Button className="w-full" onClick={() => handleTableClick(table)}>
                          <Utensils className="w-4 h-4 mr-2" />
                          <span>View / Add Order</span>
                        </Button>
                      </div>
                    </Card>
                  ))}

                  {!isLoading && (!tablesBySection[section.name] || tablesBySection[section.name].length === 0) && (
                    <div className="col-span-full text-center text-muted-foreground py-10">
                      No tables found in this section.
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          isLoading ? <Skeleton className="h-64 w-full" /> : null
        )}
      </div>
      {selectedTable && (
        <OrderModal
          table={selectedTable}
          isOpen={!!selectedTable}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
