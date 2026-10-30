export type ExportBox={x:number;y:number;width:number;height:number}
export type ExportKeyLayout=ExportBox&{columns:number;fluidColumns:number;symbolY:number;rowHeight:number;unit:number;inset:boolean}

/** Fit the key into clear drawing space; never enlarge the exported page. */
export function exportKeyLayout(page:ExportBox,obstacles:ExportBox[],entryCount:number,fluidCount:number):ExportKeyLayout{
 let unit=Math.max(1,page.width/1800),padding=12*unit,rowHeight=42*unit
 const baseUnit=unit
 const dimensions=(columns:number,width=(columns*220+24)*unit)=>{
  const fluidColumns=Math.max(1,Math.floor((width-padding*2)/(100*unit)))
  const symbolY=(34+Math.ceil(fluidCount/fluidColumns)*22)*unit
  return{width,height:symbolY+Math.ceil(entryCount/columns)*rowHeight+padding,columns,fluidColumns,symbolY,rowHeight,unit}
 }
 for(const packingScale of [1,.85,.7]){
  unit=baseUnit*packingScale;padding=12*unit;rowHeight=42*unit
  const gap=10*unit,maxColumns=Math.floor((page.width-padding*2)/(220*unit))
  for(const columns of [...new Set([2,1,...Array.from({length:maxColumns},(_,i)=>i+1)])]){
   const size=dimensions(columns)
   if(size.width>page.width-padding*2||size.height>page.height-padding*2)continue
   const xs=[...new Set([page.x+page.width-size.width-padding,page.x+padding,...obstacles.flatMap(b=>[b.x-size.width-gap,b.x+b.width+gap])])].sort((a,b)=>b-a)
   const ys=[...new Set([page.y+padding,page.y+page.height-size.height-padding,...obstacles.flatMap(b=>[b.y-size.height-gap,b.y+b.height+gap])])].sort((a,b)=>a-b)
   for(const y of ys)for(const x of xs){
    if(x<page.x+padding||y<page.y+padding||x+size.width>page.x+page.width-padding||y+size.height>page.y+page.height-padding)continue
    if(obstacles.every(b=>x+size.width+gap<=b.x||x>=b.x+b.width+gap||y+size.height+gap<=b.y||y>=b.y+b.height+gap))return{x,y,...size,inset:true}
   }
  }
 }
 // Dense drawings keep their original page size: reserve an internal footer
 // and fit the drawing above it, rather than stretching the page for a key.
 unit=baseUnit;padding=12*unit;rowHeight=42*unit
 let columns=Math.max(1,Math.floor((page.width-padding*2)/(220*unit)))
 const initial=dimensions(columns,page.width),factor=Math.min(1,page.height*.35/initial.height)
 unit*=factor;padding*=factor;rowHeight*=factor
 columns=Math.max(1,Math.floor((page.width-padding*2)/(220*unit)))
 const size=dimensions(columns,page.width)
 return{x:page.x,y:page.y+page.height-size.height,...size,inset:false}
}
