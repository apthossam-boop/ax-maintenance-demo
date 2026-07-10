(function () {
  const API_BASE = "";
  const loginView = document.getElementById("login-view");
  const mainView = document.getElementById("main-view");
  const detailView = document.getElementById("detail-view");
  const loginForm = document.getElementById("login-form");
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const searchError = document.getElementById("search-error");
  const resultsEl = document.getElementById("results");
  const welcomeEl = document.getElementById("welcome");
  const detailContent = document.getElementById("detail-content");
  const modeLabel = document.getElementById("mode-label");

  let currentUser = null;
  let searchMode = "equipment";
  let lastResults = [];

  const placeholders = {
    equipment: "أدخل كود المعدة مثل EQ-7781",
    workorder: "أدخل رقم أمر الشغل مثل WO-50021",
    phone: "اضغط بحث لعرض كل أوامرك",
  };

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
    const response = await fetch(`${API_BASE}${path}`, {
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
    currentUser = null;
    lastResults = [];
    searchForm.reset();
    resultsEl.className = "results empty-state";
    resultsEl.textContent = "ابدأ بالبحث لعرض أوامر الصيانة.";
    show(loginView);
  }

  function renderResults(orders) {
    lastResults = orders;
    if (!orders.length) {
      resultsEl.className = "results empty-state";
      resultsEl.textContent = "لا توجد نتائج ضمن أوامرك.";
      return;
    }

    resultsEl.className = "results";
    resultsEl.innerHTML = orders
      .map(
        (order) => `
      <article class="card" data-id="${order.workOrderId}">
        <div class="card-top">
          <strong>${order.workOrderId} — ${order.equipmentId}</strong>
          <span class="badge">${order.status || order.stage || "-"}</span>
        </div>
        <div class="muted">الفني: ${order.technicianName || "-"} | التكلفة: ${formatMoney(order.cost)}</div>
      </article>`
      )
      .join("");

    resultsEl.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", async () => {
        try {
          const data = await api(
            `/api/orders/${encodeURIComponent(card.dataset.id)}?phone=${encodeURIComponent(currentUser.phone)}`
          );
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

  function updateSearchUi() {
    searchInput.placeholder = placeholders[searchMode];
    searchInput.required = searchMode !== "phone";
    searchInput.disabled = searchMode === "phone";
    if (searchMode === "phone") searchInput.value = "";
  }

  async function loadMyOrders() {
    searchError.classList.add("hidden");
    resultsEl.className = "results empty-state";
    resultsEl.textContent = "جاري تحميل الأوامر...";
    try {
      const params = new URLSearchParams({
        phone: currentUser.phone,
        mode: "phone",
        q: currentUser.phone,
      });
      const data = await api(`/api/orders/search?${params.toString()}`);
      renderResults(data.orders || []);
    } catch (error) {
      resultsEl.textContent = "تعذر تحميل البيانات.";
      searchError.textContent = error.message;
      searchError.classList.remove("hidden");
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const phone = document.getElementById("phone").value.trim();
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      currentUser = { phone: data.phone, name: data.name };
      welcomeEl.textContent = `مرحباً، ${data.name}`;
      show(mainView);
      await loadMyOrders();
    } catch (error) {
      alert(error.message + "\n\nتأكد أن السيرفر يعمل عبر start-api.bat");
    }
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      searchMode = tab.dataset.mode;
      searchError.classList.add("hidden");
      updateSearchUi();
    });
  });

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    searchError.classList.add("hidden");
    const q = searchMode === "phone" ? currentUser.phone : searchInput.value.trim();

    try {
      const params = new URLSearchParams({
        phone: currentUser.phone,
        mode: searchMode,
        q,
      });
      const data = await api(`/api/orders/search?${params.toString()}`);
      renderResults(data.orders || []);
    } catch (error) {
      searchError.textContent = error.message;
      searchError.classList.remove("hidden");
    }
  });

  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("logout-btn-2").addEventListener("click", logout);
  document.getElementById("back-btn").addEventListener("click", () => show(mainView));

  updateSearchUi();
  show(loginView);

  api("/api/health")
    .then((data) => {
      if (data.mode === "sql") {
        modeLabel.textContent = data.ok
          ? `الوضع: متصل بقاعدة MicrosoftDynamicsAX (${data.ax?.ordersCount ?? ""} أمر)`
          : `الوضع: SQL فشل — ${data.ax?.error || "تحقق من الاتصال"}`;
      } else if (data.mode === "live") {
        modeLabel.textContent = data.ok
          ? "الوضع: متصل بـ AX Service"
          : "الوضع: live لكن خدمة AX غير متاحة حالياً";
      } else {
        modeLabel.textContent = "الوضع: تجريبي (mock)";
      }
    })
    .catch(() => {
      modeLabel.textContent = "الـ API غير متصل — شغّل start-api.bat ثم افتح http://localhost:8080";
    });
})();
