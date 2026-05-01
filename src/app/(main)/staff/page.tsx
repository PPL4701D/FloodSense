import { redirect } from 'next/navigation';

// /staff → redirect to /staff/verification
export default function StaffPage() {
  redirect('/staff/verification');
}
