import asyncio, sys, json
from playwright.async_api import async_playwright
import os, pathlib
URL=(pathlib.Path(__file__).resolve().parent.parent/'dist'/'index.html').as_uri()
OUT=pathlib.Path(__file__).resolve().parent/'out'; OUT.mkdir(exist_ok=True)
LAUNCH={'executable_path':os.environ['CHROME_PATH']} if os.environ.get('CHROME_PATH') else {}
async def main():
    W=int(sys.argv[1]) if len(sys.argv)>1 else 390; H=int(sys.argv[2]) if len(sys.argv)>2 else 844
    async with async_playwright() as p:
        b=await p.chromium.launch(**LAUNCH,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':W,'height':H})
        logs=[]; pg.on('pageerror',lambda e: logs.append(f'PAGEERROR: {e}')); pg.on('console',lambda m: logs.append(m.text) if m.type=='error' else None)
        await pg.goto(URL); await pg.wait_for_timeout(4000)
        await pg.evaluate("()=>{G.noAdapt=true;G.noBust=true;const b=document.getElementById('playBtn');b.disabled=false;b.dataset.mode='play';b.click();}")
        async def sim(sec, steer=0, chunks=4):
            for i in range(chunks):
                await pg.evaluate(f"()=>__sim({sec/chunks},{steer})"); await pg.wait_for_timeout(150)
        async def st(): return await pg.evaluate("()=>({state:G.state,x:+G.P.x.toFixed(1),z:+G.P.z.toFixed(1),sp:+vSpeed(G.P).toFixed(1),hp:+G.P.hp.toFixed(0),stars:G.stars,heat:+G.heat.toFixed(1),cops:G.cops.length,civs:G.civs.length,pk:G.pickups.length,cash:SAVE.bank,chunks:WORLD.chunks.size,parts:PARTS.length})")
        await sim(3,0); print('drive', await st())
        await sim(1.5,1); await sim(2,0); print('turn', await st())
        await pg.screenshot(path=f'{OUT}/f1_drive.png')
        await pg.evaluate("()=>{G.heat=20;G.godT=99;}")
        for k in range(6): await sim(1.5, [0,1,0,-1,0,1][k])
        print('wanted', await st())
        await pg.wait_for_timeout(600); await pg.screenshot(path=f'{OUT}/f2_chase.png')
        # shop flow: teleport in front of nearest shop door, facing in
        r=await pg.evaluate("""()=>{const [s]=nearestShop(G.P.x,G.P.z);const g=s.g;
          const p=gWorld(g,(s.i+0.5)*g.A,(s.j+0.5)*g.S+s.sd*(s.bv/2+g.sw+g.ws*0.5));G.P.x=p[0];G.P.z=p[1];
          G.P.h=Math.atan2(-g.dx*s.sd,g.dz*s.sd);G.P.vx=Math.sin(G.P.h)*6;G.P.vz=-Math.cos(G.P.h)*6;
          for(const c of G.cops){c.x+=200;} G.cam.tx=G.P.x;G.cam.tz=G.P.z; return s.name}""")
        print('shop target', r)
        await pg.wait_for_timeout(800)
        for i in range(6):
            await pg.evaluate("()=>__sim(0.15,0)"); await pg.wait_for_timeout(120)
        print('after drive-in', await st())
        await pg.wait_for_timeout(2000)
        await pg.screenshot(path=f'{OUT}/f3_shop.png')
        await pg.evaluate("()=>{SAVE.bank=Math.max(SAVE.bank,2000);renderShopUI();}")
        await pg.click('#swatches .sw:nth-child(1)'); await pg.wait_for_timeout(500)
        print('after respray', await st())
        await pg.screenshot(path=f'{OUT}/f4_respray.png')
        await pg.click('#leaveBtn'); await pg.wait_for_timeout(800)
        print('left shop', await st())
        await sim(2,0)
        await pg.screenshot(path=f'{OUT}/f5_after.png')
        # water test: teleport onto Hudson heading west
        await pg.evaluate("()=>{const p=P(40.745,-74.0075);G.P.x=p[0];G.P.z=p[1];G.P.h=-Math.PI/2+0.4;G.P.vx=-20;G.P.vz=0;G.cam.tx=G.P.x;G.cam.tz=G.P.z;}")
        await sim(2.5,0)
        await pg.wait_for_timeout(2500)
        print('water', await st())
        await pg.screenshot(path=f'{OUT}/f6_over.png')
        print([l for l in logs if 'ERR_TUNNEL' not in l][:20])
        await b.close()
asyncio.run(main())
