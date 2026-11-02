import { ImageResponse } from "next/og";

// En «edge» el generador de imágenes no lee su fuente del disco (en Windows falla la ruta del archivo).
export const runtime = "edge";

// Icono de la app instalable (Android, iPhone y escritorio): el mismo «E&M» del menú lateral, sobre el azul de la marca.
// /pwa-icon/192, /pwa-icon/512, /pwa-icon/180 (iPhone) y /pwa-icon/maskable-512 (con margen para los iconos redondos de Android).
const SIZES = new Set([180, 192, 512]);

export async function GET(_request: Request, { params }: { params: { size: string } }) {
  const maskable = params.size.startsWith("maskable-");
  const size = Number(params.size.replace("maskable-", ""));
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });

  const scale = maskable ? 0.62 : 0.8; // los iconos «maskable» se recortan en círculo: el logo va más pequeño
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e3a5f" }}>
        <div
          style={{
            width: size * scale,
            height: size * scale,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: size * 0.14,
            border: `${Math.max(2, Math.round(size * 0.02))}px solid rgba(255,255,255,0.35)`,
            color: "#ffffff",
            fontSize: size * scale * 0.38,
            fontWeight: 700,
            letterSpacing: -size * 0.004,
            fontFamily: "Georgia, serif",
          }}
        >
          E&amp;M
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } }
  );
}
