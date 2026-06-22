const buckets = new Map();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const MIN_FORM_AGE_MS = 4500;
const MAX_FIELD_LENGTH = 4000;
const SPAM_WORDS = [
  "casino",
  "crypto",
  "viagra",
  "loan",
  "porn",
  "seo package",
  "backlink",
  "rank higher",
  "telegram",
  "whatsapp marketing",
];

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
};

const getIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
};

const rateLimited = (ip) => {
  const now = Date.now();
  const bucket = buckets.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }

  bucket.count += 1;
  buckets.set(ip, bucket);
  return bucket.count > MAX_REQUESTS;
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const parseForm = (body, contentType) => {
  if (contentType.includes("application/json")) {
    return new URLSearchParams(JSON.parse(body));
  }
  return new URLSearchParams(body);
};

const hasSpam = (values) => {
  const haystack = values.join(" ").toLowerCase();
  return SPAM_WORDS.some((word) => haystack.includes(word));
};

const verifyTurnstile = async (token, ip) => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  const payload = new URLSearchParams();
  payload.set("secret", secret);
  payload.set("response", token);
  payload.set("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: payload,
  });
  const result = await response.json();
  return Boolean(result.success);
};

const forwardMessage = async (fields, ip) => {
  const target = process.env.CONTACT_WEBHOOK_URL;
  if (!target) return false;

  await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "entruempelungfreising.de",
      ip,
      receivedAt: new Date().toISOString(),
      fields,
    }),
  });
  return true;
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false });
  }

  const ip = getIp(req);
  if (rateLimited(ip)) {
    return json(res, 429, { ok: false });
  }

  let params;
  try {
    const body = await readBody(req);
    params = parseForm(body, req.headers["content-type"] || "");
  } catch {
    return json(res, 400, { ok: false });
  }

  if (params.get("website")) {
    return json(res, 202, { ok: true });
  }

  const startedAt = Number(params.get("startedAt") || 0);
  if (!startedAt || Date.now() - startedAt < MIN_FORM_AGE_MS) {
    return json(res, 400, { ok: false });
  }

  const fields = {
    name: String(params.get("Name") || "").trim(),
    contact: String(params.get("Kontakt") || "").trim(),
    location: String(params.get("Ort") || "").trim(),
    message: String(params.get("Nachricht") || "").trim(),
  };

  const values = Object.values(fields);
  if (values.some((value) => value.length > MAX_FIELD_LENGTH) || hasSpam(values)) {
    return json(res, 400, { ok: false });
  }

  if (!fields.contact || !fields.message) {
    return json(res, 400, { ok: false });
  }

  const turnstileOk = await verifyTurnstile(params.get("cf-turnstile-response"), ip);
  if (!turnstileOk) {
    return json(res, 400, { ok: false });
  }

  try {
    const forwarded = await forwardMessage(fields, ip);
    if (!forwarded) {
      return json(res, 503, { ok: false });
    }
  } catch {
    return json(res, 502, { ok: false });
  }

  return json(res, 202, { ok: true });
};
