'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, Briefcase, FolderPlus, Pencil, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface JobTitleRow {
    id: string;
    department: string;
    title: string;
}

export default function JobTitlesPage() {
    const [titleMap, setTitleMap] = useState<Record<string, JobTitleRow[]>>({});
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState<Record<string, boolean>>({});
    const [newTitle, setNewTitle] = useState<Record<string, string>>({});
    const [deleting, setDeleting] = useState<string | null>(null);

    // Title inline edit: titleId → draft value
    const [editingTitle, setEditingTitle] = useState<Record<string, string>>({});
    const [savingTitle, setSavingTitle] = useState<string | null>(null);

    // Department rename: deptName → draft value
    const [editingDept, setEditingDept] = useState<Record<string, string>>({});
    const [savingDept, setSavingDept] = useState<string | null>(null);

    // New department form
    const [newDeptName, setNewDeptName] = useState('');
    const [newDeptTitle, setNewDeptTitle] = useState('');
    const [addingDept, setAddingDept] = useState(false);

    const fetchTitles = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/job-titles?withIds=1');
            const data = await res.json();
            const map: Record<string, JobTitleRow[]> = {};
            for (const row of data.rows ?? []) {
                if (!map[row.department]) map[row.department] = [];
                map[row.department].push(row);
            }
            setTitleMap(map);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTitles(); }, [fetchTitles]);

    /* ── Add title ── */
    const handleAdd = async (dept: string) => {
        const title = (newTitle[dept] ?? '').trim();
        if (!title) return;
        setAdding(a => ({ ...a, [dept]: true }));
        try {
            const res = await fetch('/api/admin/job-titles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department: dept, title }),
            });
            const data = await res.json();
            if (!res.ok) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); return; }
            setNewTitle(n => ({ ...n, [dept]: '' }));
            await fetchTitles();
            toast({ title: 'Added', description: `"${title}" added to ${dept}` });
        } finally {
            setAdding(a => ({ ...a, [dept]: false }));
        }
    };

    /* ── Add department ── */
    const handleAddDepartment = async () => {
        const dept = newDeptName.trim();
        const title = newDeptTitle.trim();
        if (!dept || !title) return;
        setAddingDept(true);
        try {
            const res = await fetch('/api/admin/job-titles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department: dept, title }),
            });
            const data = await res.json();
            if (!res.ok) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); return; }
            setNewDeptName('');
            setNewDeptTitle('');
            await fetchTitles();
            toast({ title: 'Department Created', description: `"${dept}" added with job title "${title}"` });
        } finally {
            setAddingDept(false);
        }
    };

    /* ── Delete title ── */
    const handleDelete = async (id: string, title: string, dept: string) => {
        if (!id) return;
        setDeleting(id);
        try {
            const res = await fetch('/api/admin/job-titles', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) {
                const data = await res.json();
                toast({ title: 'Error', description: data.error, variant: 'destructive' });
                return;
            }
            await fetchTitles();
            toast({ title: 'Removed', description: `"${title}" removed from ${dept}` });
        } finally {
            setDeleting(null);
        }
    };

    /* ── Edit title ── */
    const startEditTitle = (row: JobTitleRow) => {
        setEditingTitle(e => ({ ...e, [row.id]: row.title }));
    };

    const cancelEditTitle = (id: string) => {
        setEditingTitle(e => { const n = { ...e }; delete n[id]; return n; });
    };

    const saveEditTitle = async (id: string) => {
        const newVal = (editingTitle[id] ?? '').trim();
        if (!newVal) return;
        setSavingTitle(id);
        try {
            const res = await fetch('/api/admin/job-titles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, title: newVal }),
            });
            const data = await res.json();
            if (!res.ok) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); return; }
            cancelEditTitle(id);
            await fetchTitles();
            toast({ title: 'Updated', description: `Title renamed to "${newVal}"` });
        } finally {
            setSavingTitle(null);
        }
    };

    /* ── Edit department name ── */
    const startEditDept = (dept: string) => {
        setEditingDept(e => ({ ...e, [dept]: dept }));
    };

    const cancelEditDept = (dept: string) => {
        setEditingDept(e => { const n = { ...e }; delete n[dept]; return n; });
    };

    const saveEditDept = async (dept: string) => {
        const newVal = (editingDept[dept] ?? '').trim();
        if (!newVal || newVal === dept) { cancelEditDept(dept); return; }
        setSavingDept(dept);
        try {
            const res = await fetch('/api/admin/job-titles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department: dept, newDepartment: newVal }),
            });
            const data = await res.json();
            if (!res.ok) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); return; }
            cancelEditDept(dept);
            await fetchTitles();
            toast({ title: 'Department Renamed', description: `"${dept}" → "${newVal}"` });
        } finally {
            setSavingDept(null);
        }
    };

    const departments = Object.keys(titleMap).sort();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Job Titles</h1>
                <p className="text-muted-foreground">Manage departments and job titles. These appear as options when creating or editing employees.</p>
            </div>

            {/* Add new department */}
            <div className="p-5 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent space-y-3">
                <div className="flex items-center gap-2">
                    <FolderPlus className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Add New Department</h3>
                </div>
                <div className="flex gap-3 flex-col sm:flex-row">
                    <Input
                        placeholder="Department name (e.g., Finance)"
                        value={newDeptName}
                        onChange={e => setNewDeptName(e.target.value)}
                        className="bg-white/50 flex-1"
                    />
                    <Input
                        placeholder="First job title (required)"
                        value={newDeptTitle}
                        onChange={e => setNewDeptTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDepartment(); } }}
                        className="bg-white/50 flex-1"
                    />
                    <Button
                        onClick={handleAddDepartment}
                        disabled={addingDept || !newDeptName.trim() || !newDeptTitle.trim()}
                        className="shrink-0"
                    >
                        {addingDept ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        Create Department
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                </div>
            ) : departments.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                    No departments yet. Add one above.
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {departments.map(dept => {
                        const titles = titleMap[dept] ?? [];
                        const isEditingDept = dept in editingDept;
                        const isSavingDept = savingDept === dept;

                        return (
                            <Card key={dept}>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                                        {isEditingDept ? (
                                            <div className="flex items-center gap-1 flex-1">
                                                <Input
                                                    autoFocus
                                                    value={editingDept[dept]}
                                                    onChange={e => setEditingDept(v => ({ ...v, [dept]: e.target.value }))}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') saveEditDept(dept);
                                                        if (e.key === 'Escape') cancelEditDept(dept);
                                                    }}
                                                    className="h-7 text-sm font-bold flex-1"
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-primary" onClick={() => saveEditDept(dept)} disabled={isSavingDept}>
                                                    {isSavingDept ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => cancelEditDept(dept)} disabled={isSavingDept}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="flex-1 truncate">{dept}</span>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100 text-muted-foreground hover:text-primary"
                                                    onClick={() => startEditDept(dept)}
                                                    title="Rename department"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                                    {titles.length} title{titles.length !== 1 ? 's' : ''}
                                                </span>
                                            </>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {/* Existing titles */}
                                    <div className="flex flex-wrap gap-2 min-h-[32px]">
                                        {titles.length === 0 && (
                                            <span className="text-xs text-muted-foreground italic">No titles yet</span>
                                        )}
                                        {titles.map(row => {
                                            const isEditing = row.id in editingTitle;
                                            const isSaving = savingTitle === row.id;
                                            return isEditing ? (
                                                <div key={row.id} className="flex items-center gap-1">
                                                    <Input
                                                        autoFocus
                                                        value={editingTitle[row.id]}
                                                        onChange={e => setEditingTitle(v => ({ ...v, [row.id]: e.target.value }))}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') saveEditTitle(row.id);
                                                            if (e.key === 'Escape') cancelEditTitle(row.id);
                                                        }}
                                                        className="h-7 text-xs w-36"
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => saveEditTitle(row.id)} disabled={isSaving}>
                                                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cancelEditTitle(row.id)} disabled={isSaving}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Badge
                                                    key={row.id || row.title}
                                                    variant="secondary"
                                                    className="flex items-center gap-1 pr-1 group/badge"
                                                >
                                                    {row.title}
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditTitle(row)}
                                                        className="ml-0.5 rounded p-0.5 opacity-0 group-hover/badge:opacity-100 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                                        title="Rename title"
                                                    >
                                                        <Pencil className="h-2.5 w-2.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(row.id, row.title, dept)}
                                                        disabled={deleting === row.id || !row.id}
                                                        className="ml-0.5 rounded hover:bg-destructive/20 p-0.5 transition-colors disabled:opacity-40"
                                                        aria-label={`Remove ${row.title}`}
                                                    >
                                                        {deleting === row.id
                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                            : <X className="h-3 w-3" />
                                                        }
                                                    </button>
                                                </Badge>
                                            );
                                        })}
                                    </div>

                                    {/* Add new title */}
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="New job title…"
                                            value={newTitle[dept] ?? ''}
                                            onChange={e => setNewTitle(n => ({ ...n, [dept]: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(dept); } }}
                                            className="h-8 text-sm"
                                        />
                                        <Button
                                            size="sm"
                                            className="h-8 px-2"
                                            onClick={() => handleAdd(dept)}
                                            disabled={adding[dept] || !(newTitle[dept] ?? '').trim()}
                                        >
                                            {adding[dept] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
