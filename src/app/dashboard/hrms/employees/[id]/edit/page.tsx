'use client';

import { useParams } from 'next/navigation';
import { EmployeeFormPage } from '@/components/dashboard/hrms/employee-form-page';

export default function EditEmployeePage() {
    const params = useParams<{ id: string }>();
    return <EmployeeFormPage userId={params.id} />;
}
