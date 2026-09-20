const defaultTabs = [
  { id: "overview", name: "Tổng quan", icon: "⌂", links: [{ title: "MDN Web Docs", url: "https://developer.mozilla.org/" }, { title: "GitHub", url: "https://github.com/" }] },
  { id: "work", name: "Công việc", icon: "▣", links: [] },
  { id: "ideas", name: "Ý tưởng", icon: "✧", links: [] }
];

function cloneDefaultTabs() {
  return defaultTabs.map(tab => ({ ...tab, links: tab.links.map(link => ({ ...link })) }));
}

function loadTabs() {
  try {
    const storedTabs = JSON.parse(localStorage.getItem("my-space-tabs") || "null");
    if (!Array.isArray(storedTabs) || storedTabs.length === 0) return cloneDefaultTabs();
    return storedTabs.map(tab => ({ ...tab, links: Array.isArray(tab.links) ? tab.links : [] }));
  } catch {
    return cloneDefaultTabs();
  }
}

let tabs = loadTabs();
if (!tabs.some(tab => tab.id === "overview")) tabs.unshift({ ...defaultTabs[0], links: defaultTabs[0].links.map(link => ({ ...link })) });
let activeId = localStorage.getItem("my-space-active") || tabs[0].id;
let noteValues = {};
let database;
let cloudReady = false;
let syncingFromCloud = false;

const tabList = document.querySelector("#tabList");
const linkGrid = document.querySelector("#linkGrid");
const currentTabName = document.querySelector("#currentTabName");
const linkCount = document.querySelector("#linkCount");
const notesPanel = document.querySelector("#notesPanel");
const linkDialog = document.querySelector("#linkDialog");
const tabDialog = document.querySelector("#tabDialog");
let notes;

function saveData() {
  localStorage.setItem("my-space-tabs", JSON.stringify(tabs));
  localStorage.setItem("my-space-active", activeId);
  if (database && cloudReady && !syncingFromCloud) {
    database.ref("my-space").set({ tabs, notes: noteValues, activeId }).catch(error => {
      console.error("Khong the luu Firebase:", error);
      cloudReady = false;
    });
  }
}

function normalizeTabs(value) {
  const sourceTabs = Array.isArray(value) ? value : Object.values(value || {});
  return sourceTabs
    .filter(tab => tab && tab.id)
    .map(tab => ({ ...tab, links: Array.isArray(tab.links) ? tab.links : Object.values(tab.links || {}) }));
}

saveData();
function currentTab() { return tabs.find(tab => tab.id === activeId) || tabs[0]; }
function renderTabs() {
  tabList.innerHTML = tabs.map(tab => `<div class="tab-row"><button class="tab-button ${tab.id === activeId ? "active" : ""}" data-tab="${tab.id}" type="button"><span class="tab-icon">${tab.icon}</span>${tab.name}</button>${tab.id === "overview" ? "" : `<button class="delete-tab" data-delete-tab="${tab.id}" title="Xóa khu vực" aria-label="Xóa khu vực ${tab.name}" type="button">×</button>`}</div>`).join("");
  tabList.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => { activeId = button.dataset.tab; saveData(); render(); }));
  tabList.querySelectorAll("[data-delete-tab]").forEach(button => button.addEventListener("click", () => {
    if (tabs.length === 1) { alert("Cần giữ lại ít nhất một khu vực."); return; }
    const tab = tabs.find(item => item.id === button.dataset.deleteTab);
    if (!confirm(`Xóa khu vực “${tab.name}” cùng toàn bộ link và ghi chú?`)) return;
    tabs = tabs.filter(item => item.id !== tab.id);
    delete noteValues[tab.id];
    localStorage.removeItem(`my-space-note-${tab.id}`);
    if (activeId === tab.id) activeId = tabs[0].id;
    saveData(); render();
  }));
}
function renderLinks() {
  const tab = currentTab();
  currentTabName.textContent = tab.name;
  linkCount.textContent = `${tab.links.length} mục`;
  linkGrid.innerHTML = tab.links.length ? tab.links.map((link, index) => `<article class="link-card"><button class="delete-link" data-delete="${index}" title="Xóa đường dẫn" type="button">×</button><a href="${link.url}" target="_blank" rel="noopener">${link.title}</a><small>${new URL(link.url).hostname}</small></article>`).join("") : `<div class="empty">Tab này chưa có gì. Hãy thêm đường dẫn đầu tiên.</div>`;
  linkGrid.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => { tab.links.splice(Number(button.dataset.delete), 1); saveData(); renderLinks(); }));
}
function createNoteTab(noteText = "") {
  const sourceTabId = activeId;
  const noteTab = { id: `note-${Date.now()}`, name: `Ghi chú ${tabs.filter(item => item.kind === "note").length + 1}`, icon: "✎", kind: "note", links: [] };
  tabs.push(noteTab); delete noteValues[sourceTabId]; noteValues[noteTab.id] = noteText.trim(); localStorage.removeItem(`my-space-note-${sourceTabId}`); localStorage.setItem(`my-space-note-${noteTab.id}`, noteText.trim()); activeId = noteTab.id; saveData(); render();
}
function renderNotes() {
  const tab = currentTab();
  const noteText = noteValues[activeId] ?? localStorage.getItem(`my-space-note-${activeId}`) ?? "";
  if (tab.kind === "note") {
    notesPanel.innerHTML = `<div class="panel-header"><h2>Ghi chú</h2><span class="count">${tab.name}</span></div><div class="note-editor" id="notes" contenteditable="true" data-placeholder="Viết nội dung ghi chú..."></div><button class="save-button" id="saveNoteChanges" type="button">Lưu ghi chú</button>`;
    notes = document.querySelector("#notes"); notes.innerHTML = noteText;
    document.querySelector("#saveNoteChanges").addEventListener("click", () => { noteValues[activeId] = notes.innerHTML.trim(); localStorage.setItem(`my-space-note-${activeId}`, noteValues[activeId]); saveData(); });
    return;
  }
  notesPanel.innerHTML = `<div class="panel-header"><h2>Ghi chú nhanh</h2><span class="count">tự lưu</span></div><textarea id="notes" placeholder="Viết bất cứ điều gì bạn muốn nhớ..."></textarea><div class="note-actions"><button class="save-button" id="saveNotes" type="button">Lưu ghi chú</button><button class="create-note-button" id="createNote" type="button">＋ Tạo ghi chú</button></div>`;
  notes = document.querySelector("#notes"); notes.value = noteText;
  document.querySelector("#saveNotes").addEventListener("click", () => { const text = notes.value.trim(); if (text) createNoteTab(text); });
  document.querySelector("#createNote").addEventListener("click", () => createNoteTab(notes.value));
}
function render() { renderTabs(); renderLinks(); renderNotes(); }

document.querySelector("#linkForm").addEventListener("submit", event => { event.preventDefault(); const tab = currentTab(); tab.links.push({ title: document.querySelector("#linkTitle").value.trim(), url: document.querySelector("#linkUrl").value.trim() }); saveData(); event.target.reset(); linkDialog.close(); renderLinks(); });
document.querySelector("#tabForm").addEventListener("submit", event => { event.preventDefault(); const name = document.querySelector("#tabName").value.trim(); tabs.push({ id: `tab-${Date.now()}`, name, icon: document.querySelector("#tabIcon").value.trim() || "◈", links: [] }); activeId = tabs[tabs.length - 1].id; saveData(); event.target.reset(); tabDialog.close(); render(); });
document.querySelector("#addLinkButton").addEventListener("click", () => linkDialog.showModal());
document.querySelector("#newTabButton").addEventListener("click", () => { document.querySelector("#tabIcon").value = "◈"; document.querySelectorAll(".icon-choice").forEach(button => button.classList.toggle("selected", button.dataset.icon === "◈")); tabDialog.showModal(); });
document.querySelectorAll(".icon-choice").forEach(button => button.addEventListener("click", () => { document.querySelector("#tabIcon").value = button.dataset.icon; document.querySelectorAll(".icon-choice").forEach(choice => choice.classList.toggle("selected", choice === button)); }));
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelector("#brandHome").addEventListener("click", () => { activeId = "overview"; saveData(); render(); });
document.querySelector("#brandHome").addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activeId = "overview"; saveData(); render(); } });
document.querySelector("#today").textContent = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
const savedTheme = localStorage.getItem("my-space-theme") || "light";
const applyTheme = theme => { document.body.dataset.theme = theme; localStorage.setItem("my-space-theme", theme); document.querySelectorAll("[data-theme-choice]").forEach(button => button.classList.toggle("active", button.dataset.themeChoice === theme)); };
document.querySelectorAll("[data-theme-choice]").forEach(button => button.addEventListener("click", () => applyTheme(button.dataset.themeChoice)));
applyTheme(savedTheme);
render();

try {
  const firebaseConfig = {
    apiKey: "AIzaSyBYAquJ1Z5NmQEOkJOaLGvsBrDgN0j7zTk",
    authDomain: "webfornotes-123.firebaseapp.com",
    databaseURL: "https://webfornotes-123-default-rtdb.firebaseio.com",
    projectId: "webfornotes-123",
    storageBucket: "webfornotes-123.firebasestorage.app",
    messagingSenderId: "17773129493",
    appId: "1:17773129493:web:ee0dec3b85a8617065c31c",
    measurementId: "G-QR3YWQBJYN"
  };
  firebase.initializeApp(firebaseConfig);
  database = firebase.database();
  database.ref("my-space").on("value", snapshot => {
    const cloudData = snapshot.val();
    cloudReady = true;
    const cloudTabs = normalizeTabs(cloudData?.tabs);
    if (!cloudData || cloudTabs.length === 0) {
      saveData();
      return;
    }
    syncingFromCloud = true;
    tabs = cloudTabs;
    if (!tabs.some(tab => tab.id === "overview")) tabs.unshift({ ...defaultTabs[0], links: defaultTabs[0].links.map(link => ({ ...link })) });
    noteValues = cloudData.notes || {};
    activeId = cloudData.activeId && tabs.some(tab => tab.id === cloudData.activeId) ? cloudData.activeId : tabs[0].id;
    localStorage.setItem("my-space-tabs", JSON.stringify(tabs));
    localStorage.setItem("my-space-active", activeId);
    syncingFromCloud = false;
    render();
  }, error => console.error("Khong the ket noi Firebase:", error));
} catch (error) {
  console.error("Firebase chua san sang, tiep tuc dung localStorage:", error);
}
