import React, { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Skeleton } from '../../../components/ui/skeleton';
import { Plus } from 'lucide-react';
import { getAllAdmins, addAdmin } from '../../../lib/firestore';
import { createAuthUser, getAuthErrorMessage } from '../../../lib/auth';
import { Admin } from '../../../types';
import { toast } from 'sonner';
import { format } from 'date-fns';

export const AdminList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const data = await getAllAdmins();
      setAdmins(data);
    } catch (error) {
      console.error('Error loading admins:', error);
      toast.error('Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newAdminEmail || !newAdminName || !newAdminPassword) {
      toast.error('Email, name, and password are required');
      return;
    }

    try {
      setAdding(true);
      const uid = await createAuthUser(newAdminEmail, newAdminPassword, newAdminName);
      await addAdmin(uid, newAdminEmail.toLowerCase(), newAdminName);
      
      toast.success('Admin added successfully');
      setShowAddDialog(false);
      setNewAdminEmail('');
      setNewAdminName('');
      setNewAdminPassword('');
      await loadAdmins();
    } catch (error: unknown) {
      console.error('Error adding admin:', error);
      toast.error(getAuthErrorMessage(error));
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admins</h1>
          <p className="text-muted-foreground">Manage administrator accounts</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Admin
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Admins ({admins.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No admins found
                  </TableCell>
                </TableRow>
              ) : (
                admins.map(admin => (
                  <TableRow key={admin.uid}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      {admin.createdAt ? format(admin.createdAt.toDate(), 'MMM dd, yyyy') : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px] w-full" onClose={() => setShowAddDialog(false)}>
          <DialogHeader>
            <DialogTitle>Add New Admin</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Temporary password *</Label>
              <Input
                id="password"
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={adding}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={adding}>
                {adding ? 'Adding...' : 'Add Admin'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
