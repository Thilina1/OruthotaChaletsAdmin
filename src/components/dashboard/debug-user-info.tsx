'use client';

import { useUserContext } from '@/context/user-context';

export default function DebugUserInfo() {
    const { user, supabaseUser, loading } = useUserContext();

    if (loading) {
        return <p>Loading debug info...</p>
    }

    return (
        <div className="mt-4 p-4 border bg-secondary/50">
            <h3 className="font-bold">Debug Info: Current User</h3>
            <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify({ user, supabaseUser }, null, 2)}
            </pre>
        </div>
    );
}
