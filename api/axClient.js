const soap = require("soap");
const config = require("./config");

let clientPromise = null;

function mapOrder(raw) {
  if (!raw) return null;
  return {
    workOrderId: raw.WorkOrderId || raw.workOrderId || "",
    equipmentId: raw.EquipmentId || raw.equipmentId || "",
    equipmentCode: raw.EquipmentCode || raw.equipmentCode || "",
    custPhone: raw.CustPhone || raw.custPhone || "",
    cost: Number(raw.Cost ?? raw.cost ?? 0),
    technicianName: raw.TechnicianName || raw.technicianName || "",
    status: raw.Status || raw.status || "",
    stage: raw.Stage || raw.stage || raw.Status || raw.status || "",
  };
}

function unwrapList(result) {
  if (!result) return [];
  // AX/SOAP غالباً ترجع أشكال مختلفة
  const candidates = [
    result,
    result.response,
    result.return,
    result.result,
    result.searchOrdersResult,
    result.searchByPhoneResult,
    result.MBSMaintOrderContract,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) {
      return item.map(mapOrder).filter(Boolean);
    }
    if (item && Array.isArray(item.MBSMaintOrderContract)) {
      return item.MBSMaintOrderContract.map(mapOrder).filter(Boolean);
    }
    if (item && item.MBSMaintOrderContract) {
      return [mapOrder(item.MBSMaintOrderContract)].filter(Boolean);
    }
  }

  if (typeof result === "object" && (result.WorkOrderId || result.workOrderId)) {
    return [mapOrder(result)];
  }

  return [];
}

async function getClient() {
  if (!clientPromise) {
    const wsdlOptions = {
      wsdl_headers: {},
      wsdl_options: {
        timeout: 15000,
      },
    };

    // NTLM/basic حسب إعداد Inbound Port عندكم
    if (config.ax.username) {
      const user = config.ax.domain
        ? `${config.ax.domain}\\${config.ax.username}`
        : config.ax.username;
      wsdlOptions.wsdl_headers.Authorization =
        "Basic " + Buffer.from(`${user}:${config.ax.password}`).toString("base64");
    }

    clientPromise = soap.createClientAsync(config.ax.wsdlUrl, wsdlOptions).then((client) => {
      if (config.ax.username) {
        const user = config.ax.domain
          ? `${config.ax.domain}\\${config.ax.username}`
          : config.ax.username;
        client.setSecurity(new soap.BasicAuthSecurity(user, config.ax.password));
      }
      return client;
    });
  }
  return clientPromise;
}

async function call(methodName, args) {
  const client = await getClient();
  const fn = client[`${methodName}Async`] || client[methodName];
  if (!fn) {
    const methods = Object.keys(client).filter((k) => k.endsWith("Async"));
    throw new Error(
      `العملية ${methodName} غير موجودة في خدمة AX. المتاح: ${methods.join(", ") || "لا يوجد"}`
    );
  }

  const result = await fn.call(client, args);
  // soap library غالباً ترجع [result, raw, soapHeader, ...]
  return Array.isArray(result) ? result[0] : result;
}

async function validatePhone(phone) {
  const result = await call("validatePhone", { _custPhone: phone });
  const value =
    result === true ||
    result === "true" ||
    result?.validatePhoneResult === true ||
    result?.return === true ||
    result?.response === true;
  return Boolean(value);
}

async function searchOrders({ mode, query, custPhone }) {
  if (mode === "phone" || mode === "customer") {
    const result = await call("searchByPhone", { _custPhone: custPhone || query });
    return unwrapList(result);
  }

  const result = await call("searchOrders", {
    _request: {
      Mode: mode,
      Query: query,
      CustPhone: custPhone,
    },
  });
  return unwrapList(result);
}

async function getOrder(workOrderId, custPhone) {
  const result = await call("getOrder", {
    _workOrderId: workOrderId,
    _custPhone: custPhone || "",
  });
  const raw =
    result?.getOrderResult ||
    result?.return ||
    result?.response ||
    result?.MBSMaintOrderContract ||
    result;
  return mapOrder(raw);
}

async function listAllEquipment({ query = "", status = "" } = {}) {
  try {
    const result = await call("listAllOrders", {
      _query: query || "",
      _status: status || "",
    });
    return unwrapList(result);
  } catch (error) {
    // fallback إذا لم تُنشر listAllOrders بعد
    const result = await call("searchOrders", {
      _request: {
        Mode: "all",
        Query: query || "",
        CustPhone: "",
      },
    });
    let rows = unwrapList(result);
    if (status) {
      rows = rows.filter((o) => o.status === status || o.stage === status);
    }
    return rows;
  }
}

async function health() {
  try {
    await getClient();
    return { ok: true, mode: "live", wsdl: config.ax.wsdlUrl };
  } catch (error) {
    return { ok: false, mode: "live", error: error.message, wsdl: config.ax.wsdlUrl };
  }
}

module.exports = {
  validatePhone,
  searchOrders,
  getOrder,
  listAllEquipment,
  health,
};
