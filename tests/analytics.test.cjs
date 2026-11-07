const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const original = readFileSync('js/analytics.js', 'utf8');
function boot({active=true, redirect, search=''}={}) {
  const handlers={}, tags=[], timers=[], navigations=[];
  const window={};
  const location={hostname:'ths-fb.github.io',origin:'https://ths-fb.github.io',pathname:'/digital/sponsors/',href:'https://ths-fb.github.io/digital/sponsors/',search,assign:u=>navigations.push(u),replace:u=>navigations.push(u)};
  const document={body:{dataset:{sponsorRedirect:redirect}},head:{appendChild:t=>tags.push(t)},createElement:()=>({}),addEventListener:(name,fn)=>handlers[name]=fn};
  vm.runInNewContext(active ? original.replace('const MEASUREMENT_ID = ""','const MEASUREMENT_ID = "G-TEST123"') : original,{window,document,location,URL,URLSearchParams,setTimeout:fn=>timers.push(fn)});
  return {window,handlers,tags,timers,navigations};
}
function click(state,{url='https://www.elizabethwarerealtors.com/?utm_source=RADIO',target='_blank',page,button=0,type='click'}={}) {
  const link={href:url,target,closest:()=>page?{dataset:{pageNumber:page}}:null,hasAttribute:()=>false};
  let prevented=false;
  state.handlers[type]({target:{closest:()=>link},button,type,preventDefault:()=>prevented=true});
  return prevented;
}
const off=boot({active:false}); click(off); assert.equal(off.tags.length,0);assert.equal(off.window.dataLayer,undefined);
const on=boot(); assert.equal(on.tags.length,1);assert.equal(on.window.dataLayer[1][2].send_page_view,true);
click(on,{page:'2'});let event=on.window.dataLayer.at(-1);assert.equal(event[1],'sponsor_click');assert.equal(event[2].sponsor_id,'elizabeth-ware');assert.equal(event[2].program_page,'2');assert.equal(event[2].placement,'online_program');
const before=on.window.dataLayer.length;click(on,{url:'https://example.com'});click(on,{url:'https://share.google/another-business'});click(on,{url:'https://ths-fb.github.io/digital/go/elizabeth-ware/'});assert.equal(on.window.dataLayer.length,before);
click(on,{type:'auxclick',button:1});assert.equal(on.window.dataLayer.length,before+1);
assert.equal(click(on,{target:'_self'}),true); on.timers.at(-1)();on.window.dataLayer.at(-1)[2].event_callback();assert.equal(on.navigations.length,1);
const redirect=boot({redirect:'elizabeth-ware',search:'?from=pdf'});assert.equal(redirect.window.dataLayer[1][2].send_page_view,false);assert.equal(redirect.window.dataLayer.at(-1)[2].placement,'pdf');redirect.timers[0]();redirect.window.dataLayer.at(-1)[2].event_callback();assert.equal(redirect.navigations.length,1);assert.match(redirect.navigations[0],/utm_source=RADIO/);
const inactiveRedirect=boot({active:false,redirect:'sovah'});assert.equal(inactiveRedirect.navigations.length,1);
console.log('PASS: disabled mode, page-view setup, named sponsor and PDF clicks, unrelated links, middle clicks, same-tab fallback, redirect deduplication, UTM preservation.');
