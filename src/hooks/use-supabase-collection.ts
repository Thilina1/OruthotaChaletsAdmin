
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

type WithId<T> = T & { id: string };

export function useSupabaseCollection<T = any>(
    tableName: string,
    queryBuilder?: (query: any) => any,
    dependencies: any[] = []
) {
    const [data, setData] = useState<WithId<T>[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<PostgrestError | null>(null);
    const supabase = createClient();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from(tableName).select('*');
            if (queryBuilder) {
                query = queryBuilder(query);
            }

            const { data: result, error: err } = await query;

            if (err) {
                setError(err);
                setData(null);
            } else {
                setData(result as WithId<T>[]);
                setError(null);
            }
        } catch (err: any) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [tableName, ...dependencies]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Real-time subscription could be added here

    return { data, loading, error, refetch: fetchData };
}
