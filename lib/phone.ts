// Validación de teléfonos, equivalente a "Validate phone" de n8n.
// Acepta españoles (9 dígitos empezando por 6-9, con o sin +34) e internacionales en formato +XX.

export type PhoneResult = { valid: boolean; phone: string | null; reason: string };

export function validatePhone(raw: string): PhoneResult {
  const cleaned = (raw || "").toString().trim().replace(/\s+/g, "").replace(/[-()]/g, "");

  if (/^(\+|00)/.test(cleaned)) {
    const normalized = cleaned.replace(/^00/, "+");
    if (/^\+34/.test(normalized)) {
      const local = normalized.replace(/^\+34/, "");
      if (/^[6789]\d{8}$/.test(local)) return { valid: true, phone: `+34${local}`, reason: "Teléfono válido (España)" };
      return { valid: false, phone: null, reason: "Teléfono no válido (España)" };
    }
    if (/^\+\d{7,15}$/.test(normalized)) return { valid: true, phone: normalized, reason: "Teléfono internacional válido" };
    return { valid: false, phone: null, reason: "Teléfono internacional no válido" };
  }

  if (/^[6789]\d{8}$/.test(cleaned)) return { valid: true, phone: `+34${cleaned}`, reason: "Teléfono válido (España)" };
  if (/^34[6789]\d{8}$/.test(cleaned)) return { valid: true, phone: `+${cleaned}`, reason: "Teléfono válido (España)" };
  return { valid: false, phone: null, reason: "Formato de teléfono no reconocido" };
}
