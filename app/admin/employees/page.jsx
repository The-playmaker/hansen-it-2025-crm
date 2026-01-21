"use client";
export const dynamic = "force-dynamic";

export default function EmployeesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white">Team / Employees</h1>
      <p className="text-brand-300 mt-2">OK – page renders.</p>
    </div>
  );
}


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


}
