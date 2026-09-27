import { AccountCollectionView } from '@/components/dashboard/account-collection-view';

export default function EventAccountPage() {
  return (
    <AccountCollectionView
      endpoint="/api/admin/event-account"
      title="Event Account"
      description="Cash and card payments collected through Event Management."
      entityLabel="Event"
      showBreakdown={false}
      enableEventFilter
    />
  );
}
