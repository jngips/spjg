const LA = { name: "LA 90404", lat: 34.02665, lon: -118.47381 }; // ZIP-center approx
const NY = { name: "NY 10009", lat: 40.725, lon: -73.985 };

const LS_PHOTOS = "board_photos_v1";
const LS_SPOTIFY = "board_spotify_v1";

function el(id){ return document.getElementById(id); }

function wxHtml(periods, n=4){
  const top = periods.slice(0,n);
  return top.map(p => `
    <div class="line">
      <div><b>${p.name}</b><div class="muted">${p.shortForecast ?? ""}</div></div>
      <div style="text-align:right">
        <div><b>${p.temperature}°${p.temperatureUnit}</b></div>
        <div class="muted">${p.windSpeed ?? ""} ${p.windDirection ?? ""}</div>
      </div>
    </div>
  `).join("");
}

async function loadWeather(targetEl, loc){
  targetEl.textContent = "Loading…";
  const r = await fetch(`/.netlify/functions/weather?lat=${loc.lat}&lon=${loc.lon}`);
  if(!r.ok) throw new Error(`Weather failed: ${r.status}`);
  const data = await r.json();
  targetEl.innerHTML = wxHtml(data.periods, 4);
}

function parseSpotifyEmbed(url){
  // Accept track/playlist/album share links; convert to embed.
  // Examples:
  // https://open.spotify.com/track/<id> -> https://open.spotify.com/embed/track/<id>
  try{
    const u = new URL(url);
    if(!u.hostname.includes("spotify.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if(parts.length < 2) return null;
    const type = parts[0], id = parts[1];
    return `https://open.spotify.com/embed/${type}/${id}`;
  }catch{ return null; }
}

function renderSpotify(){
  const url = localStorage.getItem(LS_SPOTIFY) || "";
  const box = el("spotifyEmbed");
  if(!url){
    box.classList.add("muted");
    box.textContent = "Add a link to show the player.";
    return;
  }
  const embed = parseSpotifyEmbed(url);
  if(!embed){
    box.textContent = "That doesn’t look like a Spotify link.";
    return;
  }
  box.innerHTML = `<iframe style="width:100%;height:152px;border:0;border-radius:12px"
    allow="encrypted-media" src="${embed}"></iframe>`;
}

function loadPhotos(){
  return JSON.parse(localStorage.getItem(LS_PHOTOS) || "[]");
}
function savePhotos(arr){
  localStorage.setItem(LS_PHOTOS, JSON.stringify(arr));
}
function renderGallery(){
  const g = el("gallery");
  const photos = loadPhotos();
  g.innerHTML = photos.map((src, i) => `
    <div class="imgWrap">
      <img src="${src}" alt="photo ${i+1}" loading="lazy"/>
      <button data-del="${i}" title="Remove">✕</button>
    </div>
  `).join("") || `<div class="muted">Add image URLs to build a little gallery.</div>`;

  g.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.del);
      const next = loadPhotos().filter((_, j) => j !== idx);
      savePhotos(next);
      renderGallery();
    });
  });
}

async function loadRssInto(listEl, feedUrl, limit=5){
  const r = await fetch(`/.netlify/functions/rss?url=${encodeURIComponent(feedUrl)}&limit=${limit}`);
  if(!r.ok) throw new Error(`RSS failed: ${r.status}`);
  const data = await r.json();
  listEl.innerHTML = data.items.map(it =>
    `<li><a href="${it.link}" target="_blank" rel="noopener">${it.title}</a></li>`
  ).join("");
}

async function refreshAll(){
  try{
    await Promise.all([
      loadWeather(el("wxLA"), LA),
      loadWeather(el("wxNY"), NY),
      // Fashion: WWD RSS landing page exists; pick one RSS URL you like (replace if you prefer FashionNetwork etc.)
      // WWD provides RSS feed options: https://wwd.com/rss-feeds/ :contentReference[oaicite:3]{index=3}
      loadRssInto(el("newsFashion"), "https://wwd.com/feed/"),
      // Tech + Climate: NOAA Climate.gov feeds + NASA Earth Observatory feeds exist :contentReference[oaicite:4]{index=4}
      loadRssInto(el("newsTechClimate"), "https://www.climate.gov/feeds/news-features"),
    ]);
  }catch(e){
    console.error(e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  el("refreshAll").addEventListener("click", refreshAll);

  el("addPhoto").addEventListener("click", () => {
    const v = el("photoUrl").value.trim();
    if(!v) return;
    const photos = loadPhotos();
    photos.unshift(v);
    savePhotos(photos.slice(0, 24)); // cap
    el("photoUrl").value = "";
    renderGallery();
  });

  el("setSpotify").addEventListener("click", () => {
    const v = el("spotifyUrl").value.trim();
    if(!v) return;
    localStorage.setItem(LS_SPOTIFY, v);
    el("spotifyUrl").value = "";
    renderSpotify();
  });

  renderGallery();
  renderSpotify();
  refreshAll();
});
