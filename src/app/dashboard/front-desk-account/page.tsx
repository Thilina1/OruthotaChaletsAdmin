'use client';

import { AccountCollectionView } from '@/components/dashboard/account-collection-view';

export default function FrontDeskAccountPage() {
  return (
    <AccountCollectionView
      endpoint="/api/admin/front-desk-account"
      title="Front Desk Account"
      description="Cash and card collections from room, chalet, restaurant, and service charges settled through Front Desk."
      entityLabel="Front Desk"
    />
  );
}
