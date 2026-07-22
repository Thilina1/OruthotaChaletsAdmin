'use client';

import StockRequestPortal from '@/components/dashboard/inventory/stock-request-portal';

export default function NewInventoryRequestPage() {
    return (
        <StockRequestPortal
            title="Stock Request Portal"
            descriptionText="Request items from the Main Store or view your department's inventory status."
        />
    );
}
