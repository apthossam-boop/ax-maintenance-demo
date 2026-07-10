const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function required(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
}

const config = {
  host: required("HOST", "127.0.0.1"),
  port: Number(required("PORT", "8080")),
  // mock | sql | live
  axMode: required("AX_MODE", "sql").toLowerCase(),
  staff: {
    username: required("STAFF_USERNAME", "staff"),
    password: required("STAFF_PASSWORD", "staff123"),
  },
  sql: {
    server: required("SQL_SERVER", "10.1.4.127"),
    port: Number(required("SQL_PORT", "49646")),
    database: required("SQL_DATABASE", "MicrosoftDynamicsAX"),
    domain: required("SQL_DOMAIN", required("AX_DOMAIN", "aptegy")),
    username: required("SQL_USERNAME", required("AX_USERNAME", "axalex")),
    password: required("SQL_PASSWORD", required("AX_PASSWORD", "")),
    dataAreaId: required("SQL_DATAAREAID", "apt"),
    listLimit: Number(required("SQL_LIST_LIMIT", "300")),
  },
  ax: {
    host: required("AX_HOST", "10.1.4.127"),
    servicesPort: Number(required("AX_SERVICES_PORT", "8101")),
    aosPort: Number(required("AX_AOS_PORT", "2712")),
    serviceGroup: required("AX_SERVICE_GROUP", "MBSMaintPortalServiceGroup"),
    company: required("AX_COMPANY", "apt"),
    language: required("AX_LANGUAGE", "en-us"),
    domain: required("AX_DOMAIN", "aptegy"),
    username: required("AX_USERNAME", "axalex"),
    password: required("AX_PASSWORD", ""),
  },
};

config.ax.wsdlUrl = `http://${config.ax.host}:${config.ax.servicesPort}/DynamicsAx/Services/${config.ax.serviceGroup}?wsdl`;
config.ax.serviceUrl = `http://${config.ax.host}:${config.ax.servicesPort}/DynamicsAx/Services/${config.ax.serviceGroup}`;

module.exports = config;
