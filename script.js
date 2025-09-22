(function(){
  const $ = (s, c=document) => c.querySelector(s);
  const API_BASE = 'https://statsapi.web.nhl.com/api/v1';
  const CACHE_KEY = 'pucktracker_standings_v3';
  const CACHE_TTL_MS = 24*60*60*1000;

  function setYear(){ $('#year').textContent = new Date().getFullYear(); }
  function showLoading(){
    $('#standings').innerHTML = `<article class="card"><h3>Loading</h3><div class="row"><span class="small">Fetching latest standings…</span><span></span></div></article>`;
  }
  function showError(message){
    $('#standings').innerHTML = `<article class="card"><h3>Error</h3><div class="row"><span class="small">${message}</span><span></span></div></article>`;
  }

  function row(left, right){ return `<div class="row"><span>${left}</span><span>${right}</span></div>`; }
  function sectionCard(title, list, showConf=true){
    const rows = list.map((t, i)=>{
      const left = `${i+1}. ${t.teamName}`;
      const chips = showConf ? `<span class="badge">${t.conferenceShort}</span>` : '';
      const right = `${chips} <strong>${t.points}</strong> pts <span class="small">• RW ${t.rw} • GP ${t.gp}</span>`;
      return row(left, right);
    }).join('');
    return `<article class="card"><h3>${title}</h3>${rows}</article>`;
  }

  function groupBy(arr, key){
    const m = new Map();
    for(const item of arr){
      const k = item[key] ?? 'Unknown';
      if(!m.has(k)) m.set(k, []);
      m.get(k).push(item);
    }
    return m;
  }

  function sortTeams(a, b){
    if (b.points !== a.points) return b.points - a.points;
    if (b.rw !== a.rw) return b.rw - a.rw;
    return a.teamName.localeCompare(b.teamName);
  }

  function renderStandings(data){
    const overall = [...data].sort(sortTeams);

    const east = overall.filter(t=>t.conference === 'Eastern');
    const west = overall.filter(t=>t.conference === 'Western');

    const byDivision = groupBy(overall, 'division');
    const divisionOrder = ['Atlantic','Metropolitan','Central','Pacific'];
    const divisionCards = divisionOrder
      .filter(name => byDivision.has(name))
      .map(name => {
        const list = [...byDivision.get(name)].sort(sortTeams);
        return sectionCard(`${name} Division`, list, false);
      });

    $('#standings').innerHTML = [
      sectionCard('Overall', overall),
      sectionCard('East', east),
      sectionCard('West', west),
      ...divisionCards
    ].join('');
  }

  function loadCache(){
    try{
      const raw = localStorage.getItem(CACHE_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(!parsed || !parsed.timestamp || !parsed.data) return null;
      if(Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
      return parsed.data;
    }catch{ return null; }
  }
  function saveCache(data){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data })); }catch{}
  }

  function transform(apiData){
    const out = [];
    for(const record of apiData.records || []){
      const conferenceName = record.conference?.name || 'Unknown';
      const conferenceShort = conferenceName.startsWith('East') ? 'East' : conferenceName.startsWith('West') ? 'West' : conferenceName;
      const divisionName = record.division?.name || 'Unknown';
      for(const tr of record.teamRecords || []){
        out.push({
          teamName: tr.team?.name || 'Unknown',
          points: Number(tr.points ?? 0),
          gp: Number(tr.gamesPlayed ?? 0),
          rw: Number(tr.regulationWins ?? 0),
          conference: conferenceName,
          conferenceShort,
          division: divisionName
        });
      }
    }
    return out;
  }

  async function fetchStandings(){
    const res = await fetch(`${API_BASE}/standings`, { cache: 'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return transform(json);
  }

  async function load(){
    setYear();
    showLoading();

    const cached = loadCache();
    if(cached){ renderStandings(cached); }

    try{
      const live = await fetchStandings();
      if(!Array.isArray(live) || live.length === 0) throw new Error('No data');
      saveCache(live);
      renderStandings(live);
    }catch(err){
      if(!cached){ showError('Failed to fetch standings. Please try again later.'); }
    }

    setInterval(()=>{ location.reload(); }, CACHE_TTL_MS);
  }

  document.addEventListener('DOMContentLoaded', load);
})();
