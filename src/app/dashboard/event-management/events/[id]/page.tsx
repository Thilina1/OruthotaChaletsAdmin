'use client';

import { useParams } from 'next/navigation';
import { EventWorkspaceClient } from '@/components/dashboard/event-management/event-workspace-client';

export default function EventDetailsPage() {
  const { id } = useParams<{ id: string }>();
  return <EventWorkspaceClient mode="detail" initialEventId={id} />;
}
