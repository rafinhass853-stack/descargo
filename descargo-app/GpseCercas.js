import { useState, useEffect, useRef } from 'react';
import { Vibration, Alert, Platform } from 'react-native';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  where,
  getDocs
} from 'firebase/firestore';

// Importar funções do MapUtils
import { getDistance, buscarRotaOSRM, obterCoordenadasDoEndereco } from './MapUtils';

export const useGpseCercas = (db, user, location, cargaAtiva, setCargaAtiva, viagemIniciada) => {
  const [todasAsCercas, setTodasAsCercas] = useState([]);
  const [geofenceAtiva, setGeofenceAtiva] = useState(null);
  const [rotaCoords, setRotaCoords] = useState([]);
  const [destinoCoord, setDestinoCoord] = useState(null);
  const [chegouAoDestino, setChegouAoDestino] = useState(false);
  const [confirmacaoPendente, setConfirmacaoPendente] = useState(false);
  const [carregandoRota, setCarregandoRota] = useState(false);
  const [distanciaRestante, setDistanciaRestante] = useState(0);
  const [tempoEstimado, setTempoEstimado] = useState('');
  
  const ultimaLocRotaRef = useRef(null);
  const geofenceListenerRef = useRef(null);

  // 1. Carrega pontos do banco
  useEffect(() => {
    if (!user?.uid) return;
    
    const q = query(collection(db, "cadastro_clientes_pontos"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const cercasData = [];
      snap.forEach((doc) => cercasData.push({ id: doc.id, ...doc.data() }));
      setTodasAsCercas(cercasData);
      
      // Se tem carga ativa, buscar geofence correspondente
      if (cargaAtiva) {
        buscarGeofenceParaCarga(cargaAtiva, cercasData);
      }
    });
    
    geofenceListenerRef.current = unsubscribe;
    return () => {
      if (geofenceListenerRef.current) {
        geofenceListenerRef.current();
      }
    };
  }, [user?.uid, cargaAtiva?.id]); 

  // 2. Buscar geofence específica para a carga
  const buscarGeofenceParaCarga = (carga, cercas) => {
    if (!carga || !cercas.length) return;
    
    const nomeBusca = (carga.destinoCliente || carga.clienteEntrega || "").toString().toUpperCase().trim();
    const encontrada = cercas.find(c => 
      (c.cliente || "").toUpperCase().trim() === nomeBusca ||
      (c.codigo || "").toString() === (carga.destinoCodigo || carga.codigoDestino || "").toString()
    );
    
    if (encontrada?.geofence) {
      setGeofenceAtiva(encontrada.geofence);
      
      // Se tem desenho de rota (polyline), usar como rota
      if (encontrada.geofence.tipo === 'polyline' && encontrada.geofence.coordenadas?.length > 0) {
        setRotaCoords(encontrada.geofence.coordenadas.map(p => ({
          latitude: p.lat,
          longitude: p.lng
        })));
      }
    } else {
      setGeofenceAtiva(null);
    }
  };

  // 3. Calcular rota automática quando viagem inicia
  useEffect(() => {
    if (!viagemIniciada || !location || !cargaAtiva) {
      setRotaCoords([]);
      return;
    }

    const calcularRota = async () => {
      setCarregandoRota(true);
      
      try {
        // Se já tem geofence com polyline, usar ela
        if (geofenceAtiva?.tipo === 'polyline' && geofenceAtiva.coordenadas?.length > 0) {
          console.log('Usando rota predefinida do geofence');
          setCarregandoRota(false);
          return; 
        }

        // Tentar obter coordenadas do destino
        let destinoCoords = null;
        
        // 1. Tentar pelo link do Google Maps
        if (cargaAtiva?.linkEntrega) {
          destinoCoords = await obterCoordenadasDoEndereco(cargaAtiva.linkEntrega);
        }
        
        // 2. Tentar pelo nome do cliente + cidade
        if (!destinoCoords && cargaAtiva?.destinoCliente && cargaAtiva?.destinoCidade) {
          const enderecoBusca = `${cargaAtiva.destinoCliente}, ${cargaAtiva.destinoCidade}`;
          destinoCoords = await obterCoordenadasDoEndereco(enderecoBusca);
        }
        
        // 3. Tentar pelas coordenadas do geofence
        if (!destinoCoords && geofenceAtiva?.centro) {
          destinoCoords = {
            lat: geofenceAtiva.centro.lat,
            lng: geofenceAtiva.centro.lng
          };
        }

        if (destinoCoords) {
          setDestinoCoord(destinoCoords);
          
          // Evitar recálculos frequentes
          if (ultimaLocRotaRef.current) {
            const d = getDistance(
              location.latitude, location.longitude,
              ultimaLocRotaRef.current.latitude, ultimaLocRotaRef.current.longitude
            );
            if (d < 500) { // Menos de 500m desde último cálculo
              setCarregandoRota(false);
              return;
            }
          }

          // Calcular rota via OSRM
          const rotaCalculada = await buscarRotaOSRM(
            { latitude: location.latitude, longitude: location.longitude },
            destinoCoords.lat,
            destinoCoords.lng
          );
          
          if (rotaCalculada && rotaCalculada.coordinates) {
            setRotaCoords(rotaCalculada.coordinates);
            
            // Calcular distância e tempo
            if (rotaCalculada.distance && rotaCalculada.duration) {
              const distKm = (rotaCalculada.distance / 1000).toFixed(1);
              const tempoMin = Math.round(rotaCalculada.duration / 60);
              
              setDistanciaRestante(parseFloat(distKm));
              setTempoEstimado(formatarTempo(tempoMin));
              
              // Atualizar no Firestore
              if (cargaAtiva?.id) {
                await updateDoc(doc(db, "ordens_servico", cargaAtiva.id), {
                  distanciaRestante: parseFloat(distKm),
                  tempoEstimado: tempoMin,
                  atualizadoEm: serverTimestamp()
                });
              }
            }
          }
          
          ultimaLocRotaRef.current = location;
        }
      } catch (error) {
        console.error("Erro ao calcular rota automática:", error);
        Alert.alert("Aviso", "Não foi possível calcular a rota automática.");
      } finally {
        setCarregandoRota(false);
      }
    };

    // Calcular rota imediatamente quando viagem inicia
    calcularRota();
    
    // Recalcular a cada 5 minutos ou quando mudar significativamente a localização
    const intervalo = setInterval(() => {
      if (viagemIniciada && location) {
        calcularRota();
      }
    }, 300000); // 5 minutos

    return () => clearInterval(intervalo);
  }, [viagemIniciada, geofenceAtiva, location?.latitude, cargaAtiva?.id]);

  // 4. Verificação de Chegada ao Destino
  useEffect(() => {
    if (!viagemIniciada || !location || chegouAoDestino || !cargaAtiva) return;

    const verificarChegada = async () => {
      const alvo = geofenceAtiva?.centro || destinoCoord;
      if (!alvo) return;

      const raio = geofenceAtiva?.raio || 300; // metros
      const d = getDistance(
        location.latitude, location.longitude,
        alvo.lat || alvo.latitude,
        alvo.lng || alvo.longitude
      );

      // Atualizar distância restante
      setDistanciaRestante(parseFloat((d / 1000).toFixed(1)));

      // Se chegou ao destino (dentro do raio)
      if (d <= raio) {
        const salvarChegada = async () => {
          try {
            await updateDoc(doc(db, "ordens_servico", cargaAtiva.id), { 
              status: 'AGUARDANDO CONFIRMAÇÃO',
              statusOperacional: 'NO DESTINO',
              chegouAoDestino: true,
              dataChegada: serverTimestamp(),
              distanciaRestante: 0,
              codigoDestinoConfirmacao: cargaAtiva.destinoCodigo || cargaAtiva.codigoDestino || '---',
              atualizadoEm: serverTimestamp()
            });
            
            setChegouAoDestino(true);
            setConfirmacaoPendente(true);
            
            // Notificação
            Vibration.vibrate([500, 500, 500, 500]);
            
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              Alert.alert(
                "🎉 Chegou ao Destino!",
                "Você está na área do cliente. Confirme sua chegada para finalizar a viagem.",
                [{ text: "OK" }]
              );
            }
            
          } catch (err) { 
            console.error('Erro ao salvar chegada:', err); 
          }
        };
        salvarChegada();
      }
    };

    // Verificar a cada 30 segundos
    const intervalo = setInterval(verificarChegada, 30000);
    verificarChegada(); // Verificar imediatamente
    
    return () => clearInterval(intervalo);
  }, [location?.latitude, geofenceAtiva, viagemIniciada, destinoCoord, chegouAoDestino]);

  // Função auxiliar para formatar tempo
  const formatarTempo = (minutos) => {
    if (minutos < 60) {
      return `${minutos} min`;
    } else {
      const horas = Math.floor(minutos / 60);
      const mins = minutos % 60;
      return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
    }
  };

  return { 
    geofenceAtiva, 
    rotaCoords, 
    destinoCoord, 
    chegouAoDestino, 
    confirmacaoPendente,
    carregandoRota,
    distanciaRestante,
    tempoEstimado,
    setChegouAoDestino, 
    setConfirmacaoPendente, 
    setRotaCoords 
  };
};

// Funções auxiliares exportadas
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

export const formatarTempoEstimado = (distanciaKm) => {
  const minutos = Math.round(distanciaKm * 1.5); // 1.5 min por km
  
  if (minutos < 60) {
    return `${minutos} min`;
  } else {
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    return minutosRestantes > 0 ? `${horas}h ${minutosRestantes}min` : `${horas}h`;
  }
};

export const calcularRotaAutomatica = async (origem, destino, setRotaCoords, cargaData = null) => {
  if (!origem || !destino) return null;
  
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
    
    const rota = await buscarRotaOSRM(origem, destinoCoords.lat, destinoCoords.lng);
    
    if (rota && rota.coordinates && setRotaCoords) {
      setRotaCoords(rota.coordinates);
    }
    
    return {
      destinoCoords,
      distancia: rota?.distance,
      duracao: rota?.duration
    };
    
  } catch (error) {
    console.error("Erro ao calcular rota automática:", error);
    return null;
  }
};