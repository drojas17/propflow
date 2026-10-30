import { exportKeyLayout, type ExportBox } from './exportKeyLayout'
type KeyEntry={label:string;ariaLabel:string;tank:boolean}
const ns='http://www.w3.org/2000/svg'

/** Export geometry and key use the same coordinate system, independent of editor zoom. */
export function prepareDrawingExport(source:SVGSVGElement,entries:KeyEntry[],colors:Record<string,string>,light:boolean,detail:string,routes:{x:number;y:number}[][]=[]){
 const svg=source.cloneNode(true) as SVGSVGElement
 svg.removeAttribute('style')
 svg.removeAttribute('class')
 svg.querySelectorAll('[data-canvas],#grid,.port,[stroke="transparent"],.symbol > rect[fill="transparent"],.selected-hitbox,.selection-marquee,.field-grid,.edge-handles,.export-exclude,[stroke-dasharray="6 5"]').forEach(e=>e.remove())
 const ink=light?'#1a2b3a':'#dce7ef',background=light?'#ffffff':'#071018'
 const style=document.createElementNS(ns,'style')
 style.textContent=`:root{--symbol-bg:${background};--symbol-text:${ink};--symbol-text-dim:${light?'#5a6c7d':'#c4d1d8'}}text{font-family:Arial,Helvetica,sans-serif}`
 svg.prepend(style)
 // Measure rendered symbols, labels, bends, stubs and shapes instead of the editing canvas.
 svg.style.position='fixed';svg.style.left='-100000px';svg.style.top='0'
 document.body.append(svg)
 try{
  // Empty custom placeholders with blank/punctuation-only labels are editing
  // residue, not printable diagram content. Their stray dots can widen a page.
  for(const symbol of svg.querySelectorAll('.symbol')){
   if(!symbol.getAttribute('aria-label')?.endsWith(' custom'))continue
   const glyph=Array.from(symbol.children).find(child=>child.tagName.toLowerCase()==='g') as SVGGraphicsElement|undefined
   const label=Array.from(symbol.children).filter(child=>child.tagName.toLowerCase()==='text').map(child=>child.textContent??'').join('')
   if(glyph){const box=glyph.getBBox();if(box.width<=2&&box.height<=2&&!/[\p{L}\p{N}]/u.test(label))symbol.remove()}
  }
  const bounds=svg.getBBox(),margin=30
  const x=bounds.width?bounds.x-margin:0,y=bounds.height?bounds.y-margin:0
  const width=Math.max(300,bounds.width+margin*2),drawingHeight=Math.max(100,bounds.height+margin*2)
  const fluids=Object.entries(colors).filter(([label])=>label!=='Water')
  const page={x,y,width,height:drawingHeight}
  const obstacles:ExportBox[]=Array.from(svg.children).flatMap(child=>{
   if(!(child instanceof SVGGraphicsElement)||child.hasAttribute('data-export-pipe'))return[]
   const box=child.getBBox(),matrix=child.getCTM(),rootMatrix=svg.getCTM()
   if(!matrix||!rootMatrix||(!box.width&&!box.height))return[]
   const transform=rootMatrix.inverse().multiply(matrix)
   const corners=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([cx,cy])=>new DOMPoint(cx,cy).matrixTransform(transform))
   const left=Math.min(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y))
   return[{x:left,y:top,width:Math.max(...corners.map(p=>p.x))-left,height:Math.max(...corners.map(p=>p.y))-top}]
  })
  // Treat each straight pipe segment separately: a bent run's overall box can
  // cover large areas of genuinely empty space inside its bends.
  for(const route of routes)for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i]
   obstacles.push({x:Math.min(a.x,b.x)-4,y:Math.min(a.y,b.y)-4,width:Math.abs(a.x-b.x)+8,height:Math.abs(a.y-b.y)+8})
  }
  const layout=exportKeyLayout(page,obstacles,entries.length,fluids.length)
  const {unit,columns,fluidColumns,symbolY,rowHeight}=layout,padding=12*unit,font=14*unit,columnWidth=(layout.width-padding*2)/columns
  const keyX=layout.x,keyY=layout.y,totalHeight=drawingHeight
  const element=(tag:string,attrs:Record<string,string|number>,parent:Element=svg)=>{
   const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));parent.append(el);return el
  }
  const text=(value:string,tx:number,ty:number,size=font,parent:Element=svg)=>{
   const el=element('text',{x:tx,y:ty,fill:'#1a2b3a','font-size':size},parent);el.textContent=value;return el
  }
  // Group the existing drawing only when a dense page needs internal space.
  if(!layout.inset){
   const drawing=element('g',{}),availableHeight=Math.max(1,drawingHeight-layout.height-12*unit),scale=Math.min(1,availableHeight/drawingHeight)
   for(const child of Array.from(svg.children))if(child!==drawing&&child!==style)drawing.append(child)
   drawing.setAttribute('transform',`translate(${x+width*(1-scale)/2} ${y}) scale(${scale}) translate(${-x} ${-y})`)
  }
  element('rect',{x:keyX,y:keyY,width:layout.width,height:layout.height,fill:'#ffffff',stroke:'#d0d9e3'})
  text(`KEY · ${detail.toUpperCase()}`,keyX+padding,keyY+22*unit,16*unit).setAttribute('font-weight','700')
  fluids.forEach(([label,color],i)=>{
   const fx=keyX+padding+(i%fluidColumns)*(layout.width-padding*2)/fluidColumns,fy=keyY+42*unit+Math.floor(i/fluidColumns)*22*unit
   element('line',{x1:fx,x2:fx+18*unit,y1:fy,y2:fy,stroke:color,'stroke-width':4*unit})
   text(label,fx+25*unit,fy+5*unit)
  })
  entries.forEach((entry,i)=>{
   const ex=keyX+padding+(i%columns)*columnWidth,ey=keyY+symbolY+Math.floor(i/columns)*rowHeight
   const sample=Array.from(svg.querySelectorAll('.symbol')).find(el=>el.getAttribute('aria-label')===entry.ariaLabel)
   const drawing=sample&&Array.from(sample.children).find(el=>el.tagName.toLowerCase()==='g')
   if(drawing){
    const wrapper=element('g',{}),glyph=drawing.cloneNode(true) as SVGGElement
    // Tank inventory annotations belong in the diagram, not in the symbol sample.
    if(entry.tank)glyph.querySelectorAll('text').forEach(el=>el.remove())
    // Recolor only the detached key sample; fluid colors in the drawing stay intact.
    glyph.style.setProperty('--symbol-bg','#ffffff')
    glyph.style.setProperty('--symbol-text','#000000')
    glyph.style.setProperty('--symbol-text-dim','#000000')
    for(const mark of [glyph,...Array.from(glyph.querySelectorAll('*'))]){
     for(const attr of ['stroke','fill']){
      const value=mark.getAttribute(attr)
      if(value&&!['none','transparent'].includes(value))mark.setAttribute(attr,value==='var(--symbol-bg)'?'#ffffff':'#000000')
     }
     if(mark.tagName.toLowerCase()==='image')(mark as SVGImageElement).style.filter='grayscale(1) brightness(0)'
    }
    wrapper.append(glyph)
    const box=(wrapper as SVGGElement).getBBox(),scale=Math.min(unit,32*unit/Math.max(1,box.width),32*unit/Math.max(1,box.height))
    wrapper.setAttribute('transform',`translate(${ex+17*unit} ${ey+rowHeight/2}) scale(${scale}) translate(${-box.x-box.width/2} ${-box.y-box.height/2})`)
   }
   const label=text(entry.label,ex+46*unit,ey+rowHeight/2+5*unit)
   // Long custom names wrap inside their own cell rather than colliding with the next entry.
   const words=entry.label.split(/\s+/);label.textContent='';let line='',lineIndex=0
   let span=element('tspan',{x:ex+46*unit,dy:0},label)
   for(const word of words){span.textContent=line?`${line} ${word}`:word
    if((span as SVGTSpanElement).getComputedTextLength()>columnWidth-50*unit&&line){span.textContent=line;lineIndex++;span=element('tspan',{x:ex+46*unit,dy:16*unit},label);line=word;span.textContent=word}else line=span.textContent??''
   }
   if(lineIndex)label.setAttribute('y',String(ey+rowHeight/2+5*unit-lineIndex*8*unit))
  })
  svg.setAttribute('viewBox',`${x} ${y} ${width} ${totalHeight}`)
  svg.setAttribute('width',String(width));svg.setAttribute('height',String(totalHeight))
  svg.removeAttribute('style')
  return{svg,width,height:totalHeight}
 }finally{svg.remove()}
}
