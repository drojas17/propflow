type KeyEntry={label:string;ariaLabel:string;tank:boolean}
const ns='http://www.w3.org/2000/svg'

/** Export geometry and key use the same coordinate system, independent of editor zoom. */
export function prepareDrawingExport(source:SVGSVGElement,entries:KeyEntry[],colors:Record<string,string>,light:boolean,detail:string){
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
  const bounds=svg.getBBox(),margin=30
  const x=bounds.width?bounds.x-margin:0,y=bounds.height?bounds.y-margin:0
  const width=Math.max(300,bounds.width+margin*2),drawingHeight=Math.max(100,bounds.height+margin*2)
  // Scale the key's type with the drawing so it remains readable in a page-wide preview.
  const unit=Math.max(1,width/1800),padding=20*unit,font=18*unit,rowHeight=74*unit
  const columns=Math.max(1,Math.floor((width-padding*2)/(340*unit))),columnWidth=(width-padding*2)/columns
  const fluids=Object.entries(colors),fluidColumns=Math.max(1,Math.floor((width-padding*2)/(150*unit)))
  const fluidRows=Math.ceil(fluids.length/fluidColumns),symbolY=70*unit+fluidRows*32*unit
  const keyHeight=symbolY+Math.ceil(entries.length/columns)*rowHeight+padding,totalHeight=drawingHeight+keyHeight
  const keyY=y+drawingHeight
  const element=(tag:string,attrs:Record<string,string|number>,parent:Element=svg)=>{
   const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));parent.append(el);return el
  }
  const text=(value:string,tx:number,ty:number,size=font,parent:Element=svg)=>{
   const el=element('text',{x:tx,y:ty,fill:'#1a2b3a','font-size':size},parent);el.textContent=value;return el
  }
  element('rect',{x,y:keyY,width,height:keyHeight,fill:'#ffffff',stroke:'#d0d9e3'})
  text(`P&ID KEY · ${detail.toUpperCase()} VIEW`,x+padding,keyY+32*unit,22*unit).setAttribute('font-weight','700')
  fluids.forEach(([label,color],i)=>{
   const fx=x+padding+(i%fluidColumns)*(width-padding*2)/fluidColumns,fy=keyY+62*unit+Math.floor(i/fluidColumns)*32*unit
   element('line',{x1:fx,x2:fx+28*unit,y1:fy,y2:fy,stroke:color,'stroke-width':4*unit})
   text(label,fx+38*unit,fy+6*unit)
  })
  entries.forEach((entry,i)=>{
   const ex=x+padding+(i%columns)*columnWidth,ey=keyY+symbolY+Math.floor(i/columns)*rowHeight
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
    const box=(wrapper as SVGGElement).getBBox(),scale=Math.min(unit,64*unit/Math.max(1,box.width),56*unit/Math.max(1,box.height))
    wrapper.setAttribute('transform',`translate(${ex+34*unit} ${ey+rowHeight/2}) scale(${scale}) translate(${-box.x-box.width/2} ${-box.y-box.height/2})`)
   }
   const label=text(entry.label,ex+80*unit,ey+rowHeight/2+6*unit)
   // Long custom names wrap inside their own cell rather than colliding with the next entry.
   const words=entry.label.split(/\s+/);label.textContent='';let line='',lineIndex=0
   let span=element('tspan',{x:ex+80*unit,dy:0},label)
   for(const word of words){span.textContent=line?`${line} ${word}`:word
    if((span as SVGTSpanElement).getComputedTextLength()>columnWidth-90*unit&&line){span.textContent=line;lineIndex++;span=element('tspan',{x:ex+80*unit,dy:22*unit},label);line=word;span.textContent=word}else line=span.textContent??''
   }
   if(lineIndex)label.setAttribute('y',String(ey+rowHeight/2+6*unit-lineIndex*11*unit))
  })
  svg.setAttribute('viewBox',`${x} ${y} ${width} ${totalHeight}`)
  svg.setAttribute('width',String(width));svg.setAttribute('height',String(totalHeight))
  svg.removeAttribute('style')
  return{svg,width,height:totalHeight}
 }finally{svg.remove()}
}
