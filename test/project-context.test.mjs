import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
for(const name of ['core','icons','crt-symbols','crt-catalog','state','render','composition','routes','crt-render'])
  (0,eval)(readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8'));
const {SignState:S,SignRoutes:L,SignComposition:C,SignCRT:Catalog}=globalThis;
function context(){const line=L.createLine({nameZh:'云间线',nameEn:'Cloud Line',color:'#7B2CBF',stations:[
  {nameZh:'星港',nameEn:'Starport',code:'01',transfers:'9号线'},
  {nameZh:'云谷',nameEn:'Cloud Valley',code:'02'},
  {nameZh:'月台',nameEn:'Moon Terrace',code:'03'}]});return {line,stationId:line.stations[0].id};}
test('虚构线路和当前车站属于项目，切换车站不可变且JSON恢复保留全部线路资料',()=>{
  const ctx=context(),original=S.createSign(),before=JSON.stringify(original);
  const sign=S.setProjectContext(original,ctx);
  assert.equal(JSON.stringify(original),before);
  assert.deepEqual(S.deserializeSign(S.serializeSign(sign)),sign);
  const changed=S.setProjectContext(sign,{line:ctx.line,stationId:ctx.line.stations[1].id});
  assert.equal(sign.context.stationId,ctx.stationId);assert.equal(changed.context.stationId,ctx.line.stations[1].id);
  assert.equal(S.setProjectContext(sign,null).context,undefined);
});
test('站名、门楣、乘车和运行方向从当前虚构线填入，出口编号保持独立',()=>{
  const ctx=context();
  for(const id of ['station-name','station-name-vertical','entrance-lintel','entrance-identity','train-guide','platform-direction','platform-direction-split','route-vertical']){
    const props=C.contextOverrides(Catalog.get(id),ctx);
    assert.equal(props.lineColorMode,'custom');assert.equal(props.lineColor,'#7B2CBF');
    if(id==='station-name'||id==='station-name-vertical'){
      assert.equal(props.fields.title,'星港');assert.equal(props.fields.subtitle,'Starport');assert.equal(props.fields.code,'01');
    }
    if(id==='entrance-lintel'||id==='entrance-identity'){
      assert.equal(props.fields.title,'星港');assert.equal(props.fields.code,undefined);
    }
    if(id.startsWith('platform-direction'))assert.ok(props.fields.title.includes('月台'));
    if(id==='route-vertical')assert.equal(props.fields.stations,'星港|Starport|01\n云谷|Cloud Valley|02\n月台|Moon Terrace|03');
  }
  const exit=C.contextOverrides(Catalog.get('concourse-exit'),ctx);
  assert.equal(exit.fields.code,undefined);assert.equal(exit.fields.title,undefined);
  assert.equal(C.contextOverrides(Catalog.get('restroom'),ctx).fields.title,undefined);
  assert.equal(C.contextOverrides(Catalog.get('no-smoking'),ctx).fields.title,undefined);
});
test('自创数字线路保留自选颜色，基础站名和线路元素不带标准示例',()=>{
  const ctx=context();ctx.line.nameZh='9号线';ctx.line.nameEn='Line Nine';
  const lineProps=C.contextProps('number-line',undefined,ctx);
  assert.deepEqual(lineProps.lines,[{number:'9',color:'#7B2CBF'}]);assert.equal(lineProps.lineColorMode,'custom');
  const el=S.createElement('number-line',lineProps);
  let sign=S.createSign();sign=S.addElement(sign,sign.rows[0].id,el);
  assert.deepEqual(S.deserializeSign(S.serializeSign(sign)),sign);
  assert.equal(C.contextProps('bilingual-text',undefined,ctx).textZh,'星港');
  assert.equal(C.contextProps('bilingual-text',undefined,ctx).textEn,'Starport');
  assert.deepEqual(C.contextProps('plain-text',{text:'安全说明'},ctx),{text:'安全说明'});
  assert.deepEqual(C.contextOverrides(Catalog.get('station-name'),null),{});
});
test('虚构线路换乘牌逐线使用识别色，独立文件恢复后仍可正确排版',()=>{
  let ctx=context();ctx.line.nameZh='9号线';
  ctx.line.stations[0].transfers='10号线 / 星环线';
  const orange=L.createLine({id:'orange',nameZh:'10号线',nameEn:'Line 10',color:'#EE8800'});
  const green=L.createLine({id:'green',nameZh:'星环线',nameEn:'Star Loop',color:'#008855'});
  ctx.line=L.withRelatedLines(ctx.line,[orange,green]);
  const restored=L.deserialize(L.serialize(ctx.line));
  const template=Catalog.get('transfer-wall');
  const props=C.contextOverrides(template,{line:restored,stationId:ctx.stationId});
  const measure=(text,font,weight,size)=>String(text).length*size*.6;
  measure.ink=(text,font,weight,size)=>({abl:0,abr:measure(text,font,weight,size),adv:measure(text,font,weight,size)});
  measure.ascent=(text,font,weight,size)=>size*.8;measure.descent=(text,font,weight,size)=>size*.2;
  const elements=C.materialize(template.id,props,measure);
  assert.ok(elements.some(el=>el.type==='number-line'&&el.props.lines[0].number==='10'&&el.props.lines[0].color==='#EE8800'));
  assert.ok(elements.some(el=>el.type==='text-line'&&el.props.text==='星环'&&el.props.blockColor==='#008855'));
  for(const orientation of ['horizontal','vertical']){
    const route=L.materialize(restored,orientation,measure);
    assert.ok(route.elements.some(el=>el.type==='plain-text'&&el.props.text==='10号线'&&el.props.color==='#EE8800'));
    assert.ok(route.elements.some(el=>el.type==='plain-text'&&el.props.text==='星环线'&&el.props.color==='#008855'));
  }
});

test('门套换乘从当前站填入换乘线路，保留线路单位英文而不使用本站线路名',()=>{
  const ctx=context();
  ctx.line.stations[0].transfers='10号线';
  for(const id of ['transfer-doorhead','transfer-doorpost','transfer-doorpost-multiline']){
    const fields=C.contextOverrides(Catalog.get(id),ctx).fields;
    assert.equal(fields.line,'10号线');
    assert.equal(fields.lineEn,'Line');
    assert.equal(fields.labelZh,'号线');
  }
  ctx.line.stations[0].transfers='星环线';
  const named=C.contextOverrides(Catalog.get('transfer-doorpost'),ctx).fields;
  assert.equal(named.labelZh,'线');
  assert.equal(named.lineEn,'Line');
});
