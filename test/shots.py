import asyncio, sys
from playwright.async_api import async_playwright
import os, pathlib
URL=(pathlib.Path(__file__).resolve().parent.parent/'dist'/'index.html').as_uri()
OUT=pathlib.Path(__file__).resolve().parent/'out'; OUT.mkdir(exist_ok=True)
LAUNCH={'executable_path':os.environ['CHROME_PATH']} if os.environ.get('CHROME_PATH') else {}
async def main():
    W=int(sys.argv[1]); H=int(sys.argv[2]); tag=sys.argv[3]
    async with async_playwright() as p:
        b=await p.chromium.launch(**LAUNCH,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':W,'height':H})
        logs=[]; pg.on('pageerror',lambda e: logs.append(f'PAGEERROR: {e}'))
        await pg.goto(URL); await pg.wait_for_timeout(4500)
        await pg.screenshot(path=f'{OUT}/{tag}_title.png')
        await pg.evaluate("()=>{G.noAdapt=true;G.noBust=true;const b=document.getElementById('playBtn');b.disabled=false;b.dataset.mode='play';b.click();}")
        # approach a shop exterior at 0 stars
        await pg.evaluate("""()=>{const s=SHOPS.find(s=>s.name==="GOWANUS");const g=s.g;
          const p=gWorld(g,(s.i+0.5)*g.A+2,(s.j+0.5)*g.S+s.sd*(s.bv/2+g.sw+g.ws*0.5+5));G.P.x=p[0];G.P.z=p[1];
          G.P.h=Math.atan2(-g.dx*s.sd,g.dz*s.sd);G.P.vx=0;G.P.vz=0;G.cam.tx=G.P.x;G.cam.tz=G.P.z;G.state='pause';}""")
        for i in range(8): await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{G.state='play';G.P.thr=0}")
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f'{OUT}/{tag}_shopext.png')
        await pg.evaluate("()=>{enterShop(SHOPS.find(s=>s.name==='GOWANUS'));}")
        await pg.wait_for_timeout(3000)
        await pg.screenshot(path=f'{OUT}/{tag}_shopin.png')
        await pg.click('#leaveBtn'); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{GFX.night=1;const p=P(40.7060,-74.0120);G.P.x=p[0];G.P.z=p[1];G.cam.tx=p[0];G.cam.tz=p[1];G.state='pause';}")
        for i in range(8): await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{G.state='play'}"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'{OUT}/{tag}_night.png')
        print(logs)
        await b.close()
asyncio.run(main())
