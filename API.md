# كيفية عمل API — بوابة الصيانة

## ما هو الـ API؟
الـ API جسر بين الموقع وقاعدة البيانات (أو AX).

```
المتصفح (الموقع)  →  يطلب بيانات  →  API  →  يرد JSON  →  الموقع يعرضها
```

مثال رد JSON:
```json
{
  "ok": true,
  "orders": [
    {
      "id": "WO-50021",
      "stage": "قيد الإصلاح",
      "cost": 1850
    }
  ]
}
```

## تشغيل الـ API المحلي (مجاني)
1. تأكد أن Python مثبت على الجهاز
2. انقر مرتين على `start-api.bat`
   أو من PowerShell:
   ```powershell
   cd C:\Users\tykok\ax-maintenance-demo
   python api\server.py
   ```
3. افتح المتصفح: http://localhost:8080

## المسارات (Endpoints) الجاهزة

| الطريقة | المسار | الوظيفة |
|---------|--------|---------|
| GET | `/api/health` | فحص أن الـ API يعمل |
| POST | `/api/login` | تسجيل دخول العميل |
| GET | `/api/orders/search?customerId=C-1001&mode=equipment&q=EQ-7781` | بحث |
| GET | `/api/orders/WO-50021?customerId=C-1001` | تفاصيل أمر عمل |

### مثال Login (Body JSON)
```json
{
  "customerId": "C-1001",
  "password": "1234"
}
```

### أنواع البحث `mode`
- `equipment` رقم المعدة
- `workorder` رقم أمر العمل
- `customer` رقم العميل

## تجربة سريعة من المتصفح
افتح:
- http://localhost:8080/api/health
- http://localhost:8080/api/orders/search?customerId=C-1001&mode=customer&q=C-1001

## لاحقاً مع Microsoft AX 2012
نفس الفكرة، لكن مصدر البيانات يتغير:

```
الموقع → API الوسيط → خدمة AX (AIF / Custom Service) → جداول الصيانة
```

في AX عادة تُنشأ:
1. **Custom Service** تقرأ أوامر الصيانة
2. عمليات مثل: `login` / `searchOrders` / `getOrder`
3. الـ API الوسيط يستدعي AX بدل البيانات الوهمية في `server.py`

## ملخص
- الآن: API محلي ببيانات تجريبية
- بعدين: نستبدل قراءة `ORDERS` باستدعاء AX الحقيقي
