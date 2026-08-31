'use client';

import StockRequestPortal from '@/components/dashboard/inventory/stock-request-portal';
import StockUsagePanel from '@/components/dashboard/inventory/stock-usage-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function KitchenInventoryRequestPage() {
    return (
        <Tabs defaultValue="request" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl p-1 sm:w-fit">
                <TabsTrigger value="request" className="px-5 py-2 font-bold">📦 Request &amp; Assign Items</TabsTrigger>
                <TabsTrigger value="usage" className="px-5 py-2 font-bold">✅ Mark Stock Usage</TabsTrigger>
            </TabsList>

            <TabsContent value="request" className="mt-0">
                <StockRequestPortal
                    title="Kitchen Stock Request & Usage"
                    descriptionText="Request items from the Main Store and manage Kitchen section assignments."
                    badgeLabel="Kitchen"
                    lockedDepartmentName="kitchen"
                    requestSections={['Staff', 'Function', 'A la carte', 'Room guest']}
                    compactHeader
                />
            </TabsContent>

            <TabsContent value="usage" className="mt-0">
                <StockUsagePanel
                    title="Mark Kitchen Stock Usage"
                    descriptionText="Record Kitchen stock usage separately for Staff, Function, A la carte, and Room guest."
                    lockedDepartmentName="kitchen"
                    usageSections={['Staff', 'Function', 'A la carte', 'Room guest']}
                />
            </TabsContent>
        </Tabs>
    );
}
