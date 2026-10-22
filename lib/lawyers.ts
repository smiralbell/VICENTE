// Directorio interno de abogados del despacho, para derivar casos.
// Un correo solo recibe avisos si su dominio es el del despacho; los que tienen errores de escritura se muestran pero no se envían.

export type Lawyer = {
  name: string;
  phone: string;
  mobile: string;
  extension: string;
  email: string;
};

export const LAWYERS: Lawyer[] = [
  { name: "VICENTE GARCIA ELIAS", phone: "91.760.86.45", mobile: "629.66.33.37", extension: "5108", email: "vge@eliasymunozabogados.com" },
  { name: "RUS MARIA MUÑOZ GOMEZ", phone: "91.760.86.43", mobile: "649.88.44.94", extension: "5109", email: "rusmg@eliasymunozabogados.com" },
  { name: "CONSTANZA SANCHEZ SANCHEZ", phone: "91.760.86.40", mobile: "608.03.28.39", extension: "5106", email: "css@eliasymunozabogados.com" },
  { name: "NIEVES SIMON LOPEZ", phone: "91.760.86.44", mobile: "606.53.84.14", extension: "5107", email: "nsl@eliasymunozabogados.com" },
  { name: "Felipe Carriedo Renieblas", phone: "91.760.86.41", mobile: "676.35.02.59", extension: "5105", email: "fcr@eliasymunozbogados.com" },
  { name: "LUCIA VELASCO GRANADOS", phone: "91.571.17.87", mobile: "620.15.15.15", extension: "5101", email: "admon@eliasymunozabogados.com" },
  { name: "CRISTINA RAMOS PUEBLA", phone: "91.760.86.39", mobile: "619.64.62.28", extension: "", email: "crp@eliasymunozaqbogados.com" },
  { name: "MANUEL RIOS TAMAYO", phone: "91.760.86.46", mobile: "648.04.00.83", extension: "5105", email: "mrt@eliasymunozabogados.com" },
  { name: "JOSE MARIA GALIANA PINILLA", phone: "91.571.17.87", mobile: "620.15.15.15", extension: "5103", email: "info@eliasymunozabogados.com" },
  { name: "JOSE MARIA HURTADO DE EGEA", phone: "91.760.86.39", mobile: "690.174.141", extension: "5104", email: "jmh@eliasymunozabogdos.com" },
  { name: "ANDREA GONZALEZ MATEOS", phone: "", mobile: "608.068.874", extension: "5104", email: "agm@eliasymunozabogados.com" },
  { name: "Ainhoa Jimenez Perez", phone: "", mobile: "683.602.759", extension: "5104", email: "ajp@eliasymunozabogados.com" },
];

const OFFICE_DOMAIN = "@eliasymunozabogados.com";

// Solo se envía correo a direcciones del dominio del despacho escritas correctamente.
export function isSendableLawyerEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(email) && email.toLowerCase().endsWith(OFFICE_DOMAIN);
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Busca por nombre y apellidos, sin importar mayúsculas ni tildes. Solo devuelve un abogado si la búsqueda es inequívoca.
export function findLawyer(requested: string | undefined): Lawyer | null {
  const words = normalize(requested ?? "").split(" ").filter((w) => w.length >= 3);
  if (words.length === 0) return null;
  const matches = LAWYERS.filter((lawyer) => {
    const name = normalize(lawyer.name);
    return words.every((word) => name.split(" ").includes(word));
  });
  return matches.length === 1 ? matches[0] : null;
}
