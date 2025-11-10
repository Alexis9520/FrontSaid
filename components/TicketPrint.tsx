"use client"
import React from "react"
import { formatSoles } from "../lib/utils";

interface ConfiguracionGeneral {
  nombreNegocio: string
  direccion: string
  telefono: string
  email?: string
  ruc: string
  moneda: string
}

interface ConfiguracionBoleta {
  serieBoleta: string
  mensajePie: string
  mostrarLogo: boolean
  imprimirAutomatico: boolean
  formatoImpresion: "80mm" | "58mm" | "a4"
}

interface ProductoCarrito {
  nombre: string
  cantidadBlister: number
  cantidadUnidadesBlister?: number
  precioVentaBlister?: number
  cantidadUnidad: number
  precioVentaUnd: number
  descuento?: number
  subtotal: number
}

interface TicketPrintProps {
  venta: any
  configuracionGeneral: ConfiguracionGeneral
  configuracionBoleta: ConfiguracionBoleta
}

function getPrintSetup(formato: "80mm" | "58mm" | "a4") {
  if (formato === "58mm") {
    return {
      pageSize: "58mm auto",
      contentW: "48mm",              // zona imprimible real en 58mm
      margin: "0",
      fsBase: 12,
      fsTotal: 16,
      cols: { qty: "10mm", unit: "16mm", total: "18mm" }, // suma ~44mm, el resto para "Producto"
    }
  }
  if (formato === "80mm") {
    return {
      pageSize: "80mm auto",
      contentW: "72mm",
      margin: "0",
      fsBase: 13,
      fsTotal: 18,
      cols: { qty: "12mm", unit: "22mm", total: "24mm" },
    }
  }
  // A4
  return {
    pageSize: "A4",
    contentW: "180mm",               // ancho cómodo dentro de A4
    margin: "12mm",
    fsBase: 14,
    fsTotal: 20,
    cols: { qty: "20mm", unit: "35mm", total: "35mm" },
  }
}

export default function TicketPrint({
  venta,
  configuracionGeneral,
  configuracionBoleta,
}: TicketPrintProps) {
  const formato = configuracionBoleta.formatoImpresion
  const setup = getPrintSetup(formato)

  // CSS de impresión dinámico
  const pageCss = `
  @page { size: ${setup.pageSize}; margin: ${setup.margin}; }
  @media print {
    html, body { margin: 0; padding: 0; }
    .ticket-print { 
      width: ${setup.contentW}; 
      margin: 0 auto; 
      box-shadow: none !important; 
      border: 0 !important; 
      border-radius: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: none !important; }
    table { page-break-inside: auto; }
    tr, td, th { page-break-inside: avoid; break-inside: avoid; }
  }
  @media screen {
    body { background: #f6f7f9; }
    .ticket-print {
      width: ${setup.contentW};
      margin: 8px auto;
      box-shadow: 0 0 10px #eee;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #fff;
    }
  }
  `

  // Calcula el vuelto (si existe)
  let vuelto = 0
  if (venta?.metodoPago) {
    const efectivo = Number(venta.metodoPago.efectivo || 0)
    const digital = Number(venta.metodoPago.digital || 0)
    const pagado = efectivo + digital
    const total = Number(venta.total || 0)
    vuelto = pagado > total ? pagado - total : 0
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />
      <div
        className="ticket-print"
        style={{
          fontFamily: "'Segoe UI', 'monospace', 'Arial'",
          fontSize: `${setup.fsBase}px`,
          padding: 0,
          display: "block",
        }}
      > 
        <div style={{ width: "100%", margin: "0 auto", padding: "12px 0" }}>
          {/* HEADER */}
          <div style={{ textAlign: "center", fontWeight: "bold", fontSize: `${setup.fsTotal}px`, letterSpacing: "0.5px", marginBottom: 4 }}>
            {configuracionBoleta.mostrarLogo && (
              <img
                src="/logo-said.png"
                alt="Logo"
                style={{ width: 42, height: 42, marginBottom: 2, display: "block", marginLeft: "auto", marginRight: "auto" }}
              />
            )}
            {configuracionGeneral.nombreNegocio}
          </div>
          <div style={{ textAlign: "center", fontSize: `${Math.max(11, setup.fsBase - 1)}px` }}>RUC: {configuracionGeneral.ruc}</div>
          <div style={{ textAlign: "center", fontSize: `${Math.max(11, setup.fsBase - 1)}px` }}>{configuracionGeneral.direccion}</div>
          <div style={{ textAlign: "center", fontSize: `${Math.max(11, setup.fsBase - 1)}px`, marginBottom: 2 }}>Tel: {configuracionGeneral.telefono}</div>
          {configuracionGeneral.email && <div style={{ textAlign: "center", fontSize: `${Math.max(10, setup.fsBase - 2)}px` }}>{configuracionGeneral.email}</div>}
          <hr style={{ margin: "10px 0" }} />

          {/* DATOS DE VENTA */}
          <div style={{ marginBottom: 5, fontSize: `${setup.fsBase}px` }}>
            <div>
              <b>Boleta:</b> <span style={{ float: "right" }}>{venta.numero}</span>
            </div>
            <div style={{ clear: "both" }}>
              <b>Fecha:</b> <span style={{ float: "right" }}>{venta.fecha || new Date().toLocaleString()}</span>
            </div>
            <div style={{ clear: "both" }}>
              <b>Cliente:</b> <span style={{ float: "right" }}>{venta.nombreCliente}</span>
            </div>
            <div style={{ clear: "both" }}>
              <b>DNI:</b> <span style={{ float: "right" }}>{venta.dniCliente}</span>
            </div>
            {venta.nombreVendedor && (
              <div style={{ clear: "both" }}>
                <b>Trabajador:</b> <span style={{ float: "right" }}>{venta.nombreVendedor}</span>
              </div>
            )}
          </div>
          <hr style={{ margin: "8px 0" }} />

          {/* TABLA DE PRODUCTOS */}
          <table style={{ width: "100%", fontSize: `${setup.fsBase}px`, marginBottom: 8, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 2px" }}>Producto</th>
                <th style={{ textAlign: "center", width: setup.cols.qty, padding: "4px 2px" }}>Cant</th>
                <th style={{ textAlign: "right", width: setup.cols.unit, padding: "4px 2px" }}>P.Unit</th>
                <th style={{ textAlign: "right", width: setup.cols.total, padding: "4px 2px" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {venta.productos?.map((item: ProductoCarrito, i: number) => (
                <React.Fragment key={i}>
                  {item.cantidadBlister > 0 && item.precioVentaBlister && (
                    <tr>
                      <td style={{ padding: "2px 2px" }}>
                        {item.nombre} <span style={{ color: "#444", fontSize: `${Math.max(10, setup.fsBase - 2)}px` }}>[Blister]</span>
                      </td>
                      <td style={{ textAlign: "center", padding: "2px 2px" }}>
                        {item.cantidadBlister} x {item.cantidadUnidadesBlister ?? "?"}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 2px" }}>
                        {formatSoles(item.precioVentaBlister)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 2px" }}>
                        {formatSoles(Number(item.precioVentaBlister) * Number(item.cantidadBlister))}
                      </td>
                    </tr>
                  )}
                  {item.cantidadUnidad > 0 && (
                    <tr>
                      <td style={{ padding: "2px 2px" }}>
                        {item.nombre} <span style={{ color: "#444", fontSize: `${Math.max(10, setup.fsBase - 2)}px` }}>[Unidad]</span>
                      </td>
                      <td style={{ textAlign: "center", padding: "2px 2px" }}>
                        {item.cantidadUnidad}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 2px" }}>
                        {formatSoles(item.precioVentaUnd)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 2px" }}>
                        {formatSoles(
                          Number(item.precioVentaUnd) * Number(item.cantidadUnidad)
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <hr style={{ margin: "8px 0" }} />

          {/* TOTAL */}
          <div
            style={{
              fontWeight: "bold",
              textAlign: "right",
              fontSize: `${setup.fsTotal}px`,
              marginBottom: 8,
            }}
          >
            TOTAL: {formatSoles(venta.total)}
          </div>

          {/* MÉTODO DE PAGO Y VUELTO */}
          {venta.metodoPago && (
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              Método de pago: <b>{venta.metodoPago.nombre}</b>
              {venta.metodoPago.efectivo > 0 && (
                <div>Efectivo: {formatSoles(venta.metodoPago.efectivo)}</div>
              )}
              {venta.metodoPago.digital > 0 && (
                <div>Yape/Plin: {formatSoles(venta.metodoPago.digital)}</div>
              )}
              {vuelto > 0 && (
                <div style={{ color: "#16a34a", fontWeight: 600 }}>
                  Vuelto: {formatSoles(vuelto)}
                </div>
              )}
            </div>
          )}

          <hr style={{ margin: "8px 0" }} />

          {/* MENSAJE DE PIE */}
          {configuracionBoleta.mensajePie && (
            <div
              style={{
                textAlign: "center",
                margin: "16px 0 0 0",
                whiteSpace: "pre-line",
                fontSize: `${Math.max(11, setup.fsBase - 1)}px`,
                color: "#666",
              }}
            >
              {configuracionBoleta.mensajePie}
            </div>
          )}
        </div>
      </div>
    </>
  )
}