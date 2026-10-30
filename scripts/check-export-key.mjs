import assert from 'node:assert/strict'
import {createServer} from 'vite'

const vite=await createServer({server:{middlewareMode:true},appType:'custom'})
try{
 const {exportKeyLayout}=await vite.ssrLoadModule('/src/exportKeyLayout.ts')
 const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y
 const inside=(key,page)=>{
  assert.ok(key.x>=page.x&&key.y>=page.y)
  assert.ok(key.x+key.width<=page.x+page.width+.001)
  assert.ok(key.y+key.height<=page.y+page.height+.001)
 }
 // The right-hand whitespace holds a full key without changing the drawing scale.
 const page={x:-30,y:70,width:1800,height:1200}
 const obstacles=[{x:0,y:100,width:1200,height:1100},{x:1700,y:110,width:5,height:5}]
 const key=exportKeyLayout(page,obstacles,12,6)
 assert.ok(key.inset);inside(key,page)
 assert.ok(obstacles.every(box=>!overlaps(key,box)))
 // A completely occupied page uses an internal footer, including tiny drawings.
 for(const page of [{x:0,y:0,width:800,height:600},{x:-100,y:-50,width:300,height:100}]){
  const key=exportKeyLayout(page,[page],12,6)
  assert.equal(key.inset,false);inside(key,page)
  assert.ok(key.height<=page.height*.35+.001)
 }
 // Narrow clear space still accommodates a one-column legend.
 const narrow={x:0,y:0,width:300,height:900}
 const one=exportKeyLayout(narrow,[],12,6)
 assert.ok(one.inset);assert.equal(one.columns,1);inside(one,narrow)
 console.log('Export key checks passed: inset collision avoidance, offset bounds, narrow layouts, and fixed-size dense pages.')
}finally{await vite.close()}
