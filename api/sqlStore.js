const sql = require("mssql");
const config = require("./config");

let poolPromise = null;

function normalizePhone(phone) {
  return String(phone || "").replace(/[\s\-]/g, "").trim();
}

function statusLabel(code) {
  const n = Number(code);
  const map = {
    0: "جديد / مفتوح",
    1: "قيد التنفيذ",
    5: "مكتمل جزئياً",
    7: "مغلق",
    14: "مُسلَّم",
  };
  return map[n] || `حالة ${Number.isFinite(n) ? n : "-"}`;
}

function mapRow(row) {
  const statusCode = row.serviceStatus ?? row.operationStatus ?? row.workOrderStatus;
  return {
    workOrderId: String(row.workOrderId || "").trim(),
    equipmentId: String(row.equipmentId || "").trim(),
    equipmentCode: String(row.equipmentCode || "").trim(),
    custPhone: normalizePhone(row.custPhone),
    custAccount: String(row.custAccount || "").trim(),
    custName: String(row.custName || "").trim(),
    cost: Number(row.cost || 0),
    technicianName: String(row.technicianName || "").trim(),
    status: statusLabel(statusCode),
    stage: statusLabel(statusCode),
    workOrderStatus: Number(row.workOrderStatus || 0),
    serviceStatus: Number(row.serviceStatus || 0),
    searchName: String(row.searchName || "").trim(),
    createdAt: row.createdAt || null,
  };
}

async function getPool() {
  if (!poolPromise) {
    const sqlConfig = {
      server: config.sql.server,
      port: config.sql.port,
      database: config.sql.database,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      connectionTimeout: 15000,
      requestTimeout: 60000,
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
      authentication: {
        type: "ntlm",
        options: {
          domain: config.sql.domain,
          userName: config.sql.username,
          password: config.sql.password,
        },
      },
    };
    poolPromise = new sql.ConnectionPool(sqlConfig)
      .connect()
      .then((pool) => {
        pool.on("error", (err) => {
          console.error("[SQL POOL ERROR]", err);
          poolPromise = null;
        });
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

const BASE_SELECT = `
SELECT
  s.MBS_WORKSHOPORDERID AS workOrderId,
  s.ITEMID AS equipmentId,
  s.TOOLSERIAL AS equipmentCode,
  s.TELNO AS custPhone,
  s.CUSTACCOUNT AS custAccount,
  s.CUSTNAME AS custName,
  s.MBS_WORKORDERSTATUS AS workOrderStatus,
  s.OPERATIONSTATUS AS operationStatus,
  s.CREATEDDATETIME AS createdAt,
  o.SERIVCESTATUS AS serviceStatus,
  o.SEARCHNAME AS searchName,
  COALESCE(
    (
      SELECT SUM(i.PRICE * ISNULL(i.QTY, 1))
      FROM MBS_WORKSHOPORDERITEMS i
      WHERE i.MBS_WORKSHOPORDERSSERVICESRECID = s.RECID
        AND i.DATAAREAID = s.DATAAREAID
    ),
    o.PRICE,
    0
  ) AS cost,
  COALESCE(p.NAME, o.DELIVEREDBY, N'') AS technicianName
FROM MBS_WORKSHOPORDERSSERVICES s
LEFT JOIN MBS_WORKSHOPORDEROPERATIONS o
  ON o.MBS_WORKSHOPORDERID = s.MBS_WORKSHOPORDERID
 AND o.MBS_WORKSHOPORDERSSERVICESRECID = s.RECID
 AND o.DATAAREAID = s.DATAAREAID
LEFT JOIN HCMWORKER w
  ON w.RECID = o.WORKER
LEFT JOIN DIRPARTYTABLE p
  ON p.RECID = w.PERSON
`;

async function validatePhone(phone) {
  const p = normalizePhone(phone);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("dataAreaId", sql.NVarChar(4), config.sql.dataAreaId)
    .input("phone", sql.NVarChar(40), p)
    .query(`
      SELECT TOP 1 s.RECID
      FROM MBS_WORKSHOPORDERSSERVICES s
      WHERE s.DATAAREAID = @dataAreaId
        AND REPLACE(REPLACE(REPLACE(ISNULL(s.TELNO,''), ' ', ''), '-', ''), '+', '') = @phone
    `);
  return result.recordset.length > 0;
}

async function searchOrders({ mode, query, custPhone }) {
  const phone = normalizePhone(custPhone);
  const q = String(query || "").trim();
  const pool = await getPool();
  const request = pool
    .request()
    .input("dataAreaId", sql.NVarChar(4), config.sql.dataAreaId)
    .input("phone", sql.NVarChar(40), phone)
    .input("q", sql.NVarChar(100), q);

  let where = `
    WHERE s.DATAAREAID = @dataAreaId
      AND REPLACE(REPLACE(REPLACE(ISNULL(s.TELNO,''), ' ', ''), '-', ''), '+', '') = @phone
  `;

  if (mode === "equipment") {
    where += ` AND (s.ITEMID = @q OR s.TOOLSERIAL = @q)`;
  } else if (mode === "workorder") {
    where += ` AND s.MBS_WORKSHOPORDERID = @q`;
  }

  const result = await request.query(`
    ${BASE_SELECT}
    ${where}
    ORDER BY s.CREATEDDATETIME DESC
  `);
  return result.recordset.map(mapRow);
}

async function getOrder(workOrderId, custPhone) {
  const pool = await getPool();
  const request = pool
    .request()
    .input("dataAreaId", sql.NVarChar(4), config.sql.dataAreaId)
    .input("workOrderId", sql.NVarChar(20), String(workOrderId || "").trim());

  let where = `
    WHERE s.DATAAREAID = @dataAreaId
      AND s.MBS_WORKSHOPORDERID = @workOrderId
  `;

  if (custPhone) {
    request.input("phone", sql.NVarChar(40), normalizePhone(custPhone));
    where += ` AND REPLACE(REPLACE(REPLACE(ISNULL(s.TELNO,''), ' ', ''), '-', ''), '+', '') = @phone`;
  }

  const result = await request.query(`
    ${BASE_SELECT}
    ${where}
  `);
  return result.recordset[0] ? mapRow(result.recordset[0]) : null;
}

async function listAllEquipment({ query = "", status = "" } = {}) {
  const pool = await getPool();
  const q = String(query || "").trim();
  const request = pool
    .request()
    .input("dataAreaId", sql.NVarChar(4), config.sql.dataAreaId)
    .input("q", sql.NVarChar(100), q ? `%${q}%` : "%")
    .input("topN", sql.Int, config.sql.listLimit);

  let where = `WHERE s.DATAAREAID = @dataAreaId`;
  if (q) {
    where += `
      AND (
        s.MBS_WORKSHOPORDERID LIKE @q
        OR s.ITEMID LIKE @q
        OR s.TOOLSERIAL LIKE @q
        OR s.TELNO LIKE @q
        OR s.CUSTNAME LIKE @q
        OR s.CUSTACCOUNT LIKE @q
      )
    `;
  }

  const result = await request.query(`
    SELECT TOP (@topN) *
    FROM (
      ${BASE_SELECT}
      ${where}
    ) x
    ORDER BY x.createdAt DESC
  `);

  let rows = result.recordset.map(mapRow);
  if (status) {
    rows = rows.filter((r) => r.status === status || String(r.serviceStatus) === status);
  }
  return rows;
}

async function health() {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("dataAreaId", sql.NVarChar(4), config.sql.dataAreaId)
      .query(`
        SELECT
          DB_NAME() AS dbName,
          @@SERVERNAME AS serverName,
          (SELECT COUNT(*) FROM MBS_WORKSHOPORDERSSERVICES WHERE DATAAREAID=@dataAreaId) AS ordersCount
      `);
    const row = result.recordset[0];
    return {
      ok: true,
      mode: "sql",
      dbName: row.dbName,
      serverName: row.serverName,
      ordersCount: row.ordersCount,
    };
  } catch (error) {
    return { ok: false, mode: "sql", error: error.message };
  }
}

module.exports = {
  validatePhone,
  searchOrders,
  getOrder,
  listAllEquipment,
  health,
};
