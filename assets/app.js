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
  const cls = conditionClass(shortForecast);

  document.body.classList.remove("wx-clear","wx-cloudy","wx-rain","wx-snow","wx-thunder","wx-fog");
  document.body.classList.add(cls);

  const rain = $("fxRain");
  const snow = $("fxSnow");
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
  $("sunset").textContent = "—";

  $("updatedLine").textContent = `Updated: ${fmtUpdated(data.updated)}`;

  // Theme based on selected city's forecast
  applyWeatherTheme(short);
}

function renderForecastStrip(data){
  const periods = (data.dailyPeriods || []).slice(0, 10);
  $("forecastStrip").innerHTML = periods.map(p => {
    const day = weekdayFromISO(p.startTime);
    const desc = (p.shortForecast || "").slice(0, 28);
    const wind = p.windSpeed || "";
    return `
      <div class="fc">
        <div class="day">${day}</div>
        <div class="small">${desc}</div>
        <div class="t">${p.temperature}°</div>
        <div class="small">${wind}</div>
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
