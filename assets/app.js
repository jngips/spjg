// ---- Cities (HER defaults on load) ----
const HER = { key:"HER", label:"New York", tz:"America/New_York", lat:40.725, lon:-73.985 };
const ME  = { key:"ME",  label:"Los Angeles", tz:"America/Los_Angeles", lat:34.02665, lon:-118.47381 };

let current = HER;
const cache = { HER:null, ME:null };

const $ = (id) => document.getElementById(id);

// ---- Clock line ----
function updateClockLine(){
  const la = new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit", timeZone: ME.tz});
  const ny = new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit", timeZone: HER.tz});
  $("clockLine").textContent = `LA ${la} • NY ${ny}`;
}
updateClockLine();
setInterval(updateClockLine, 30_000);

// ---- Helpers ----
function isValentineWindow() {
  // Show love theme on Feb 13–15 (covers “tomorrow” and V-Day itself)
  const now = new Date();
  const m = now.getMonth() + 1; // 1-12
  const d = now.getDate();
  return (m === 2 && (d === 13 || d === 14 || d === 15));
}

// ---- Note bar (saved locally) ----
const NOTE_KEY = "c2c_note";

function initNoteBar(){
  const input = $("noteInput");
  const btn = $("noteSave");
  if(!input || !btn) return;

  // load saved
  const saved = localStorage.getItem(NOTE_KEY);
  if(saved) input.value = saved;

  function save(){
    localStorage.setItem(NOTE_KEY, input.value.trim());
    btn.textContent = "Saved ♥";
    setTimeout(()=> btn.textContent = "Save", 1200);
  }

  btn.addEventListener("click", save);
  input.addEventListener("keydown", (e)=>{
    if(e.key === "Enter") save();
  });
}

initNoteBar();


function mphFromWindSpeed(windSpeedStr=""){
  // NWS windSpeed is often like "7 mph" or "3 to 7 mph"
  const m = windSpeedStr.match(/(\d+)(?:\s*to\s*(\d+))?\s*mph/i);
  if(!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : null;
  return b ? (a + b)/2 : a;
}

function windChillF(Tf, mph){
  // Valid when T <= 50F and wind > 3 mph
  if(Tf == null || mph == null) return null;
  if(Tf > 50 || mph <= 3) return Tf;
  return 35.74 + 0.6215*Tf - 35.75*Math.pow(mph,0.16) + 0.4275*Tf*Math.pow(mph,0.16);
}

function heatIndexF(Tf, rh){
  // Valid when T >= 80F and RH >= 40% (rough guidance)
  if(Tf == null || rh == null) return null;
  if(Tf < 80 || rh < 40) return Tf;

  // Rothfusz regression
  const T = Tf, R = rh;
  return -42.379 + 2.04901523*T + 10.14333127*R
    - 0.22475541*T*R - 0.00683783*T*T - 0.05481717*R*R
    + 0.00122874*T*T*R + 0.00085282*T*R*R - 0.00000199*T*T*R*R;
}

function feelsLikeF(hour){
  if(!hour) return null;
  const T = hour.temperature;
  const rh = hour.relativeHumidity?.value ?? null;
  const mph = mphFromWindSpeed(hour.windSpeed ?? "");
  // Use wind chill if cold, heat index if hot, else just temp
  if(T != null && T <= 50 && mph != null && mph > 3) return windChillF(T, mph);
  if(T != null && T >= 80 && rh != null) return heatIndexF(T, rh);
  return T;
}

function fmtHour(iso, tz){
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour:"numeric", minute:"2-digit", timeZone: tz });
}


function setLoveMode(on){
  document.body.classList.toggle("wx-love", on);
  const hearts = $("fxHearts");
  if (hearts) hearts.style.opacity = on ? "0.65" : "0";
}



function weekdayFromISO(iso){
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "short" });
}

function conditionClass(shortForecast=""){
  const t = shortForecast.toLowerCase();
  if (t.includes("snow") || t.includes("sleet") || t.includes("flurr")) return "wx-snow";
  if (t.includes("thunder")) return "wx-thunder";
  if (t.includes("rain") || t.includes("showers") || t.includes("drizzle")) return "wx-rain";
  if (t.includes("fog") || t.includes("haze")) return "wx-fog";
  if (t.includes("cloud") || t.includes("overcast")) return "wx-cloudy";
  return "wx-clear";
}

function applyWeatherTheme(shortForecast){
  // Emerald theme is forced elsewhere.
  // This function only controls weather overlays (rain/snow).

  const cls = conditionClass(shortForecast);

  const rain = $("fxRain");
  const snow = $("fxSnow");
  const hearts = $("fxHearts");

  // Hearts OFF (no Valentine)
  if (hearts) hearts.style.opacity = "0";

  if (rain) rain.style.opacity = (cls === "wx-rain" || cls === "wx-thunder") ? "0.55" : "0";
  if (snow) snow.style.opacity = (cls === "wx-snow") ? "0.60" : "0";
}


function fmtUpdated(updatedIso){
  if(!updatedIso) return "—";
  try{
    const d = new Date(updatedIso);
    return d.toLocaleString([], { weekday:"short", hour:"numeric", minute:"2-digit" });
  }catch{
    return "—";
  }
}

// --- Simple sunrise/sunset approximation (NOAA-style-ish) ---
// Accuracy is typically within a few minutes—fine for a gift app.
function sunriseSunset(lat, lon, date = new Date()) {
  // returns { sunrise: Date, sunset: Date } in local browser time
  // This uses a common approximation for solar events.
  const rad = Math.PI / 180;
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const n = Math.floor((day - new Date(day.getFullYear(), 0, 0)) / 86400000);

  const lngHour = lon / 15;

  function calc(t, isSunrise) {
    const M = (0.9856 * t) - 3.289;
    let L = M + (1.916 * Math.sin(M * rad)) + (0.020 * Math.sin(2 * M * rad)) + 282.634;
    L = (L + 360) % 360;

    let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = (RA + 360) % 360;

    const Lquadrant  = Math.floor(L / 90) * 90;
    const RAquadrant = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquadrant - RAquadrant)) / 15;

    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));

    const cosH = (Math.cos(90.833 * rad) - (sinDec * Math.sin(lat * rad))) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return null; // polar day/night edge cases

    let H = isSunrise ? (360 - Math.acos(cosH) / rad) : (Math.acos(cosH) / rad);
    H = H / 15;

    const T = H + RA - (0.06571 * t) - 6.622;
    let UT = (T - lngHour) % 24;
    if (UT < 0) UT += 24;

    const hr = Math.floor(UT);
    const min = Math.floor((UT - hr) * 60);
    // Interpret UT as UTC time on `day`, then convert to local Date object:
    const utc = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hr, min, 0));
    return utc;
  }

  const tRise = n + ((6 - lngHour) / 24);
  const tSet  = n + ((18 - lngHour) / 24);

  const riseUTC = calc(tRise, true);
  const setUTC  = calc(tSet, false);

  return {
    sunrise: riseUTC ? new Date(riseUTC) : null,
    sunset:  setUTC  ? new Date(setUTC)  : null
  };
}

function fmtTime(d, tz){
  if(!d) return "—";
  return d.toLocaleTimeString([], { hour:"numeric", minute:"2-digit", timeZone: tz });
}


// From hourly period objects
function pickHourlyNow(hourlyPeriods){
  return (hourlyPeriods && hourlyPeriods.length) ? hourlyPeriods[0] : null;
}
function pickDailyNow(dailyPeriods){
  return (dailyPeriods && dailyPeriods.length) ? dailyPeriods[0] : null;
}

function numOrDash(v, suffix=""){
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v}${suffix}`;
}

// ---- Fetch ----
async function fetchWeather(city){
  const r = await fetch(`/.netlify/functions/weather?lat=${city.lat}&lon=${city.lon}`);
  if(!r.ok) throw new Error(`Weather failed ${r.status}`);
  return await r.json(); // { updated, dailyPeriods, hourlyPeriods }
}

// ---- Render ----
function renderHero(city, data){
  const daily0 = pickDailyNow(data.dailyPeriods);
  const hour0  = pickHourlyNow(data.hourlyPeriods);
  const feels0 = feelsLikeF(hour0);
  $("feels").textContent = feels0 == null ? "—" : `${Math.round(feels0)}°`;

  // Fallback logic if one is missing
  const temp = hour0?.temperature ?? daily0?.temperature ?? null;
  const unit = hour0?.temperatureUnit ?? daily0?.temperatureUnit ?? "";
  const short = daily0?.shortForecast ?? hour0?.shortForecast ?? "—";

  $("cityName").textContent = city.label;
  $("tempBig").textContent = (temp == null) ? "--°" : `${temp}°${unit}`;
  $("condLine").textContent = short;

  // "Feels": NWS hourly doesn't give "feels like" directly; using temp is reasonable for now
  $("feels").textContent = (temp == null) ? "—" : `${temp}°`;

  // Precip / RH / Sky from hourly if available
  const pop = hour0?.probabilityOfPrecipitation?.value; // number or null
  const rh  = hour0?.relativeHumidity?.value;           // number or null
  const sky = hour0?.skyCover?.value;                   // number or null (sometimes absent)

  $("precip").textContent = (pop == null) ? "—" : `${pop}%`;
  $("rh").textContent     = (rh  == null) ? "—" : `${rh}%`;
  $("sky").textContent    = (sky == null) ? "—" : `${sky}%`;

  // Wind from daily or hourly
  const windSpeed = daily0?.windSpeed ?? hour0?.windSpeed ?? "";
  const windDir   = daily0?.windDirection ?? hour0?.windDirection ?? "";
  const windLine  = [windSpeed, windDir].filter(Boolean).join(" ").trim();
  $("wind").textContent = windLine || "—";

  // Sunset: still blank until we add a sunrise/sunset API or compute astronomy.
  // Keeping it as — is honest. We can implement next.
    const ss = sunriseSunset(city.lat, city.lon, new Date());
  const riseStr = fmtTime(ss.sunrise, city.tz);
  const setStr  = fmtTime(ss.sunset, city.tz);

  $("sunset").textContent = setStr;
  // If you want to also show sunrise, swap "Humidity" label or add a new metaItem later.


  $("updatedLine").textContent = `Updated: ${fmtUpdated(data.updated)}`;

  // Theme based on selected city's forecast
  applyWeatherTheme(short);
}

function renderHourlyStrip(city, data){
  const hours = (data.hourlyPeriods || []).slice(0, 18); // next 18 hours
  const el = $("hourlyStrip");
  if(!el) return;

  el.innerHTML = hours.map(h => {
    const time = fmtHour(h.startTime, city.tz);
    const T = h.temperature;
    const unit = h.temperatureUnit || "F";
    const pop = h.probabilityOfPrecipitation?.value;
    const wind = `${h.windSpeed || "—"} ${h.windDirection || ""}`.trim();
    const feels = feelsLikeF(h);
    const feelsStr = (feels == null) ? "—" : `${Math.round(feels)}°${unit}`;

    return `
      <div class="hc">
        <div class="time">${time}</div>
        <div class="t">${T ?? "—"}°${unit}</div>
        <div class="small">Feels: <b>${feelsStr}</b></div>
        <div class="row">
          <div class="small">PoP: <b>${pop == null ? "—" : `${pop}%`}</b></div>
          <div class="small">Wind: <b>${wind || "—"}</b></div>
        </div>
      </div>
    `;
  }).join("");
}


function renderForecastStrip(data){
  const periods = (data.dailyPeriods || []);

  // NWS daily periods are often Day/Night alternating.
  // Group into 7 days: take first Day + following Night if available.
  const days = [];
  for (let i = 0; i < periods.length && days.length < 7; i++){
    const p = periods[i];
    if (!p) continue;

    // Prefer daytime entries as the "day"
    if (p.isDaytime) {
      const night = periods[i+1] && !periods[i+1].isDaytime ? periods[i+1] : null;
      days.push({ day: p, night });
    }
  }

  $("forecastStrip").innerHTML = days.map(({day, night}) => {
    const name = weekdayFromISO(day.startTime);
    const desc = (day.shortForecast || "").slice(0, 28);
    const hi = day.temperature;
    const lo = night?.temperature ?? "—";
    const icon = day.icon ? day.icon.split("?")[0] : null;

    return `
      <div class="fc">
        <div class="day">${name}</div>
        <div class="icon">${icon ? `<img src="${icon}" alt="">` : "—"}</div>
        <div class="desc">${desc}</div>
        <div class="hi">${hi}°</div>
        <div class="lo">${lo !== "—" ? `${lo}°` : "—"}</div>
      </div>
    `;
  }).join("");
}

function renderComparison(){
  const aCity = current;
  const bCity = (current.key === "HER") ? ME : HER;

  const A = cache[aCity.key];
  const B = cache[bCity.key];
  const a0h = pickHourlyNow(A?.hourlyPeriods);
  const b0h = pickHourlyNow(B?.hourlyPeriods);

  // If missing hourly, fallback to daily
  const a0d = pickDailyNow(A?.dailyPeriods);
  const b0d = pickDailyNow(B?.dailyPeriods);

  const aTemp = a0h?.temperature ?? a0d?.temperature ?? null;
  const bTemp = b0h?.temperature ?? b0d?.temperature ?? null;

  if(aTemp == null || bTemp == null){
    $("dTemp").textContent = "Δ Temp: —";
  } else {
    const dT = aTemp - bTemp; // selected - other
    let msg;
    if (dT === 0) msg = "Same temp";
    else if (dT > 0) msg = `${aCity.label} is warmer`;
    else msg = `${aCity.label} is colder`;
    $("dTemp").textContent = `Δ Temp: ${Math.abs(dT)}° (${msg})`;
  }

  // precip delta from hourly POP
  const aPop = a0h?.probabilityOfPrecipitation?.value;
  const bPop = b0h?.probabilityOfPrecipitation?.value;
  if(aPop == null || bPop == null){
    $("dPrecip").textContent = "Δ Precip: —";
  } else {
    $("dPrecip").textContent = `Δ Precip: ${Math.abs(aPop - bPop)}%`;
  }

  // sunset delta not implemented yet
  $("dSunset").textContent = "Δ Sunset: —";

  // Mood line from shortForecast
  const aShort = (a0d?.shortForecast ?? a0h?.shortForecast ?? "").toLowerCase();
  const bShort = (b0d?.shortForecast ?? b0h?.shortForecast ?? "").toLowerCase();

  const rainy = (t) => t.includes("rain") || t.includes("showers") || t.includes("drizzle") || t.includes("thunder");
  const snowy = (t) => t.includes("snow") || t.includes("sleet") || t.includes("flurr");
  const clear = (t) => t.includes("clear") || t.includes("sunny");

  let mood = "Two different skies.";
  if (rainy(aShort) && rainy(bShort)) mood = "Shared rain.";
  else if (snowy(aShort) && snowy(bShort)) mood = "Shared snow.";
  else if (clear(aShort) && clear(bShort)) mood = "Clear in both cities.";
  else if (rainy(aShort) && !rainy(bShort)) mood = `Rain in ${aCity.label}.`;
  else if (!rainy(aShort) && rainy(bShort)) mood = `Rain in ${bCity.label}.`;

  $("mood").textContent = mood;
}

// ---- Load + City switch ----
async function loadCity(city){
  const data = await fetchWeather(city);
  cache[city.key] = data;

  if(current.key === city.key){
    renderHero(city, data);
    renderForecastStrip(data);
    renderHourlyStrip(city, data);
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
    renderHourlyStrip(current, data); // add this

  } else {
    // in case first load is slow
    $("condLine").textContent = "Loading…";
  }
  renderComparison();
}

document.querySelectorAll(".segBtn").forEach(btn=>{
  btn.addEventListener("click", ()=> setCity(btn.dataset.city));
});

// Boot: always HER
setCity("HER");
Promise.all([loadCity(HER), loadCity(ME)]).catch(console.error);

// Force Emerald theme always
document.body.classList.remove(
  "wx-clear","wx-cloudy","wx-rain",
  "wx-snow","wx-thunder","wx-fog","wx-love","wx-emerald"
);
document.body.classList.add("wx-emerald");

// Ensure hearts are off in emerald mode
const hearts = $("fxHearts");
if (hearts) hearts.style.opacity = "0";


