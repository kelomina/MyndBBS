import { headers } from 'next/headers';
import { Locale, defaultLocale } from '../../../../i18n/config';
import { getDictionary } from '../../../../i18n/get-dictionary';
import { EditPostForm } from './EditPostForm';
import { notFound } from 'next/navigation';

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  let post = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/${id}`, {
      cache: 'no-store'
    });
    if (res.ok) {
      post = await res.json();
    } else if (res.status === 404) {
      return notFound();
    }
  } catch (error) {
    console.error('Failed to fetch post:', error);
  }

  if (!post) {
    return notFound();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <EditPostForm dict={dict} initialPost={post} />
      </div>
    </div>
  );
}
