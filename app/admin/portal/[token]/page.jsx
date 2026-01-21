"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  AlertTriangle,
  Calendar,
  MapPin,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Paperclip,
  Download,
} from "lucide-react";

export default function QuotePortal() {
  const { token } = useParams();
  const tokenStr = String(token || "");

  const [data, setData] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const totalHours = useMemo(
    () => timeEntries.reduce((sum, t) => sum + Number(t.hours || 0), 0),
    [timeEntries]
  );

  useEffect(() => {
    if (!tokenStr) return;

    const load = async () => {
      try {
        setLoading(true);
        setInvalid(false);

        const res = await fetch(`/api/portal/${encodeURIComponent(tokenStr)}`, {
          cache: "no-store",
        });

        const json = await res.json();
        if (!res.ok) {
          console.error("Portal load error:", json);
          setInvalid(true);
          return;
        }

        setTimeEntries(json.timeEntries || []);
        setAttachments(json.attachments || []);
        setData({ quote: json.quote, employee: json.employee, token: json.token });
      } catch (e) {
        console.error(e);
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tokenStr]);

  const statusLabel = (status) => {
    switch (status) {
      case "Ny":
        return "New – we have received your request";
      case "Pågår":
        return "In progress – we are working on your project";
      case "Fullført":
        return "Completed";
      default:
        return status || "Unknown";
    }
  };

  const statusChip = (status) => {
    const base = "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border";
    if (status === "Ny")
      return <span className={`${base} border-blue-500/40 bg-blue-500/10 text-blue-200`}>New</span>;
    if (status === "Pågår")
      return (
        <span className={`${base} border-yellow-500/40 bg-yellow-500/10 text-yellow-200`}>
          In progress
        </span>
      );
    if (status === "Fullført")
      return (
        <span className={`${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`}>
          Completed
        </span>
      );
    return (
      <span className={`${base} border-brand-700 bg-brand-900/40 text-brand-200`}>
        {status || "Unknown"}
      </span>
    );
  };

  const downloadAttachment = async (file_path) => {
    try {
      const res = await fetch("/api/portal/attachments/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenStr, file_path }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to sign URL");

      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
      alert("Could not download the file. Please try again.");
    }
  };

  // (Foreløpig) messages/actions: lagres som notes via API (ikke client supabase)
  const postPortalMessage = async () => {
    if (!data?.quote?.id || !message.trim()) return;

    try {
      setSending(true);

      const res = await fetch("/api/portal/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenStr, message: message.trim() }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");

      setMessage("");
      alert("Message sent!");
    } catch (e) {
      console.error(e);
      alert("Could not send message.");
    } finally {
      setSending(false);
    }
  };

  const portalAction = async (type) => {
    if (!data?.quote?.id) return;

    try {
      setActionBusy(true);

      const res = await fetch("/api/portal/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenStr, type }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");

      alert(type === "approved" ? "Thanks! We received your approval." : "Thanks! We received your request.");
    } catch (e) {
      console.error(e);
      alert("Could not update status.");
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  if (invalid || !data) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center px-4">
        <Card className="max-w-md text-center border-red-500 bg-red-500/10">
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <h1 className="text-xl font-bold text-white">Link not valid</h1>
            <p className="text-sm text-red-200">
              This access link is invalid or has expired. Please contact us for an updated link.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const { quote, employee } = data;

  const offerPdf =
    attachments.find(
      (a) =>
        (a.file_name || "").toLowerCase().includes("offer") &&
        (a.file_name || "").toLowerCase().endsWith(".pdf")
    ) ||
    attachments.find((a) => (a.file_name || "").toLowerCase().endsWith(".pdf")) ||
    null;

  return (
    <div className="min-h-screen bg-brand-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
        <Card className="border-accent-blue/50 bg-brand-900/70">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Your project with Hansen IT</h1>
              <p className="text-brand-300 text-sm">Track status, view the offer, and communicate with us here.</p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {statusChip(quote.status)}
                <span className="text-[11px] text-brand-500 font-mono">Project ID: {quote.id}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => portalAction("approved")} disabled={actionBusy} className="gap-2">
                <CheckCircle2 size={16} /> Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => portalAction("changes_requested")}
                disabled={actionBusy}
                className="gap-2"
              >
                <XCircle size={16} /> Request changes
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4" /> Your details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-brand-300">
                  <div>
                    <div className="text-xs text-brand-500 uppercase">Name</div>
                    <div className="text-white">{quote.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-brand-500 uppercase">Email</div>
                    <div className="text-white">{quote.email}</div>
                  </div>
                  {quote.phone ? (
                    <div>
                      <div className="text-xs text-brand-500 uppercase">Phone</div>
                      <div className="text-white">{quote.phone}</div>
                    </div>
                  ) : null}
                  {quote.address ? (
                    <div>
                      <div className="text-xs text-brand-500 uppercase flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> Address
                      </div>
                      <div className="text-white">{quote.address}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Project status & schedule
                </h2>

                <p className="text-sm text-brand-300">
                  <span className="font-medium text-white">Status:</span> {statusLabel(quote.status)}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-brand-300">
                  <div>
                    <p className="font-medium text-white text-xs uppercase">Inspection</p>
                    <p>
                      {quote.inspection_date
                        ? new Date(quote.inspection_date).toLocaleString()
                        : "Not scheduled yet"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-white text-xs uppercase">Start</p>
                    <p>{quote.start_date ? new Date(quote.start_date).toLocaleDateString() : "Not scheduled yet"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-white text-xs uppercase">Due</p>
                    <p>{quote.due_date ? new Date(quote.due_date).toLocaleDateString() : "Not defined yet"}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-brand-800 mt-2 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm text-brand-300 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>
                      <span className="font-medium text-white">Logged hours:</span> {totalHours.toFixed(2)}h
                    </span>
                  </div>

                  {employee ? (
                    <div className="text-sm text-brand-300">
                      <span className="font-medium text-white">Assigned contact:</span> {employee.name}
                      {employee.phone ? ` · ${employee.phone}` : ""}
                      {employee.email ? ` · ${employee.email}` : ""}
                    </div>
                  ) : (
                    <div className="text-sm text-brand-500">No assigned contact yet.</div>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-white mb-3">Your request</h2>
              <p className="text-sm text-brand-300 whitespace-pre-wrap">{quote.message}</p>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-white mb-2">Send a message</h2>
              <p className="text-sm text-brand-300 mb-3">
                Send additional details or questions here. We will see it internally.
              </p>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message…" />
              <div className="mt-3">
                <Button onClick={postPortalMessage} disabled={sending || !message.trim()}>
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div className="text-white font-semibold flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Documents
                </div>
              </div>

              {offerPdf ? (
                <div className="mt-3 space-y-2">
                  <div className="text-sm text-white">{offerPdf.file_name}</div>
                  <Button variant="outline" className="gap-2" onClick={() => downloadAttachment(offerPdf.file_path)}>
                    <Download size={16} /> Download
                  </Button>
                </div>
              ) : (
                <div className="mt-3 text-sm text-brand-400">No offer document available yet.</div>
              )}

              {attachments.length > 1 ? (
                <div className="mt-4 pt-4 border-t border-brand-800">
                  <div className="text-xs text-brand-500 uppercase mb-2">All attachments</div>
                  <div className="space-y-2">
                    {attachments.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => downloadAttachment(a.file_path)}
                        className="w-full text-left border border-brand-800 rounded-lg p-2 hover:bg-brand-900/40"
                      >
                        <div className="text-sm text-white flex items-center gap-2">
                          <Paperclip className="w-4 h-4" /> {a.file_name}
                        </div>
                        <div className="text-[11px] text-brand-500">
                          {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-white mb-2">Need changes?</h2>
              <p className="text-sm text-brand-300">
                If you want to change details or add information, use the message box or contact us and refer to:
              </p>
              <p className="text-sm text-accent-blue font-mono mt-2">Project ID: #{quote.id}</p>
            </Card>

            <div className="text-center text-[11px] text-brand-500">Hansen IT – powered by CRM</div>
          </div>
        </div>
      </div>
    </div>
  );
}
