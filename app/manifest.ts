import type { MetadataRoute } from "next";

// App instalable: «Añadir a pantalla de inicio» en Chrome (Android) y Safari (iPhone) abre el Dashboard como una app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dashboard · G. Elías y Muñoz Abogados",
    short_name: "Elías y Muñoz",
    description: "Leads, citas, conversaciones y llamadas del asistente de IA del despacho.",
    start_url: "/leads",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#1e3a5f",
    lang: "es",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
