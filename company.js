(function () {
  const loginView = document.getElementById("login-view");
  const mainView = document.getElementById("main-view");
  const detailView = document.getElementById("detail-view");
  const loginForm = document.getElementById("login-form");
  const filterForm = document.getElementById("filter-form");
  const filterError = document.getElementById("filter-error");
  const equipBody = document.getElementById("equip-body");
  const statsEl = document.getElementById("stats");
  const welcomeEl = document.getElementById("welcome");
  const detailContent = document.getElementById("detail-content");

  let staffUser = null;
  let rows = [];

  function show(view) {
    [loginView, mainView, detailView].forEach((el) => el.classList.add("hidden"));
    view.classList.remove("hidden");
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  }

  function toWhatsAppNumber(phone) {
    let digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = "20" + digits.slice(1);
    if (!digits.startsWith("20") && digits.length === 10) digits = "20" + digits;
    return digits;
  }

  function buildWhatsAppUrl(order) {
    const phone = toWhatsAppNumber(order.custPhone);
    if (!phone) return "";
    const text = [
      "مرحباً،",
      `تفاصيل أمر الصيانة رقم: ${order.workOrderId || "-"}`,
      `المعدة: ${order.equipmentId || "-"}${order.equipmentCode ? " / " + order.equipmentCode : ""}`,
      `الحالة: ${order.status || order.stage || "-"}`,
      `تكلفة الإصلاح: ${formatMoney(order.cost)}`,
    ].join("\n");
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  async function api(path, options) {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "فشل الاتصال بالـ API");
    }
    return data;
  }

  function logout() {
    staffUser = null;
    rows = [];
    show(loginView);
  }

  function renderStats(orders) {
    const total = orders.length;
    const byStatus = {};
    orders.forEach((o) => {
      const key = o.status || o.stage || "غير محدد";
      byStatus[key] = (byStatus[key] || 0) + 1;
    });
    const chips = Object.entries(byStatus)
      .map(([name, count]) => `<span class="stat-chip">${name}: <strong>${count}</strong></span>`)
      .join("");
    statsEl.innerHTML = `<span class="stat-chip total">الإجمالي: <strong>${total}</strong></span>${chips}`;
  }

  function renderTable(orders) {
    rows = orders;
    renderStats(orders);
    if (!orders.length) {
      equipBody.innerHTML = `<tr><td colspan="7" class="muted">لا توجد معدات مطابقة.</td></tr>`;
      return;
    }

    equipBody.innerHTML = orders
      .map(
        (o) => `
      <tr class="clickable" data-id="${o.workOrderId}">
        <td><strong>${o.workOrderId}</strong></td>
        <td>${o.equipmentId || "-"}</td>
        <td>${o.equipmentCode || "-"}</td>
        <td><span class="badge">${o.status || o.stage || "-"}</span></td>
        <td>${o.technicianName || "-"}</td>
        <td>${o.custPhone || "-"}</td>
        <td class="cost-cell">${formatMoney(o.cost)}</td>
      </tr>`
      )
      .join("");

    equipBody.querySelectorAll("tr.clickable").forEach((tr) => {
      tr.addEventListener("click", async () => {
        try {
          const data = await api(`/api/orders/${encodeURIComponent(tr.dataset.id)}?staff=1`);
          renderDetail(data.order);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderDetail(order) {
    const waUrl = buildWhatsAppUrl(order);
    detailContent.innerHTML = `
      <p class="brand">تفاصيل أمر العمل</p>
      <h2>${order.workOrderId}</h2>
      <p class="muted">المعدة ${order.equipmentId}${order.equipmentCode ? " / " + order.equipmentCode : ""}</p>
      <div class="meta">
        <div><span>الحالة / المرحلة</span><strong>${order.status || order.stage || "-"}</strong></div>
        <div><span>الفني</span><strong>${order.technicianName || "-"}</strong></div>
        <div><span>تكلفة الإصلاح</span><strong class="cost">${formatMoney(order.cost)}</strong></div>
        <div><span>تليفون العميل</span><strong>${order.custPhone || "-"}</strong></div>
      </div>
      <div class="actions-row">
        ${
          waUrl
            ? `<a class="btn-whatsapp" href="${waUrl}" target="_blank" rel="noopener noreferrer">إرسال التكلفة على واتساب</a>`
            : `<button type="button" class="btn-whatsapp" disabled>لا يوجد رقم واتساب</button>`
        }
      </div>
    `;
    show(detailView);
  }

  async function loadEquipment() {
    filterError.classList.add("hidden");
    equipBody.innerHTML = `<tr><td colspan="7" class="muted">جاري التحميل...</td></tr>`;
    const q = document.getElementById("filter-q").value.trim();
    const status = document.getElementById("filter-status").value.trim();
    try {
      const params = new URLSearchParams({ q, status });
      const data = await api(`/api/equipment?${params.toString()}`);
      renderTable(data.orders || []);
    } catch (error) {
      equipBody.innerHTML = `<tr><td colspan="7" class="muted">تعذر تحميل البيانات.</td></tr>`;
      filterError.textContent = error.message;
      filterError.classList.remove("hidden");
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    try {
      const data = await api("/api/staff/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      staffUser = data;
      welcomeEl.textContent = `مرحباً، ${data.name} (${data.username})`;
      show(mainView);
      await loadEquipment();
    } catch (error) {
      alert(error.message);
    }
  });

  filterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadEquipment();
  });

  document.getElementById("refresh-btn").addEventListener("click", loadEquipment);
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("logout-btn-2").addEventListener("click", logout);
  document.getElementById("back-btn").addEventListener("click", () => show(mainView));

  show(loginView);
})();
