import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(**LAUNCH,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':390,'height':844})
        logs=[]; pg.on('pageerror',lambda e: logs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(3500)
        for name,tag in [('BROOKLYN BRIDGE','bb'),('VERRAZZANO BRIDGE','vz'),('QUEENSBORO BRIDGE','qb')]:
            await pg.evaluate(f"""()=>{{G.noBust=true;G.noAdapt=true;startRun();const br=BRIDGES.find(b=>b.name==='{name}');
              const t=br.len*0.2;G.P.x=br.a[0]+br.dx*t;G.P.z=br.a[1]+br.dz*t;G.P.h=Math.atan2(br.dx,-br.dz);G.P.vx=br.dx*15;G.P.vz=br.dz*15;
              G.cam.tx=G.P.x;G.cam.tz=G.P.z;G.state='pause';}}""")
            await pg.wait_for_timeout(3500)
            await pg.evaluate("()=>{G.state='play'}")
            for i in range(4): await pg.evaluate("()=>__sim(0.5,0)"); await pg.wait_for_timeout(200)
            await pg.wait_for_timeout(1500)
            print(name, await pg.evaluate("()=>({state:G.state,y:G.P.y.toFixed(2),sink:G.P.sink,onb:G.P.onBridge&&G.P.onBridge.name,hood:G.hood})"))
            await pg.screenshot(path=f'{OUT}/br_{tag}.png')
        print(logs)
        await b.close()
asyncio.run(main())
