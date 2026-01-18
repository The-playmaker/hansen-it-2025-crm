"use client";
export const dynamic = "force-dynamic";

export default function ServicesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white">Services</h1>
      <p className="text-brand-300 mt-2">Services page is loading correctly.</p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { supabase } from '@/lib/supabaseClient';
import { Trash2, Plus, ArrowLeft } from 'lucide-react';


export default function AdminServices() {
  const router = useRouter();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    short_description: '',
    description: '',
    href: '',
    features: [], // array of strings
    icon_name: 'Wrench',
  });

  // Helper to handle features text area (one per line)
  const [featuresText, setFeaturesText] = useState('');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data } = await supabase
        .from('services')
        .select('*')
        .order('sort_order');

      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Convert features text to array
    const featuresArray = featuresText
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const payload = {
        ...formData,
        features: featuresArray
    };

    try {
      if (editingId) {
        await supabase
          .from('services')
          .update(payload)
          .eq('id', editingId);
      } else {
        await supabase.from('services').insert([payload]);
      }

      resetForm();
      fetchServices();
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      short_description: '',
      description: '',
      href: '',
      features: [],
      icon_name: 'Wrench',
    });
    setFeaturesText('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      await supabase.from('services').delete().eq('id', id);
      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const handleEdit = (service) => {
    setFormData({
      name: service.name,
      short_description: service.short_description || '',
      description: service.description || '',
      href: service.href || '',
      features: service.features || [],
      icon_name: service.icon_name || 'Wrench',
    });
    setFeaturesText((service.features || []).join('\n'));
    setEditingId(service.id);
    setShowForm(true);
  };

  
}
