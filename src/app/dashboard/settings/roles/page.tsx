'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Save, ShieldCheck, Plus, Trash2, Pencil } from 'lucide-react';
import { APP_SECTION_GROUPS } from '@/lib/section-groups';

const BUILT_IN_ROLES = ['admin', 'waiter', 'kitchen', 'payment'];

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-green-600',
  waiter: 'bg-blue-500',
  kitchen: 'bg-orange-500',
  payment: 'bg-purple-500',
};

export default function RolePermissionsPage() {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('');

  // Create role dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [creating, setCreating] = useState(false);

  // Rename role dialog
  const [renameOpen, setRenameOpen] = useState(false);
  const [renamingRole, setRenamingRole] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/role-permissions')
      .then(r => r.json())
      .then(d => {
        if (d.permissions) {
          setPermissions(d.permissions);
          const r = Object.keys(d.permissions);
          setRoles(r);
          setActiveTab(r[0] ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (role: string, path: string) => {
    setPermissions(prev => {
      const current = prev[role] || [];
      const next = current.includes(path)
        ? current.filter(p => p !== path)
        : [...current, path];
      return { ...prev, [role]: next };
    });
  };

  const toggleGroup = (role: string, paths: string[]) => {
    setPermissions(prev => {
      const current = prev[role] || [];
      const allChecked = paths.every(p => current.includes(p));
      const next = allChecked
        ? current.filter(p => !paths.includes(p))
        : [...new Set([...current, ...paths])];
      return { ...prev, [role]: next };
    });
  };

  const save = async (role: string) => {
    setSaving(role);
    try {
      const res = await fetch('/api/admin/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, paths: permissions[role] }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: 'Saved', description: `Permissions updated for "${role}" role.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSaving(null);
    }
  };

  const createRole = async () => {
    const name = newRoleName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name) return;
    if (roles.includes(name)) {
      toast({ variant: 'destructive', title: 'Role exists', description: `"${name}" already exists.` });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: name, paths: [] }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: 'Role created', description: `"${name}" created. Assign permissions and save.` });
      setPermissions(prev => ({ ...prev, [name]: [] }));
      setRoles(prev => [...prev, name]);
      setActiveTab(name);
      setCreateOpen(false);
      setNewRoleName('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const openRename = (role: string) => {
    setRenamingRole(role);
    setRenameValue(role.replace(/_/g, ' '));
    setRenameOpen(true);
  };

  const renameRole = async () => {
    const newName = renameValue.trim().toLowerCase().replace(/\s+/g, '_');
    if (!newName || newName === renamingRole) { setRenameOpen(false); return; }
    if (roles.includes(newName)) {
      toast({ variant: 'destructive', title: 'Name taken', description: `"${newName}" already exists.` });
      return;
    }
    setRenaming(true);
    try {
      const res = await fetch('/api/admin/role-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldRole: renamingRole, newRole: newName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: 'Role renamed', description: `"${renamingRole}" → "${newName}". All employees with this role have been updated.` });
      // Update local state
      const oldPaths = permissions[renamingRole] || [];
      setPermissions(prev => {
        const n = { ...prev };
        delete n[renamingRole];
        n[newName] = oldPaths;
        return n;
      });
      setRoles(prev => prev.map(r => r === renamingRole ? newName : r));
      setActiveTab(newName);
      setRenameOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setRenaming(false);
    }
  };

  const deleteRole = async (role: string) => {
    setDeleting(role);
    try {
      const res = await fetch('/api/admin/role-permissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: 'Role deleted', description: `"${role}" role removed.` });
      const remaining = roles.filter(r => r !== role);
      setRoles(remaining);
      setPermissions(prev => { const n = { ...prev }; delete n[role]; return n; });
      setActiveTab(remaining[0] ?? '');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Role Permissions</h1>
            <p className="text-muted-foreground text-sm">
              Define which sections each role can access. These become the starting permissions when creating a new employee.
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No roles yet. Click "New Role" to create one.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            {roles.map(r => (
              <TabsTrigger key={r} value={r} className="gap-2 capitalize">
                <span className={`inline-block w-2 h-2 rounded-full ${ROLE_COLORS[r] ?? 'bg-slate-500'}`} />
                {r.replace(/_/g, ' ')}
                <Badge variant="secondary" className="text-xs ml-1">
                  {(permissions[r] || []).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {roles.map(role => (
            <TabsContent key={role} value={role}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 capitalize">
                      <span className={`inline-block w-3 h-3 rounded-full ${ROLE_COLORS[role] ?? 'bg-slate-500'}`} />
                      {role.replace(/_/g, ' ')} Role
                    </CardTitle>
                    <CardDescription>
                      {(permissions[role] || []).length} sections selected. New employees with this role start with these permissions.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {!BUILT_IN_ROLES.includes(role) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRename(role)}
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          Rename
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteRole(role)}
                          disabled={deleting === role}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          {deleting === role ? 'Deleting...' : 'Delete'}
                        </Button>
                      </>
                    )}
                    <Button onClick={() => save(role)} disabled={saving === role}>
                      <Save className="mr-2 h-4 w-4" />
                      {saving === role ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    {APP_SECTION_GROUPS.map(group => {
                      const groupPaths = group.sections.map(s => s.path);
                      const allChecked = groupPaths.every(p => (permissions[role] || []).includes(p));
                      const someChecked = groupPaths.some(p => (permissions[role] || []).includes(p));
                      return (
                        <div key={group.name} className="space-y-2">
                          <div className="flex items-center gap-2 border-b pb-1">
                            <Checkbox
                              checked={allChecked}
                              data-state={someChecked && !allChecked ? 'indeterminate' : undefined}
                              onCheckedChange={() => toggleGroup(role, groupPaths)}
                              id={`group-${role}-${group.name}`}
                            />
                            <label
                              htmlFor={`group-${role}-${group.name}`}
                              className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 cursor-pointer"
                            >
                              {group.name}
                            </label>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 pl-2">
                            {group.sections.map(section => (
                              <div key={section.path} className="flex items-center gap-2">
                                <Checkbox
                                  id={`${role}-${section.path}`}
                                  checked={(permissions[role] || []).includes(section.path)}
                                  onCheckedChange={() => toggle(role, section.path)}
                                />
                                <label
                                  htmlFor={`${role}-${section.path}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {section.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Create Role Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-role-name">Role Name</Label>
            <Input
              id="new-role-name"
              placeholder="e.g. receptionist"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createRole(); }}
            />
            <p className="text-xs text-muted-foreground">
              Spaces become underscores, stored in lowercase (e.g. "Front Desk" → "front_desk").
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setNewRoleName(''); }}>
              Cancel
            </Button>
            <Button onClick={createRole} disabled={!newRoleName.trim() || creating}>
              {creating ? 'Creating...' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Role Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rename-role">New Name for "{renamingRole.replace(/_/g, ' ')}"</Label>
            <Input
              id="rename-role"
              placeholder="New role name"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') renameRole(); }}
            />
            <p className="text-xs text-muted-foreground">
              All employees currently assigned "{renamingRole.replace(/_/g, ' ')}" will be updated to the new name automatically.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={renameRole} disabled={!renameValue.trim() || renaming}>
              {renaming ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
