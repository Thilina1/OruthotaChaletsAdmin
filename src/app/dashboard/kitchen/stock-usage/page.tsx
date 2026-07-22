'use client';

import StockUsagePanel from '@/components/dashboard/inventory/stock-usage-panel';

export default function KitchenStockUsagePage() {
    return (
        <StockUsagePanel
            title="Stock Usage & Damage for Kitchen"
            descriptionText="Mark Kitchen stock as used, or report expired/damaged items."
            lockedDepartmentName="kitchen"
        />
    );
}
