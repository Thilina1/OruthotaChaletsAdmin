
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

type WithId<T> = T & { id: string };

export function useSupabaseDoc<T = any>(tableName: string, id: string | null | undefined) {
    const [data, setData] = useState<WithId<T> | null>(null);
    const [loading, setLoading] = useState(false); // Start false, only true if id exists
    const [error, setError] = useState<PostgrestError | null>(null);
    const supabase = createClient();

    const fetchData = useCallback(async () => {
        if (!id) {
            setData(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data: result, error: err } = await supabase
                .from(tableName)
                .select('*')
                .eq('id', id)
                .single();

            if (err) {
                setError(err);
                setData(null);
            } else {
                setData(result as WithId<T>);
                setError(null);
            }
        } catch (err: any) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [tableName, id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
}
