// MapUtils.js
export const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const buscarRotaOSRM = async (origem, latDest, lngDest, setRotaCoords) => {
  if (!origem || !latDest || !lngDest) return;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origem.longitude},${origem.latitude};${lngDest},${latDest}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      setRotaCoords(data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] })));
    }
  } catch (error) { console.error("Erro OSRM:", error); }
};