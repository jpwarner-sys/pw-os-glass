/* PW OS glass — SCHEMA.md parse only. Transformers do not decide. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PWParse = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function isIgnoredName(name) {
    if (!name) return true;
    if (name.charAt(0) === ".") return true;
    if (/\.keep$/i.test(name)) return true;
    if (/^README\.md$/i.test(name)) return true;
    return false;
  }

  function firstSentence(text) {
    if (text == null) return "";
    var lines = String(text).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = raw.replace(/^\uFEFF/, "").trim();
      if (!line) continue;
      if (line.charAt(0) === "#") continue;
      if (/^<!--/.test(line)) continue;
      return line;
    }
    return "";
  }

  function parseProjects(text) {
    var rows = [];
    if (text == null) return rows;
    var lines = String(text).split(/\r?\n/);
    var headers = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!/^\|/.test(line)) continue;
      var cells = line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(function (c) {
          return c.trim();
        });
      if (!headers) {
        headers = cells.map(function (h) {
          return h.toLowerCase();
        });
        continue;
      }
      if (cells.every(function (c) {
        return /^:?-+:?$/.test(c);
      }))
        continue;
      var obj = {};
      for (var k = 0; k < headers.length; k++) {
        obj[headers[k]] = cells[k] != null ? cells[k] : "";
      }
      if (!obj.name && !obj.next && !obj.status) continue;
      rows.push({
        name: obj.name || "",
        next: obj.next || "",
        status: obj.status || "",
      });
    }
    return rows;
  }

  function parseVessels(text) {
    var out = [];
    if (text == null) return out;
    var lines = String(text).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var m = line.match(/^-+\s*([^:]+):\s*(.*)$/);
      if (!m) continue;
      out.push({ label: m[1].trim(), value: m[2].trim() });
    }
    return out;
  }

  function workshopHalt(names) {
    var workshop = false;
    for (var j = 0; j < names.length; j++) {
      if (/^(Brainstorm|Build|Design)$/i.test(names[j])) workshop = true;
    }
    var hasNow = false;
    for (var k = 0; k < names.length; k++) {
      if (/^NOW\.md$/i.test(names[k])) hasNow = true;
    }
    return workshop && !hasNow;
  }

  function catalog(files) {
    var nowText = null;
    var projectsText = null;
    var vesselsText = null;
    var modules = [];
    var names = [];
    var topNames = [];

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var path = (f.path || f.name || "").replace(/\\/g, "/");
      var parts = path.split("/").filter(Boolean);
      var name = parts[parts.length - 1] || f.name || "";
      names.push(name);
      if (parts.length === 1) topNames.push(name);
      if (/^artifacts(\/|$)/i.test(path) || parts[0] === "artifacts") continue;
      if (isIgnoredName(name)) continue;
      if (/^NOW\.md$/i.test(name) && parts.length === 1) nowText = f.text;
      else if (/^PROJECTS\.md$/i.test(name) && parts.length === 1) projectsText = f.text;
      else if (/^VESSELS\.md$/i.test(name) && parts.length === 1) vesselsText = f.text;
      else if (parts[0] === "modules" && parts.length === 2 && /\.md$/i.test(name)) {
        modules.push({
          id: name.replace(/\.md$/i, ""),
          name: name,
          title: firstSentence(f.text || "") || name.replace(/\.md$/i, ""),
          text: f.text || "",
        });
      }
    }

    var halt = workshopHalt(topNames.length ? topNames : names);

    return {
      halt: halt,
      now: halt ? "" : firstSentence(nowText),
      projects: halt ? [] : parseProjects(projectsText),
      vessels: halt ? [] : parseVessels(vesselsText),
      modules: halt ? [] : modules,
      empty: !halt && !firstSentence(nowText) && parseProjects(projectsText).length === 0 && modules.length === 0,
    };
  }

  return {
    isIgnoredName: isIgnoredName,
    firstSentence: firstSentence,
    parseProjects: parseProjects,
    parseVessels: parseVessels,
    workshopHalt: workshopHalt,
    catalog: catalog,
  };
});
