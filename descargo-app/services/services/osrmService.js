import axios from 'axios';

export const calcularRotaOSRM = async (origem, destino) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${
      origem.longitude},${origem.latitude};${destino.longitude},${destino.latitude
    }?overview=full&geometries=geojson&steps=true&annotations=true&language=pt`;
    
    console.log('Buscando rota OSRM:', url);
    
    const response = await axios.get(url);
    
    if (response.data.routes.length === 0) {
      throw new Error('Nenhuma rota encontrada');
    }
    
    const route = response.data.routes[0];
    const leg = route.legs[0];
    
    // Converter coordenadas GeoJSON para formato do MapView
    const coordenadas = route.geometry.coordinates.map(coord => ({
      longitude: coord[0],
      latitude: coord[1]
    }));
    
    // Processar instruções
    const instrucoes = leg.steps.map((step, index) => {
      let texto = step.maneuver.instruction || '';
      
      // Traduzir/manipular instruções se necessário
      texto = texto.replace('Turn left', 'Vire à esquerda');
      texto = texto.replace('Turn right', 'Vire à direita');
      texto = texto.replace('Continue', 'Continue');
      texto = texto.replace('Head', 'Siga');
      texto = texto.replace('onto', 'em');
      
      return {
        id: index,
        texto: texto,
        distancia: step.distance, // em metros
        duracao: step.duration, // em segundos
        coordenada: {
          longitude: step.maneuver.location[0],
          latitude: step.maneuver.location[1]
        },
        tipo: step.maneuver.type,
        modificador: step.maneuver.modifier
      };
    });
    
    return {
      coordenadas,
      instrucoes,
      distanciaTotal: route.distance, // metros
      duracaoTotal: route.duration, // segundos
      codigoPolylines: route.geometry
    };
    
  } catch (error) {
    console.error('Erro ao calcular rota OSRM:', error);
    throw error;
  }
};

// Função para decodificar polyline (se necessário)
export const decodificarPolyline = (encoded) => {
  const points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  
  return points;
};