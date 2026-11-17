// Envía el aviso diario del calendario a los móviles suscritos.
// Lo ejecuta GitHub Actions (.github/workflows/avisos.yml). Las suscripciones y
// la clave privada de los avisos están cifradas; se abren con el secreto CLAVE_AVISOS.
import webpush from "web-push";
import fs from "node:fs";
import crypto from "node:crypto";

const AK = Buffer.from(process.env.CLAVE_AVISOS || "", "base64");
if (AK.length !== 32) { console.error("Falta el secreto CLAVE_AVISOS en GitHub (Settings → Secrets and variables → Actions)."); process.exit(1); }
const abrir = texto => {
  const u = Buffer.from(texto.trim(), "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", AK, u.subarray(0, 12));
  d.setAuthTag(u.subarray(u.length - 16));
  return Buffer.concat([d.update(u.subarray(12, u.length - 16)), d.final()]).toString("utf8");
};

// Hora de España
function madrid(fecha = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"})
    .formatToParts(fecha).map(x => [x.type, x.value]));
  return {mes: +p.month, dia: +p.day, min: +p.hour * 60 + +p.minute};
}
const esperar = ms => new Promise(r => setTimeout(r, ms));

const prueba = (process.env.PRUEBA || "").trim();
let dia;
if (prueba) {
  dia = 0;
} else {
  // GitHub arranca la tarea un poco antes; aquí se espera a la hora exacta.
  const ahora = madrid();
  if (ahora.mes === 11) {             // 30 de noviembre por la noche → día 1 a las 00:00
    while (madrid().mes === 11) await esperar(15000);
    dia = 1;
  } else if (ahora.mes === 12 && ahora.dia >= 2 && ahora.dia <= 24) {
    dia = ahora.dia;
    while (madrid().min < 8 * 60 + 30) await esperar(15000);
  } else {
    console.log("Hoy no toca aviso."); process.exit(0);
  }
}

const vapid = JSON.parse(abrir(fs.readFileSync("avisos/vapid.bin", "utf8")));
webpush.setVapidDetails("https://7tphcn7skv-spec.github.io/adviento/", vapid.publicKey, vapid.privateKey);

const cuerpo = prueba ? {title: "Calendario de Adviento", body: prueba, dia: 0}
  : dia === 1 ? {title: "¡Empieza el Adviento!", body: "Ya puedes abrir la primera ventana de tu calendario.", dia}
  : dia === 24 ? {title: "¡Es Nochebuena!", body: "Ya puedes abrir la puerta del día 24. Tu última sorpresa te espera.", dia}
  : {title: "Calendario de Adviento", body: "Ya se ha abierto la ventana del día " + dia + ". Tu sorpresa te espera.", dia};

const archivos = fs.existsSync("avisos") ? fs.readdirSync("avisos").filter(f => /^sub-[\w-]+\.bin$/.test(f)) : [];
let ok = 0, mal = 0;
for (const f of archivos) {
  try {
    const sub = JSON.parse(abrir(fs.readFileSync("avisos/" + f, "utf8")));
    await webpush.sendNotification(sub, JSON.stringify(cuerpo), {TTL: 60 * 60 * 20, urgency: "high"});
    ok++;
  } catch (e) {
    mal++; console.log(f + ": no enviado (" + (e.statusCode || e.message) + ")");
  }
}
console.log((prueba ? "Prueba" : "Día " + dia) + ": " + ok + " enviados, " + mal + " fallidos, " + archivos.length + " móviles suscritos.");
