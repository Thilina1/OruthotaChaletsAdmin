import ServiceIncomeClient from '@/components/dashboard/services/service-income-client';

export const metadata = {
  title: 'Laundry Income | Oruthota Chalets',
};

export default function LaundryIncomePage() {
  return (
    <ServiceIncomeClient 
      title="Laundry Income" 
      descriptionText="Track revenue from laundry services."
      serviceType="Laundry"
    />
  );
}
