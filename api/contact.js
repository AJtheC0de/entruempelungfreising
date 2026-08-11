const buckets = new Map();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const MIN_FORM_AGE_MS = 4500;
const MAX_FIELD_LENGTH = 4000;
const MAX_URLS = 3;
const MAX_EMAILS = 3;
const SPAM_WORDS = [
  "seo",
  "seo paket",
  "casino",
  "crypto",
  "viagra",
  "loan",
  "porn",
  "seo package",
  "seo service",
  "seo services",
  "suchmaschinenoptimierung",
  "search engine optimization",
  "backlink",
  "backlinks",
  "linkbuilding",
  "link building",
  "keyword ranking",
  "google ranking",
  "google rankings",
  "ranking verbessern",
  "rank higher",
  "google bewertung",
  "google bewertungen",
  "google review",
  "google reviews",
  "google rating",
  "google ratings",
  "5 sterne bewertung",
  "5 star review",
  "bewertungen kaufen",
  "buy reviews",
  "trustpilot",
  "telegram",
  "whatsapp marketing",
  "webdesign",
  "web design",
  "webdesigner",
  "website redesign",
  "website design",
  "website development",
  "web development",
  "neue website",
  "new website",
  "homepage erstellen",
  "redesign your website",
  "marketing agentur",
  "marketing agency",
  "digital marketing",
  "online marketing",
  "social media marketing",
  "lead generation",
  "leadgenerierung",
  "generate leads",
  "mehr kunden",
  "more customers",
  "increase traffic",
  "increase leads",
  "google ads",
  "facebook ads",
  "instagram ads",
  "ppc campaign",
  "email marketing",
  "ai automation",
  "ki automatisierung",
  "ai agency",
  "ki agentur",
  "chatgpt",
  "chatbot",
  "virtual assistant",
  "guest post",
  "sponsored post",
  "partnership opportunity",
  "business proposal",
  "quick question",
  "i found your website",
  "improve your website",
  "grow your business",
  "forex",
  "kredit",
];
const SPAM_DOMAINS = [
  "@outlookindia.com",
  "@yandex.com",
  "@mail.ru",
  "@163.com",
  "@qq.com",
];
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
const BLOCKED_URL_PATTERN = /\b(?:https?:\/\/|www\.)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

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

const hasSpamWord = (values) => {
  const haystack = values.join(" ").toLowerCase();
  return SPAM_WORDS.some((word) => haystack.includes(word));
};

const hasSpamDomain = (values) => {
  const haystack = values.join(" ").toLowerCase();
  return SPAM_DOMAINS.some((domain) => haystack.includes(domain));
};

const countMatches = (value, pattern) => {
  const matches = value.match(pattern);
  return matches ? matches.length : 0;
};

const hasMessageSpam = (message) => {
  const urlCount = countMatches(message, URL_PATTERN);
  const emailCount = countMatches(message, EMAIL_PATTERN);
  return (
    BLOCKED_URL_PATTERN.test(message) ||
    urlCount > MAX_URLS ||
    emailCount > MAX_EMAILS
  );
};

const forwardMessage = async (fields, ip) => {
  const target = process.env.CONTACT_WEBHOOK_URL;
  if (!target) return false;

  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "entruempelungfreising.de",
      ip,
      receivedAt: new Date().toISOString(),
      fields,
    }),
  });

  if (!response.ok) {
    throw new Error(`Contact webhook responded with ${response.status}`);
  }

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
  if (
    values.some((value) => value.length > MAX_FIELD_LENGTH) ||
    hasSpamWord(values) ||
    hasSpamDomain(values) ||
    hasMessageSpam(fields.message)
  ) {
    return json(res, 400, { ok: false });
  }

  if (!fields.contact || !fields.message) {
    return json(res, 400, { ok: false });
  }

  try {
    const forwarded = await forwardMessage(fields, ip);
    if (!forwarded) {
      return json(res, 503, { ok: false, error: "service_unavailable" });
    }
  } catch {
    return json(res, 502, { ok: false, error: "delivery_failed" });
  }

  return json(res, 202, { ok: true });
};
