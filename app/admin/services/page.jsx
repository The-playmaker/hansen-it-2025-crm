'use client';
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

  return (
    <AdminLayout title="Services">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold text-white">Manage Services</h1>
          </div>
          {!showForm && (
            <Button
              variant="primary"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2"
            >
              <Plus size={18} />
              Add Service
            </Button>
          )}
        </div>

        {showForm && (
          <Card className="mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Edit Service' : 'Add New Service'}
              </h2>

              <Input
                label="Service Name"
                placeholder="e.g., Kitchen Renovation"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <Input
                label="Short Description"
                placeholder="One line description (displayed on card)"
                value={formData.short_description}
                onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                required
              />

              <Textarea
                label="Full Description"
                placeholder="Detailed service description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />

              <Input
                label="Link (href)"
                placeholder="/automation"
                value={formData.href}
                onChange={(e) => setFormData({ ...formData, href: e.target.value })}
              />

              <Textarea
                label="Features (one per line)"
                placeholder="Feature 1\nFeature 2\nFeature 3"
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                rows={5}
              />

              <div className="flex gap-4">
                <Button variant="primary" type="submit">
                  {editingId ? 'Update Service' : 'Add Service'}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin"></div>
          </div>
        ) : services.length > 0 ? (
          <div className="space-y-4">
            {services.map((service) => (
              <Card key={service.id} hover>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{service.name}</h3>
                    <p className="text-brand-400 mb-2">{service.short_description}</p>
                    {service.href && (
                        <p className="text-xs text-accent-blue mb-2">Link: {service.href}</p>
                    )}
                    {service.features && service.features.length > 0 && (
                        <ul className="list-disc list-inside text-sm text-brand-300 mb-2">
                            {service.features.map((feat, idx) => (
                                <li key={idx}>{feat}</li>
                            ))}
                        </ul>
                    )}
                    <p className="text-sm text-brand-500 line-clamp-2">{service.description}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(service)}
                    >
                      Edit
                    </Button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-500 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-12">
              <p className="text-brand-400 mb-4">No services created yet.</p>
              <Button variant="primary" onClick={() => setShowForm(true)}>
                Create First Service
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
