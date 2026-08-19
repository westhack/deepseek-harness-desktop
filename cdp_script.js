const http = require('http');

const SCRIPT_TO_EXECUTE = "(() => {\n  const labels = document.querySelectorAll('.n-tabs-tab__label');\n  const result = [];\n  result.push('count=' + labels.length);\n  labels.forEach((el, i) => {\n    result.push('tab[' + i + '].textContent=' + JSON.stringify(el.textContent));\n    result.push('tab[' + i + '].innerHTML=' + JSON.stringify(el.innerHTML));\n    result.push('tab[' + i + '].childElementCount=' + el.childElementCount);\n  });\n  const rail = document.querySelector('.n-tabs-rail');\n  result.push('rail.innerHTML length=' + (rail ? rail.innerHTML.length : 'no rail'));\n  result.push('rail.innerText=' + JSON.stringify(rail ? rail.innerText : 'no rail'));\n  return result.join('\\n');\n})();";

function getTargets() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('Parse: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('CDP connect timeout')));
  });
}

function connectAndEvaluate(wsUrl) {
  return new Promise((resolve, reject) => {
    let WebSocketCtor;
    try { WebSocketCtor = globalThis.WebSocket || require('ws'); } catch(e) { return reject(new Error('No WS: ' + e.message)); }
    const ws = new WebSocketCtor(wsUrl);
    let msgId = 0;
    const pending = new Map();
    let done = false;
    const cleanup = () => { done = true; try { ws.close(); } catch(e){} };
    const onOpen = async () => {
      try {
        console.log('WS connected. Waiting 4s for Vue mount...');
        await new Promise(r => setTimeout(r, 4000));
        msgId++; pending.set(msgId, {resolve:()=>{}, reject});
        ws.send(JSON.stringify({id: msgId, method:'Runtime.enable'}));
        msgId++;
        const eid = msgId;
        pending.set(eid, {resolve, reject});
        ws.send(JSON.stringify({id: eid, method:'Runtime.evaluate', params:{expression: SCRIPT_TO_EXECUTE, returnByValue:true, awaitPromise:true}}));
        setTimeout(() => { if(!done){cleanup(); reject(new Error('Eval timeout'));} }, 20000);
      } catch(e) { cleanup(); reject(e); }
    };
    const onMsg = (input) => {
      try {
        const raw = typeof input==='string' ? input : (input && input.data ? input.data : input.toString());
        const msg = JSON.parse(raw);
        if (pending.has(msg.id)) {
          const p = pending.get(msg.id); pending.delete(msg.id);
          if (msg.error) p.reject(new Error('CDP: '+JSON.stringify(msg.error)));
          else p.resolve(msg.result);
          if (msg.id !== 1) setTimeout(cleanup, 100);
        }
      } catch(e) { console.error('msg err', e.message); }
    };
    if (typeof ws.addEventListener === 'function') {
      ws.addEventListener('open', onOpen);
      ws.addEventListener('message', onMsg);
      ws.addEventListener('error', ()=>{cleanup(); reject(new Error('WS err'));});
      ws.addEventListener('close', ()=>{if(!done){cleanup(); reject(new Error('WS closed'));}});
    } else {
      ws.on('open', onOpen); ws.on('message', onMsg);
      ws.on('error', ()=>{cleanup(); reject(new Error('WS err'));});
      ws.on('close', ()=>{if(!done){cleanup(); reject(new Error('WS closed'));}});
    }
  });
}

(async () => {
  try {
    const targets = await getTargets();
    console.log('Targets: '+targets.length);
    let t = targets.find(x=>x.type==='page'&&x.url&&x.url.includes('127.0.0.1:5174')) || targets.find(x=>x.type==='page');
    if (!t) { console.log(JSON.stringify(targets,null,2)); throw new Error('No page'); }
    console.log('Target URL: '+t.url);
    const r = await connectAndEvaluate(t.webSocketDebuggerUrl);
    console.log('\n===CDP_RAW_START===');
    console.log(JSON.stringify(r, null, 2));
    console.log('===CDP_RAW_END===');
    if (r && r.result) {
      if (r.result.type === 'string') {
        console.log('\n===CONSOLE_OUTPUT_START===');
        process.stdout.write(r.result.value);
        process.stdout.write('\n');
        console.log('===CONSOLE_OUTPUT_END===');
      } else if (r.result.value !== undefined) {
        console.log('\n===CONSOLE_OUTPUT_START===');
        process.stdout.write(String(r.result.value));
        process.stdout.write('\n');
        console.log('===CONSOLE_OUTPUT_END===');
      }
    }
    process.exit(0);
  } catch(e) {
    console.error('FATAL: '+e.message); console.error(e.stack); process.exit(1);
  }
})();
