import asyncio, random
from playwright.async_api import async_playwright
import os, pathlib
URL=(pathlib.Path(__file__).resolve().parent.parent/'dist'/'index.html').as_uri()
OUT=pathlib.Path(__file__).resolve().parent/'out'; OUT.mkdir(exist_ok=True)
LAUNCH={'executable_path':os.environ['CHROME_PATH']} if os.environ.get('CHROME_PATH') else {}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(**LAUNCH,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':320,'height':480})
        logs=[]; pg.on('pageerror',lambda e: logs.append(f'PAGEERROR: {e}')); pg.on('console',lambda m: logs.append(m.text) if m.type in('error','warning') and 'GL Driver' not in m.text and 'TUNNEL' not in m.text else None)
        await pg.goto(URL); await pg.wait_for_timeout(4000)
        for boro in ['MANHATTAN','BROOKLYN','QUEENS','BRONX','STATEN ISLAND']:
            await pg.evaluate(f"()=>{{G.noAdapt=true;SAVE.boro='{boro}';titleCar=SAVE.car;startRun();G.godT=1e9;G.noBust=true;G.heat=100;}}")
            await pg.wait_for_timeout(1500)
            for i in range(40):
                st=random.choice([-1,0,0,1])
                await pg.evaluate(f"()=>__sim(0.5,{st})"); await pg.wait_for_timeout(60)
            r=await pg.evaluate("()=>({boro:SAVE.boro,state:G.state,x:G.P.x,z:G.P.z,nan:[G.P.x,G.P.z,G.P.vx,G.P.h].some(isNaN),hp:G.P.hp,stars:G.stars,cops:G.cops.length,wrecks:G.wrecks.length,civs:G.civs.length,parts:PARTS.length,chunks:WORLD.chunks.size,heli:!!G.heli,cash:SAVE.bank,hood:G.hood})")
            print(r)
            await pg.screenshot(path=f"{OUT}/c_{boro.replace(' ','_')}.png")
        print(logs[:20])
        await b.close()
asyncio.run(main())
