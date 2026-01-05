import { useState, useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { getDistance, buscarRotaOSRM } from './MapUtils';

// Função auxiliar para obter coordenadas do endereço - EXPORTADA
export const obterCoordenadasDoEndereco = async (endereco) => {
  if (!endereco) return null;
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&key=AIzaSyDT5OptLHwnCVPuevN5Ie8SFWxm4mRPAl4`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    }
  } catch (error) {
    console.error("Erro ao buscar coordenadas:", error);
  }
  
  return null;
};

// Função para calcular rota automática (exportada para uso em outros componentes)
export const calcularRotaAutomatica = async (origem, destino, setRotaCoords, cargaData = null) => {
  if (!origem || !destino) return;
  
  try {
    let destinoCoords = null;
    
    // Se destino é um objeto com coordenadas
    if (destino.lat && destino.lng) {
      destinoCoords = destino;
    }
    // Se destino tem latitude/longitude
    else if (destino.latitude && destino.longitude) {
      destinoCoords = { lat: destino.latitude, lng: destino.longitude };
    }
    // Se destino é um endereço (string)
    else if (typeof destino === 'string') {
      destinoCoords = await obterCoordenadasDoEndereco(destino);
    }
    
    if (!destinoCoords) {
      console.error("Não foi possível obter coordenadas do destino");
      return null;
    }
    
    await buscarRotaOSRM(origem, destinoCoords.lat, destinoCoords.lng, setRotaCoords);
    
    // Retornar as coordenadas calculadas para uso posterior
    return destinoCoords;
    
  } catch (error) {
    console.error("Erro ao calcular rota automática:", error);
    return null;
  }
};

// Função auxiliar para calcular distância (em metros)
export const calcularDistancia = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // raio da Terra em metros
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2 - lat1) * Math.PI/180;
  const Δλ = (lon2 - lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // distância em metros
};

// Função para formatar tempo estimado
export const formatarTempoEstimado = (distanciaKm) => {
  const minutos = Math.round(distanciaKm * 1.5); // 1.5 min por km
  
  if (minutos < 60) {
    return `${minutos} min`;
  } else {
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    return `${horas}h ${minutosRestantes}min`;
  }
};

export const useGpseCercas = (db, user, location, cargaAtiva, setCargaAtiva, viagemIniciada) => {
  const [todasAsCercas, setTodasAsCercas] = useState([]);
  const [geofenceAtiva, setGeofenceAtiva] = useState(null);
  const [rotaCoords, setRotaCoords] = useState([]);
  const [destinoCoord, setDestinoCoord] = useState(null);
  const [chegouAoDestino, setChegouAoDestino] = useState(false);
  const [confirmacaoPendente, setConfirmacaoPendente] = useState(false);
  const [carregandoRota, setCarregandoRota] = useState(false);
  
  const ultimaLocRotaRef = useRef(null);

  // 1. Carrega pontos do banco
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "cadastro_clientes_pontos"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const cercasData = [];
      snap.forEach((doc) => cercasData.push({ id: doc.id, ...doc.data() }));
      setTodasAsCercas(cercasData);
    });
    return () => unsubscribe();
  }, [user?.uid]); 

  // 2. Busca desenho pelo nome do destino
  useEffect(() => {
    if (!cargaAtiva || todasAsCercas.length === 0) {
      setGeofenceAtiva(null);
      return;
    }
    const nomeBusca = (cargaAtiva?.destinoCliente || cargaAtiva?.clienteEntrega || "").toString().toUpperCase().trim();
    const encontrada = todasAsCercas.find(c => (c.cliente || "").toUpperCase().trim() === nomeBusca);
    setGeofenceAtiva(encontrada?.geofence || null);
  }, [cargaAtiva, todasAsCercas]);

  // 3. Lógica da Rota Automática - MODIFICADA para iniciar automaticamente
  useEffect(() => {
    if (!viagemIniciada || !location || !cargaAtiva) return;

    const iniciarRotaAutomatica = async () => {
      setCarregandoRota(true);
      
      try {
        // Se você desenhou uma POLYLINE no painel, ela vira o trajeto fixo
        if (geofenceAtiva?.tipo === 'polyline' && geofenceAtiva.coordenadas?.length > 0) {
          setRotaCoords(geofenceAtiva.coordenadas.map(p => ({
            latitude: p.lat,
            longitude: p.lng
          })));
          setCarregandoRota(false);
          return; 
        }

        // Se não tem desenho de linha, calcula do seu GPS até o centro do destino
        const destinoFinal = geofenceAtiva?.centro;
        
        if (!destinoFinal) {
          // Tenta obter coordenadas do destino da carga
          let destinoCoords = null;
          
          // Primeiro do link do Google Maps
          if (cargaAtiva?.destinoLink) {
            destinoCoords = await obterCoordenadasDoEndereco(cargaAtiva.destinoLink);
          }
          
          // Se não, tenta pelo nome do cliente + cidade
          if (!destinoCoords && cargaAtiva?.destinoCliente && cargaAtiva?.destinoCidade) {
            const enderecoBusca = `${cargaAtiva.destinoCliente}, ${cargaAtiva.destinoCidade}`;
            destinoCoords = await obterCoordenadasDoEndereco(enderecoBusca);
          }
          
          if (destinoCoords) {
            setDestinoCoord(destinoCoords);
            
            if (ultimaLocRotaRef.current) {
              const d = getDistance(location.latitude, location.longitude, ultimaLocRotaRef.current.latitude, ultimaLocRotaRef.current.longitude);
              if (d < 500) {
                setCarregandoRota(false);
                return;
              }
            }

            await buscarRotaOSRM(location, destinoCoords.lat, destinoCoords.lng, setRotaCoords);
            ultimaLocRotaRef.current = location;
          }
        } else {
          // Usa as coordenadas do geofence
          const dLat = destinoFinal.lat;
          const dLng = destinoFinal.lng;

          if (ultimaLocRotaRef.current) {
            const d = getDistance(location.latitude, location.longitude, ultimaLocRotaRef.current.latitude, ultimaLocRotaRef.current.longitude);
            if (d < 500) {
              setCarregandoRota(false);
              return;
            }
          }

          await buscarRotaOSRM(location, dLat, dLng, setRotaCoords);
          ultimaLocRotaRef.current = location;
        }
      } catch (error) {
        console.error("Erro ao calcular rota automática:", error);
      } finally {
        setCarregandoRota(false);
      }
    };

    // Inicia a rota automaticamente quando a viagem começa
    iniciarRotaAutomatica();
  }, [viagemIniciada, geofenceAtiva, location?.latitude, cargaAtiva?.id]);

  // 4. Verificação de Chegada
  useEffect(() => {
    if (!viagemIniciada || !location || chegouAoDestino) return;

    const alvo = geofenceAtiva?.centro || destinoCoord;
    if (!alvo) return;

    const raio = geofenceAtiva?.raio || 300;
    const d = getDistance(location.latitude, location.longitude, alvo.lat || alvo.latitude, alvo.lng || alvo.longitude);

    if (d <= raio) {
      const salvarChegada = async () => {
        try {
          await updateDoc(doc(db, "ordens_servico", cargaAtiva.id), { 
            status: 'AGUARDANDO CONFIRMAÇÃO',
            chegouAoDestino: true,
            dataChegada: serverTimestamp()
          });
          setChegouAoDestino(true);
          setConfirmacaoPendente(true);
          Vibration.vibrate([500, 500, 500, 500]);
        } catch (err) { console.error(err); }
      };
      salvarChegada();
    }
  }, [location?.latitude, geofenceAtiva, viagemIniciada, destinoCoord]);

  return { 
    geofenceAtiva, 
    rotaCoords, 
    destinoCoord, 
    chegouAoDestino, 
    confirmacaoPendente,
    carregandoRota,
    setChegouAoDestino, 
    setConfirmacaoPendente, 
    setRotaCoords 
  };
};