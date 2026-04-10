import { useState, useEffect } from 'react';
import { fetcher } from './api/fetcher';

export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await fetcher('/api/v1/user/profile');
        setUser(data.user);
      } catch (err) {
        // Not logged in or error
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  return { user, loading };
}

export function useCategories() {
  const [categories, setCategories] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const data = await fetcher('/api/categories');
        setCategories(data);
      } catch (err) {
        console.error('Failed to load categories', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCats();
  }, []);

  return { categories, loading };
}
