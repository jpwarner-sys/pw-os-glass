var assert = require("assert");
var P = require("./parse.js");

assert.strictEqual(P.firstSentence("# NOW\n\nHello ñandú\n"), "Hello ñandú");
assert.strictEqual(P.firstSentence("# NOW\n\n"), "");
assert.strictEqual(P.firstSentence("<!-- x -->\n# H\n\nSecond"), "Second");
assert.strictEqual(P.isIgnoredName(".keep"), true);
assert.strictEqual(P.isIgnoredName("dump.keep"), true);
assert.strictEqual(P.isIgnoredName("README.md"), true);
assert.strictEqual(P.isIgnoredName("NOW.md"), false);

var rows = P.parseProjects(
  "# PROJECTS\n\n| Name | Next | Status |\n| --- | --- | --- |\n| Cabinet | file today | open |\n"
);
assert.strictEqual(rows.length, 1);
assert.strictEqual(rows[0].name, "Cabinet");
assert.strictEqual(rows[0].next, "file today");

var ves = P.parseVessels("- Talker: ChatGPT\n- iCloud: other pile — not live\n");
assert.strictEqual(ves[0].label, "Talker");
assert.strictEqual(ves[1].label, "iCloud");

assert.strictEqual(P.workshopHalt(["Brainstorm", "Build", "Design"]), true);
assert.strictEqual(P.workshopHalt(["Brainstorm", "Build", "NOW.md"]), false);
assert.strictEqual(P.workshopHalt(["NOW.md", "dump"]), false);

var cat = P.catalog([
  { path: "NOW.md", name: "NOW.md", text: "# NOW\n\nOne sentence.\n" },
  { path: "PROJECTS.md", name: "PROJECTS.md", text: "| Name | Next | Status |\n| --- | --- | --- |\n| A | B | open |\n" },
  { path: "modules/deeds.md", name: "deeds.md", text: "# deeds\n\nLand titles\n" },
  { path: "artifacts/cont_v001.md", name: "cont_v001.md", text: "ignore" },
  { path: ".keep", name: ".keep", text: "keep" },
]);
assert.strictEqual(cat.halt, false);
assert.strictEqual(cat.now, "One sentence.");
assert.strictEqual(cat.projects.length, 1);
assert.strictEqual(cat.modules.length, 1);
assert.strictEqual(cat.modules[0].title, "Land titles");

assert.strictEqual(P.workshopHalt(["Build", "packet"]), true);

console.log("ok");
