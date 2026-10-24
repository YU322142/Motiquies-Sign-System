import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
for (const name of ['core','icons','crt-symbols','crt-catalog','state','render','composition','crt-render']) {
  (0,eval)(readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8'));
}
const {SignState:S,SignRender:R,SignComposition:C,SignCRT:Catalog}=globalThis;
const measure=(text,font,weight,size)=>String(text).length*size*0.9;
measure.ink=(text,font,weight,size)=>({abl:0,abr:measure(text,font,weight,size),adv:measure(text,font,weight,size)});
measure.ascent=(text,font,weight,size)=>size*0.8;
measure.descent=(text,font,weight,size)=>size*0.2;
function preset(id){
  const t=Catalog.get(id),elements=C.materialize(id,undefined,measure);
  return S.addTemplateRow(S.createSign(),null,elements,{templateId:id,widthRatio:t.width/t.height});
}
function near(a,b){assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);}
test('不同牌型预设采用各自参考比例，横牌仍使用原有流式元素',()=>{
  for(const id of ['entrance-guide','concourse-exit','station-name','route-vertical','no-smoking']){
    const sign=preset(id),row=sign.rows[0],t=Catalog.get(id);
    near(R.computeRowWidth(row,sign.rowHeight,measure)/sign.rowHeight,t.width/t.height);
    assert.equal(row.templateId,id);
    near(row.referenceWidthRatio,t.width/t.height);
    assert.equal(sign.widthMode,'dynamic');
    if(id==='entrance-guide')assert.equal(row.layout,'flow');
    assert.deepEqual(S.deserializeSign(S.serializeSign(sign)),sign);
  }
});
test('用户改变横牌比例后内容等比适配，不超出牌面且不改字体几何公式',()=>{
  const original=preset('entrance-guide'),before=JSON.stringify(original);
  const resized=S.setRowAspectRatio(original,original.rows[0].id,2);
  assert.equal(JSON.stringify(original),before);
  near(R.computeRowWidth(resized.rows[0],256,measure),512);
  const layout=R.layoutSign(resized,measure),slots=layout.rows[0].elements;
  assert.ok(slots.every(s=>s.x>=0&&s.x+s.width<=512+1e-7));
  assert.ok(slots.every(s=>s.scale>0&&s.scale<=1));
  assert.deepEqual(S.deserializeSign(S.serializeSign(resized)),resized);
});
test('竖牌改比例按横向位置和宽度调整，图文仍独立且恢复参考比例无漂移',()=>{
  const sign=preset('station-name'),id=sign.rows[0].id;
  const resized=S.setRowAspectRatio(sign,id,1.5);
  for(let i=0;i<sign.rows[0].elements.length;i++){
    const a=sign.rows[0].elements[i],b=resized.rows[0].elements[i];
    assert.equal(a.id,b.id);near(b.props.box.x,a.props.box.x*2);near(b.props.box.width,a.props.box.width*2);
    near(b.props.box.y,a.props.box.y);near(b.props.box.height,a.props.box.height);
  }
  const reset=S.setRowAspectRatio(resized,id,sign.rows[0].referenceWidthRatio);
  reset.rows[0].elements.forEach((el,i)=>{for(const key of ['x','y','width','height'])near(el.props.box[key],sign.rows[0].elements[i].props.box[key]);});
  near(reset.rows[0].widthRatio,0.75);
});
test('加宽自由牌面时底色和色条铺满新宽度，站号圆形和文字保持自身比例',()=>{
  const sign=preset('station-name'),resized=S.setRowAspectRatio(sign,sign.rows[0].id,1.5);
  const slots=R.layoutSign(resized,measure).rows[0].elements;
  resized.rows[0].elements.forEach((element,i)=>{
    const slot=slots[i];
    if(element.type==='shape'&&element.props.shape==='rect')near(slot.metrics.width,slot.width);
    if(element.type==='bilingual-text')near(slot.offsetX,(slot.width-slot.naturalWidth*slot.scale)/2);
  });
});
test('预设单独成行时不继承上一张牌的比例，旧版无比例行保持流式行为',()=>{
  let sign=preset('entrance-guide');
  const t=Catalog.get('no-smoking');
  sign=S.addTemplateRow(sign,sign.rows[0].id,C.materialize(t.id,undefined,measure),{templateId:t.id,widthRatio:t.width/t.height});
  near(sign.rows[0].widthRatio,10);near(sign.rows[1].widthRatio,2/3);
  const old=S.createSign(),flow=S.addElement(old,old.rows[0].id,S.createElement('bilingual-text'));
  assert.equal(flow.rows[0].widthRatio,undefined);
  assert.deepEqual(S.deserializeSign(S.serializeSign(flow)),flow);
});
test('目录与类型入口移除时刻表、地图和指定三款标识，线路图仍可添加',()=>{
  const removed=['first-last-train','interconnection-timetable','network-map','network-map-double','street-map','evacuation-map'];
  assert.equal(Catalog.ALL.length,82);
  removed.forEach(id=>assert.ok(!Catalog.ALL.some(t=>t.id===id),id));
  assert.deepEqual(C.SECTIONS.map(s=>s.id),['horizontal','vertical','route','safety']);
  assert.ok(Catalog.ALL.some(t=>t.id==='route-vertical'));
  for(const id of ['entrance-identity','gate-indicator','fare-information']){
    assert.equal(Catalog.ALL.some(t=>t.id===id),false,id);
    assert.equal(Catalog.get(id).id,id);
  }
  removed.forEach(id=>assert.equal(Catalog.get(id).id,id,'旧项目仍应能恢复'));
});
