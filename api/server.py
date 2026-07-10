"""
API تجريبي محلي لبوابة الصيانة
تشغيل:
  python server.py
ثم افتح: http://localhost:8080
"""

from __future__ import annotations

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
HOST = "127.0.0.1"
PORT = 8080

USERS = {
    "C-1001": {"password": "1234", "name": "شركة النور للتجارة"},
    "C-1002": {"password": "1234", "name": "مؤسسة الأمل الصناعية"},
}

ORDERS = [
    {
        "id": "WO-50021",
        "customerId": "C-1001",
        "equipmentId": "EQ-7781",
        "equipmentName": "ضاغط هواء صناعي",
        "stage": "قيد الإصلاح",
        "status": "جاري العمل",
        "cost": 1850,
        "openedAt": "2026-07-01",
        "updatedAt": "2026-07-09",
        "notes": "تم طلب قطعة الغيار وبدء التركيب.",
        "stages": ["استلام", "فحص", "قيد الإصلاح", "اختبار", "تسليم"],
    },
    {
        "id": "WO-50018",
        "customerId": "C-1001",
        "equipmentId": "EQ-2204",
        "equipmentName": "مضخة مياه",
        "stage": "اختبار",
        "status": "قريب من الإكمال",
        "cost": 640,
        "openedAt": "2026-06-20",
        "updatedAt": "2026-07-08",
        "notes": "الإصلاح مكتمل تقريباً — بانتظار اختبار التشغيل.",
        "stages": ["استلام", "فحص", "قيد الإصلاح", "اختبار", "تسليم"],
    },
    {
        "id": "WO-49990",
        "customerId": "C-1001",
        "equipmentId": "EQ-1109",
        "equipmentName": "مولد كهرباء",
        "stage": "تسليم",
        "status": "مكتمل",
        "cost": 3200,
        "openedAt": "2026-05-12",
        "updatedAt": "2026-06-02",
        "notes": "تم التسليم للعميل.",
        "stages": ["استلام", "فحص", "قيد الإصلاح", "اختبار", "تسليم"],
    },
    {
        "id": "WO-50102",
        "customerId": "C-1002",
        "equipmentId": "EQ-3301",
        "equipmentName": "رافعة شوكية",
        "stage": "فحص",
        "status": "بانتظار قطع",
        "cost": 4100,
        "openedAt": "2026-07-05",
        "updatedAt": "2026-07-10",
        "notes": "الفحص أظهر حاجة لتغيير الهيدروليك.",
        "stages": ["استلام", "فحص", "قيد الإصلاح", "اختبار", "تسليم"],
    },
]


def json_response(handler: SimpleHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)


def read_json(handler: SimpleHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    return json.loads(raw) if raw else {}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/login":
            data = read_json(self)
            customer_id = str(data.get("customerId", "")).strip().upper()
            password = str(data.get("password", ""))
            user = USERS.get(customer_id)
            if not user or user["password"] != password:
                return json_response(self, 401, {"ok": False, "error": "بيانات الدخول غير صحيحة"})
            return json_response(
                self,
                200,
                {"ok": True, "customerId": customer_id, "name": user["name"]},
            )
        return json_response(self, 404, {"ok": False, "error": "المسار غير موجود"})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            return json_response(self, 200, {"ok": True, "message": "API يعمل"})

        if path == "/api/orders/search":
            query = parse_qs(parsed.query)
            customer_id = (query.get("customerId") or [""])[0].strip().upper()
            mode = (query.get("mode") or ["equipment"])[0].strip().lower()
            value = (query.get("q") or [""])[0].strip().upper()

            if customer_id not in USERS:
                return json_response(self, 401, {"ok": False, "error": "عميل غير معروف"})

            mine = [o for o in ORDERS if o["customerId"] == customer_id]

            if mode == "equipment":
                results = [o for o in mine if o["equipmentId"].upper() == value]
            elif mode == "workorder":
                results = [o for o in mine if o["id"].upper() == value]
            elif mode == "customer":
                if value != customer_id:
                    return json_response(
                        self,
                        200,
                        {"ok": True, "orders": [], "message": "يمكنك البحث فقط برقم عميلك"},
                    )
                results = mine
            else:
                return json_response(self, 400, {"ok": False, "error": "نوع بحث غير صالح"})

            return json_response(self, 200, {"ok": True, "orders": results})

        if path.startswith("/api/orders/"):
            order_id = path.split("/")[-1].upper()
            customer_id = (parse_qs(parsed.query).get("customerId") or [""])[0].strip().upper()
            order = next((o for o in ORDERS if o["id"].upper() == order_id), None)
            if not order:
                return json_response(self, 404, {"ok": False, "error": "أمر العمل غير موجود"})
            if order["customerId"] != customer_id:
                return json_response(self, 403, {"ok": False, "error": "غير مصرح"})
            return json_response(self, 200, {"ok": True, "order": order})

        # ملفات الموقع (HTML/CSS/JS)
        return super().do_GET()

    def log_message(self, format: str, *args) -> None:
        print(f"[API] {self.address_string()} - {args[0]}")


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("=" * 50)
    print(" API بوابة الصيانة يعمل")
    print(f" الموقع: http://{HOST}:{PORT}")
    print(f" فحص API: http://{HOST}:{PORT}/api/health")
    print(" للإيقاف: Ctrl+C")
    print("=" * 50)
    server.serve_forever()
