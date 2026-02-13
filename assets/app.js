const HER = { key:"HER", label:"New York", zip:"10009", lat:40.725, lon:-73.985 };
const ME  = { key:"ME",  label:"Los Angeles", zip:"90404", lat:34.02665, lon:-118.47381 };

let current = HER;
let cache = { HER:null, ME:null };

const $ = (id) => document.getElementById(id);

function nowClockLine(){
  const la = new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit", timeZone:"America/Los_Angeles"});
  const ny = new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit", timeZone:"America/New_York"});
  $("clockLine").textContent = `LA ${la} • NY ${ny}`;
}
setInterval(nowClockLine, 30_000);
nowClockLine();

function minutesBetween(a, b){
  return Math.round((b - a) / 60000);
}

function formatHM(d, tz){
  return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit", timeZone: tz});
}

function dayLabelFromName(name){
  // NWS "Tonight", "Monday", etc. We'll keep it as-is but shorten if needed.
  return name.length > 10 ? name.slice(0,10) + "…" : name;
}

async function fetchForecast(city){
  const r = await fetch(`/.netlify/functions/weather?lat=${city.lat}&lon=${city.lon}`);
  if(!r.ok) throw new Error(`Weather failed ${r.status}`);
  return await r.json(); // { periods: [...] }
}

function pickCurrent(periods){
  // Use the first period as "current-ish"
  return periods[0] || null;
}

function estimateSkyCover(shortForecast){
  // NWS doesn't always provide numeric sky cover in forecast periods.
  // We'll estimate from text (simple heuristic) so UI can show something.
  const t = (shortForecast || "").toLowerCase();
  if(t.includes("clear")) return 10;
  if(t.includes("mostly sunny")) return 25;
  if(t.includes("partly")) return 45;
  if(t.includes("mostly cloudy")) return 75;
  if(t.includes("cloudy") || t.includes("overcast")) return 90;
  return null;
}

function estimatePrecipChance(detailedForecast){
  // NWS gives POP in some products but not always in /forecast periods.
  // We'll show "—" unless we can infer something.
  const t = (detailedForecast || "").toLowerCase();
  if(t.includes("chance of")) return 40;
  if(t.includes("likely")) return 60;
  if(t.includes("rain") || t.includes("showers") || t.includes("thunder")) return 55;
  if(t.includes("snow")) return 55;
  return null;
}

function renderHero(city, data){
  const periods = data.periods || [];
  const cur = pickCurrent(periods);
  if(!cur){
    $("condLine").textContent = "No data";
    return;
  }

  $("cityName").textContent = `${city.label}`;
  $("tempBig").textContent = `${cur.temperature}°${cur.temperatureUnit}`;
  $("condLine").textContent = cur.shortForecast || "—";

  // “Feels like” isn’t directly in NWS /forecast periods.
  // We'll show same as temp for now (or you can compute via heat index/wind chill later).
  $("feels").textContent = `${cur.temperature}°`;

  const pop = estimatePrecipChance(cur.detailedForecast);
  $("precip").textContent = pop == null ? "—" : `${pop}%`;

  const sky = estimateSkyCover(cur.shortForecast);
  $("sky").textContent = sky == null ? "—" : `${sky}%`;

  const wind = [cur.windSpeed, cur.windDirection].filter(Boolean).join(" ");
  $("wind").textContent = wind || "—";

  // RH not included in this endpoint; keep placeholder.
  $("rh").textContent = "—";

  // Sunset: requires astronomy calc OR separate API.
  // For now we leave it placeholder, but we can add sunrise-sunset.org or an NOAA calc later.
  $("sunset").textContent = "—";
}

function renderForecastStrip(data){
  const periods = (data.periods || []).slice(0, 8);
  $("forecastStrip").innerHTML = periods.map(p => `
    <div class="fc">
      <div class="day">${dayLabelFromName(p.name)}</div>
      <div class="small">${p.shortForecast || ""}</div>
      <div class="t">${p.temperature}°</div>
      <div class="small">${p.windSpeed || ""}</div>
    </div>
  `).join("");
}

function renderComparison(){
  const a = cache.HER?.periods?.[0];
  const b = cache.ME?.periods?.[0];

  if(!a || !b){
    $("dTemp").textContent = "Δ Temp: —";
    $("dSunset").textContent = "Δ Sunset: —";
    $("dPrecip").textContent = "Δ Precip: —";
    $("mood").textContent = "—";
    return;
  }

  const dT = a.temperature - b.temperature; // HER - ME
  const colder = dT < 0 ? "warmer" : "colder";
  $("dTemp").textContent = `Δ Temp: ${Math.abs(dT)}° (${cache.HERCityLabel ?? "NY"} is ${colder})`;

  // Precip heuristic
  const popA = estimatePrecipChance(a.detailedForecast) ?? 0;
  const popB = estimatePrecipChance(b.detailedForecast) ?? 0;
  $("dPrecip").textContent = `Δ Precip: ${Math.abs(popA - popB)}%`;

  // Sunset placeholder until we add proper calc
  $("dSunset").textContent = "Δ Sunset: —";

  // Mood line
  const ra = (a.shortForecast||"").toLowerCase();
  const rb = (b.shortForecast||"").toLowerCase();
  const rainyA = ra.includes("rain") || ra.includes("showers") || ra.includes("thunder");
  const rainyB = rb.includes("rain") || rb.includes("showers") || rb.includes("thunder");
  const clearA = ra.includes("clear");
  const clearB = rb.includes("clear");

  let mood = "Two different skies.";
  if(rainyA && rainyB) mood = "Shared rain.";
  else if(clearA && clearB) mood = "Clear in both cities.";
  else if(rainyA && !rainyB) mood = "Rain there, clearer here.";
  else if(!rainyA && rainyB) mood = "Clearer there, rain here.";

  $("mood").textContent = mood;
}

async function loadCity(city){
  const data = await fetchForecast(city);
  cache[city.key] = data;
  if(current.key === city.key){
    renderHero(city, data);
    renderForecastStrip(data);
  }
  renderComparison();
}

function setCity(key){
  current = (key === "ME") ? ME : HER;
  document.querySelectorAll(".segBtn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.city === current.key);
  });
  const data = cache[current.key];
  if(data){
    renderHero(current, data);
    renderForecastStrip(data);
  }
}

// Wire buttons
document.querySelectorAll(".segBtn").forEach(btn=>{
  btn.addEventListener("click", ()=> setCity(btn.dataset.city));
});

// Boot: default HER
setCity("HER");
Promise.all([loadCity(HER), loadCity(ME)]).catch(console.error);
