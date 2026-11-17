import type * as T from "../types";
const hoy = new Date();
export const iso = (dias = 0) =>
  new Date(hoy.getTime() - dias * 86400000).toISOString();
export const etapas: T.EtapaEmbudo[] = [
  "identificado",
  "contactable",
  "contactado",
  "interesado",
  "lead",
  "calificado",
  "discovery",
  "propuesta",
  "cliente",
  "postventa",
  "excluido",
  "descartado",
  "perdido",
];
export const sectores = [
  "comercio",
  "industria y manufactura",
  "agroindustria y agricultura",
  "servicios",
  "construcción",
  "turismo y alimentos",
  "transporte y logística",
];
export const origenes: T.Origen[] = [
  "organico_busqueda",
  "organico_redes",
  "pagado",
  "correo",
  "referencia",
  "directo_desconocido",
  "manual",
  "registro",
  "descubrimiento",
];
export const evidencia = (
  campo: string,
  valor: string,
  estado: T.EstadoEvidencia = "verificado",
): T.Evidencia => ({
  campo,
  valor,
  fuente: "sitio_web",
  url: "https://saman.example/acerca",
  cita: valor,
  obtenidoEn: iso(3),
  estado,
});
const nombres = [
  "Empaques Samán S.A.S.",
  "AgroValle",
  "Caña Clara",
  "Logística Horizonte",
  "Alimentos Ceiba",
  "Taller Roble",
  "Servicios del Río",
  "Construcciones Nativa",
  "Comercial La Palma",
  "Turismo Senderos",
  "Textiles Colibrí",
  "Metal Valle",
  "Agro Semilla",
  "Transporte Brisa",
  "Café Montaña",
  "Maderas Sol",
  "Soluciones Guayacán",
  "Obras Andinas",
  "Mercado Azahar",
  "Sabores de Origen",
  "Frutos del Cauca",
  "Plásticos Circular",
  "Consultores Arrayán",
  "Fletes del Sur",
  "Empaques Saman SAS",
];
export function crearDatos() {
  const empresas: T.Empresa[] = nombres.map((razonSocial, i) => ({
    id: `e${i + 1}`,
    razonSocial,
    sector: sectores[i === 0 ? 1 : i % 7],
    tamano: i % 3 === 0 ? "11-50" : "51-200",
    municipio: ["Palmira", "Candelaria", "Cali"][i % 3],
    sitioWeb: `https://empresa${i + 1}.example`,
    dominio: `empresa${i + 1}.example`,
    estadoCuenta: i === 8 ? "cliente" : "prospecto",
    senales: [
      {
        tipo: "proveedor",
        descripcion: "Provee a empresas agroindustriales de la región",
        fecha: iso(10),
      },
    ],
    puntaje: {
      total: 55 + ((i * 7) % 45),
      incompleto: i % 4 === 0,
      criterios: [
        {
          nombre: "11 a 200 empleados",
          cumple: true,
          peso: 30,
          explicacion:
            i === 0
              ? "45 empleados (ejemplo ficticio)"
              : "Tamaño dentro del perfil",
        },
        {
          nombre: "Proveedor agroindustrial",
          cumple: i % 4 === 0 ? null : true,
          peso: 40,
          explicacion: "Señal comercial del registro de ejemplo",
        },
        {
          nombre: "Valle del Cauca",
          cumple: true,
          peso: 30,
          explicacion: "Ubicación objetivo",
        },
      ],
    },
    evidencias: [
      evidencia("razonSocial", razonSocial),
      evidencia("sector", sectores[i === 0 ? 1 : i % 7]),
      evidencia("municipio", ["Palmira", "Candelaria", "Cali"][i % 3]),
      evidencia("tamano", i % 3 === 0 ? "11-50" : "51-200", "inferido"),
      evidencia("sitioWeb", `https://empresa${i + 1}.example`),
    ],
  }));
  const contactos: T.Contacto[] = Array.from({ length: 60 }, (_, i) => {
    const nombre =
      ["Andrés Felipe Cárdenas", "Claudia Mejía", "Laura Gómez"][i] ??
      `Contacto ficticio ${i + 1}`;
    const correo = `contacto${i + 1}@empresa${i < 3 ? 1 : 1 + (i % 25)}.example`;
    return {
      id: `c${i + 1}`,
      empresaId: `e${i < 3 ? 1 : 1 + (i % 25)}`,
      nombre,
      cargo: [
        "Gerente",
        "Gerente administrativa y financiera",
        "Coordinadora de calidad y SST",
      ][i % 3],
      correo,
      estadoCorreo:
        i < 3
          ? "valido"
          : (
              [
                "valido",
                "valido",
                "riesgoso",
                "invalido",
                "desconocido",
                "catch_all",
              ] as const
            )[i % 6],
      etapa: etapas[i % 13],
      baseLegal: {
        tipo: i % 4 === 3 ? "pendiente" : "autorizacion_formulario",
        aprobadaPorAdmin: i % 4 !== 3,
        texto: "Autorización ficticia para comunicaciones B2B",
        fecha: iso(20),
        prueba: `form-demo-${i + 1}`,
      },
      excluido: i % 13 === 10,
      origen: origenes[i % 9],
      evidencias: [
        evidencia("nombre", nombre),
        evidencia("correo", correo, i % 5 === 0 ? "inferido" : "verificado"),
        evidencia(
          "cargo",
          [
            "Gerente",
            "Gerente administrativa y financiera",
            "Coordinadora de calidad y SST",
          ][i % 3],
        ),
      ],
      creadoEn: iso(35),
      actualizadoEn: iso(3),
    };
  });
  const firma = "\n\n{{firma}}\n{{baja}}";
  const secuencias: T.Secuencia[] = [
    {
      id: "s1",
      nombre: "RSE Express · Proveedores",
      objetivo: "Invitar al diagnóstico gratuito RSE Express",
      llamadaAccion: "Completar el diagnóstico gratuito",
      pasos: [
        {
          id: "p1",
          orden: 1,
          asunto: "Los cuestionarios de proveedores que llegan a {{empresa}}",
          cuerpo:
            "Buenos días, {{nombre}}: Vimos que {{empresa}} {{senal}}. Cada vez más empresas grandes les piden a sus proveedores información sobre prácticas laborales, ambientales y éticas, y muchas MiPymes no tienen cómo responder con evidencia. En NEXUS, desde Candelaria, creamos un diagnóstico rápido, el RSE Express, que muestra el punto de partida de su empresa y por dónde empezar. Es gratuito y el resultado lo revisa nuestro equipo. ¿Le sirve hacerlo esta semana?" +
            firma,
          esperaDiasHabiles: 0,
          mismoHilo: false,
          variables: [
            {
              nombre: "senal",
              campoFuente: "senal",
              respaldo: "trabaja con empresas grandes de la región",
            },
          ],
        },
        {
          id: "p2",
          orden: 2,
          cuerpo:
            "Hola, {{nombre}}. Tres temas frecuentes son residuos, condiciones laborales y de seguridad, y relación con la comunidad. RSE Express puede ayudar a {{empresa}} a identificar evidencias. Diagnóstico gratuito: https://nexus.example/rse-express" +
            firma,
          esperaDiasHabiles: 4,
          mismoHilo: true,
          variables: [],
        },
        {
          id: "p3",
          orden: 3,
          cuerpo:
            "Hola, {{nombre}}. Este es nuestro último mensaje. Puede hacer el diagnóstico en https://nexus.example/rse-express o conversar 20 minutos con nuestro equipo. ¿Qué opción le sirve mejor?" +
            firma,
          esperaDiasHabiles: 9,
          mismoHilo: true,
          variables: [],
        },
      ],
      metricasExito: [
        "Respuestas positivas",
        "Diagnósticos completados",
        "Reuniones",
      ],
      ventanaEnvio: { dias: [1, 2, 3, 4, 5], desde: "08:00", hasta: "17:00" },
    },
  ];
  const segmentos: T.Segmento[] = [
    {
      id: "seg1",
      nombre: "Proveedores del Valle",
      reglas: [{ campo: "municipio", operador: "no_es", valor: "Cali" }],
      justificacion: "MiPymes cercanas con necesidades de evidencia RSE",
      tamano: 40,
      version: 1,
      estado: "aprobado",
      propuestoPor: "agente",
    },
    {
      id: "seg2",
      nombre: "Industria de Palmira",
      reglas: [{ campo: "municipio", operador: "es", valor: "Palmira" }],
      justificacion: "Priorizar cercanía territorial",
      tamano: 20,
      version: 1,
      estado: "propuesto",
      propuestoPor: "agente",
    },
  ];
  const campanas: T.Campana[] = [
    {
      id: "cam1",
      nombre: "Proveedores agroindustriales · Palmira y Candelaria",
      segmentoId: "seg1",
      secuenciaId: "s1",
      estado: "activa",
      versionAprobada: 1,
      topeDiario: 20,
      creadaEn: iso(18),
      metricas: {
        inscritos: 12,
        enviados: 24,
        entregados: 23,
        rebotes: 1,
        bajas: 1,
        clics: 9,
        aperturas: 16,
        respuestas: 8,
        respuestasPositivas: 3,
        diagnosticos: 2,
        reuniones: 2,
      },
    },
    {
      id: "cam2",
      nombre: "RSE Express · Industria local",
      segmentoId: "seg2",
      secuenciaId: "s1",
      estado: "en_revision",
      topeDiario: 15,
      creadaEn: iso(4),
      metricas: {
        inscritos: 0,
        enviados: 0,
        entregados: 0,
        rebotes: 0,
        bajas: 0,
        clics: 0,
        aperturas: 0,
        respuestas: 0,
        respuestasPositivas: 0,
        diagnosticos: 0,
        reuniones: 0,
      },
    },
  ];
  const propuestas: T.PropuestaAgente[] = [
    "enriquecimiento",
    "segmento",
    "campana",
    "mejora",
    "correo_inferido",
  ].map((tipo, i) => ({
    id: `pr${i + 1}`,
    objetivoId: ["e1", "seg2", "cam2", "cam1", "c1"][i],
    agente: (
      [
        "investigador",
        "segmentador",
        "estratega_redactor",
        "analista",
        "investigador",
      ] as const
    )[i],
    tipo: tipo as T.PropuestaAgente["tipo"],
    estado: "pendiente",
    resumen: [
      "Revisar tamaño de Empaques Samán",
      "Aprobar segmento Industria de Palmira",
      "Campaña RSE Express · Industria local",
      "Reducir el volumen diario a 15 contactos",
      "Revisar correo corporativo inferido",
    ][i],
    version: 2,
    versiones: [
      {
        version: 1,
        contenido: "Propuesta inicial: diagnóstico general",
        fecha: iso(5),
      },
      {
        version: 2,
        contenido: "Propuesta actual: diagnóstico RSE Express territorial",
        fecha: iso(2),
      },
    ],
    fuentes: [
      evidencia(
        "empresa",
        "Empaques Samán S.A.S.",
        i === 4 ? "inferido" : "verificado",
      ),
    ],
    creadaEn: iso(4),
  }));
  const respuestas: T.Respuesta[] = Array.from({ length: 8 }, (_, i) => ({
    id: `r${i + 1}`,
    contactoId: `c${i + 1}`,
    campanaId: "cam1",
    fecha: iso(i),
    hilo: [
      {
        de: "nexus",
        fecha: iso(i + 2),
        texto: "¿Le sirve hacer el diagnóstico RSE Express?",
      },
      {
        de: "contacto",
        fecha: iso(i),
        texto: [
          "Sí, nos interesa conocer el diagnóstico.",
          "¿Podemos agendar una reunión?",
          "Por favor, retiren mi correo de la lista.",
          "Estaré fuera de la oficina esta semana.",
          "Necesito más información.",
          "Ahora no es buen momento.",
          "Tenemos algunas dudas sobre el proceso.",
          "Contacte a nuestra área de calidad.",
        ][i],
      },
    ],
    clasificacion: (
      [
        "interesado",
        "quiere_reunion",
        "baja",
        "fuera_oficina",
        "pide_informacion",
        "ahora_no",
        "necesita_revision",
        "remite_a_otra_persona",
      ] as const
    )[i],
    confianza: i === 6 ? 0.43 : 0.95,
    borrador:
      "Gracias por su respuesta. Podemos acompañarle con el diagnóstico RSE Express. ¿Qué horario le sirve?",
    estado: i === 2 ? "atendida" : "pendiente",
  }));
  contactos[2] = {
    ...contactos[2],
    excluido: true,
    etapa: "excluido",
    motivoExclusion: "Baja solicitada",
  };
  const oportunidades: T.Oportunidad[] = Array.from({ length: 5 }, (_, i) => ({
    id: `o${i + 1}`,
    empresaId: `e${i + 1}`,
    etapa: (
      ["discovery", "propuesta", "cliente", "perdido", "discovery"] as const
    )[i],
    reto: "Organizar evidencias ambientales y laborales",
    valorEstimadoCOP: (i + 1) * 1500000,
    creadaEn: iso(12 + i * 5),
  }));
  empresas[2].estadoCuenta = "cliente";
  const busquedas: T.BusquedaDescubrimiento[] = [
    {
      id: "b1",
      criterios: {
        consulta: "Fabricantes de empaques",
        municipios: ["Palmira"],
        sectores: ["industria y manufactura"],
      },
      estado: "terminada",
      progreso: 100,
      resultados: Array.from({ length: 3 }, (_, i) => ({
        id: `d${i + 1}`,
        empresa: {
          razonSocial: [
            "Envases Guayacán S.A.S.",
            "Empaques Samán S.A.S.",
            "Cartones del Valle",
          ][i],
          sector: "industria y manufactura",
          municipio: "Palmira",
          sitioWeb: `https://descubierta${i}.example`,
        },
        contactoCorporativo: {
          correo: `info@descubierta${i}.example`,
          telefono: "000 000 0000",
          whatsapp: "000 000 0000",
          formularioUrl: `https://descubierta${i}.example/contacto`,
        },
        personas: [
          {
            nombre: "Persona de ejemplo",
            cargo: "Gerencia",
            requiereBaseLegal: true,
          },
        ],
        evidencias: [evidencia("razonSocial", "Registro público de ejemplo")],
        posibleDuplicadoDe: i === 1 ? "e1" : undefined,
        estado: "pendiente",
      })),
      creadaEn: iso(1),
    },
    {
      id: "b2",
      criterios: {
        consulta: "Proveedores agroindustriales",
        municipios: ["Candelaria"],
        sectores: [],
      },
      estado: "ejecutando",
      progreso: 45,
      resultados: [],
      creadaEn: iso(),
    },
  ];
  const supresiones: T.Supresion[] = [
    {
      id: "su1",
      correo: contactos[2].correo,
      motivo: "Baja solicitada",
      fecha: iso(2),
    },
  ];
  const inscripciones: T.Inscripcion[] = contactos
    .filter(
      (c) =>
        c.estadoCorreo === "valido" &&
        c.baseLegal.aprobadaPorAdmin &&
        !c.excluido &&
        !["cliente", "postventa"].includes(c.etapa) &&
        empresas.find((e) => e.id === c.empresaId)?.estadoCuenta !==
          "cliente" &&
        empresas.find((e) => e.id === c.empresaId)?.municipio !== "Cali",
    )
    .slice(0, 12)
    .map((c, i) => ({
      id: `in${i + 1}`,
      campanaId: "cam1",
      contactoId: c.id,
      pasoActual: 1 + (i % 3),
      proximoEnvio: i < 2 ? undefined : iso(-1),
      estado: i < 2 ? "pausada" : "activa",
      motivoSalida: i < 2 ? "respondio" : undefined,
    }));
  campanas[0].metricas.inscritos = inscripciones.length;
  campanas[0].huellaAprobada = JSON.stringify({
    s: secuencias[0],
    reglas: segmentos[0].reglas,
    version: segmentos[0].version,
  });
  const auditoria: T.RegistroAuditoria[] = Array.from(
    { length: 50 },
    (_, i) => ({
      id: `a${i + 1}`,
      fecha: iso(i / 3),
      actor: i % 3 ? "agente:investigador" : "admin",
      accion: i % 3 ? "propuesta_creada" : "revision",
      entidad: "empresa",
      entidadId: `e${1 + (i % 25)}`,
      antes: { estado: "pendiente" },
      despues: { estado: "revisado" },
    }),
  );
  const interacciones: T.Interaccion[] = contactos.flatMap((c, i) => [
    {
      id: `it${i}`,
      contactoId: c.id,
      tipo: "nota",
      fecha: iso(5),
      resumen: "Registro ficticio revisado por el administrador",
    },
  ]);
  const integraciones: T.Integracion[] = (
    [
      "gmail",
      "formulario",
      "ga4",
      "search_console",
      "verificador",
      "claude",
    ] as const
  ).map((id) => ({
    id,
    nombre: {
      gmail: "Gmail Workspace",
      formulario: "Formulario del sitio",
      ga4: "Google Analytics 4",
      search_console: "Search Console",
      verificador: "Verificador de correo",
      claude: "API de Claude",
    }[id],
    estado: id === "gmail" ? "conectada" : "desconectada",
    detalle: "Simulación · sin conexión externa",
    ultimaSincronizacion: iso(),
  }));
  const metricas: T.MetricaDiaria[] = Array.from({ length: 90 }, (_, i) => ({
    campanaId: "cam1",
    segmentoId: "seg1",
    leads: i % 9 === 0 ? 1 : 0,
    clientes: i % 30 === 0 ? 1 : 0,
    fecha: iso(89 - i),
    enviados: 10 + (i % 11),
    respuestas: i % 5,
    visitas: 30 + (i % 27),
    fuente: origenes[i % 6],
    costoUSD: null,
  }));
  const marca: T.Marca = {
    nombre: "NEXUS Innovación",
    oferta: "RSE Express → RSE por Retos",
    tono: "Cercano, claro y profesional",
    firma: "Equipo NEXUS · Candelaria, Valle del Cauca",
    prohibidas: ["garantizado", "gratis para siempre"],
    politica: "https://nexus.example/privacidad",
    baja: "Si no desea recibir mensajes, responda BAJA.",
  };
  const limites: T.LimitesEnvio = {
    topeDiarioNuevos: 20,
    separacionSegundos: [60, 180],
    ventana: { dias: [1, 2, 3, 4, 5], desde: "08:00", hasta: "17:00" },
    topePorDominio: 2,
    umbralRebotePausa: 5,
  };
  const duplicados: T.Duplicado[] = [
    {
      id: "dup1",
      principalId: "e1",
      duplicadoId: "e25",
      motivo: "Razón social similar",
    },
  ];
  const recomendaciones: T.Recomendacion[] = [
    {
      id: "rec1",
      texto: "Priorizar las respuestas positivas antes de ampliar el volumen.",
      estado: "pendiente",
    },
    {
      id: "rec2",
      texto: "Probar una llamada a la acción más corta en el segundo paso.",
      estado: "pendiente",
    },
  ];
  return {
    empresas,
    contactos,
    secuencias,
    segmentos,
    campanas,
    propuestas,
    respuestas,
    oportunidades,
    busquedas,
    supresiones,
    inscripciones,
    auditoria,
    interacciones,
    integraciones,
    metricas,
    marca,
    limites,
    duplicados,
    recomendaciones,
    clienteIdeal: {
      criterios: [
        "MiPymes de 11 a 200 empleados",
        "Valle del Cauca",
        "Proveedor de empresas grandes",
      ],
    },
  };
}
export type Datos = ReturnType<typeof crearDatos>;
