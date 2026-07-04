export function mapRequestToLead(request = {}) {
  const message = request.message || request.description || request.customer_message || "";
  const createdAt = request.created_at || request.createdAt || null;
  const updatedAt = request.updated_at || request.updatedAt || null;

  return {
    id: request.id,
    name: request.name || request.customer_name || "",
    email: request.email || "",
    company: request.company || "",
    phone: request.phone || "",
    message,
    priority: request.priority || "normal",
    status: normalizeRequestStatus(request.status),
    rawStatus: request.status || "ny",
    created_at: createdAt,
    updated_at: updatedAt,
    createdAt,
    updatedAt,
    source: request.source || "requests",
    category: request.category || "Henvendelse",
    request
  };
}

export function normalizeRequestStatus(status) {
  const value = String(status || "ny").trim().toLowerCase();
  if (["ny", "new"].includes(value)) return "ny";
  if (["pågår", "pagaar", "pagar", "in_progress", "under arbeid"].includes(value)) return "pågår";
  if (["fullført", "fullfort", "ferdig", "done", "completed"].includes(value)) return "fullført";
  if (["arkivert", "archived"].includes(value)) return "arkivert";
  if (["converted", "konvertert"].includes(value)) return "converted";
  return value || "ny";
}

export function toRequestStatus(status) {
  const normalized = normalizeRequestStatus(status);
  return {
    ny: "ny",
    "pågår": "pågår",
    "fullført": "fullført",
    arkivert: "arkivert",
    converted: "converted"
  }[normalized] || normalized;
}

export function normalizeRequestPriority(priority) {
  const value = String(priority || "normal").trim().toLowerCase();
  return value === "hast" || value === "urgent" || value === "høy" ? "hast" : "normal";
}

export function isOpenRequest(request = {}) {
  return !["fullført", "arkivert", "converted"].includes(normalizeRequestStatus(request.status));
}

export function isHastRequest(request = {}) {
  return normalizeRequestPriority(request.priority) === "hast";
}
