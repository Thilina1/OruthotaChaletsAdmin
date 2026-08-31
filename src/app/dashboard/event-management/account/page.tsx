import { AccountCollectionView } from '@/app/dashboard/services/account/page';

export default function EventAccountPage() {
  return (
    <AccountCollectionView
      endpoint="/api/admin/event-account"
      title="Event Account"
      description="Cash and card payments collected through Event Management."
      entityLabel="Event"
    />
  );
}
