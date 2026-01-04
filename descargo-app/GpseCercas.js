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

export const useGpseCercas = (db, user, location, cargaAtiva, setCargaAtiva, viagemIniciada) => {
  const [todasAsCercas, setTodasAsCercas] = useState([]);
  const [geofenceAtiva, setGeofenceAtiva] = useState(null);
  const [rotaCoords, setRotaCoords] = useState([]);
  const [destinoCoord, setDestinoCoord] = useState(null);
  const [chegouAoDestino, setChegouAoDestino] = useState(false);
  const [confirmacaoPendente, setConfirmacaoPendente] = useState(false);
  
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

  // 3. Lógica da Rota (Ajustada para sua observação: Origem = App)
  useEffect(() => {
    if (!viagemIniciada || !location) return;

    const processarRota = async () => {
      // Se você desenhou uma POLYLINE no painel, ela vira o trajeto fixo
      if (geofenceAtiva?.tipo === 'polyline' && geofenceAtiva.coordenadas?.length > 0) {
        setRotaCoords(geofenceAtiva.coordenadas.map(p => ({
          latitude: p.lat,
          longitude: p.lng
        })));
        return; 
      }

      // Se não tem desenho de linha, calcula do seu GPS até o centro do destino
      const destinoFinal = geofenceAtiva?.centro || destinoCoord;
      if (destinoFinal) {
        const dLat = destinoFinal.lat || destinoFinal.latitude;
        const dLng = destinoFinal.lng || destinoFinal.longitude;

        if (ultimaLocRotaRef.current) {
          const d = getDistance(location.latitude, location.longitude, ultimaLocRotaRef.current.latitude, ultimaLocRotaRef.current.longitude);
          if (d < 500) return; 
        }

        buscarRotaOSRM(location, dLat, dLng, setRotaCoords);
        ultimaLocRotaRef.current = location;
      }
    };

    processarRota();
  }, [viagemIniciada, geofenceAtiva, location?.latitude]);

  // 4. Verificação de Chegada
  useEffect(() => {
    if (!viagemIniciada || !location || chegouAoDestino) return;

    const alvo = geofenceAtiva?.centro || (destinoCoord ? { lat: destinoCoord.latitude, lng: destinoCoord.longitude } : null);
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
  }, [location?.latitude, geofenceAtiva, viagemIniciada]);

  return { geofenceAtiva, rotaCoords, destinoCoord, chegouAoDestino, confirmacaoPendente, setChegouAoDestino, setConfirmacaoPendente, setRotaCoords };
};