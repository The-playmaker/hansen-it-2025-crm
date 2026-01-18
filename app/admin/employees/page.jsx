'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { UserPlus, UserX, Trash2 } from 'lucide-react';


const ROLE_LABELS = {
  worker: 'Worker',
  manager: 'Manager',
  admin: 'Admin',
};

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('worker');
  const [adding, setAdding] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: employeesError } = await supabase
        .from('employees')
        .select('id, name, email, phone, role, active, auth_user_id')
        .order('name', { ascending: true });

      if (employeesError) throw employeesError;

      setEmployees(data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const toggleActive = async (employee) => {
    setSavingId(employee.id);
    setError(null);

    try {
      const { error } = await supabase
        .from('employees')
        .update({ active: !employee.active })
        .eq('id', employee.id);

      if (error) throw error;

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employee.id ? { ...e, active: !employee.active } : e
        )
      );
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update employee');
    } finally {
      setSavingId(null);
    }
  };

  const changeRole = async (employee, newRole) => {
    setSavingId(employee.id);
    setError(null);

    try {
      const { error } = await supabase
        .from('employees')
        .update({ role: newRole })
        .eq('id', employee.id);

      if (error) throw error;

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employee.id ? { ...e, role: newRole } : e
        )
      );
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update role');
    } finally {
      setSavingId(null);
    }
  };

  const handleAddEmployee = async () => {
    if (!newName.trim()) {
      setError('Name is required for new employee');
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('employees')
        .insert([
          {
            name: newName.trim(),
            email: newEmail.trim() || null,
            phone: newPhone.trim() || null,
            role: newRole,
            active: true,
          },
        ])
        .select('id, name, email, phone, role, active, auth_user_id')
        .single();

      if (error) throw error;

      setEmployees((prev) => [...prev, data]);

      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewRole('worker');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to add employee');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteEmployee = async (employee) => {
    const confirmed = window.confirm(
      `Delete employee "${employee.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setSavingId(employee.id);
    setError(null);

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employee.id);

      if (error) throw error;

      setEmployees((prev) => prev.filter((e) => e.id !== employee.id));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete employee');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminLayout title="Employees">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Employees & Roles</h1>
        </div>

        {error && (
          <Card className="border-red-500 bg-red-500/10">
            <p className="text-red-300 text-sm">{error}</p>
          </Card>
        )}

        {/* Add employee form */}
        <Card>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Add Employee
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Name *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-sm text-white placeholder-brand-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-sm text-white placeholder-brand-500"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-sm text-white placeholder-brand-500"
              />
              <div className="flex items-center gap-3">
                <select
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value)
                  }
                  className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-sm text-white flex-1"
                >
                  <option value="worker">Worker</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={adding}
                  onClick={handleAddEmployee}
                  className="whitespace-nowrap"
                >
                  {adding ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Employees table */}
        <Card>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-brand-400">No employees yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-700">
                    <th className="text-left py-3 px-4 text-white">Name</th>
                    <th className="text-left py-3 px-4 text-white">Email</th>
                    <th className="text-left py-3 px-4 text-white">Phone</th>
                    <th className="text-left py-3 px-4 text-white">Role</th>
                    <th className="text-left py-3 px-4 text-white">Login Linked</th>
                    <th className="text-left py-3 px-4 text-white">Active</th>
                    <th className="text-left py-3 px-4 text-white">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const isSaving = savingId === emp.id;
                    const roleLabel =
                      (emp.role && ROLE_LABELS[emp.role]) || 'Worker';

                    return (
                      <tr
                        key={emp.id}
                        className="border-b border-brand-700 hover:bg-brand-900/40"
                      >
                        <td className="py-3 px-4 text-white">{emp.name}</td>
                        <td className="py-3 px-4 text-brand-300">
                          {emp.email || (
                            <span className="text-brand-600 italic">
                              No email
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-brand-300">
                          {emp.phone || (
                            <span className="text-brand-600 italic">
                              No phone
                            </span>
                          )}
                        </td>

                        {/* Rolle */}
                        <td className="py-3 px-4 text-brand-300">
                          <select
                            value={emp.role || 'worker'}
                            onChange={(e) => changeRole(emp, e.target.value)}
                            disabled={isSaving}
                            className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-1 text-xs text-white"
                          >
                            <option value="worker">Worker</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                          <span className="inline-block mt-1 px-2 py-1 text-[10px] rounded bg-brand-800 text-brand-400 border border-brand-700 ml-2">
                            {roleLabel}
                          </span>
                        </td>

                        {/* Login linked */}
                        <td className="py-3 px-4 text-brand-300 text-xs">
                          {emp.auth_user_id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/40">
                              Linked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-brand-900 text-brand-500 border border-brand-700">
                              No login
                            </span>
                          )}
                        </td>

                        {/* Active toggle */}
                        <td className="py-3 px-4">
                          <Button
                            type="button"
                            size="sm"
                            variant={emp.active ? 'outline' : 'secondary'}
                            disabled={isSaving}
                            onClick={() => toggleActive(emp)}
                            className="flex items-center gap-2 text-xs"
                          >
                            {emp.active ? (
                              <>
                                <UserX className="w-3 h-3" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-3 h-3" />
                                Activate
                              </>
                            )}
                          </Button>
                        </td>

                        {/* Delete */}
                        <td className="py-3 px-4">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isSaving}
                            onClick={() => handleDeleteEmployee(emp)}
                            className="flex items-center gap-1 text-xs text-red-400 border-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
