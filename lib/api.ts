import { apiUrl } from "../components/config"

type ToastFn = (opts: { title: string; description: string; variant?: "destructive" | "default" }) => void;

// Detecta rutas solo-ADMIN
function isAdminOnlyPath(url: string): boolean {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const p = u.pathname || "";
    // Ajusta este listado si tienes más prefijos solo-admin
    return /^\/api\/(dashboard|reports|admin)(\/|$)/.test(p);
  } catch {
    // Si es una URL relativa no parseable, haz una comprobación simple
    return /\/api\/(dashboard|reports|admin)\b/.test(url);
  }
}

export async function fetchWithAuth(url: string, options: RequestInit = {}, toastFn?: ToastFn) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (!token) {
    if (toastFn) toastFn({ title: "Sesión expirada", description: "Por favor inicia sesión nuevamente.", variant: "destructive" });
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("No token");
  }
  const hasBody = !!options.body;
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
    ...(hasBody ? { "Content-Type": (options.headers as any)?.["Content-Type"] || "application/json" } : {})
  } as Record<string, string>;

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let errorText = await res.text(); let backendMsg = "";
    try { const json = JSON.parse(errorText); backendMsg = json.message || errorText; } catch { backendMsg = errorText; }
    const lowerMsg = (backendMsg || "").toLowerCase();

    if (res.status === 403 && lowerMsg.includes("cerrar tu caja")) {
      if (toastFn) toastFn({ title: "Atención", description: backendMsg, variant: "destructive" });
      if (typeof window !== "undefined" && window.location.pathname !== "/dashboard/caja") window.location.href = "/dashboard/caja";
      return null;
    }
    if (res.status === 403 && (lowerMsg.includes("fuera de tu horario") || lowerMsg.includes("fuera de horario"))) {
      if (toastFn) toastFn({ title: "Acceso fuera de turno", description: backendMsg, variant: "destructive" });
      localStorage.removeItem("token"); localStorage.removeItem("usuario");
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error(backendMsg);
    }
    if (res.status === 401) {
      localStorage.removeItem("token"); localStorage.removeItem("usuario");
      if (toastFn) toastFn({ title: "Sesión expirada", description: "Por seguridad, inicia sesión nuevamente.", variant: "destructive" });
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Sesión expirada");
    }

    if (toastFn) toastFn({ title: "Error", description: backendMsg || `Error en la petición: ${res.status}`, variant: "destructive" });
    throw new Error(backendMsg || `Error en la petición: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/octet-stream") || contentType.includes("application/vnd.openxmlformats")) return res;
  const contentLength = res.headers.get("content-length");
  if (res.status === 204 || contentLength === "0") return null;

  const text = await res.text(); if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function downloadWithAuth(path: string, filename = "reporte.xlsx", toastFn?: ToastFn, onStart?: () => void) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (!token) {
    if (toastFn) toastFn({ title: "Sesión expirada", description: "Por favor inicia sesión nuevamente.", variant: "destructive" });
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("No token");
  }
  const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const blob = await res.blob(); let msg = `Error ${res.status}`;
    try { const text = await blob.text(); const json = JSON.parse(text); msg = json.message || text || msg; } catch {}
    throw new Error(msg);
  }
  // Notifica al llamador que la respuesta del servidor llegó y la descarga está por comenzar
  try { onStart && onStart(); } catch (e) { console.warn("onStart callback failed", e) }

  const blob = await res.blob(); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* Tipos */
export type SalesSummary = { ventas: number; tickets: number; unidades: number; ticket_promedio: number; upt: number }
export type SalesByDay = { fecha: string; tickets: number; unidades: number; ventas: number; ticket_promedio: number; upt: number }
export type SalesByHour = { hora: number; tickets: number; ventas: number }
export type TopProduct = { codigo_barras: string; nombre: string; categoria: string | null; unidades: number; ventas: number }
export type PaymentMix = { metodo_pago: string; tickets: number; total: number }
export type TopCustomer = { dni: string | null; nombre: string | null; tickets: number; unidades: number; ventas: number; ultima_compra: string | null }
export type InventoryProductFull = {
  codigo_barras: string; cantidad_unidades_blister: number | null; activo: boolean | null; cantidad_general: number | null; categoria: string | null;
  concentracion: string | null; descuento: number | null; fecha_actualizacion: string | null; fecha_creacion: string | null; laboratorio: string | null;
  nombre: string; precio_venta_blister: number | null; precio_venta_und: number | null; cantidad_minima: number | null; principio_activo: string | null;
  tipo_medicamento: string | null; presentacion: string | null; stock_total: number; lotes: number; lotes_vencidos: number; proximo_vencimiento: string | null;
  valor_compra_total: number | null; costo_promedio: number | null
}
export type InventoryLot = { lote_id: number; codigo_barras: string; cantidad_unidades: number; fecha_vencimiento: string | null; precio_compra: number | null; estado: string }
export type CajaSummary = { ingresos: number; egresos: number; neto: number }

/* Utils */
function toQuery(params?: Record<string, any>) {
  if (!params) return ""; const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v === undefined || v === null) return; if (v instanceof Date) search.append(k, v.toISOString()); else search.append(k, String(v)); });
  const s = search.toString(); return s ? `?${s}` : "";
}

/* Ventas (reportes - ADMIN) */
export function getSalesSummary({ from, to }: { from: Date; to: Date }) { return fetchWithAuth(apiUrl("/api/reports/sales/summary") + toQuery({ from, to })) as Promise<SalesSummary> }
export function getSalesByDay({ from, to }: { from: Date; to: Date }) { return fetchWithAuth(apiUrl("/api/reports/sales/by-day") + toQuery({ from, to })) as Promise<SalesByDay[]> }
export function getSalesByHour({ from, to }: { from: Date; to: Date }) { return fetchWithAuth(apiUrl("/api/reports/sales/by-hour") + toQuery({ from, to })) as Promise<SalesByHour[]> }
export function getTopProducts({ from, to, limit = 10 }: { from: Date; to: Date; limit?: number }) { return fetchWithAuth(apiUrl("/api/reports/sales/top-products") + toQuery({ from, to, limit })) as Promise<TopProduct[]> }
export function getPaymentMix({ from, to }: { from: Date; to: Date }) { return fetchWithAuth(apiUrl("/api/reports/sales/payment-mix") + toQuery({ from, to })) as Promise<PaymentMix[]> }

/* Inventario (reportes - ADMIN) */
export type PageResponse<T> = {
  items(items: any): unknown; content: T[]; totalElements: number; page: number; size: number; totalPages: number 
}
export function getInventoryFull(params: { search?: string; categoria?: string; activo?: boolean; page?: number; size?: number; sort?: string; dir?: "asc" | "desc" }) {
  const { page = 0, size = 50, sort = "nombre", dir = "asc", ...rest } = params || {};
  return fetchWithAuth(apiUrl("/api/reports/inventory/full") + toQuery({ page, size, sort, dir, ...rest })) as Promise<PageResponse<InventoryProductFull>>;
}
export function getInventoryLots(codigo_barras: string) { return fetchWithAuth(apiUrl("/api/reports/inventory/lots") + toQuery({ codigo_barras })) as Promise<InventoryLot[]> }
export function exportInventoryFull(params: { search?: string; categoria?: string; activo?: boolean } = {}, onStart?: () => void) {
  const q = toQuery(params);
  // Pasamos onStart como cuarto argumento a downloadWithAuth (toastFn queda por defecto undefined)
  return downloadWithAuth(`/api/reports/inventory/export-full${q}`, "inventario_full.xlsx", undefined, onStart)
}
export function exportInventory(scope: "all" | "low" | "near-expiry" | "out-of-stock", days = 30) { const q = toQuery({ scope, days: scope === "near-expiry" ? days : undefined, format: "xlsx" }); return downloadWithAuth(`/api/reports/inventory/export${q}`, `inventario_${scope}.xlsx`) }

/* Clientes (reportes - ADMIN) */
export function getTopCustomers({ from, to, limit = 20, sortBy = "ventas" as "ventas" | "tickets" }: { from?: Date; to?: Date; limit?: number; sortBy?: "ventas" | "tickets" }) {
  return fetchWithAuth(apiUrl("/api/reports/customers/top") + toQuery({ from, to, limit, sortBy })) as Promise<TopCustomer[]>;
}
export function exportCustomers({ from, to }: { from?: Date; to?: Date }) {
  const q = toQuery({ from, to, format: "xlsx" });
  return downloadWithAuth(`/api/reports/customers/export${q}`, `clientes_top.xlsx`);
}

/* Caja (si esto también es admin, queda suavizado por fetchWithAuth) */
export function getCajaSummary({ from, to }: { from: Date; to: Date }) {
  return fetchWithAuth(apiUrl("/api/reports/caja/summary") + toQuery({ from, to })) as Promise<CajaSummary>;
}

/* Ventas export (admin) */
export function exportSalesByDay({ from, to }: { from: Date; to: Date }) { const q = toQuery({ from, to, group_by: "day", format: "xlsx" }); return downloadWithAuth(`/api/reports/sales/export${q}`, `ventas_por_dia.xlsx`) }
export function exportSalesByProduct({ from, to }: { from: Date; to: Date }) { const q = toQuery({ from, to, group_by: "product", format: "xlsx" }); return downloadWithAuth(`/api/reports/sales/export${q}`, `ventas_por_producto.xlsx`) }
export function exportInventoryProfessional(params: { search?: string; categoria?: string; activo?: boolean } = {}) {
  const q = toQuery(params)
  return downloadWithAuth(`/api/reports/inventory/export-professional${q}`, "Inventario_Botica.xlsx")
}

/* Ventas / Boletas (accesible a trabajador + admin) */
export type VentaItem = { codBarras: string; nombre: string; cantidad: number; precio: number }
export type BoletaDTO = {
  id: number
  numero: string
  fecha: string
  cliente: string | null
  metodoPago: string | null
  totalCompra?: number | null
  total?: number | null
  vuelto?: number | null
  usuario: string | null
  productos: VentaItem[]
}

// Compat multi-formato
export async function getBoletas(params: {
  page?: number
  limit?: number
  size?: number
  search?: string
  q?: string
  from?: string
  to?: string
  pathOverride?: string
} = {}) {
  const { page = 1, limit = 10, size, search, q, from, to, pathOverride } = params;
  const query = new URLSearchParams()
  query.set("page", String(page))
  query.set("limit", String(size ?? limit))
  if (search?.trim()) query.set("search", search.trim())
  if (!search && q?.trim()) query.set("search", q.trim())
  if (from) query.set("from", from)
  if (to) query.set("to", to)

  const path = pathOverride || "/api/boletas"
  const res = await fetchWithAuth(apiUrl(`${path}?${query.toString()}`))

  if (res && Array.isArray(res.boletas)) {
    const content = res.boletas as BoletaDTO[]
    const total = typeof res.total === "number" ? res.total : content.length
    const pageSize = size ?? limit
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return { content, totalElements: total, page: page - 1, size: pageSize, totalPages } as PageResponse<BoletaDTO>
  }
  if (res && Array.isArray(res.content)) {
    const total = typeof res.totalElements === "number" ? res.totalElements : (typeof res.total === "number" ? res.total : res.content.length)
    const pageSize = typeof res.size === "number" ? res.size : (size ?? limit)
    const totalPages = typeof res.totalPages === "number" ? res.totalPages : Math.max(1, Math.ceil(total / pageSize))
    return { content: res.content as BoletaDTO[], totalElements: total, page: typeof res.page === "number" ? res.page : (page - 1), size: pageSize, totalPages } as PageResponse<BoletaDTO>
  }
  if (Array.isArray(res)) {
    const content = res as BoletaDTO[]; const total = content.length; const pageSize = size ?? limit
    return { content, totalElements: total, page: page - 1, size: pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) } as PageResponse<BoletaDTO>
  }
  return {
    items: (items: any) => items,
    content: [],
    totalElements: 0,
    page: page - 1,
    size: size ?? limit,
    totalPages: 0
  } as PageResponse<BoletaDTO>
}

export async function getBoletasPage(params: { page?: number; size?: number; search?: string; from?: string; to?: string } = {}) {
  const { page = 0, size = 10, search, from, to } = params
  const qs = new URLSearchParams()
  qs.set("page", String(page))
  qs.set("size", String(size))
  if (search?.trim()) qs.set("search", search.trim())
  if (from) qs.set("from", from)
  if (to) qs.set("to", to)
  const res = await fetchWithAuth(apiUrl(`/api/boletas?${qs.toString()}`))
  return res as PageResponse<BoletaDTO>
}

export async function getBoletaById(id: number) {
  return fetchWithAuth(apiUrl(`/api/boletas/${id}`)) as Promise<BoletaDTO>
}

