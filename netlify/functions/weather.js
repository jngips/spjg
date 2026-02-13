export default async (req) => {
  try{
    const url = new URL(req.url);
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    if(!lat || !lon){
      return new Response(JSON.stringify({error:"Missing lat/lon"}), { status: 400 });
    }

    // Step 1: points endpoint
    const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;

    const commonHeaders = {
      // NWS asks for a descriptive User-Agent in general documentation :contentReference[oaicite:6]{index=6}
      // Putting it here (server-side) avoids browser preflight/header problems :contentReference[oaicite:7]{index=7}
      "User-Agent": "our-board/1.0 (contact: you@example.com)",
      "Accept": "application/geo+json, application/json"
    };

    const p = await fetch(pointsUrl, { headers: commonHeaders });
    if(!p.ok) return new Response(JSON.stringify({error:"points failed", status:p.status}), { status: 502 });

    const pj = await p.json();
    const forecastUrl = pj?.properties?.forecast;
    if(!forecastUrl) return new Response(JSON.stringify({error:"No forecast URL"}), { status: 502 });

    // Step 2: forecast endpoint
    const f = await fetch(forecastUrl, { headers: commonHeaders });
    if(!f.ok) return new Response(JSON.stringify({error:"forecast failed", status:f.status}), { status: 502 });

    const fj = await f.json();
    const periods = fj?.properties?.periods ?? [];

    return new Response(JSON.stringify({ periods }), {
      status: 200,
      headers: {
        "Content-Type":"application/json",
        "Cache-Control":"public, max-age=300"
      }
    });
  }catch(e){
    return new Response(JSON.stringify({error:String(e)}), { status: 500 });
  }
};
