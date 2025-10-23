
// Coordenadas aproximadas da Prefeitura de Indaiatuba (assumidas para demo)
// Se preferir uma posição diferente, informe as coordenadas exatas.
const CENTER = { lat: -23.0905, lng: -47.2108 };

// Mock de unidades no terreno
// Generate mock units spread across the city around CENTER
function randomOffset(scaleLat=0.02, scaleLng=0.03){
  const lat = CENTER.lat + (Math.random()-0.5)*scaleLat;
  const lng = CENTER.lng + (Math.random()-0.5)*scaleLng;
  return { lat, lng };
}

function generateUnits(){
  const list = [];
  // 30 viaturas
  for(let i=1;i<=30;i++){
    const p = randomOffset(0.035, 0.05);
    list.push({ id: `VTR-${String(i).padStart(2,'0')}`, equipe: 'Viatura', type: 'vehicle', pos: { lat: p.lat, lng: p.lng }, status: 'Disponível' });
  }
  // 30 policiais
  for(let i=1;i<=30;i++){
    const p = randomOffset(0.04, 0.06);
    list.push({ id: `POL-${String(i).padStart(2,'0')}`, equipe: 'Policial', type: 'agent', pos: { lat: p.lat, lng: p.lng }, status: 'Em ronda' });
  }
  // 5 cães K9
  for(let i=1;i<=5;i++){
    const p = randomOffset(0.03, 0.04);
    list.push({ id: `K9-${String(i).padStart(2,'0')}`, equipe: 'K9', type: 'k9', pos: { lat: p.lat, lng: p.lng }, status: 'Em operação' });
  }
  // 5 drones
  for(let i=1;i<=5;i++){
    const p = randomOffset(0.03, 0.04);
    list.push({ id: `DRN-${String(i).padStart(2,'0')}`, equipe: 'Drone', type: 'drone', pos: { lat: p.lat, lng: p.lng }, status: 'Em voo' });
  }
  return list;
}

let unidades = generateUnits();

// Mock de ocorrências ativas
let ocorrencias = [
  { id: 101, tipo: 'Furto', risco: 'Médio', lat: -20.8205, lng: -49.3821, status: 'Aberta' },
  { id: 102, tipo: 'Trânsito', risco: 'Baixo', lat: -20.8182, lng: -49.3779, status: 'Aberta' },
  { id: 103, tipo: 'Briga', risco: 'Alto', lat: -20.8228, lng: -49.3766, status: 'Aberta' }
];

// Pontos de calor (lat, lng, intensidade)
function gerarCalor(evento='praca', n=250){
  const pts = [];
  let base = CENTER;
  if(evento==='estadio') base = { lat: -20.8065, lng: -49.3880 };
  if(evento==='feira') base = { lat: -20.8168, lng: -49.3750 };
  // Alça Nilson Cardoso de Carvalho (coordenadas aproximadas em Indaiatuba)
  if(evento==='alca_nilson') base = { lat: -23.0900, lng: -47.2095 };
  for(let i=0;i<n;i++){
    const offLat = (Math.random()-0.5)*0.008; // ~800m
    const offLng = (Math.random()-0.5)*0.008;
    const w = Math.random()*0.9 + 0.2; // 0.2–1.1
    pts.push([base.lat + offLat, base.lng + offLng, w]);
  }
  return pts;
}

function estimarPublico(heat){
  // soma simples das intensidades * fator
  const total = heat.reduce((acc,p)=> acc + (p[2]||0), 0);
  return Math.round(total*120); // fator empírico para demo
}

function riscoAtual(){
  const altos = ocorrencias.filter(o=>o.risco==='Alto').length;
  if(altos>=2) return 'Alto';
  const qtd = ocorrencias.length;
  if(qtd>=4) return 'Médio';
  return 'Baixo';
}

function incidenteMaisCritico(){
  const pri = { 'Alto':3, 'Médio':2, 'Baixo':1 };
  return ocorrencias.slice().sort((a,b)=> pri[b.risco]-pri[a.risco])[0];
}

function unidadeMaisProxima(lat, lng){
  let best=null, dmin=1e9;
  for(const u of unidades){
    const d = Math.hypot(u.pos.lat-lat, u.pos.lng-lng);
    if(d<dmin){ dmin=d; best=u; }
  }
  return best;
}

function simularOcorrencia(){
  // Gera ocasionalmente uma nova ocorrência
  if(Math.random()<0.35){
    const tipos=['Furto','Briga','Desordem','Emergência médica','Trânsito'];
    const riscos=['Baixo','Médio','Alto'];
    const base = gerarCalor(window.EVENTO||'praca',1)[0];
    const nova={ id: Math.floor(Math.random()*900+200), tipo: tipos[Math.floor(Math.random()*tipos.length)], risco: riscos[Math.floor(Math.random()*riscos.length)], lat: base[0], lng: base[1], status:'Aberta' };
    ocorrencias.unshift(nova);
    window.LOG && window.LOG(`Nova ocorrência #${nova.id} (${nova.tipo}, ${nova.risco})`);
  }
  // Fecha aleatoriamente alguma
  if(ocorrencias.length>0 && Math.random()<0.25){
    const o = ocorrencias.pop();
    window.LOG && window.LOG(`Ocorrência #${o.id} encerrada`);
  }
}

function moverUnidade(u, lat, lng, passos=20){
  const dlat=(lat-u.pos.lat)/passos;
  const dlng=(lng-u.pos.lng)/passos;
  let i=0;
  const t=setInterval(()=>{
    u.pos.lat += dlat; u.pos.lng += dlng; i++;
    if(i>=passos) clearInterval(t);
    document.dispatchEvent(new CustomEvent('unit:move'));
  }, 500);
}

// Dados de analytics simulados
const histTipos = {
  labels: ['Furto','Briga','Desordem','Emergência médica','Trânsito'],
  valores: [42, 31, 27, 19, 36]
};

const histPublico = {
  labels: Array.from({length:18}, (_,i)=>`${i*10}min`),
  valores: Array.from({length:18}, ()=> Math.round(4000 + Math.random()*3000)).sort((a,b)=>a-b)
};

// Agenda de eventos culturais (exemplos)
let eventos = [
  { id: 'E1', titulo: 'Feira Cultural - Centro', data: '2025-11-05T18:00', cep: '13331630', num: '100', descricao: 'Artes, música e gastronomia.' },
  { id: 'E2', titulo: 'Concerto na Praça', data: '2025-11-12T20:00', cep: '13331630', num: '12', descricao: 'Concerto da orquestra municipal.' }
];
