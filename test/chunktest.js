const fs=require('fs'),vm=require('vm');const ctx={console};vm.createContext(ctx);
const src=['data.js','map.js','chunkgen.js'].map(f=>fs.readFileSync(__dirname+'/../src/'+f,'utf8')).join('\n')+'\n;this.API={buildMap,initWorldData,genChunk,P,LM,CH};';
vm.runInContext(src,ctx);const A=ctx.API;
let t=Date.now();A.buildMap();A.initWorldData();console.log('init ms',Date.now()-t);
for(const [n,lat,lon] of [['midtown',40.7549,-73.984],['fidi',40.708,-74.01],['bk',40.68,-73.95],['si',40.58,-74.15],['qns',40.72,-73.8],['cp',40.78,-73.965]]){
 const p=A.P(lat,lon);const cx=Math.floor(p[0]/A.CH),cz=Math.floor(p[1]/A.CH);t=Date.now();const c=A.genChunk(cx,cz);
 console.log(n,'ms',Date.now()-t,'boxes',c.boxes.length/14,'cols',c.cols.length/7,'props',c.props.length/8,'bills',c.bills.length/8);}
