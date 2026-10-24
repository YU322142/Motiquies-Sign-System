import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
for (const name of ['core','icons','crt-symbols','crt-catalog','crt-render','state','render','composition','routes','workspace','sign-content'])
  (0,eval)(readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8'));
const {SignState:S,SignRoutes:R,SignContent:C,SignWorkspace:W}=globalThis;
const measure=(text,font,weight,size)=>Array.from(String(text)).length*size*.6;
measure.ink=(text,font,weight,size)=>({abl:0,abr:measure(text,font,weight,size),adv:measure(text,font,weight,size)});
measure.ascent=(text,font,weight,size)=>size*.8;measure.descent=(text,font,weight,size)=>size*.2;
function setup(){
 const line=R.createLine({id:'spruce',nameZh:'云杉线',nameEn:'Spruce Line',color:'#592C82',direction:'backward',currentStationId:'a',stations:[
  {id:'a',nameZh:'同名站',nameEn:'West Common',code:'01',transfers:''},
  {id:'b',nameZh:'同名站',nameEn:'East Common',code:'02',transfers:'72号线'}]});
 const other=R.createLine({id:'orange',nameZh:'72号线',nameEn:'Line 72',color:'#F27019'});
 return {line,other,context:{line,stationId:'b',source:'local'}};
}
test('标准线路图用完整线路快照与ID本站，添加与拖入共享配方',()=>{
 const {line,other,context}=setup(),before=JSON.stringify(context);
 const result=C.build('route-vertical-double',context,[line,other],measure);
 assert.equal(result.options.route.line.currentStationId,'b');
 assert.equal(result.options.route.line.direction,'backward');
 assert.equal(result.options.route.source,'local');
 assert.equal(result.options.route.line.relatedLines[0].color,'#F27019');
 assert.equal(result.options.stationContext.stationId,'b');
 assert.equal(result.options.templateId,'route-vertical-double');
 assert.equal(JSON.stringify(context),before);
});
test('换乘选择从已有线路取得完整名称及本色，不把本站线路当换乘线',()=>{
 const {line,other,context}=setup();
 const selected={...context,transferLineIds:[other.id]};
 const result=C.build('transfer-wall',selected,[line,other],measure);
 assert.ok(result.elements.some(el=>el.type==='number-line'&&el.props.lines[0].number==='72'&&el.props.lines[0].color==='#F27019'));
 assert.deepEqual(result.options.stationContext.transferLineIds,[other.id]);
});
test('批量更换仅作用于指定牌面，保留原牌型、手动比例、活动牌和共享车站',()=>{
 const {line,other,context}=setup(),lines=[line,other];
 const first=C.build('station-name-vertical',{...context,stationId:'a'},lines,measure);
 let sign=W.addPreset(S.createSign(),first.elements,{...first.options,name:'第一牌'});
 const firstBoard=W.list(sign)[0].id,firstRow=sign.rows[0].id;
 sign=S.setProjectContext(sign,{...context,stationId:'a'});
 sign=S.setRowAspectRatio(sign,firstRow,0.4);
 const second=C.build('transfer-wall',{...context,stationId:'a'},lines,measure);
 sign=W.addPreset(sign,second.elements,{...second.options,name:'第二牌'});
 const secondBoard=W.list(sign).find(b=>b.active).id;
 const before=JSON.stringify(sign),selected=C.replaceBoards(sign,[firstBoard],context,lines,measure);
 assert.equal(JSON.stringify(sign),before);
 assert.equal(selected.workspace.activeId,secondBoard);
 assert.equal(selected.context.stationId,'a');
 const boards=W.list(selected),firstAfter=boards.find(b=>b.id===firstBoard).sign.rows[0];
 assert.equal(firstAfter.id,firstRow);
 assert.equal(firstAfter.widthRatio,0.4);
 assert.equal(firstAfter.templateId,'station-name-vertical');
 assert.equal(firstAfter.stationContext.stationId,'b');
 assert.deepEqual(boards.find(b=>b.id===secondBoard).sign.rows,sign.rows);
 assert.deepEqual(S.deserializeSign(S.serializeSign(selected)),selected);
});
test('已有牌面选站保留固定输出宽度模式',()=>{
 const {line,other,context}=setup(),lines=[line,other],content=C.build('station-name',context,lines,measure);
 let sign=W.addPreset(S.createSign(),content.elements,content.options);
 sign=S.updateSignSettings(sign,{widthMode:'fixed',width:2200});
 const next=C.replaceRow(sign,sign.rows[0].id,{...context,stationId:'a'},lines,measure);
 assert.equal(next.widthMode,'fixed');assert.equal(next.width,2200);
});
test('单侧和岛式方向牌的牌面底色也保存选用线路主题色',()=>{
 const {line,other,context}=setup();
 for(const id of ['platform-direction-single','platform-direction-split']) {
  assert.equal(C.build(id,context,[line,other],measure).options.backgroundColor,line.color);
 }
});
test('明确勾选换乘线时，同名的其他已保存线路不会抢走颜色',()=>{
 const {line,other,context}=setup();
 const older=R.createLine({...other,id:'same-name',color:'#0055AA'});
 const content=C.build('transfer-wall',{...context,transferLineIds:[other.id]},[line,older,other],measure);
 assert.ok(content.elements.some(el=>el.type==='number-line'&&el.props.lines[0].color===other.color));
});
