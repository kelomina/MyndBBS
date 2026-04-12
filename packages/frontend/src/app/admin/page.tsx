import { redirect } from 'next/navigation';

/**
 * Callers: []
 * Callees: [redirect]
 * Description: Handles the admin page logic for the application.
 * Keywords: adminpage, admin, page, auto-annotated
 */
export default function AdminPage() {
  redirect('/admin/users');
}
