/* PW OS glass — watch files. Do no work except dump. */
(function () {
  "use strict";
  var state = {
    mode: localStorage.getItem("pw-glass.mode") || "fill",
    density: Math.max(0, Math.min(3, parseInt(localStorage.getItem("pw-glass.density") || "1", 10) || 1)),
    focus: localStorage.getItem("pw-glass.focus") || "now",
    sizes: {},
    pipe: localStorage.getItem("pw-glass.pipe") || "",
    folderId: localStorage.getItem("pw-glass.folderId") || "",
    dirHandle: null,
    token: null,
    clientId: (window.PW_CONFIG && window.PW_CONFIG.GOOGLE_CLIENT_ID) || "",
    catalog: { halt: false, now: "", projects: [], vessels: [], modules: [], empty: true },
    bound: false,
  };
  try { state.sizes = JSON.parse(localStorage.getItem("pw-glass.sizes") || "{}"); } catch (e) { state.sizes = {}; }
  function $(id) { return document.getElementById(id); }
  function applyChrome() {
    document.body.className = (state.mode === "compact" ? "compact" : "fill") + " density-" + state.density + (state.catalog.halt ? " halt" : "");
    $("g-fill").setAttribute("aria-pressed", state.mode === "fill" ? "true" : "false");
    $("g-split").setAttribute("aria-pressed", state.mode === "compact" ? "true" : "false");
    var pips = $("pips").querySelectorAll("button");
    for (var i = 0; i < pips.length; i++) pips[i].classList.toggle("on", i <= state.density);
    $("bind-pip").className = state.catalog.halt ? "halt" : state.bound ? "live" : "";
    $("bind-pip").id = "bind-pip";
  }
  function persist() {
    localStorage.setItem("pw-glass.mode", state.mode);
    localStorage.setItem("pw-glass.density", String(state.density));
    localStorage.setItem("pw-glass.focus", state.focus || "");
    localStorage.setItem("pw-glass.sizes", JSON.stringify(state.sizes));
    localStorage.setItem("pw-glass.pipe", state.pipe || "");
    localStorage.setItem("pw-glass.folderId", state.folderId || "");
  }
  function esc(s) {
    return String(s).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
  }
  function render() {
    applyChrome();
    var cat = state.catalog;
    $("tiles").innerHTML = "";
    $("legend").innerHTML = "";
    var has = !!(cat.now || (cat.projects && cat.projects.length) || (cat.modules && cat.modules.length));
    $("void-mark").style.display = cat.halt || has ? "none" : "flex";
    $("dump").disabled = !state.bound || cat.halt;
    if (cat.halt || !has) { persist(); return; }
    var list = [];
    if (cat.now) list.push({ id: "now:now", kind: "now", k: "NOW", body: cat.now, next: "", st: "" });
    for (var i = 0; i < cat.projects.length; i++) {
      var p = cat.projects[i];
      list.push({ id: "proj:" + i + ":" + p.name, kind: "proj", k: "PROJECT", body: p.name || "\u2014", next: p.next || "", st: p.status || "" });
    }
    for (var m = 0; m < cat.modules.length; m++) {
      var mod = cat.modules[m];
      list.push({ id: "mod:" + mod.id, kind: "mod", k: "MODULE", body: mod.title, next: "", st: "" });
    }
    if (!list.some(function (t) { return t.id === state.focus; })) state.focus = list[0] ? list[0].id : "now";
    for (var t = 0; t < list.length; t++) {
      var item = list[t];
      var el = document.createElement("article");
      var sz = state.sizes[item.id] || 1;
      el.className = "tile" + (item.id === state.focus ? " focused" : "") + (item.kind === "mod" ? " mod" : "") + " size-" + sz;
      el.dataset.id = item.id;
      el.innerHTML = '<div class="k">' + esc(item.k) + '</div><div class="body">' + esc(item.body) + "</div>" +
        (item.next ? '<div class="next">' + esc(item.next) + "</div>" : "") +
        (item.st ? '<div class="st">' + esc(item.st) + "</div>" : "");
      el.addEventListener("click", function (ev) { state.focus = ev.currentTarget.dataset.id; persist(); render(); });
      el.addEventListener("dblclick", function (ev) {
        ev.preventDefault();
        var id = ev.currentTarget.dataset.id;
        var n = state.sizes[id] || 1;
        state.sizes[id] = n >= 3 ? 1 : n + 1;
        persist(); render();
      });
      $("tiles").appendChild(el);
    }
    if (cat.vessels && cat.vessels.length) {
      var dl = document.createElement("dl");
      for (var v = 0; v < cat.vessels.length; v++) {
        var dt = document.createElement("dt"); dt.textContent = cat.vessels[v].label;
        var dd = document.createElement("dd"); dd.textContent = cat.vessels[v].value;
        dl.appendChild(dt); dl.appendChild(dd);
      }
      $("legend").appendChild(dl);
    }
    persist();
  }
  function applyFiles(files) { state.catalog = window.PWParse.catalog(files); render(); }
  function utcStamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) + "T" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + "Z";
  }
  async function pipeFS() {
    if (!window.showDirectoryPicker) return;
    try {
      state.dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      state.pipe = "fs"; state.bound = true; persist();
      await readFS();
    } catch (e) {}
  }
  async function readFS() {
    if (!state.dirHandle) return;
    var files = [];
    for await (var entry of state.dirHandle.values()) {
      if (entry.kind === "file") {
        if (window.PWParse.isIgnoredName(entry.name)) continue;
        files.push({ path: entry.name, name: entry.name, text: await (await entry.getFile()).text() });
      } else if (entry.kind === "directory" && entry.name === "modules") {
        for await (var mod of entry.values()) {
          if (mod.kind !== "file" || window.PWParse.isIgnoredName(mod.name)) continue;
          files.push({ path: "modules/" + mod.name, name: mod.name, text: await (await mod.getFile()).text() });
        }
      }
    }
    applyFiles(files);
  }
  async function dumpFS(body) {
    if (!state.dirHandle) return false;
    try {
      var dumpDir = await state.dirHandle.getDirectoryHandle("dump", { create: true });
      var w = await (await dumpDir.getFileHandle(utcStamp() + ".md", { create: true })).createWritable();
      await w.write(body); await w.close(); return true;
    } catch (e) { return false; }
  }
  function gisReady() {
    return !!(state.clientId && window.google && window.google.accounts && window.google.accounts.oauth2);
  }
  function pipeDrive() {
    if (!gisReady()) return;
    window.google.accounts.oauth2.initTokenClient({
      client_id: state.clientId,
      scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
      callback: function (resp) {
        if (!resp || !resp.access_token) return;
        state.token = resp.access_token;
        pickDriveFolder();
      },
    }).requestAccessToken({ prompt: "" });
  }
  async function driveGet(url) {
    var res = await fetch(url, { headers: { Authorization: "Bearer " + state.token } });
    if (!res.ok) throw new Error("drive " + res.status);
    return res.json();
  }
  async function driveText(id) {
    var res = await fetch("https://www.googleapis.com/drive/v3/files/" + id + "?alt=media", { headers: { Authorization: "Bearer " + state.token } });
    return res.ok ? res.text() : "";
  }
  async function listChildren(folderId) {
    var data = await driveGet("https://www.googleapis.com/drive/v3/files?pageSize=200&fields=files(id,name,mimeType)&q=" + encodeURIComponent("'" + folderId + "' in parents and trashed = false"));
    return data.files || [];
  }
  async function pickDriveFolder() {
    var data = await driveGet("https://www.googleapis.com/drive/v3/files?pageSize=25&fields=files(id,name)&q=" + encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and name = 'PW_OS' and trashed = false"));
    var found = data.files || [];
    var live = [];
    for (var i = 0; i < found.length; i++) {
      var names = (await listChildren(found[i].id)).map(function (k) { return k.name; });
      if (window.PWParse.workshopHalt(names)) continue;
      live.push(found[i]);
    }
    if (!live.length && found.length) {
      state.catalog = { halt: true, now: "", projects: [], vessels: [], modules: [], empty: true };
      state.bound = false; render(); return;
    }
    if (!live[0]) return;
    state.folderId = live[0].id; state.pipe = "drive"; state.bound = true; persist();
    await readDrive();
  }
  async function readDrive() {
    if (!state.folderId || !state.token) return;
    var kids = await listChildren(state.folderId);
    var files = [];
    var modulesId = null;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.mimeType === "application/vnd.google-apps.folder" && k.name === "modules") { modulesId = k.id; continue; }
      if (k.mimeType === "application/vnd.google-apps.folder") continue;
      if (window.PWParse.isIgnoredName(k.name)) continue;
      if (!/^(NOW|PROJECTS|VESSELS|CONTINUITY)\.md$/i.test(k.name)) continue;
      files.push({ path: k.name, name: k.name, text: await driveText(k.id) });
    }
    if (modulesId) {
      var mods = await listChildren(modulesId);
      for (var m = 0; m < mods.length; m++) {
        if (window.PWParse.isIgnoredName(mods[m].name) || !/\.md$/i.test(mods[m].name)) continue;
        files.push({ path: "modules/" + mods[m].name, name: mods[m].name, text: await driveText(mods[m].id) });
      }
    }
    state.bound = true; applyFiles(files);
  }
  async function dumpDrive(body) {
    if (!state.folderId || !state.token) return false;
    var kids = await listChildren(state.folderId);
    var dumpId = null;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].name === "dump" && kids[i].mimeType === "application/vnd.google-apps.folder") dumpId = kids[i].id;
    }
    if (!dumpId) {
      var created = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: "Bearer " + state.token, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "dump", mimeType: "application/vnd.google-apps.folder", parents: [state.folderId] }),
      });
      if (!created.ok) return false;
      dumpId = (await created.json()).id;
    }
    var meta = { name: utcStamp() + ".md", parents: [dumpId], mimeType: "text/markdown" };
    var fd = new FormData();
    fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
    fd.append("file", new Blob([body], { type: "text/markdown" }));
    var res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST", headers: { Authorization: "Bearer " + state.token }, body: fd,
    });
    return res.ok;
  }
  async function onDump(ev) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    var box = $("dump");
    var text = box.value;
    if (!text.trim()) return;
    box.value = "";
    var ok = false;
    if (state.pipe === "fs") ok = await dumpFS(text);
    else if (state.pipe === "drive") ok = await dumpDrive(text);
    if (!ok) box.value = text;
  }
  function demo() {
    state.pipe = "demo"; state.bound = true; applyFiles(window.PW_DEMO || []);
  }
  function tick() {
    if (state.pipe === "fs" && state.dirHandle) readFS();
    else if (state.pipe === "drive" && state.token && state.folderId) readDrive();
  }
  function init() {
    $("g-fill").addEventListener("click", function () { state.mode = "fill"; persist(); render(); });
    $("g-split").addEventListener("click", function () { state.mode = "compact"; persist(); render(); });
    var pips = $("pips").querySelectorAll("button");
    for (var i = 0; i < pips.length; i++) {
      (function (d) { pips[d].addEventListener("click", function () { state.density = d; persist(); render(); }); })(i);
    }
    $("bind-pip").addEventListener("click", function () { $("bind-sheet").classList.toggle("open"); });
    $("btn-fs").addEventListener("click", function () { $("bind-sheet").classList.remove("open"); pipeFS(); });
    $("btn-drive").addEventListener("click", function () { $("bind-sheet").classList.remove("open"); pipeDrive(); });
    $("dump").addEventListener("keydown", onDump);
    if (!window.showDirectoryPicker) $("btn-fs").disabled = true;
    if (!state.clientId) $("btn-drive").disabled = true;
    if (/[?&]demo=1/.test(location.search)) demo(); else render();
    setInterval(tick, 8000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
