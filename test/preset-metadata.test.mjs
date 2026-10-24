import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const data=new Map();
globalThis.localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
for(const name of ['core','crt-catalog','state','presets']) (0,eval)(readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8'));
const {SignState:S,SignPresets:P}=globalThis;
test('行预设保存用户比例与参考比例，点击和拖入都可恢复独立副本',()=>{
  const row={layout:'flow',widthRatio:8,referenceWidthRatio:5.25,templateId:'concourse-exit',backgroundColor:'#F7D917',
    elements:[S.createElement('exit')]};
  P.save('出口8比1',row.elements,row);
  const saved=P.list().at(-1);
  assert.equal(saved.row.widthRatio,8);assert.equal(saved.row.referenceWidthRatio,5.25);
  assert.equal(saved.row.templateId,'concourse-exit');
  const parts=P.materialize(saved.id),sign=S.addTemplateRow(S.createSign(),null,parts,saved.row);
  assert.equal(sign.rows[0].widthRatio,8);assert.equal(sign.rows[0].referenceWidthRatio,5.25);
  assert.notEqual(parts[0].id,row.elements[0].id);
  assert.deepEqual(S.deserializeSign(S.serializeSign(sign)),sign);
  assert.equal(row.elements[0].props.code,'1');
});
