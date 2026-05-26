import ServiceIncomeClient from '@/components/dashboard/services/service-income-client';

export const metadata = {
  title: 'Spa & Pool Income | Oruthota Chalets',
};

export default function SpaIncomePage() {
  return (
    <ServiceIncomeClient 
      title="Spa & Pool Income" 
      descriptionText="Track revenue from spa and pool services."
      serviceType="Spa/Pool"
    />
  );
}
