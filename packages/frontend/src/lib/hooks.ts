import { useState, useEffect } from 'react';
import { fetcher } from './api/fetcher';

/**
 * Callers: []
 * Callees: [useState, useEffect, fetcher, setUser, setLoading, fetchUser]
 * Description: Handles the use current user logic for the application.
 * Keywords: usecurrentuser, use, current, user, auto-annotated
 */
export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
       * Callers: []
       * Callees: [fetcher, setUser, setLoading]
       * Description: Handles the fetch user logic for the application.
       * Keywords: fetchuser, fetch, user, auto-annotated
       */
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

/**
 * Callers: []
 * Callees: [useState, useEffect, fetcher, setCategories, error, setLoading, fetchCats]
 * Description: Handles the use categories logic for the application.
 * Keywords: usecategories, use, categories, auto-annotated
 */
export function useCategories() {
  const [categories, setCategories] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
       * Callers: []
       * Callees: [fetcher, setCategories, error, setLoading]
       * Description: Handles the fetch cats logic for the application.
       * Keywords: fetchcats, fetch, cats, auto-annotated
       */
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
