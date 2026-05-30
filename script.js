// ===== 設定 =====
const GAS_URL = "https://script.google.com/macros/s/AKfycbyPYLvfbzhgsd7A0lkAiT54U7CXxu_WkMkHVAXyHUymrmvahHX9h7djcZN4Zw7kaBzh/exec";

// ===== 状態 =====
let cart = {};
let total = 0;
let dailySales = {};
let products = [];
let history = [];
let menuSales = {};
let staff = [];
let isAdmin = false;
let paymentMethod = "";
let showTodayOnly = false;
let tempNumber = "";
let adminPassword = "";
let currentStaff = null; // { number, name }

// ===== 起動 =====
window.onload = function () {
  loadData().then(() => {
    askStaffLogin();
  });
};

// ===== 従業員ログイン =====
function askStaffLogin() {
  let num = prompt("従業員番号（4桁）を入力してください");
  if (!num) { askStaffLogin(); return; }
  const found = staff.find(s => String(s.number) === String(num).padStart(4, '0') || String(s.number) === String(num));
  if (!found) {
    alert("登録されていない番号です");
    askStaffLogin();
    return;
  }
  currentStaff = found;
  document.getElementById("currentStaffDisplay").textContent = "担当：" + found.name;
  postData({ type: "login", staffNumber: found.number, staffName: found.name });
  alert(found.name + " さんでログインしました");
}

// ===== サーバーから全データ取得 =====
async function loadData() {
  try {
    const res = await fetch(GAS_URL + "?type=all");
    const data = await res.json();
    history       = data.history    || [];
    products      = data.products   || [];
    dailySales    = data.dailySales || {};
    menuSales     = data.menuSales  || {};
    adminPassword = String(data.password || "");
    staff         = data.staff      || [];
    updateActiveStaffDisplay(data.activeStaff || []);
    renderProducts();
    loadHistoryFromServer();
    updateDailySales();
  } catch (err) {
    console.error("データ取得失敗:", err);
  }
}

// ===== サーバーへデータ送信 =====
async function postData(body) {
  try {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("送信失敗:", err);
    alert("送信に失敗しました。通信を確認してください。");
  }
}

// ===== 今日の日付 =====
function getToday() {
  return new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    .split(" ")[0]
    .replace(/\//g, "-")
    .replace(/^(\d+)-(\d+)-(\d+)$/, (_, y, m, d) =>
      y + "-" + m.padStart(2, "0") + "-" + d.padStart(2, "0")
    );
}
// ===== 日付を見やすく（例：4月19日） =====
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  return String(dateStr);
}

// ===== 支払い方法 =====
function setPayment(method) {
  paymentMethod = method;
  document.getElementById("payment").textContent = method;
  document.getElementById("btnCash").classList.remove("active-payment");
  document.getElementById("btnPaypay").classList.remove("active-payment");
  if (method === "現金") {
    document.getElementById("btnCash").classList.add("active-payment");
    document.getElementById("cashArea").classList.remove("hidden");
  } else {
    document.getElementById("btnPaypay").classList.add("active-payment");
    document.getElementById("cashArea").classList.add("hidden");
  }
}

// ===== 商品をカートに追加 =====
function addItem(name, price) {
  if (cart[name]) cart[name].count++;
  else cart[name] = { price, count: 1 };
  total += price;
  updateDisplay();
}

// ===== カートから1個削除 =====
function removeItem(name) {
  if (!cart[name]) return;
  cart[name].count -= 1;
  total -= cart[name].price;
  if (cart[name].count <= 0) delete cart[name];
  updateDisplay();
}

// ===== カート表示更新 =====
function updateDisplay() {
  document.getElementById("total").textContent = total;
  let list = document.getElementById("cart");
  list.innerHTML = "";
  for (let name in cart) {
    let item = cart[name];
    let li = document.createElement("li");
    let text = document.createElement("span");
    text.textContent = `${name} ×${item.count} = ${item.price * item.count}円`;
    let btn = document.createElement("button");
    btn.textContent = "×";
    btn.style.cssText = "margin-left:10px;background:red;color:white;border:none;cursor:pointer;border-radius:50%;width:25px;height:25px;flex-shrink:0;";
    btn.onclick = () => removeItem(name);
    li.appendChild(text);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

// ===== 日別売上表示 =====
function updateDailySales() {
  let container = document.getElementById("dailySales");
  container.innerHTML = "";
  let today = getToday();
  const sortedDates = Object.keys(dailySales).sort((a, b) => b.localeCompare(a));
  let grandCash = 0, grandPaypay = 0;

  for (let date of sortedDates) {
    if (showTodayOnly && date !== today) continue;
    let data = dailySales[date];
    let isToday = date === today;
    let cash   = Number(data.cash)   || 0;
    let paypay = Number(data.paypay) || 0;
    grandCash   += cash;
    grandPaypay += paypay;

    let div = document.createElement("div");
    div.style.cssText = isToday
      ? "font-weight:bold;background:#fffde7;padding:8px 12px;border-radius:8px;margin:4px 0;border-left:4px solid #f9a825;"
      : "padding:8px 12px;margin:4px 0;border-left:4px solid #ddd;";

    let label = formatDate(date) + (isToday ? " 今日" : "");
    div.innerHTML =
      "<div style='font-size:15px;margin-bottom:4px;'>" + label + "</div>" +
      "<div style='display:flex;gap:16px;font-size:14px;color:#555;'>" +
        "<span>現金 <b>" + cash.toLocaleString() + "円</b></span>" +
        "<span>PayPay <b>" + paypay.toLocaleString() + "円</b></span>" +
        "<span>計 <b style='color:#333;'>" + (cash + paypay).toLocaleString() + "円</b></span>" +
      "</div>";
    container.appendChild(div);
  }

  if (!showTodayOnly && sortedDates.length > 1) {
    let totalDiv = document.createElement("div");
    totalDiv.style.cssText = "margin-top:10px;padding:8px 12px;background:#e8f5e9;border-radius:8px;font-weight:bold;";
    totalDiv.innerHTML =
      "<div style='font-size:14px;margin-bottom:4px;'>全期間合計</div>" +
      "<div style='display:flex;gap:16px;font-size:14px;'>" +
        "<span>現金 <b>" + grandCash.toLocaleString() + "円</b></span>" +
        "<span>PayPay <b>" + grandPaypay.toLocaleString() + "円</b></span>" +
        "<span>計 <b>" + (grandCash + grandPaypay).toLocaleString() + "円</b></span>" +
      "</div>";
    container.appendChild(totalDiv);
  }
}

// ===== 今日だけ表示切替 =====
function toggleToday() {
  showTodayOnly = !showTodayOnly;
  let btn = document.querySelector("button[onclick='toggleToday()']");
  btn.textContent = showTodayOnly ? "全日表示に戻す" : "今日だけ表示";
  updateDailySales();
}

// ===== お釣り計算 =====
function calcChange() {
  let paid = parseInt(document.getElementById("paidAmount").value) || 0;
  document.getElementById("change").textContent = paid >= total ? paid - total : 0;
}

// ===== 会計ボタン =====
function checkout() {
  if (!paymentMethod) {
    alert("支払い方法を選択してください！");
    return;
  }
  if (Object.keys(cart).length === 0) {
    alert("商品を選択してください！");
    return;
  }
  document.getElementById("numberPad").classList.remove("hidden");
}

// ===== 番号入力 =====
function inputNumber(num) {
  if (tempNumber.length >= 2) return;
  tempNumber += num;
  document.getElementById("displayNumber").textContent = tempNumber;
}

function clearNumber() {
  tempNumber = "";
  document.getElementById("displayNumber").textContent = "0";
}

// ===== 番号確定 → 会計完了 =====
async function confirmNumber() {
  if (!tempNumber) {
    alert("番号を入力してください");
    return;
  }
  let today = getToday();
  const record = {
    date: new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit"
}).format(new Date()),
    dateKey:     today,
    number:      tempNumber,
    total:       total,
    payment:     paymentMethod,
    items:       JSON.parse(JSON.stringify(cart)),
    staffNumber: currentStaff ? currentStaff.number : "",
    staffName:   currentStaff ? currentStaff.name   : ""
  };

  cart = {};
  total = 0;
  paymentMethod = "";
  tempNumber = "";
  document.getElementById("payment").textContent = "未選択";
  document.getElementById("displayNumber").textContent = "0";
  document.getElementById("numberPad").classList.add("hidden");
  document.getElementById("btnCash").classList.remove("active-payment");
  document.getElementById("btnPaypay").classList.remove("active-payment");
  document.getElementById("cashArea").classList.add("hidden");
  document.getElementById("change").textContent = "0";
  document.getElementById("paidAmount").value = "";
  updateDisplay();

  postData({ type: "checkout", record });

  history.push(record);
  if (!dailySales[record.dateKey]) dailySales[record.dateKey] = { cash: 0, paypay: 0 };
  if (record.payment === "現金") dailySales[record.dateKey].cash += record.total;
  else dailySales[record.dateKey].paypay += record.total;

  for (let name in record.items) {
    const count = record.items[name].count;
    if (!menuSales[name]) menuSales[name] = { total: 0, daily: {} };
    menuSales[name].total += count;
    menuSales[name].daily[record.dateKey] = (menuSales[name].daily[record.dateKey] || 0) + count;
  }

  updateDailySales();
  showMenuSales();
}

// ===== 履歴表示 =====
function loadHistoryFromServer() {
  const historyList = document.getElementById("history");
  historyList.innerHTML = "";
  [...history].reverse().forEach((h, revIndex) => {
    const index = history.length - 1 - revIndex;
    const li = document.createElement("li");
    li.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #eee;";
    let itemsText = Object.entries(h.items || {})
      .map(([name, item]) => `${name}×${item.count}`)
      .join(", ");
    const text = document.createElement("span");
    text.style.flex = "1";
    let dateLabel = formatDate(h.dateKey);
    text.textContent = `${dateLabel} 番号${h.number}：${h.total}円［${h.payment}］（${itemsText}）`;
    const del = document.createElement("button");
    del.textContent = "×";
    del.style.cssText = "margin-left:10px;background:red;color:white;border:none;border-radius:50%;width:25px;height:25px;cursor:pointer;flex-shrink:0;";
    del.onclick = () => deleteHistory(index, h);
    li.appendChild(text);
    li.appendChild(del);
    historyList.appendChild(li);
  });
}

// ===== 履歴1件削除 =====
async function deleteHistory(index, record) {
  if (!checkAdmin()) return;
  let ok = confirm("この会計を削除しますか？");
  if (!ok) return;

  clearInterval(autoRefresh);
  history.splice(index, 1);

  for (let name in record.items) {
    if (menuSales[name]) {
      menuSales[name].total = Math.max(0, menuSales[name].total - record.items[name].count);
      if (menuSales[name].daily && menuSales[name].daily[record.dateKey]) {
        menuSales[name].daily[record.dateKey] = Math.max(0, menuSales[name].daily[record.dateKey] - record.items[name].count);
      }
    }
  }

  if (dailySales[record.dateKey]) {
    if (record.payment === "現金") {
      dailySales[record.dateKey].cash = Math.max(0, dailySales[record.dateKey].cash - record.total);
    } else {
      dailySales[record.dateKey].paypay = Math.max(0, dailySales[record.dateKey].paypay - record.total);
    }
  }

  loadHistoryFromServer();
  updateDailySales();
  showMenuSales();

  await postData({
    type: "deleteHistory",
    record: { ...record, index },
    staffNumber: currentStaff ? currentStaff.number : "",
    staffName:   currentStaff ? currentStaff.name   : ""
  });

  await loadData();
  autoRefresh = setInterval(loadData, 5000);
}

// ===== 全履歴クリア =====
async function clearHistory() {
  if (!checkAdmin()) return;
  let result = confirm("本当に履歴をすべて削除しますか？");
  if (!result) return;
  await postData({
    type: "clearAll",
    staffNumber: currentStaff ? currentStaff.number : "",
    staffName:   currentStaff ? currentStaff.name   : ""
  });
  await loadData();
  alert("削除しました");
}

// ===== 商品一覧表示 =====
function renderProducts() {
  let container = document.getElementById("productList");
  container.innerHTML = "";
  products.forEach((p, index) => {
    let wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;align-items:center;gap:8px;background:#fff;padding:8px;border-radius:8px;";
    let btn = document.createElement("button");
    btn.textContent = `${p.name} (${p.price}円)`;
    btn.style.cssText = "flex:1;text-align:left;";
    btn.onclick = () => addItem(p.name, p.price);
    wrapper.appendChild(btn);
    if (isAdmin) {
      let del = document.createElement("button");
      del.textContent = "×";
      del.style.cssText = "background:red;color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;flex-shrink:0;font-size:14px;";
      del.onclick = () => deleteProduct(index, p.name);
      wrapper.appendChild(del);
    }
    container.appendChild(wrapper);
  });
}

// ===== 商品追加 =====
async function addProduct() {
  let name  = document.getElementById("newName").value.trim();
  let price = parseInt(document.getElementById("newPrice").value);
  if (!name || isNaN(price)) {
    alert("正しく入力してください");
    return;
  }
  await postData({
    type: "addProduct",
    product: { name, price },
    staffNumber: currentStaff ? currentStaff.number : "",
    staffName:   currentStaff ? currentStaff.name   : ""
  });
  await loadData();
  document.getElementById("newName").value  = "";
  document.getElementById("newPrice").value = "";
}

// ===== 商品削除 =====
async function deleteProduct(index, productName) {
  let ok = confirm("この商品を削除しますか？");
  if (!ok) return;
  await postData({
    type: "deleteProduct",
    index,
    productName,
    staffNumber: currentStaff ? currentStaff.number : "",
    staffName:   currentStaff ? currentStaff.name   : ""
  });
  await loadData();
}

// ===== メニュー売上表示 =====
function showMenuSales() {
  let container = document.getElementById("menuSales");
  container.innerHTML = "";
  let today = getToday();
  for (let name in menuSales) {
    let data = menuSales[name];
    let todayCount = data.daily ? (data.daily[today] || 0) : 0;
    let p = document.createElement("p");
    p.textContent = `${name}：今日 ${todayCount}個 / 合計 ${data.total}個`;
    container.appendChild(p);
  }
}

// ===== メニュー売上クリア =====
async function clearMenuSales() {
  if (!checkAdmin()) return;
  let ok = confirm("メニュー売上だけリセットしますか？");
  if (!ok) return;
  await postData({
    type: "clearMenuSales",
    staffNumber: currentStaff ? currentStaff.number : "",
    staffName:   currentStaff ? currentStaff.name   : ""
  });
  await loadData();
  alert("メニュー売上をリセットしました");
}

// ===== 画面切替 =====
function showScreen(screenId) {
  document.getElementById("register").classList.add("hidden");
  document.getElementById("historyScreen").classList.add("hidden");
  document.getElementById(screenId).classList.remove("hidden");
  if (screenId === "historyScreen") loadData();
}

// ===== 管理者ログイン =====
function adminLogin() {
  if (!adminPassword) {
    isAdmin = true;
    document.getElementById("adminControls").classList.remove("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("staffPanel").classList.remove("hidden");
    renderProducts();
    renderStaff();
    alert("ログイン成功！まずパスワードを設定してください。");
    return;
  }
  let input = prompt("パスワードを入力してください");
  if (input === adminPassword) {
    isAdmin = true;
    document.getElementById("adminControls").classList.remove("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("staffPanel").classList.remove("hidden");
    renderProducts();
    renderStaff();
    alert("ログイン成功（管理者モードON）");
  } else {
    alert("パスワードが違います");
  }
}

// ===== 管理者ログアウト =====
function adminLogout() {
  isAdmin = false;
  document.getElementById("adminControls").classList.add("hidden");
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("staffPanel").classList.add("hidden");
  renderProducts();
  alert("ログアウトしました（管理者モードOFF）");
}

// ===== パスワード設定 =====
async function setPassword() {
  if (adminPassword) {
    let current = prompt("現在のパスワードを入力してください");
    if (current !== adminPassword) { alert("パスワードが違います"); return; }
  }
  let newPass = prompt("新しいパスワードを入力してください");
  if (!newPass) { alert("パスワードが入力されていません"); return; }
  let confirmPass = prompt("もう一度入力してください");
  if (newPass !== confirmPass) { alert("パスワードが一致しません"); return; }
  await postData({ type: "setPassword", password: newPass });
  adminPassword = newPass;
  alert("パスワードを設定しました");
}

// ===== 管理者チェック（共通） =====
function checkAdmin() {
  if (isAdmin) return true;
  let input = prompt("パスワードを入力してください");
  if (input === adminPassword) return true;
  alert("パスワードが違います");
  return false;
}

// ===== 従業員一覧表示 =====
function renderStaff() {
  let container = document.getElementById("staffList");
  container.innerHTML = "";
  staff.forEach((s, index) => {
    let div = document.createElement("div");
    div.style.cssText = "display:flex;align-items:center;gap:8px;padding:5px 8px;background:#f9f9f9;border-radius:6px;margin-bottom:4px;";
    let number = document.createElement("span");
    number.textContent = s.number;
    number.style.cssText = "font-weight:bold;color:#555;width:50px;font-size:13px;";
    let name = document.createElement("span");
    name.textContent = s.name;
    name.style.cssText = "flex:1;font-size:13px;";
    let del = document.createElement("button");
    del.textContent = "×";
    del.style.cssText = "background:red;color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px;flex-shrink:0;padding:0;";
    del.onclick = () => deleteStaff(index, s.name);
    div.appendChild(number);
    div.appendChild(name);
    div.appendChild(del);
    container.appendChild(div);
  });
}

// ===== 従業員追加 =====
async function addStaff() {
  let number = document.getElementById("newStaffNumber").value.trim();
  let name   = document.getElementById("newStaffName").value.trim();
  if (!number || !name) { alert("番号と名前を入力してください"); return; }
  if (number.length !== 4 || isNaN(number)) { alert("番号は4桁の数字にしてください"); return; }
  if (staff.find(s => s.number === number)) { alert("その番号はすでに登録されています"); return; }
  await postData({
    type: "addStaff",
    staff: { number, name },
    staffNumber: currentStaff ? currentStaff.number : "",
    staffName:   currentStaff ? currentStaff.name   : ""
  });
  await loadData();
  renderStaff();
  document.getElementById("newStaffNumber").value = "";
  document.getElementById("newStaffName").value   = "";
}

// ===== 従業員削除 =====
async function deleteStaff(index, deletedName) {
  let ok = confirm(deletedName + " を削除しますか？");
  if (!ok) return;
  await postData({
    type: "deleteStaff",
    index,
    deletedName,
    staffNumber: currentStaff ? currentStaff.number : "",
    staffName:   currentStaff ? currentStaff.name   : ""
  });
  await loadData();
  renderStaff();
}

// ===== ログイン中従業員を表示 =====
function updateActiveStaffDisplay(activeStaff) {
  const el = document.getElementById("activeStaffDisplay");
  if (!el) return;
  if (activeStaff.length === 0) {
    el.textContent = "";
    return;
  }
  el.textContent = "ログイン中：" + activeStaff.map(s => s.name).join("、");
}

// ===== 5秒ごとに自動更新 =====
let autoRefresh = setInterval(loadData, 5000);

// ===== 1分ごとにハートビート送信（ページを開いている間はログイン中） =====
setInterval(() => {
  if (currentStaff) {
    postData({ type: "login", staffNumber: currentStaff.number, staffName: currentStaff.name });
  }
}, 60 * 1000);
