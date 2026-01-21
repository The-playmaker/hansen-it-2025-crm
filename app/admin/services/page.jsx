"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { supabase } from "@/lib/supabaseClient";
import { Trash2, Plus, ArrowLeft } from "lucide-react";

export default function ServicesPage() {
  const router = useRouter();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    short_description: "",
    description: "",
    href: "",
    features: [], // array of strings
    icon_name: "Wrench",
  });

  // one feature per line
  const [featuresText, setFeaturesText] = useState("");

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase.from("services").select("*").order("sort_order");
      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      short_description: "",
      description: "",
      href: "",
      features: [],
      icon_name: "Wrench",
    });
    setFeaturesText("");
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const featuresArray = featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const payload = { ...formData, features: featuresArray };

    try {
      const q = editingId
        ? supabase.from("services").update(payload).eq("id", editingId)
        : supabase.from("services").insert([payload]);

      const { error } = await q;
      if (error) throw error;

      resetForm();
      fetchServices();
    } catch (error) {
      console.error("Error saving service:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
      fetchServices();
    } catch (error) {
      console.error("Error deleting service:", error);
    }
  };

  const handleEdit = (service) => {
    setFormData({
      name: service.name || "",
      short_description: service.short_description || "",
      description: service.description || "",
      href: service.href || "",
      features: service.features || [],
      icon_name: service.icon_name || "Wrench",
    });
    setFeaturesText((service.features || []).join("\n"));
    setEditingId(service.id);
    setShowForm(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => router.push("/admin/dashboard")} className="gap-2">
          <ArrowLeft size={16} />
          Back
        </Button>

        <div className="flex-1" />

        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus size={16} />
          New service
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Services</h1>
          <p className="text-brand-300 text-sm mt-1">Manage services shown in CRM / website.</p>
        </div>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-brand-200">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-brand-200">Href</label>
                <Input
                  value={formData.href}
                  onChange={(e) => setFormData((p) => ({ ...p, href: e.target.value }))}
                  placeholder="/services/whatever"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-brand-200">Short description</label>
              <Input
                value={formData.short_description}
                onChange={(e) => setFormData((p) => ({ ...p, short_description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-brand-200">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-brand-200">Features (one per line)</label>
              <Textarea value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} rows={6} />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-brand-200">Icon name</label>
              <Input
                value={formData.icon_name}
                onChange={(e) => setFormData((p) => ({ ...p, icon_name: e.target.value }))}
                placeholder="Wrench"
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit">{editingId ? "Save changes" : "Create service"}</Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="py-8 text-center text-brand-300">Loading…</div>
        ) : services.length === 0 ? (
          <div className="py-8 text-center text-brand-300">No services yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-800">
                  <th className="text-left py-3 px-4 text-white">Name</th>
                  <th className="text-left py-3 px-4 text-white">Href</th>
                  <th className="text-left py-3 px-4 text-white">Icon</th>
                  <th className="text-right py-3 px-4 text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className="border-b border-brand-800 hover:bg-brand-900/40">
                    <td className="py-3 px-4 text-white">{s.name}</td>
                    <td className="py-3 px-4 text-brand-300">{s.href || "-"}</td>
                    <td className="py-3 px-4 text-brand-300">{s.icon_name || "-"}</td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => handleEdit(s)}>
                          Edit
                        </Button>
                        <Button variant="outline" onClick={() => handleDelete(s.id)} className="gap-2">
                          <Trash2 size={16} />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
