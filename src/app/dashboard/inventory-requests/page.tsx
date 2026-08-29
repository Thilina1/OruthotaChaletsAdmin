'use client';

import StockRequestPortal from '@/components/dashboard/inventory/stock-request-portal';

export default function NewInventoryRequestPage() {
    return (
        <StockRequestPortal
            title="MRN Requests"
            descriptionText="Create a Material Requisition Note (MRN) for items from the Main Store or view your department's inventory status."
            compactHeader
        />
    );
}
