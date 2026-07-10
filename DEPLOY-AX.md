# نشر Custom Service على AX 2012

## حالة الشبكة (تم فحصها من جهازك)
- `10.1.4.127:2712` مفتوح (AOS)
- `10.1.4.127:8101` مفتوح (Services HTTP) — حالياً يرد 503 إلى أن تُنشر/تفعّل الخدمة
- `1433` مغلق → لا نستخدم SQL مباشر

## تحذير أمان
تم إدخال كلمة مرور السيرفر في المحادثة. بعد التشغيل غيّرها، ولا ترفع ملف `.env` لأي مكان.

## الحقول — مهم جداً
أسماء الحقول في الكود افتراضية. افتح الجداول في AOT/Table browser وعدّل الأسماء في الملفات لتطابق بيئتكم:

### MBS_WorkShopOrdersServices (متوقع)
| معنى | اسم افتراضي في الكود |
|------|----------------------|
| رقم أمر الشغل | WorkOrderId |
| كود/رقم المعدة | EquipmentId |
| كود معدة إضافي | EquipmentCode |
| هاتف العميل | CustPhone |
| التكلفة | Cost |

### MBS_WorkShopOrderOperations (متوقع)
| معنى | اسم افتراضي في الكود |
|------|----------------------|
| رقم أمر الشغل | WorkOrderId |
| رقم المعدة | EquipmentId |
| اسم الفني | TechnicianName |
| الحالة/الاستاتس | Status |

## خطوات النشر في AX
1. افتح **Development Workspace** بحساب له صلاحية AOT
2. أنشئ الـ Classes من مجلد `ax-xpp/` بالترتيب:
   - `MBSMaintOrderContract`
   - `MBSMaintSearchRequestContract`
   - `MBSMaintPortalService`
3. صحّح أسماء الحقول حسب Table browser
4. أنشئ **Service** اسمه `MBSMaintPortalService` واربط الـ class
5. أضف Operations: `searchByPhone`, `searchOrders`, `getOrder`
6. أنشئ **Service Group**: `MBSMaintPortalServiceGroup`
7. Deploy Service Group
8. **Inbound ports** → New → HTTP → اربط العمليات → **Activate**
9. جرّب WSDL:
   `http://10.1.4.127:8101/DynamicsAx/Services/MBSMaintPortalServiceGroup?wsdl`

## بعد نجاح WSDL
في ملف `.env` غيّر:
```env
AX_MODE=live
```
ثم أعد تشغيل `start-api.bat`
