// Hover hit-testing sweep: for one stone, load the served page once, reach
// every view the way a user does (keys 1, 2, 3, then a drag from the Math
// face to each yaw in 15-degree steps) and check that a pointer over the
// centre and both lower corners of every front-facing face lands on that
// face. A miss means hover callouts are dead there. This is what found the
// Blink 3D hit-testing failure fixed in step 30 (the stone's own box
// shadowing the faces), so run it after any change to the stone's CSS
// transforms. Needs the page served (just serve-site), Google Chrome and
// Node 22+ (built-in fetch and WebSocket). Prints one line per stone.
//
//   node tests/hover-sweep.mjs sigmoid
//   for s in $(ls fixtures); do node tests/hover-sweep.mjs "$s"; done
import { spawn } from "node:child_process";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const stone = process.argv[2]; const port = 9340 + (process.pid % 50);
import { mkdirSync, rmSync } from "node:fs";
mkdirSync("tmp", { recursive: true });
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1280,1100", "--user-data-dir=tmp/chrome-profile-" + process.pid, "--disable-http-cache", `--remote-debugging-port=${port}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets; for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: `http://127.0.0.1:8765/?stone=${stone}&yaw=0` }); await sleep(2500);
const c = await ev("(()=>{const r=document.getElementById('stage').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()");
const key = async (k) => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: "Digit" + k, text: k }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: "Digit" + k }); };
const probe = "(()=>{const st=document.getElementById('stone');const yaw=parseFloat(getComputedStyle(st).getPropertyValue('--yaw'));const out={yaw:Math.round(yaw),bad:[]};for(const f of document.querySelectorAll('.face')){const r=f.getBoundingClientRect();const a=Number(getComputedStyle(f).getPropertyValue('--a'));const n=((a+yaw)%360+540)%360-180;if(Math.abs(n)>=75)continue;for(const [dx,dy] of [[0.5,0.4],[0.2,0.6],[0.8,0.6]]){const x=r.left+r.width*dx,y=r.top+r.height*dy;const el=document.elementFromPoint(x,y);const ff=el&&el.closest('.face');const hit=ff?ff.dataset.face:(el?el.id||el.tagName:'null');if(hit!==f.dataset.face)out.bad.push(f.dataset.face+'@'+Math.round(n)+'->'+hit)}}return out})()";
const results = [];
for (const k of ["1", "2", "3"]) { await key(k); await sleep(600); results.push({ via: "key " + k, ...(await ev(probe)) }); }
for (let yaw = -180; yaw < 180; yaw += 15) {
  await key("1"); await sleep(500);
  const dx = yaw / 0.45; const steps = 6;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: c[0], y: c[1], button: "left", clickCount: 1 });
  for (let s = 1; s <= steps; s++) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c[0] + dx * s / steps, y: c[1], button: "left" }); await sleep(20); }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c[0] + dx, y: c[1], button: "left", clickCount: 1 });
  await sleep(300);
  results.push({ via: "drag", ...(await ev(probe)) });
}
const bad = results.filter((r) => r.bad && r.bad.length);
console.log(stone, "checked", results.length, "views; failures:", bad.length, bad.length ? JSON.stringify(bad) : "");
ws.close(); proc.kill();
await sleep(300); rmSync("tmp/chrome-profile-" + process.pid, { recursive: true, force: true });
if (bad.length) process.exit(1);
