/**
 * webPush.ts — Envío de Web Push desde Deno Edge Functions
 * 
 * Implementación ligera del protocolo Web Push sin dependencias externas pesadas.
 * Usa npm:web-push para la firma VAPID y el cifrado del payload.
 */

/**
 * Implementación nativa de Web Push para Deno Edge Functions.
 * Usa Web Crypto API (ECDH P-256 + HKDF + AES-128-GCM) y firma JWT VAPID
 * sin depender de paquetes npm que requieran módulos nativos de Node.
 *
 * Basado en RFC 8291 (Web Push Encryption) y RFC 8292 (VAPID).
 */

// ─── Helpers de codificación ─────────────────────────────────────────────

function b64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// ─── VAPID JWT ────────────────────────────────────────────────────────────

/**
 * Convierte una clave privada VAPID (raw 32 bytes en base64url) a CryptoKey
 * para firmar JWT con ECDSA P-256.
 */
async function importVapidPrivateKey(privateKeyB64: string, publicKeyB64: string): Promise<CryptoKey> {
  const d = b64UrlDecode(privateKeyB64);
  const pub = b64UrlDecode(publicKeyB64);
  // pub viene como 0x04 || X(32) || Y(32)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error("VAPID public key invalid (expected 65 bytes uncompressed)");
  }
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: b64UrlEncode(d),
    x: b64UrlEncode(x),
    y: b64UrlEncode(y),
    ext: true,
  };
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function buildVapidJwt(audience: string, subject: string, privKey: CryptoKey): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 horas
  const payload = { aud: audience, exp, sub: subject };
  const data = `${b64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))}.${b64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  )}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    new TextEncoder().encode(data),
  );
  return `${data}.${b64UrlEncode(sig)}`;
}

// ─── Cifrado de payload (RFC 8291 — aes128gcm) ───────────────────────────

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function encryptPayload(
  payload: Uint8Array,
  uaPublicKey: Uint8Array, // p256dh del cliente (65 bytes)
  authSecret: Uint8Array, // auth del cliente (16 bytes)
): Promise<{ body: Uint8Array; }> {
  // 1. Generar par efímero del servidor
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
  );

  // 2. Importar clave pública del cliente (raw 65 bytes uncompressed)
  const uaPubKey = await crypto.subtle.importKey(
    "raw",
    uaPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  // 3. ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPubKey },
    serverKeyPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedBits);

  // 4. Generar salt aleatorio (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. Derivar IKM según RFC 8291
  // key_info = "WebPush: info\0" || ua_public || as_public
  const keyInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    uaPublicKey,
    serverPubRaw,
  );
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  // 6. Derivar CEK (Content Encryption Key, 16 bytes) y NONCE (12 bytes)
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // 7. Padding: 0x02 (último registro) — añadimos 1 byte de delimitador
  const padded = concatBytes(payload, new Uint8Array([0x02]));

  // 8. AES-128-GCM encrypt
  const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, padded),
  );

  // 9. Construir header binario (RFC 8188 §2.1):
  //    salt(16) || rs(4 BE) || idlen(1) || keyid(idlen) || ciphertext
  //    keyid = server public key (65 bytes)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const idlen = new Uint8Array([serverPubRaw.length]);
  const body = concatBytes(salt, rs, idlen, serverPubRaw, ciphertext);

  return { body };
}

// ─── API pública ─────────────────────────────────────────────────────────

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

function getVapidConfig() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@cuadrante.app";
  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY env vars");
  }
  return { publicKey, privateKey, subject };
}

/**
 * Envía una notificación push a una suscripción específica.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<{ success: boolean; expired: boolean }> {
  try {
    const { publicKey, privateKey, subject } = getVapidConfig();

    // Audience = origen del endpoint (scheme + host)
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const privKey = await importVapidPrivateKey(privateKey, publicKey);
    const jwt = await buildVapidJwt(audience, subject, privKey);

    // Cifrar payload
    const uaPub = b64UrlDecode(subscription.keys_p256dh);
    const auth = b64UrlDecode(subscription.keys_auth);
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const { body } = await encryptPayload(payloadBytes, uaPub, auth);

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": String(body.length),
        "TTL": "3600",
        "Authorization": `vapid t=${jwt}, k=${publicKey}`,
      },
      body,
    });

    if (res.status === 201 || res.status === 200 || res.status === 202) {
      return { success: true, expired: false };
    }

    if (res.status === 410 || res.status === 404) {
      console.warn(`[webPush] Subscription expired (${res.status}): ${subscription.id}`);
      return { success: false, expired: true };
    }

    const text = await res.text().catch(() => "");
    console.error(`[webPush] Push failed ${res.status} for ${subscription.id}:`, text);
    return { success: false, expired: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webPush] Error sending to ${subscription.id}:`, msg);
    return { success: false, expired: false };
  }
}

/**
 * Envía notificaciones push a múltiples suscripciones.
 * Retorna las IDs de las suscripciones expiradas para limpiarlas de la BD.
 */
export async function sendPushToAll(
  subscriptions: PushSubscriptionRecord[],
  payload: PushPayload,
): Promise<{ sent: number; expired: string[] }> {
  let sent = 0;
  const expired: string[] = [];

  // Enviar en paralelo con concurrencia controlada (máximo 10 simultáneas)
  const BATCH_SIZE = 10;
  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) => sendPushNotification(sub, payload)),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        if (result.value.success) sent++;
        if (result.value.expired) expired.push(batch[j].id);
      }
    }
  }

  return { sent, expired };
}
