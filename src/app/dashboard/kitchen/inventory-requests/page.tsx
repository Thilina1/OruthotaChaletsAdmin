'use client';

import StockRequestPortal from '@/components/dashboard/inventory/stock-request-portal';

export default function KitchenInventoryRequestPage() {
    return (
        <StockRequestPortal
            title="Item Request Portal for Kitchen"
            descriptionText="Request items from the Main Store for the Kitchen."
            badgeLabel="Kitchen"
            lockedDepartmentName="kitchen"
        />
    );
}
