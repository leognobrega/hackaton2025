
(function(){
  const user = sessionStorage.getItem('gmu_user') || 'Operador';
  const role = sessionStorage.getItem('gmu_role') || 'Comando';
  // Always use dark theme
  document.documentElement.setAttribute('data-bs-theme', 'dark');
  document.getElementById('userBadge').textContent = `${user} • ${role}`;

  // Logger
  const logEl = document.getElementById('log');
  window.LOG = (msg)=>{
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.textContent = `[${time}] ${msg}`;
    logEl.prepend(div);
  };
  LOG('Painel iniciado');

  // Leaflet map
  const map = L.map('map').setView([CENTER.lat, CENTER.lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // Ensure the map renders if the container was hidden/changed size (fix for some embeds)
  map.whenReady(()=> setTimeout(()=> map.invalidateSize(), 200));
  window.addEventListener('resize', ()=> map.invalidateSize());

  // Heat layer (default to Alça Nilson heat zone) — use larger radius and smoother blur for softer, wider heat
  let heatData = gerarCalor('alca_nilson');
  const heatOptions = { radius: 45, blur: 30, maxZoom: 17, minOpacity: 0.25 }; // larger radius + more blur + gentle minimum opacity
  let heat = L.heatLayer(heatData, heatOptions).addTo(map);
  window.EVENTO='alca_nilson';

  // Cameras e barreiras (mock como círculos)
  const layerCameras = L.layerGroup([
    L.circle([CENTER.lat+0.001, CENTER.lng-0.002], {radius: 50, color:'#0dcaf0'}),
    L.circle([CENTER.lat-0.001, CENTER.lng+0.0015], {radius: 50, color:'#0dcaf0'}),
  ]).addTo(map);
  const layerBarreiras = L.layerGroup([
    L.rectangle([[CENTER.lat+0.002, CENTER.lng-0.003],[CENTER.lat+0.0022, CENTER.lng-0.002]], {color:'#ffc107'}),
    L.rectangle([[CENTER.lat-0.002, CENTER.lng+0.002],[CENTER.lat-0.0018, CENTER.lng+0.0028]], {color:'#ffc107'})
  ]).addTo(map);

  // Unidades (marcadores)
  const unitMarkers = new Map();
  function drawUnits(){
    for(const u of unidades){
      let m = unitMarkers.get(u.id);
      const latlng = [u.pos.lat, u.pos.lng];
      // choose a visual based on type
      let marker;
  // Use emojis for markers (larger and styled via CSS)
  const emojiVehicle = `<div class="emoji">🚓</div>`;
  const emojiAgent = `<div class="emoji">👮</div>`;
  const emojiK9 = `<div class="emoji">🐕</div>`;
  const emojiDrone = `<div class="emoji">🚁</div>`;

      if(u.type==='camera'){
        marker = L.circleMarker(latlng, { radius:6, color:'#0dcaf0', fillColor:'#0dcaf0', fillOpacity:0.9 });
      } else if(u.type==='vehicle'){
        marker = L.marker(latlng, { icon: L.divIcon({ className:'unit-icon vehicle', html: emojiVehicle, iconSize:[40,40], iconAnchor:[20,20] }) });
      } else if(u.type==='drone'){
        marker = L.marker(latlng, { icon: L.divIcon({ className:'unit-icon drone', html: emojiDrone, iconSize:[36,36], iconAnchor:[18,18] }) });
      } else if(u.type==='k9'){
        marker = L.marker(latlng, { icon: L.divIcon({ className:'unit-icon k9', html: emojiK9, iconSize:[30,30], iconAnchor:[15,15] }) });
      } else { // agent, default
        marker = L.marker(latlng, { icon: L.divIcon({ className:'unit-icon agent', html: emojiAgent, iconSize:[32,32], iconAnchor:[16,16] }) });
      }

      if(!m){
        marker.addTo(map).bindPopup(`<b>${u.id}</b><br>${u.equipe}<br><small>${u.status}</small>`);
        unitMarkers.set(u.id, marker);
      } else {
        // replace or move existing marker
        try { unitMarkers.get(u.id).setLatLng(latlng); unitMarkers.get(u.id).setPopupContent(`<b>${u.id}</b><br>${u.equipe}<br><small>${u.status}</small>`); }
        catch(e){ unitMarkers.get(u.id).remove(); marker.addTo(map).bindPopup(`<b>${u.id}</b><br>${u.equipe}<br><small>${u.status}</small>`); unitMarkers.set(u.id, marker); }
      }
    }
  }
  drawUnits();
  document.addEventListener('unit:move', drawUnits);

  // subtle pulse on random vehicles to highlight activity
  setInterval(()=>{
    const vehicleKeys = Array.from(unitMarkers.keys()).filter(k=> k.startsWith('VTR'));
    if(vehicleKeys.length===0) return;
    // clear previous pulses
    for(const k of vehicleKeys){ const el = unitMarkers.get(k)?.getElement?.(); if(el) el.classList.remove('pulse'); }
    // pick 3 random vehicles
    for(let i=0;i<3;i++){
      const key = vehicleKeys[Math.floor(Math.random()*vehicleKeys.length)];
      const m = unitMarkers.get(key);
      const el = m && m.getElement && m.getElement();
      if(el) el.classList.add('pulse');
    }
  }, 2500);

  // Ocorrências (lista e interação)
  const listaOc = document.getElementById('listaOcorrencias');
  function renderOcorrencias(){
    if(!listaOc) return; // guard: if the occurrences list element was removed, avoid JS errors
    listaOc.innerHTML='';
    for(const o of ocorrencias){
      const item = document.createElement('a');
      item.href='#';
      item.className='list-group-item list-group-item-action';
      item.innerHTML = `<div class="d-flex w-100 justify-content-between">
        <h6 class="mb-1">#${o.id} — ${o.tipo}</h6>
        <small class="text-${o.risco==='Alto'?'danger':o.risco==='Médio'?'warning':'secondary'}">${o.risco}</small>
      </div>
      <div class="small text-muted">${o.status || ''}</div>`;
      item.addEventListener('click', (e)=>{
        e.preventDefault();
        map.setView([o.lat, o.lng], 16);
        L.popup().setLatLng([o.lat, o.lng]).setContent(`<b>Ocorrência #${o.id}</b><br>${o.tipo} — Risco ${o.risco}`).openOn(map);
      });
      listaOc.appendChild(item);
    }
  }
  renderOcorrencias();

  // Open occurrences dashboard
  const occChartEl = document.getElementById('chartCriticidade');
  let occChart = null;
  function updateOccChart(){
    if(!occChartEl) return;
    const counts = { Baixo:0, Médio:0, Alto:0 };
    for(const o of ocorrencias){ if(o.status && o.status.toLowerCase().includes('fechado')) continue; const r = o.risco || 'Baixo'; counts[r] = (counts[r]||0)+1; }
    const labels = ['Baixo','Médio','Alto'];
    const data = labels.map(l=>counts[l]||0);
    if(occChart) { occChart.data.labels = labels; occChart.data.datasets[0].data = data; occChart.update(); }
    else { occChart = new Chart(occChartEl, { type:'bar', data:{ labels, datasets:[{ label:'Quantidade', data, backgroundColor:['#6c757d','#ffc107','#dc3545'] }] }, options:{ plugins:{ legend:{display:false} }, scales:{ y:{ beginAtZero:true } } } }); }
  }

  function renderOpenOccurrences(){
    const list = document.getElementById('openOccList');
    if(!list) return;
    list.innerHTML = '';
    // show open occurrences, most recent first
    const open = ocorrencias.filter(o=> !(o.status && o.status.toLowerCase().includes('fechado')));
    for(const o of open){
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-start';
      a.innerHTML = `<div class="ms-1 me-auto">
          <div class="fw-semibold">#${o.id} — ${o.tipo}</div>
          <div class="small text-muted">${o.status || ''}</div>
        </div>
        <div class="text-end"><span class="badge text-bg-${o.risco==='Alto'?'danger':o.risco==='Médio'?'warning':'secondary'}">${o.risco || 'Baixo'}</span></div>`;
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        if(o.lat && o.lng){
          map.setView([o.lat, o.lng], 16);
          L.popup().setLatLng([o.lat, o.lng]).setContent(`<b>Ocorrência #${o.id}</b><br>${o.tipo} — Risco ${o.risco}`).openOn(map);
        }
      });
      list.appendChild(a);
    }
  }

  // wire into existing flows
  const oldSim = window.simularOcorrencia;
  if(typeof oldSim === 'function'){
    window.simularOcorrencia = function(){ oldSim(); refreshKPIs(); updateOccChart(); renderOpenOccurrences(); }
  }
  // also update after manual changes
  const origCreateOc = document.getElementById('btnCreateOc');
  if(origCreateOc){ origCreateOc.addEventListener('click', ()=>{ setTimeout(()=>{ updateOccChart(); renderOpenOccurrences(); }, 200); }); }

  // initial render
  updateOccChart(); renderOpenOccurrences();

  // Compact occurrences panel (floating)
  const ocCompact = document.getElementById('oc-list-compact');
  const ocPanel = document.getElementById('oc-panel');
  const ocToggle = document.getElementById('oc-toggle');

  function renderCompact(){
    if(!ocCompact) return;
    ocCompact.innerHTML = '';
    const top = ocorrencias.slice(0,3);
    if(top.length===0){ ocCompact.innerHTML = '<div class="p-2 text-muted">Sem ocorrências</div>'; return; }
    for(const o of top){
      const div = document.createElement('div');
      div.className = 'oc-item border';
      div.innerHTML = `<div class="d-flex justify-content-between"><div><strong>#${o.id}</strong> <small class="text-muted">${o.tipo}</small></div><div><small class="text-${o.risco==='Alto'?'danger':o.risco==='Médio'?'warning':'secondary'}">${o.risco}</small></div></div>`;
      div.addEventListener('click', ()=>{ map.setView([o.lat, o.lng], 16); L.popup().setLatLng([o.lat,o.lng]).setContent(`<b>Ocorrência #${o.id}</b><br>${o.tipo} — ${o.status}`).openOn(map); });
      ocCompact.appendChild(div);
    }
  }
  renderCompact();

  // Update compact panel when occurrences change
  const origSimular = window.simularOcorrencia;
  if(typeof origSimular === 'function'){
    window.simularOcorrencia = function(){ origSimular(); renderOcorrencias(); renderCompact(); refreshKPIs(); }
  }

  if(ocToggle) ocToggle.addEventListener('click', ()=>{ ocPanel.classList.toggle('collapsed'); ocCompact.style.display = ocPanel.classList.contains('collapsed') ? 'none' : 'block'; });

  // KPIs
  function refreshKPIs(){
    document.getElementById('kpiPublico').textContent = estimarPublico(heatData).toLocaleString('pt-BR');
    document.getElementById('kpiOcorrencias').textContent = ocorrencias.length;
    document.getElementById('kpiRisco').textContent = riscoAtual();
    document.getElementById('kpiUnidades').textContent = unidades.length;
  }
  refreshKPIs();

  // Botões
  document.getElementById('btnRecalcular').addEventListener('click', ()=>{
    heatData = gerarCalor(window.EVENTO);
    // replace data while preserving options (some heat plugins require recreating the layer for option changes)
    if(heat && typeof heat.setLatLngs === 'function'){
      heat.setLatLngs(heatData);
    } else {
      if(heat) map.removeLayer(heat);
      heat = L.heatLayer(heatData, heatOptions).addTo(map);
    }
    LOG('Mapa de calor recalculado a partir do drone');
    refreshKPIs();
  });

  document.getElementById('btnCentralizar').addEventListener('click', ()=>{
    map.setView([CENTER.lat, CENTER.lng], 14);
  });

  document.getElementById('btnDespachar').addEventListener('click', ()=>{
    const alvo = incidenteMaisCritico();
    if(!alvo){ return; }
    const unit = unidadeMaisProxima(alvo.lat, alvo.lng);
    if(!unit){ return; }
    LOG(`Despacho: ${unit.id} -> Ocorrência #${alvo.id}`);
    unit.status = `Em deslocamento para #${alvo.id}`;
    moverUnidade(unit, alvo.lat, alvo.lng);
    renderOcorrencias();
    refreshKPIs();
  });

  // Filtros e camadas
  document.getElementById('selEvento').addEventListener('change', (e)=>{
    const val = e.target.value; window.EVENTO = val;
    heatData = gerarCalor(val);
    if(heat && typeof heat.setLatLngs === 'function'){
      heat.setLatLngs(heatData);
    } else {
      if(heat) map.removeLayer(heat);
      heat = L.heatLayer(heatData, heatOptions).addTo(map);
    }
    refreshKPIs();
    LOG(`Evento selecionado: ${e.target.options[e.target.selectedIndex].text}`);
  });

  document.getElementById('layerHeat').addEventListener('change', (e)=>{
    if(e.target.checked){ heat.addTo(map); LOG('Camada: calor ON'); } else { map.removeLayer(heat); LOG('Camada: calor OFF'); }
  });
  document.getElementById('layerCameras').addEventListener('change', (e)=>{
    if(e.target.checked){ layerCameras.addTo(map); } else { map.removeLayer(layerCameras); }
  });
  document.getElementById('layerBarreiras').addEventListener('change', (e)=>{
    if(e.target.checked){ layerBarreiras.addTo(map); } else { map.removeLayer(layerBarreiras); }
  });

  // Comunicação
  document.getElementById('enviar').addEventListener('click', ()=>{
    const v = document.getElementById('msg').value.trim();
    const dest = document.getElementById('selDestino') ? document.getElementById('selDestino').value : 'GM';
    if(!v) return;
    LOG(`${user} → ${dest}: ${v}`);
    // if message suggests an occurrence, create a quick occurrence at map center
    const lower = v.toLowerCase();
    if(lower.includes('ocorr') || lower.includes('acidente') || lower.includes('ferido')){
      const center = map.getCenter();
      const novo = { id: Math.floor(Math.random()*9000+1000), tipo: 'Reportado via comunicação', risco: 'Médio', lat: center.lat, lng: center.lng, status: `Notificado: ${dest}` };
      ocorrencias.unshift(novo);
      renderOcorrencias(); renderCompact(); refreshKPIs();
      LOG(`Ocorrência criada e enviada para ${dest} (proximidade do centro do mapa)`);
    }
    document.getElementById('msg').value='';
  });

  document.getElementById('btnExportarLog').addEventListener('click', ()=>{
    const lines = Array.from(logEl.querySelectorAll('div')).map(d=>d.textContent).reverse();
    // Use CRLF for Windows/Notepad compatibility
    const newline = '\r\n';
    const blob = new Blob([lines.join(newline)], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'log-operacao.txt'; a.click();
    URL.revokeObjectURL(url);
  });

  // Atualizações periódicas
  setInterval(()=>{
    simularOcorrencia();
    refreshKPIs();
    updateOccChart();
    renderOpenOccurrences();
  }, 6000);

  // Charts
  const elTipos = document.getElementById('chartTipos');
  if(elTipos){ new Chart(elTipos, {
    type: 'bar',
    data: { labels: histTipos.labels, datasets: [{ label:'Qtd', data: histTipos.valores, backgroundColor: '#1f7aed' }] },
    options: { plugins:{ legend:{display:false} }, scales:{ y:{ beginAtZero:true } } }
  }); }
  const elPublico = document.getElementById('chartPublico');
  if(elPublico){ new Chart(elPublico, {
    type: 'line',
    data: { labels: histPublico.labels, datasets: [{ label:'Público', data: histPublico.valores, borderColor:'#0dcaf0' }] },
    options: { plugins:{ legend:{display:false} }, scales:{ y:{ beginAtZero:false } } }
  }); }

  // --- Geocode by CEP + número (ViaCEP -> Nominatim) and center map
  async function geocodeCep(cep, numero=''){
    try{
      const cepClean = (cep||'').replace(/\D/g,'');
      if(cepClean.length!==8) throw new Error('CEP inválido');
      const via = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`).then(r=>r.json());
      if(via.erro) throw new Error('CEP não encontrado');
      const address = `${via.logradouro || ''} ${numero} - ${via.bairro || ''} ${via.localidade} ${via.uf}`;
      // Use Nominatim to geocode
      const q = encodeURIComponent(address + ' Brasil');
      const nom = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&limit=1`).then(r=>r.json());
      if(!nom || nom.length===0) throw new Error('Geocoding vazio');
      const loc = nom[0];
      const lat = parseFloat(loc.lat), lon = parseFloat(loc.lon);
      map.setView([lat, lon], 17);
      L.marker([lat, lon]).addTo(map).bindPopup(`<b>Endereço</b><br>${address}`).openPopup();
      LOG(`Centralizado em: ${address}`);
      return { lat, lon, address };
    }catch(err){ LOG('Erro geocoding: '+err.message); return null; }
  }

  // On load: center to requested CEP 13331-630, nº 2800 as requested
  (async ()=>{ await geocodeCep('13331-630','2800'); })();

  // --- Simple prediction UI
  const predBtn = document.getElementById('btnPredict');
  const clearHist = document.getElementById('btnClearHist');
  const histInput = document.getElementById('hist-input');
  const predResult = document.getElementById('pred-result');
  const ctxPred = document.getElementById('chartPredicao');
  let predChart = null;

  function parseNumbers(text){
    const parts = text.split(/[,\n;]/).map(s=>s.trim()).filter(Boolean);
    return parts.map(p=> Number(p)).filter(n=>!Number.isNaN(n));
  }

  function simpleLinearForecast(data, steps=6){
    // fit slope via simple linear regression
    const n = data.length;
    if(n<2) return [];
    const xs = data.map((_,i)=>i);
    const meanX = (n-1)/2;
    const meanY = data.reduce((a,b)=>a+b,0)/n;
    let num=0, den=0;
    for(let i=0;i<n;i++){ num += (xs[i]-meanX)*(data[i]-meanY); den += (xs[i]-meanX)*(xs[i]-meanX); }
    const slope = den===0?0:num/den; const intercept = meanY - slope*meanX;
    const preds = [];
    for(let t=0;t<steps;t++){ const x = n + t; preds.push(intercept + slope*x); }
    return preds;
  }

  if(predBtn){ predBtn.addEventListener('click', ()=>{
    const nums = parseNumbers(histInput.value||'');
    if(nums.length===0){ predResult.innerHTML = '<div class="text-danger">Insira ao menos dois valores.</div>'; return; }
    const preds = simpleLinearForecast(nums, 12);
    predResult.innerHTML = `<div class="text-success">Próximos ${preds.length} períodos gerados.</div>`;
    // draw chart
    const labels = nums.map((_,i)=>`t${i+1}`).concat(preds.map((_,i)=>`t${nums.length+i+1}`));
    const values = nums.concat(preds.map(p=>Math.max(0, Math.round(p))));
    if(predChart) predChart.destroy();
    predChart = new Chart(ctxPred, { type:'line', data:{ labels, datasets:[{ label:'Historico+Predição', data: values, borderColor:'#0066b3', backgroundColor:'rgba(0,102,179,0.08)', fill:true }] }, options:{ plugins:{ legend:{display:false} } } });
  }); }

  if(clearHist){ clearHist.addEventListener('click', ()=>{ histInput.value=''; predResult.innerHTML=''; if(predChart) { predChart.destroy(); predChart=null; } }); }

  // === Occurrence creation modal wiring ===
  const btnNovaOc = document.getElementById('btnNovaOc');
  const modalNovaOcEl = document.getElementById('modalNovaOc');
  if(btnNovaOc){ btnNovaOc.addEventListener('click', ()=>{ new bootstrap.Modal(modalNovaOcEl).show(); }); }
  const btnCreateOc = document.getElementById('btnCreateOc');
  if(btnCreateOc){ btnCreateOc.addEventListener('click', async ()=>{
    const tipo = document.getElementById('oc-tipo').value.trim();
    const risco = document.getElementById('oc-risco').value;
    const cep = document.getElementById('oc-cep').value.trim();
    const num = document.getElementById('oc-num').value.trim();
    const res = await geocodeCep(cep, num);
    if(!res){ alert('Não foi possível geocodificar a ocorrência'); return; }
    const novo = { id: Math.floor(Math.random()*9000+300), tipo: tipo||'Outro', risco: risco||'Baixo', lat: res.lat, lng: res.lon, status: 'Aberta' };
    ocorrencias.unshift(novo);
    renderOcorrencias(); renderCompact(); refreshKPIs();
    bootstrap.Modal.getInstance(modalNovaOcEl).hide();
  }); }

  // === Events (agenda) wiring ===
  const btnCriarEvento = document.getElementById('btnCriarEvento');
  const btnCreateEvento = document.getElementById('btnCreateEvento');
  const agendaList = document.getElementById('agendaList');
  // floating panel element (replaces modal)
  const floatingPanel = document.getElementById('floatingCreateEvt');
  const floatingClose = document.getElementById('floatingClose');

  function renderAgenda(){
    if(!agendaList) return;
    agendaList.innerHTML='';
    for(const ev of eventos){
      const a = document.createElement('a');
      a.href='#'; a.className='list-group-item list-group-item-action';
      const localText = ev.local || (ev.cep? `CEP ${ev.cep}` : '');
      const publicoText = ev.publico ? `<div class="small text-muted">Público esperado: ${ev.publico}</div>` : '';
      a.innerHTML = `<div class="d-flex w-100 justify-content-between"><div><strong>${ev.titulo}</strong><div class="small text-muted">${new Date(ev.data).toLocaleString()}</div>${publicoText}</div><div><small>${localText}</small></div></div><div class="small">${ev.descricao}</div>`;
      a.addEventListener('click', async (e)=>{ e.preventDefault(); if(ev.local){ try{ const q = encodeURIComponent(ev.local + ' Indaiatuba, Brasil'); const nom = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&limit=1`).then(r=>r.json()); if(nom && nom.length>0){ map.setView([parseFloat(nom[0].lat), parseFloat(nom[0].lon)], 16); } }catch(err){ LOG('Erro geocoding local: '+err.message); } } else if(ev.cep){ const res = await geocodeCep(ev.cep, ev.num); if(res){ map.setView([res.lat,res.lon],16); } } });
      agendaList.appendChild(a);
    }
  }
  renderAgenda();

  if(btnCriarEvento){ btnCriarEvento.addEventListener('click', ()=>{
    // show floating panel
    if(floatingPanel) { floatingPanel.style.display = 'block'; const first = document.getElementById('evt-titulo'); if(first) first.focus(); }
  }); }
  if(floatingClose){ floatingClose.addEventListener('click', ()=>{ if(floatingPanel) floatingPanel.style.display='none'; }); }
  if(btnCreateEvento){ btnCreateEvento.addEventListener('click', async ()=>{
    const titulo = document.getElementById('evt-titulo').value.trim();
    const data = document.getElementById('evt-data').value;
    const publico = Number(document.getElementById('evt-publico').value) || 0;
    const localTxt = document.getElementById('evt-local').value.trim();
    const desc = document.getElementById('evt-desc').value.trim();
    if(!titulo || !data || !localTxt){ alert('Preencha nome, horário e local'); return; }
    const novo = { id: 'E'+Math.floor(Math.random()*9000+100), titulo, data, publico, local: localTxt, descricao: desc };
    eventos.push(novo);
    renderAgenda();
    // geocode local text via Nominatim and add marker
    try{
      const q = encodeURIComponent(localTxt + ' Indaiatuba, Brasil');
      const nom = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&limit=1`).then(r=>r.json());
      if(nom && nom.length>0){ const loc = nom[0]; L.marker([parseFloat(loc.lat),parseFloat(loc.lon)], { title: titulo }).addTo(map).bindPopup(`<b>${titulo}</b><br>${new Date(data).toLocaleString()}<br>Público esperado: ${publico}`); map.setView([parseFloat(loc.lat),parseFloat(loc.lon)],16); }
    }catch(err){ LOG('Erro geocoding local: '+err.message); }
    // hide floating panel
    if(floatingPanel) floatingPanel.style.display='none';
  }); }

  // === Calendar rendering ===
  const btnMostrarCalendario = document.getElementById('btnMostrarCalendario');
  const modalCalendarioEl = document.getElementById('modalCalendario');
  const calGrid = document.getElementById('calendarGrid');
  const calDayEvents = document.getElementById('calendarDayEvents');
  const calPrev = document.getElementById('cal-prev');
  const calNext = document.getElementById('cal-next');

  let calDate = new Date(); // current month shown

  function startOfMonth(dt){ return new Date(dt.getFullYear(), dt.getMonth(), 1); }
  function endOfMonth(dt){ return new Date(dt.getFullYear(), dt.getMonth()+1, 0); }

  function renderCalendar(){
    if(!calGrid) return;
    calGrid.innerHTML = '';
    const first = startOfMonth(calDate);
    const last = endOfMonth(calDate);
    const startWeekday = first.getDay(); // 0..6
    // show week header
    const weekDays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    for(const d of weekDays){ const hd = document.createElement('div'); hd.className='calendar-cell text-center fw-bold'; hd.style.background='#f7fbff'; hd.innerText = d; calGrid.appendChild(hd); }
    // fill initial blanks
    for(let i=0;i<startWeekday;i++){ const em = document.createElement('div'); em.className='calendar-cell'; em.innerHTML=''; calGrid.appendChild(em); }
    // days
    for(let day=1; day<=last.getDate(); day++){
      const cell = document.createElement('div'); cell.className='calendar-cell';
      const d = new Date(calDate.getFullYear(), calDate.getMonth(), day);
      const num = document.createElement('div'); num.className='date-num'; num.innerText = day; cell.appendChild(num);
      // count events for this day
      const key = d.toISOString().slice(0,10);
      const evs = eventos.filter(e=> e.data && e.data.slice(0,10)===key);
      const cnt = document.createElement('div'); cnt.className='events-count'; cnt.innerText = evs.length? evs.length+' evento(s)' : '---'; cell.appendChild(cnt);
      if(evs.length>0){ for(const ev of evs){ const pe = document.createElement('div'); pe.className='calendar-day-event'; pe.innerText = ev.titulo; pe.addEventListener('click', ()=>{ calDayEvents.innerHTML = `<h6>${ev.titulo}</h6><div>${new Date(ev.data).toLocaleString()}</div><div>Público esperado: ${ev.publico||'N/A'}</div><div class="small mt-1">${ev.descricao||''}</div>`; }); cell.appendChild(pe); } }
      // highlight today
      const today = new Date(); if(d.toDateString()===today.toDateString()) cell.classList.add('calendar-today');
      calGrid.appendChild(cell);
    }
  }

  if(btnMostrarCalendario){ btnMostrarCalendario.addEventListener('click', ()=>{ new bootstrap.Modal(modalCalendarioEl).show(); renderCalendar(); }); }
  if(calPrev) calPrev.addEventListener('click', ()=>{ calDate = new Date(calDate.getFullYear(), calDate.getMonth()-1, 1); renderCalendar(); });
  if(calNext) calNext.addEventListener('click', ()=>{ calDate = new Date(calDate.getFullYear(), calDate.getMonth()+1, 1); renderCalendar(); });

  // --- Mini calendar (right column) ---
  let miniCalDate = new Date();
  const miniGrid = document.getElementById('miniCalendarGrid');
  const miniEvents = document.getElementById('miniCalendarEvents');
  const miniPrev = document.getElementById('mini-cal-prev');
  const miniNext = document.getElementById('mini-cal-next');
  const miniLabel = document.getElementById('mini-cal-label');

  function renderMiniCalendar(){
    if(!miniGrid) return;
    miniGrid.innerHTML = '';
    if(miniLabel){ const opts = { month: 'long', year: 'numeric' }; miniLabel.textContent = miniCalDate.toLocaleDateString('pt-BR', opts); miniLabel.style.cursor = 'pointer'; miniLabel.title = 'Voltar ao mês atual'; }
    const first = startOfMonth(miniCalDate);
    const last = endOfMonth(miniCalDate);
    const startWeekday = first.getDay();
    // header row (weekdays)
    const weekDays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    for(const d of weekDays){ const hd = document.createElement('div'); hd.className='calendar-cell text-center fw-bold'; hd.style.background='#f7fbff'; hd.style.padding='6px 4px'; hd.innerText = d; miniGrid.appendChild(hd); }
    // blanks
    for(let i=0;i<startWeekday;i++){ const em = document.createElement('div'); em.className='calendar-cell'; em.innerHTML=''; miniGrid.appendChild(em); }
    for(let day=1; day<=last.getDate(); day++){
      const cell = document.createElement('div'); cell.className='calendar-cell'; cell.style.minHeight='56px';
      const d = new Date(miniCalDate.getFullYear(), miniCalDate.getMonth(), day);
      const num = document.createElement('div'); num.className='date-num'; num.innerText = day; cell.appendChild(num);
      const key = d.toISOString().slice(0,10);
      const evs = eventos.filter(e=> e.data && e.data.slice(0,10)===key);
      const cnt = document.createElement('div'); cnt.className='events-count small text-muted'; cnt.innerText = evs.length? evs.length+' evento(s)' : '---'; cell.appendChild(cnt);
      if(evs.length>0){
        const list = document.createElement('div'); list.className='mt-1';
        for(const ev of evs.slice(0,2)){
          const a = document.createElement('a'); a.href='#'; a.className='d-block small'; a.innerText = ev.titulo || 'Evento';
          a.addEventListener('click', async (e)=>{ e.preventDefault(); // center map on event if possible
            try{
              if(ev.lat && ev.lon){ map.setView([ev.lat, ev.lon], 16); }
              else if(ev.cep){ const res = await geocodeCep(ev.cep, ev.num); if(res) map.setView([res.lat, res.lon], 16); }
              else if(ev.local){ const q = encodeURIComponent(ev.local + ' Indaiatuba, Brasil'); const nom = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&limit=1`).then(r=>r.json()); if(nom && nom.length>0){ map.setView([parseFloat(nom[0].lat), parseFloat(nom[0].lon)], 16); } }
            }catch(err){ LOG('Mini-cal geocoding erro: '+err.message); }
          });
          list.appendChild(a);
        }
        cell.appendChild(list);
      }
      cell.addEventListener('click', ()=>{
        // show full list in the events pane
        const items = eventos.filter(e=> e.data && e.data.slice(0,10)===key);
        if(items.length===0){ if(miniEvents) miniEvents.innerText = 'Sem eventos neste dia.'; return; }
        if(miniEvents) miniEvents.innerHTML = items.map(it=>`<div><strong>${it.titulo}</strong> <div class="small text-muted">${new Date(it.data).toLocaleString()}</div></div>`).join('');
      });
      miniGrid.appendChild(cell);
    }
  }
  if(miniPrev) miniPrev.addEventListener('click', ()=>{ miniCalDate = new Date(miniCalDate.getFullYear(), miniCalDate.getMonth()-1, 1); renderMiniCalendar(); });
  if(miniNext) miniNext.addEventListener('click', ()=>{ miniCalDate = new Date(miniCalDate.getFullYear(), miniCalDate.getMonth()+1, 1); renderMiniCalendar(); });
  if(miniLabel) miniLabel.addEventListener('click', ()=>{ miniCalDate = new Date(); renderMiniCalendar(); });
  // render once on load
  renderMiniCalendar();
})();
