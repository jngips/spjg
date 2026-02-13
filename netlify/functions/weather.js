export default async (req) => {
  try {
    const url = new URL(req.url);
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: "Missing lat/lon" }), { status: 400 });
    }

    const headers = {
      "User-Agent": "coast-to-coast/1.0 (contact: YOUR_EMAIL@example.com)",
      "Accept": "application/geo+json, application/json"
    };

    // 1) points endpoint -> discover forecast URLs
    const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
    const p = await fetch(pointsUrl, { headers });
    if (!p.ok) {
      return new Response(JSON.stringify({ error: "points failed", status: p.status }), { status: 502 });
    }

    const pj = await p.json();
    const props = pj?.properties || {};
    const forecastUrl = props.forecast;
    const hourlyUrl = props.forecastHourly;

    if (!forecastUrl || !hourlyUrl) {
      return new Response(JSON.stringify({ error: "Missing forecast urls" }), { status: 502 });
    }

    // 2) daily + hourly fetch
    const [fd, fh] = await Promise.all([
      fetch(forecastUrl, { headers }),
      fetch(hourlyUrl, { headers })
    ]);

    if (!fd.ok) {
      return new Response(JSON.stringify({ error: "forecast failed", status: fd.status }), { status: 502 });
    }
    if (!fh.ok) {
      return new Response(JSON.stringify({ error: "hourly failed", status: fh.status }), { status: 502 });
    }

    const dj = await fd.json();
    const hj = await fh.json();

    const dailyPeriods = dj?.properties?.periods ?? [];
    const hourlyPeriods = hj?.properties?.periods ?? [];
    const updated = dj?.properties?.updated ?? hj?.properties?.updated ?? null;

    return new Response(JSON.stringify({
      updated,
      dailyPeriods,
      hourlyPeriods
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // 5-min caching (good practice). Refresh will still feel "live".
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
