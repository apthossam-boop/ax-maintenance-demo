const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const config = require("./config");
const mockStore = require("./mockStore");
const axClient = require("./axClient");
const sqlStore = require("./sqlStore");

const ROOT = path.join(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function store() {
  if (config.axMode === "sql") return sqlStore;
  if (config.axMode === "live") return axClient;
  return mockStore;
}

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  const relative = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, relative));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${config.host}:${config.port}`);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      const axHealth = await store().health();
      return sendJson(res, axHealth.ok ? 200 : 503, {
        ok: axHealth.ok,
        mode: config.axMode,
        ax: axHealth,
        message:
          config.axMode === "sql"
            ? "API يعمل (SQL / MicrosoftDynamicsAX)"
            : config.axMode === "mock"
              ? "API يعمل (وضع تجريبي)"
              : "API يعمل (وضع AX Service)",
      });
    }

    if (req.method === "POST" && pathname === "/api/staff/login") {
      const data = await readBody(req);
      const username = String(data.username || "").trim();
      const password = String(data.password || "");
      if (username !== config.staff.username || password !== config.staff.password) {
        return sendJson(res, 401, { ok: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      return sendJson(res, 200, {
        ok: true,
        role: "staff",
        username,
        name: "مستخدم الشركة",
      });
    }

    if (req.method === "GET" && pathname === "/api/equipment") {
      const query = (url.searchParams.get("q") || "").trim();
      const status = (url.searchParams.get("status") || "").trim();
      const orders = await store().listAllEquipment({ query, status });
      return sendJson(res, 200, { ok: true, orders, count: orders.length });
    }

    if (req.method === "POST" && pathname === "/api/login") {
      const data = await readBody(req);
      const phone = String(data.phone || data.customerId || "").replace(/\s+/g, "").trim();
      if (!phone) {
        return sendJson(res, 400, { ok: false, error: "أدخل رقم التليفون" });
      }

      const valid = await store().validatePhone(phone);
      if (!valid) {
        return sendJson(res, 401, { ok: false, error: "رقم التليفون غير موجود في أوامر الصيانة" });
      }

      return sendJson(res, 200, {
        ok: true,
        phone,
        name: `عميل ${phone}`,
      });
    }

    if (req.method === "GET" && pathname === "/api/orders/search") {
      const phone = (url.searchParams.get("phone") || url.searchParams.get("customerId") || "")
        .replace(/\s+/g, "")
        .trim();
      const mode = (url.searchParams.get("mode") || "equipment").trim().toLowerCase();
      const query = (url.searchParams.get("q") || "").trim();

      if (!phone) {
        return sendJson(res, 401, { ok: false, error: "يجب تسجيل الدخول برقم التليفون" });
      }

      const orders = await store().searchOrders({ mode, query, custPhone: phone });
      return sendJson(res, 200, { ok: true, orders });
    }

    if (req.method === "GET" && pathname.startsWith("/api/orders/")) {
      const workOrderId = decodeURIComponent(pathname.split("/").pop());
      const phone = (url.searchParams.get("phone") || url.searchParams.get("customerId") || "")
        .replace(/\s+/g, "")
        .trim();
      const staff = (url.searchParams.get("staff") || "") === "1";
      const order = await store().getOrder(workOrderId, staff ? "" : phone);
      if (!order) {
        return sendJson(res, 404, { ok: false, error: "أمر العمل غير موجود أو غير مصرح" });
      }
      return sendJson(res, 200, { ok: true, order });
    }

    if (pathname.startsWith("/api/")) {
      return sendJson(res, 404, { ok: false, error: "المسار غير موجود" });
    }

    return serveStatic(req, res, pathname);
  } catch (error) {
    console.error("[API ERROR]", error);
    return sendJson(res, 500, {
      ok: false,
      error: error.message || "خطأ في الخادم",
      mode: config.axMode,
    });
  }
});

server.listen(config.port, config.host, () => {
  console.log("=".repeat(60));
  console.log(" بوابة صيانة AX 2012");
  console.log(` الموقع: http://${config.host}:${config.port}`);
  console.log(` الوضع: ${config.axMode}`);
  console.log(` AX WSDL: ${config.ax.wsdlUrl}`);
  console.log(" للإيقاف: Ctrl+C");
  console.log("=".repeat(60));
});
