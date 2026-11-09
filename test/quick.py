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
        await pg.goto(URL); await pg.wait_for_timeout(6000)
        await pg.screenshot(path=f'{OUT}/{tag}_title.png')
        print(await pg.evaluate("()=>({pct:loadingPct(),chunks:WORLD.chunks.size,btn:document.getElementById('playBtn').textContent})"))
        await pg.evaluate("()=>{G.noAdapt=true;G.noBust=true;startRun();G.heat=45;}")
        for i in range(8): await pg.evaluate("()=>__sim(0.5,0)"); await pg.wait_for_timeout(100)
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/{tag}_hud.png')
        print(logs)
        await b.close()
asyncio.run(main())
