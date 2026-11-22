import type { OptionGroup } from "../../components/ui/MultiSelect";

export const TIPOS_EMPRESA: OptionGroup[] = [
  {
    label: "Industria",
    options: [
      "Fabricantes de empaques",
      "Fabricantes de plásticos",
      "Procesadoras de alimentos",
      "Fabricantes de bebidas",
      "Ingenios azucareros",
      "Empresas metalmecánicas",
      "Fabricantes de muebles",
      "Laboratorios farmacéuticos y químicos",
      "Confecciones y textiles",
    ],
  },
  {
    label: "Comercio y servicios",
    options: [
      "Distribuidoras mayoristas",
      "Empresas de logística y transporte",
      "Constructoras",
      "Inmobiliarias",
      "Concesionarios de vehículos",
      "Agencias de marketing y publicidad",
      "Empresas de software y tecnología",
      "Firmas de consultoría y servicios profesionales",
    ],
  },
  {
    label: "Agro y energía",
    options: [
      "Empresas agroindustriales",
      "Comercializadoras agrícolas",
      "Empresas de energía y servicios públicos",
      "Empresas de gestión de residuos y reciclaje",
    ],
  },
  {
    label: "Salud, educación y turismo",
    options: [
      "Clínicas y centros médicos",
      "Colegios privados",
      "Universidades e institutos",
      "Hoteles",
      "Restaurantes",
    ],
  },
  {
    label: "Perfil",
    options: [
      "Empresas con programas de sostenibilidad",
      "Empresas exportadoras",
      "Empresas familiares",
    ],
  },
];

export const MUNICIPIOS: OptionGroup[] = [
  {
    label: "Valle del Cauca",
    options: [
      "Palmira",
      "Candelaria",
      "Cali",
      "Yumbo",
      "Jamundí",
      "Buga",
      "Tuluá",
      "Cartago",
      "Buenaventura",
      "El Cerrito",
      "Florida",
      "Pradera",
      "Ginebra",
      "Guacarí",
      "Dagua",
      "Vijes",
      "Yotoco",
      "La Cumbre",
      "Restrepo",
      "Calima (El Darién)",
      "Bugalagrande",
      "Andalucía",
      "Riofrío",
      "Trujillo",
      "San Pedro",
      "Sevilla",
      "Caicedonia",
      "Zarzal",
      "Roldanillo",
      "La Unión",
      "La Victoria",
      "Bolívar",
      "Toro",
      "Obando",
      "Versalles",
      "El Dovio",
      "Alcalá",
      "Ulloa",
      "Ansermanuevo",
      "Argelia",
      "El Águila",
      "El Cairo",
    ],
  },
  {
    label: "Norte del Cauca",
    options: [
      "Puerto Tejada",
      "Santander de Quilichao",
      "Villa Rica",
      "Caloto",
    ],
  },
  {
    label: "Ciudades principales",
    options: [
      "Bogotá D.C.",
      "Medellín",
      "Barranquilla",
      "Cartagena",
      "Bucaramanga",
      "Pereira",
      "Manizales",
      "Armenia",
      "Ibagué",
      "Popayán",
      "Pasto",
      "Santa Marta",
      "Cúcuta",
      "Villavicencio",
      "Neiva",
      "Montería",
    ],
  },
];

export const SECTORES: OptionGroup[] = [
  {
    label: "Sectores",
    options: [
      "Agroindustria",
      "Alimentos y bebidas",
      "Manufactura",
      "Empaques y plásticos",
      "Construcción",
      "Logística y transporte",
      "Comercio",
      "Salud",
      "Educación",
      "Turismo y hotelería",
      "Tecnología",
      "Servicios profesionales",
      "Energía",
      "Financiero",
      "Automotriz",
      "Textil y confección",
      "Químico y farmacéutico",
      "Metalmecánica",
      "Inmobiliario",
      "Medios y publicidad",
      "Otro",
    ],
  },
];

/** Convierte los tipos elegidos en la instrucción que recibe el agente. */
export function armarConsulta(tipos: string[]): string {
  if (tipos.length === 1) return `Busca empresas en Colombia: ${tipos[0]}`;
  return `Busca empresas en Colombia de estos tipos: ${tipos.join("; ")}`;
}
