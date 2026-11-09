// Node port of test/flow.py + test/chaos.py (uses the preinstalled Playwright; no Python needed).
// Usage: node test/flow_node.js [dist/index.html] [out prefix]
const { chromium } = require('playwright');
const path = require('path'); const html = process.argv[2] || path.resolve(__dirname, '../dist/index.html'); const out = process.argv[3] || path.resolve(__dirname, 'out/node'); require('fs').mkdirSync(path.dirname(out), { recursive: true });
(async () => {
  const b = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const pg = await b.newPage({viewport:{width:390,height:844}});
  const logs=[]; pg.on('pageerror',e=>logs.push('PAGEERROR: '+e.message)); pg.on('console',m=>{ if(m.type()==='error') logs.push(m.text()); });
  await pg.goto('file://'+html); await pg.waitForTimeout(4000);
  await pg.evaluate("(()=>{G.noAdapt=true;G.noBust=true;const b=document.getElementById('playBtn');b.disabled=false;b.dataset.mode='play';b.click();})()");
  const sim=async(sec,steer=0,n=4)=>{for(let i=0;i<n;i++){await pg.evaluate(`__sim(${sec/n},${steer})`);await pg.waitForTimeout(150);}};
  const st=()=>pg.evaluate("({state:G.state,x:+G.P.x.toFixed(1),z:+G.P.z.toFixed(1),sp:+vSpeed(G.P).toFixed(1),hp:+G.P.hp.toFixed(0),stars:G.stars,heat:+G.heat.toFixed(1),cops:G.cops.length,civs:G.civs.length,cash:SAVE.bank,chunks:WORLD.chunks.size})");
  await sim(3,0); console.log('drive', JSON.stringify(await st()));
  await sim(1.5,1); await sim(2,0); console.log('turn', JSON.stringify(await st()));
  await pg.evaluate("G.heat=20;G.godT=99;");
  for (const k of [0,1,0,-1,0,1]) await sim(1.5,k);
  console.log('wanted', JSON.stringify(await st()));
  await pg.waitForTimeout(600); await pg.screenshot({path:out+'_chase.png'});
  const r=await pg.evaluate(`(()=>{const [s]=nearestShop(G.P.x,G.P.z);const g=s.g;
    const p=gWorld(g,(s.i+0.5)*g.A,(s.j+0.5)*g.S+s.sd*(s.bv/2+g.sw+g.ws*0.5));G.P.x=p[0];G.P.z=p[1];
    G.P.h=Math.atan2(-g.dx*s.sd,g.dz*s.sd);G.P.vx=Math.sin(G.P.h)*6;G.P.vz=-Math.cos(G.P.h)*6;
    for(const c of G.cops){c.x+=200;} G.cam.tx=G.P.x;G.cam.tz=G.P.z; return s.name})()`);
  console.log('shop target', r);
  await pg.waitForTimeout(800);
  for (let i=0;i<6;i++){ await pg.evaluate('__sim(0.15,0)'); await pg.waitForTimeout(120); }
  console.log('after drive-in', JSON.stringify(await st()));
  await pg.waitForTimeout(2500); await pg.screenshot({path:out+'_shop.png'});
  await pg.evaluate("SAVE.bank=Math.max(SAVE.bank,2000);renderShopUI();");
  await pg.click('#swatches .sw:nth-child(1)'); await pg.waitForTimeout(500);
  console.log('after respray', JSON.stringify(await st()));
  await pg.click('#leaveBtn'); await pg.waitForTimeout(800);
  console.log('left shop', JSON.stringify(await st()));
  await sim(2,0);
  await pg.evaluate("(()=>{const p=P(40.745,-74.0075);G.P.x=p[0];G.P.z=p[1];G.P.h=-Math.PI/2+0.4;G.P.vx=-20;G.P.vz=0;G.cam.tx=G.P.x;G.cam.tz=G.P.z;})()");
  await sim(2.5,0); await pg.waitForTimeout(2500);
  console.log('water', JSON.stringify(await st()));
  // chaos + night
  await pg.evaluate("GFX.night=1;");
  for (const boro of ['MANHATTAN','BROOKLYN','QUEENS','BRONX','STATEN ISLAND']) {
    await pg.evaluate(`(()=>{G.noAdapt=true;SAVE.boro='${boro}';titleCar=SAVE.car;startRun();G.godT=1e9;G.noBust=true;G.heat=100;})()`);
    await pg.waitForTimeout(1500);
    for (let i=0;i<40;i++){ const s=[-1,0,0,1][Math.floor(Math.random()*4)]; await pg.evaluate(`__sim(0.5,${s})`); await pg.waitForTimeout(60); }
    const c=await pg.evaluate("({boro:SAVE.boro,state:G.state,nan:[G.P.x,G.P.z,G.P.vx,G.P.h].some(isNaN),hp:+G.P.hp.toFixed(0),stars:G.stars,cops:G.cops.length,civs:G.civs.length,chunks:WORLD.chunks.size,heli:!!G.heli,hood:G.hood})");
    console.log('chaos', JSON.stringify(c));
    if (boro==='MANHATTAN'||boro==='BROOKLYN') await pg.screenshot({path:out+'_night_'+boro+'.png'});
  }
  console.log('logs', JSON.stringify(logs.slice(0,20)));
  await b.close();
})();
