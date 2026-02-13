// netlify/functions/weather.js
exports.handler = async (event) => {
  try {
    const { lat, lon } = event.queryStringParameters || {};
    if (!lat || !lon) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing lat/lon" }),
      };
    }

    const headers = {
      // Put a real email here (NWS wants a contact)
      "User-Agent": "coast-to-coast/1.0 (contact: you@example.com)",
      "Accept": "application/geo+json, application/json",
    };

    const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
    const p = await fetch(pointsUrl, { headers });

    if (!p.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "points failed", status: p.status }),
      };
    }

    const pj = await p.json();
    const props = pj?.properties || {};
    const forecastUrl = props.forecast;
    const hourlyUrl = props.forecastHourly;

    if (!forecastUrl || !hourlyUrl) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing forecast urls" }),
      };
    }

    const [fd, fh] = await Promise.all([
      fetch(forecastUrl, { headers }),
      fetch(hourlyUrl, { headers }),
    ]);

    if (!fd.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "forecast failed", status: fd.status }),
      };
    }
    if (!fh.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "hourly failed", status: fh.status }),
      };
    }

    const dj = await fd.json();
    const hj = await fh.json();

    const dailyPeriods = dj?.properties?.periods ?? [];
    const hourlyPeriods = hj?.properties?.periods ?? [];
    const updated = dj?.properties?.updated ?? hj?.properties?.updated ?? null;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
      body: JSON.stringify({ updated, dailyPeriods, hourlyPeriods }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
