const MOCK_ORDERS = [
  {
    workOrderId: "WO-50021",
    equipmentId: "EQ-7781",
    equipmentCode: "EQ-7781",
    custPhone: "01001234567",
    cost: 1850,
    technicianName: "أحمد علي",
    status: "قيد الإصلاح",
    stage: "قيد الإصلاح",
  },
  {
    workOrderId: "WO-50018",
    equipmentId: "EQ-2204",
    equipmentCode: "EQ-2204",
    custPhone: "01001234567",
    cost: 640,
    technicianName: "محمود حسن",
    status: "اختبار",
    stage: "اختبار",
  },
  {
    workOrderId: "WO-49990",
    equipmentId: "EQ-1109",
    equipmentCode: "EQ-1109",
    custPhone: "01001234567",
    cost: 3200,
    technicianName: "أحمد علي",
    status: "تسليم",
    stage: "تسليم",
  },
  {
    workOrderId: "WO-50102",
    equipmentId: "EQ-3301",
    equipmentCode: "EQ-3301",
    custPhone: "01009876543",
    cost: 4100,
    technicianName: "سارة إبراهيم",
    status: "فحص",
    stage: "فحص",
  },
];

function normalizePhone(phone) {
  return String(phone || "").replace(/\s+/g, "").trim();
}

async function validatePhone(phone) {
  const p = normalizePhone(phone);
  return MOCK_ORDERS.some((o) => o.custPhone === p);
}

async function searchOrders({ mode, query, custPhone }) {
  const phone = normalizePhone(custPhone);
  const q = String(query || "").trim().toUpperCase();
  let rows = MOCK_ORDERS.filter((o) => o.custPhone === phone);

  if (mode === "phone" || mode === "customer") {
    return rows;
  }
  if (mode === "equipment") {
    return rows.filter(
      (o) => o.equipmentId.toUpperCase() === q || o.equipmentCode.toUpperCase() === q
    );
  }
  if (mode === "workorder") {
    return rows.filter((o) => o.workOrderId.toUpperCase() === q);
  }
  return [];
}

async function getOrder(workOrderId, custPhone) {
  const id = String(workOrderId).toUpperCase();
  if (!custPhone) {
    return MOCK_ORDERS.find((o) => o.workOrderId.toUpperCase() === id) || null;
  }
  const phone = normalizePhone(custPhone);
  return (
    MOCK_ORDERS.find((o) => o.workOrderId.toUpperCase() === id && o.custPhone === phone) || null
  );
}

async function listAllEquipment({ query = "", status = "" } = {}) {
  const q = String(query || "").trim().toUpperCase();
  const st = String(status || "").trim();
  return MOCK_ORDERS.filter((o) => {
    const matchQuery =
      !q ||
      o.equipmentId.toUpperCase().includes(q) ||
      o.equipmentCode.toUpperCase().includes(q) ||
      o.workOrderId.toUpperCase().includes(q) ||
      o.custPhone.includes(q) ||
      (o.technicianName || "").includes(query);
    const matchStatus = !st || o.status === st || o.stage === st;
    return matchQuery && matchStatus;
  });
}

async function health() {
  return { ok: true, mode: "mock" };
}

module.exports = {
  validatePhone,
  searchOrders,
  getOrder,
  listAllEquipment,
  health,
};
