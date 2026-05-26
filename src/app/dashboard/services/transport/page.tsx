import ServiceIncomeClient from '@/components/dashboard/services/service-income-client';

export const metadata = {
  title: 'Transport & Excursion | Oruthota Chalets',
};

export default function TransportIncomePage() {
  return (
    <ServiceIncomeClient 
      title="Transport & Excursion Income" 
      descriptionText="Track revenue from transport and excursion services."
      serviceType="Transport & Excursion"
    />
  );
}
