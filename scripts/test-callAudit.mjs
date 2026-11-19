// Pruebas de lib/callAudit.ts sin base de datos ni claves reales.
// Ejecutar desde la raíz del proyecto:  node scripts/test-callAudit.mjs   (Node 22.18+ o 24)
//
// Los imports ./db, ./openai y ./env de callAudit.ts se redirigen a scripts/test-stubs/.
// scripts/test-stubs/callAudit.original.ts es una copia del archivo ANTES del cambio: cada caso
// se ejecuta con las dos versiones y la misma respuesta falsa del modelo, para comparar.
// El modelo no se llama de verdad: estas pruebas comprueban el código y el texto de las instrucciones,
// no si el modelo clasifica bien cada llamada.
import { registerHooks } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

const STUBS = new URL("./test-stubs/", import.meta.url);
const REDIRECT = { "./db": "db.ts", "./openai": "openai.ts", "./env": "env.ts" };

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? "";
    const fromAudit = parent.endsWith("/lib/callAudit.ts") || parent.endsWith("/test-stubs/callAudit.original.ts");
    if (fromAudit && specifier in REDIRECT) {
      return { url: new URL(REDIRECT[specifier], STUBS).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const nuevo = await import("../lib/callAudit.ts");
const original = await import("./test-stubs/callAudit.original.ts");
const db = await import("./test-stubs/db.ts");
const openai = await import("./test-stubs/openai.ts");

const TEXTO_DE_SIEMPRE_CITA = "El cliente pidió cita y el agente no usó la herramienta correspondiente.";
const TEXTO_INACTIVIDAD =
  "La llamada se cortó por inactividad: el agente dejó de responder o el cliente se quedó en silencio.";
const TRES_CAMPOS_CORREOS = ["user_requested_appointment_change", "user_requested_appointment_cancel", "cancelled_booking_in_call"];
const OUTCOMES = ["cliente_desistio", "comportamiento_esperado", "fallo_real", "sin_problema", "otro", undefined];

// Diálogos inventados, sin datos de clientes reales.
const DIALOGO_PRECIO = [
  { role: "agent", content: "Hola, le llamo del despacho por el formulario que rellenó." },
  { role: "user", content: "Sí, quería una consulta por un tema de herencia." },
  { role: "agent", content: "La primera consulta cuesta 50 euros. ¿Le busco un hueco?" },
  { role: "user", content: "Uf, me lo pienso y ya les llamo." },
];
const DIALOGO_NO_CLIENTE = [
  { role: "agent", content: "Despacho de abogados, ¿en qué puedo ayudarle?" },
  { role: "user", content: "Quiero hablar con un abogado, no soy cliente todavía." },
  { role: "agent", content: "Puedo ofrecerle una primera consulta con uno de nuestros abogados." },
];
const DIALOGO_FALLO = [
  { role: "user", content: "Quiero cita para el martes por la mañana." },
  { role: "agent", content: "Perfecto, queda agendada." },
  { role: "user", content: "¿Seguro? ¿Me llegará algo?" },
];
const DIALOGO_SILENCIO = [
  { role: "agent", content: "Hola, le llamo del despacho por el formulario que rellenó." },
  { role: "user", content: "Sí, dígame." },
  { role: "agent", content: "¿Qué día le viene bien para la consulta?" },
];

function modelo(campos) {
  return JSON.stringify({
    user_requested_derivation: false,
    user_requested_appointment: false,
    user_requested_appointment_change: false,
    user_requested_appointment_cancel: false,
    cancelled_booking_in_call: false,
    used_derivation_tool: false,
    used_appointment_tool: false,
    problem: null,
    explanation: "Explicación de prueba.",
    ...campos,
  });
}

// Ejecuta la versión original y la nueva con la misma respuesta falsa del modelo.
// "extra" se añade tal cual a la entrada (p. ej. { disconnectionReason: "inactivity" }).
async function auditarConLasDos(respuesta, transcript, toolNames = [], extra = {}) {
  const input = { callId: "call_prueba", phone: "+34600000000", agentId: "agent_prueba", transcript, toolNames, ...extra };
  const correr = async (mod) => {
    db.resetQueries();
    openai.resetMessages();
    openai.setNextReply(respuesta);
    const result = await mod.auditCall(input);
    return { result, queries: [...db.queryCalls], mensajes: [...openai.sentMessages] };
  };
  return { antes: await correr(original), ahora: await correr(nuevo) };
}

function mismosCamposCorreos(antes, ahora) {
  for (const campo of TRES_CAMPOS_CORREOS) {
    assert.equal(ahora[campo], antes[campo], `${campo} ha cambiado`);
  }
}

// Texto de las instrucciones entre la clave "desde" y la clave "hasta".
function tramoDelPrompt(prompt, desde, hasta) {
  const inicio = prompt.indexOf(`"${desde}"`);
  const fin = prompt.indexOf(`"${hasta}"`, inicio);
  assert.ok(inicio >= 0 && fin > inicio, `no se encuentra el tramo ${desde} → ${hasta}`);
  return prompt.slice(inicio, fin);
}

test("1. cliente_desistio + pidió cita sin herramienta: problem null y etiqueta [Cliente desistió]", async () => {
  const { antes, ahora } = await auditarConLasDos(
    modelo({ user_requested_appointment: true, outcome: "cliente_desistio", explanation: "Colgó al oír el precio." }),
    DIALOGO_PRECIO
  );
  assert.equal(antes.result.problem, TEXTO_DE_SIEMPRE_CITA, "el original sí lo marcaba como problema");
  assert.equal(ahora.result.problem, null);
  assert.equal(ahora.result.explanation, "[Cliente desistió] Colgó al oír el precio.");
  assert.equal(ahora.result.outcome, "cliente_desistio");
  mismosCamposCorreos(antes.result, ahora.result);
});

test("2. no cliente pide hablar con un abogado y no se deriva: fallo_real con el problem de derivación", async () => {
  const { antes, ahora } = await auditarConLasDos(
    modelo({ user_requested_derivation: true, outcome: "fallo_real", explanation: "Pidió hablar con un abogado y no se derivó." }),
    DIALOGO_NO_CLIENTE
  );
  assert.equal(ahora.result.outcome, "fallo_real");
  assert.match(ahora.result.problem, /derivación/);
  assert.equal(ahora.result.problem, antes.result.problem, "mismo texto de problema que el original");
  assert.equal(ahora.result.explanation, "Pidió hablar con un abogado y no se derivó.", "sin etiqueta");
  assert.deepEqual(ahora.queries, antes.queries, "el INSERT debe ser idéntico al original");
  mismosCamposCorreos(antes.result, ahora.result);
});

test("2a. las instrucciones ya no tratan al no cliente que pide hablar con alguien como comportamiento esperado", async () => {
  const { ahora } = await auditarConLasDos(modelo({}), DIALOGO_NO_CLIENTE);
  const prompt = ahora.mensajes[0][0].content;
  const esperado = tramoDelPrompt(prompt, "comportamiento_esperado", "fallo_real");
  assert.doesNotMatch(esperado, /no cliente/i, "comportamiento_esperado no debe incluir al no cliente");
  for (const caso of [
    "número equivocado",
    "asunto que el despacho no lleva",
    "anulación de cita",
    "agendó aunque también pidiera hablar con alguien",
    "derivó aunque pidiera consulta",
  ]) {
    assert.ok(esperado.includes(caso), `falta "${caso}" en comportamiento_esperado`);
  }
  const fallo = tramoDelPrompt(prompt, "fallo_real", "sin_problema");
  assert.match(fallo, /sea cliente o no/);
  assert.match(fallo, /herramienta de derivación/);
});

test("2b. comportamiento_esperado (agendó aunque pidiera hablar con alguien) anula también un problem escrito por el modelo", async () => {
  const { ahora } = await auditarConLasDos(
    modelo({ user_requested_appointment: true, used_appointment_tool: true, user_requested_derivation: true, outcome: "comportamiento_esperado", problem: "Pidió hablar con alguien y no se derivó." }),
    DIALOGO_NO_CLIENTE,
    ["agendar_cita"]
  );
  assert.equal(ahora.result.problem, null);
});

test("3. fallo_real + pidió cita sin herramienta: problem con el texto de siempre y explanation sin tocar", async () => {
  const { antes, ahora } = await auditarConLasDos(
    modelo({ user_requested_appointment: true, outcome: "fallo_real", explanation: "Confirmó la cita sin usar la herramienta." }),
    DIALOGO_FALLO
  );
  assert.equal(ahora.result.problem, TEXTO_DE_SIEMPRE_CITA);
  assert.equal(ahora.result.problem, antes.result.problem);
  assert.equal(ahora.result.explanation, "Confirmó la cita sin usar la herramienta.");
  assert.equal(ahora.result.outcome, "fallo_real");
  assert.deepEqual(ahora.queries, antes.queries, "el INSERT debe ser idéntico al original");
  mismosCamposCorreos(antes.result, ahora.result);
});

test("4. sin outcome: mismo resultado y mismo INSERT que el código original", async () => {
  const casos = [
    modelo({ user_requested_appointment: true }),
    modelo({ user_requested_derivation: true, user_requested_appointment: true }),
    modelo({ user_requested_appointment: true, problem: "Texto propio del modelo." }),
    modelo({ user_requested_appointment_change: true, user_requested_appointment: true }),
    modelo({ user_requested_appointment_cancel: true }),
    modelo({ cancelled_booking_in_call: true, user_requested_appointment: true, used_appointment_tool: true }),
    "{}",
  ];
  for (const respuesta of casos) {
    const { antes, ahora } = await auditarConLasDos(respuesta, DIALOGO_FALLO);
    assert.deepEqual(ahora.result, { ...antes.result, outcome: null }, `resultado distinto con ${respuesta}`);
    assert.deepEqual(ahora.queries, antes.queries, `INSERT distinto con ${respuesta}`);
  }
});

test("5. outcome inventado o con otro formato: se trata como null (igual que el original)", async () => {
  for (const outcome of ["otro", "Cliente_Desistio", "cliente desistio", "", 3, true, ["sin_problema"], { a: 1 }, "toString", "__proto__"]) {
    const { antes, ahora } = await auditarConLasDos(modelo({ user_requested_appointment: true, outcome }), DIALOGO_PRECIO);
    assert.equal(ahora.result.outcome, null, `outcome ${JSON.stringify(outcome)} no debería aceptarse`);
    assert.deepEqual(ahora.result, { ...antes.result, outcome: null });
    assert.deepEqual(ahora.queries, antes.queries);
  }
});

test("sin_problema: problem null y etiqueta [Sin problema]", async () => {
  const { ahora } = await auditarConLasDos(
    modelo({ user_requested_appointment: true, used_appointment_tool: true, outcome: "sin_problema", explanation: "Se agendó." }),
    DIALOGO_FALLO,
    ["agendar_cita"]
  );
  assert.equal(ahora.result.problem, null);
  assert.equal(ahora.result.explanation, "[Sin problema] Se agendó.");
});

test("6. los tres campos de los correos salen igual que antes con cualquier outcome y motivo de corte", async () => {
  const combinaciones = [
    { user_requested_appointment_change: true, user_requested_appointment: true },
    { user_requested_appointment_cancel: true },
    { cancelled_booking_in_call: true, user_requested_appointment: true, used_appointment_tool: true },
    { user_requested_appointment_change: true, user_requested_appointment_cancel: true, cancelled_booking_in_call: true },
    {},
  ];
  for (const campos of combinaciones) {
    for (const outcome of OUTCOMES) {
      for (const extra of [{}, { disconnectionReason: "inactivity" }, { disconnectionReason: "user_hangup" }]) {
        const { antes, ahora } = await auditarConLasDos(modelo({ ...campos, outcome }), DIALOGO_FALLO, [], extra);
        mismosCamposCorreos(antes.result, ahora.result);
        for (const campo of ["user_requested_derivation", "user_requested_appointment", "used_derivation_tool", "used_appointment_tool"]) {
          assert.equal(ahora.result[campo], antes.result[campo], `${campo} ha cambiado`);
        }
      }
    }
  }
});

test("7. inactividad + el modelo dice cliente_desistio: fallo_real con el problem de inactividad y sin etiqueta", async () => {
  const { antes, ahora } = await auditarConLasDos(
    modelo({ outcome: "cliente_desistio", explanation: "El cliente dejó de responder." }),
    DIALOGO_SILENCIO,
    [],
    { disconnectionReason: "inactivity" }
  );
  assert.equal(ahora.result.outcome, "fallo_real");
  assert.equal(ahora.result.problem, TEXTO_INACTIVIDAD);
  assert.equal(ahora.result.explanation, "El cliente dejó de responder.", "no se añade etiqueta");
  assert.equal(ahora.queries[0].text, antes.queries[0].text, "el SQL del INSERT ha cambiado");
  assert.equal(ahora.queries[0].params[7], TEXTO_INACTIVIDAD, "$8 problem");
  assert.equal(ahora.queries[0].params[8], "El cliente dejó de responder.", "$9 explanation");
  mismosCamposCorreos(antes.result, ahora.result);
});

test("7a. inactividad: fallo_real decida lo que decida el modelo (también sin outcome o con uno inventado)", async () => {
  for (const outcome of OUTCOMES) {
    const { ahora } = await auditarConLasDos(modelo({ outcome }), DIALOGO_SILENCIO, [], { disconnectionReason: "inactivity" });
    assert.equal(ahora.result.outcome, "fallo_real", `outcome ${outcome}`);
    assert.equal(ahora.result.problem, TEXTO_INACTIVIDAD, `outcome ${outcome}`);
    assert.equal(ahora.result.explanation, "Explicación de prueba.", `outcome ${outcome}: sin etiqueta`);
  }
});

test("8. inactividad + el modelo ya puso un problem: se mantiene su texto", async () => {
  const { ahora } = await auditarConLasDos(
    modelo({ outcome: "sin_problema", problem: "El agente se quedó callado tras preguntar el día." }),
    DIALOGO_SILENCIO,
    [],
    { disconnectionReason: "inactivity" }
  );
  assert.equal(ahora.result.outcome, "fallo_real");
  assert.equal(ahora.result.problem, "El agente se quedó callado tras preguntar el día.");
  assert.equal(ahora.result.explanation, "Explicación de prueba.", "no se añade etiqueta");
});

test("8a. inactividad + problem de la comprobación de herramientas: se mantiene ese texto", async () => {
  const { ahora } = await auditarConLasDos(
    modelo({ user_requested_appointment: true, outcome: "cliente_desistio" }),
    DIALOGO_SILENCIO,
    [],
    { disconnectionReason: "inactivity" }
  );
  assert.equal(ahora.result.outcome, "fallo_real");
  assert.equal(ahora.result.problem, TEXTO_DE_SIEMPRE_CITA);
});

test("8b. inactividad + problem vacío (\"\") del modelo: se pone el texto de inactividad", async () => {
  const { ahora } = await auditarConLasDos(
    modelo({ outcome: "fallo_real", problem: "" }),
    DIALOGO_SILENCIO,
    [],
    { disconnectionReason: "inactivity" }
  );
  assert.equal(ahora.result.problem, TEXTO_INACTIVIDAD);
});

test("9. sin disconnectionReason, undefined u otro motivo: todo igual que sin el campo", async () => {
  const respuestas = [
    modelo({ user_requested_appointment: true, outcome: "cliente_desistio", explanation: "Lo pensará." }),
    modelo({ user_requested_derivation: true, outcome: "comportamiento_esperado" }),
    modelo({ user_requested_appointment: true, outcome: "fallo_real" }),
    modelo({ outcome: "sin_problema", problem: "Texto propio del modelo." }),
    modelo({ user_requested_appointment: true }),
    "{}",
  ];
  const otrosMotivos = [undefined, "user_hangup", "agent_hangup", "max_duration_reached", "Inactivity", ""];
  for (const respuesta of respuestas) {
    const base = await auditarConLasDos(respuesta, DIALOGO_PRECIO);
    for (const disconnectionReason of otrosMotivos) {
      const { ahora } = await auditarConLasDos(respuesta, DIALOGO_PRECIO, [], { disconnectionReason });
      assert.deepEqual(ahora.result, base.ahora.result, `resultado distinto con motivo ${disconnectionReason}`);
      assert.deepEqual(ahora.queries, base.ahora.queries, `INSERT distinto con motivo ${disconnectionReason}`);
      assert.deepEqual(ahora.mensajes, base.ahora.mensajes, `mensajes al modelo distintos con motivo ${disconnectionReason}`);
    }
  }
});

test("el INSERT usa las mismas columnas y solo cambian problem y explanation", async () => {
  const { antes, ahora } = await auditarConLasDos(
    modelo({ user_requested_appointment: true, outcome: "cliente_desistio", explanation: "Lo pensará." }),
    DIALOGO_PRECIO
  );
  assert.equal(ahora.queries.length, 1);
  assert.equal(ahora.queries[0].text, antes.queries[0].text, "el SQL del INSERT ha cambiado");
  const [a, b] = [antes.queries[0].params, ahora.queries[0].params];
  assert.deepEqual(b.slice(0, 7), a.slice(0, 7), "parámetros $1 a $7 deben ser idénticos");
  assert.equal(b[7], null, "$8 problem");
  assert.equal(b[8], "[Cliente desistió] Lo pensará.", "$9 explanation");
});

test("las instrucciones al modelo solo añaden outcome al final; el resto es idéntico", async () => {
  const { antes, ahora } = await auditarConLasDos(modelo({}), DIALOGO_PRECIO);
  const promptAntes = antes.mensajes[0][0].content;
  const promptAhora = ahora.mensajes[0][0].content;
  assert.ok(promptAntes.endsWith("explanation (string breve en español)."));
  const base = promptAntes.slice(0, -1); // sin el punto final
  assert.ok(promptAhora.startsWith(base + ", outcome ("), "el texto anterior a outcome ha cambiado");
  for (const valor of ["cliente_desistio", "comportamiento_esperado", "fallo_real", "sin_problema"]) {
    assert.ok(promptAhora.includes(`"${valor}"`), `falta ${valor} en las instrucciones`);
  }
  assert.deepEqual(ahora.mensajes[0][1], antes.mensajes[0][1], "el mensaje con la transcripción ha cambiado");
});
