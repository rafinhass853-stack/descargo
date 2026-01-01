import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  Alert, 
  ScrollView,
  Dimensions,
  Linking,
  Vibration,
  Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { FontAwesome, MaterialCommunityIcons, Ionicons, MaterialIcons } from '@expo/vector-icons';

// Componentes do Sistema
import Conta from './Conta'; 
import Jornada from './Jornada';
import Escala from './Escala';
import MinhasViagens from './MinhasViagens';
import Rotas from './Rotas';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  initializeAuth, 
  getReactNativePersistence 
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'; 
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  serverTimestamp,
  and,
  getDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDT5OptLHwnCVPuevN5Ie8SFWxm4mRPAl4",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:android:fd1b81db2c11ea523bca8d"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (e) {
  auth = getAuth(app);
}

const db = getFirestore(app);

const MapViewStatic = memo(({ html, webviewRef }) => {
  if (!html) {
    return (
      <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }
  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      source={{ html }}
      style={{ flex: 1, backgroundColor: '#000' }}
      onMessage={() => {}}
      androidLayerType="hardware"
      domStorageEnabled={true}
      javaScriptEnabled={true}
      startInLoadingState={true}
      renderLoading={() => <ActivityIndicator color="#FFD700" style={{position: 'absolute', top: '50%', left: '50%'}} />}
    />
  );
}, (prev, next) => prev.html === next.html);

const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

// Componente de Modal de Confirmação de Chegada
const ConfirmacaoChegadaModal = ({ visible, onConfirm, onCancel }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <MaterialIcons name="check-circle" size={40} color="#2ecc71" />
            <Text style={styles.modalTitle}>CHEGOU AO DESTINO!</Text>
          </View>
          
          <Text style={styles.modalMessage}>
            Você entrou na área de destino. Para finalizar a viagem, confirme sua chegada.
          </Text>
          
          <Text style={styles.modalSubmessage}>
            Esta ação registrará a finalização da viagem no sistema.
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalButtonCancel]} 
              onPress={onCancel}
            >
              <Text style={styles.modalButtonCancelText}>AGUARDAR</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalButtonConfirm]} 
              onPress={onConfirm}
            >
              <MaterialIcons name="check" size={20} color="#fff" />
              <Text style={styles.modalButtonConfirmText}>CONFIRMAR CHEGADA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function App() {
  const webviewRef = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('painel'); 
  const [user, setUser] = useState(null); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [hasCentered, setHasCentered] = useState(false); 
  const [currentSpeed, setCurrentSpeed] = useState(0); 
  const [cargaAtiva, setCargaAtiva] = useState(null);
  const [todasAsCercas, setTodasAsCercas] = useState([]);
  const [geofenceAtiva, setGeofenceAtiva] = useState(null); 
  const [statusOperacional, setStatusOperacional] = useState('Sem programação');
  const [statusJornada, setStatusJornada] = useState('fora da jornada');
  const [rotaCoords, setRotaCoords] = useState([]);
  const [destinoCoord, setDestinoCoord] = useState(null);
  const [chegouAoDestino, setChegouAoDestino] = useState(false);
  const [confirmacaoPendente, setConfirmacaoPendente] = useState(false);
  const [showConfirmacaoModal, setShowConfirmacaoModal] = useState(false);
  const [finalizandoViagem, setFinalizandoViagem] = useState(false);
  const [viagemIniciada, setViagemIniciada] = useState(false);
  
  // Estados para instruções de navegação
  const [instrucoesNavegacao, setInstrucoesNavegacao] = useState([]);
  const [instrucaoAtualIndex, setInstrucaoAtualIndex] = useState(0);
  const [mostrarInstrucoes, setMostrarInstrucoes] = useState(false);

  const openLink = (url) => Linking.openURL(url);

  const mapHtml = useMemo(() => {
    if (!location) return null;

    const lat = location.latitude;
    const lng = location.longitude;

    // Cerca da geofence ativa (se houver)
    let cercaJs = '';
    if (cargaAtiva?.cercaVirtual?.ativa && cargaAtiva.cercaVirtual.centro) {
      const geofence = cargaAtiva.cercaVirtual;
      if (geofence.tipo === 'circle') {
        const raio = geofence.raio || 100;
        const cor = chegouAoDestino ? '#2ecc71' : '#FFD700';
        cercaJs = `
          L.circle([${geofence.centro.lat}, ${geofence.centro.lng}], {
            radius: ${raio},
            color: '${cor}',
            weight: 3,
            fillOpacity: 0.2,
            dashArray: chegouAoDestino ? '10, 10' : null
          }).addTo(map);
          
          // Marcador do destino
          L.marker([${geofence.centro.lat}, ${geofence.centro.lng}], {
            icon: L.divIcon({
              html: '<div style="background-color:${chegouAoDestino ? '#2ecc71' : '#FFD700'}; width:20px; height:20px; border-radius:50%; border:3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
              className: 'custom-div-icon',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })
          }).addTo(map).bindPopup('Destino Final');
        `;
      }
    }

    // Renderização da rota
    const rotaJs = rotaCoords && rotaCoords.length > 0 
      ? `var polyline = L.polyline(${JSON.stringify(rotaCoords.map(c => [c.latitude, c.longitude]))}, {color: '#FFD700', weight: 6, opacity: 0.8}).addTo(map);
         map.fitBounds(polyline.getBounds(), {padding: [50, 50]});`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style> 
          body { margin: 0; padding: 0; background: #000; overflow: hidden; } 
          #map { height: 100vh; width: 100vw; } 
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 16);
          L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: 'Google Maps'
          }).addTo(map);
          
          var motoristaIcon = L.divIcon({
            html: '<div style="background-color:#FFD700; width:18px; height:18px; border-radius:50%; border:3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
            className: 'custom-div-icon', 
            iconSize: [18, 18], 
            iconAnchor: [9, 9]
          });
          
          var marker = L.marker([${lat}, ${lng}], {icon: motoristaIcon}).addTo(map);
          
          ${cercaJs}
          ${rotaJs}
          
          window.addEventListener('message', function(e) {
            try {
              var data = JSON.parse(e.data);
              if(data.type === 'updateLoc') { 
                marker.setLatLng([data.lat, data.lng]); 
                if(data.center) {
                  map.flyTo([data.lat, data.lng], 16);
                }
              }
              if(data.type === 'center') { 
                map.flyTo([data.lat, data.lng], 16); 
              }
            } catch(err) {}
          });
        </script>
      </body>
      </html>
    `;
  }, [todasAsCercas, rotaCoords, !!location, cargaAtiva?.id, chegouAoDestino, cargaAtiva?.cercaVirtual]);

  useEffect(() => {
    if (location && webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({ 
        type: 'updateLoc', 
        lat: location.latitude, 
        lng: location.longitude,
        center: !hasCentered
      }));
      
      if (!hasCentered) {
        setHasCentered(true);
      }
    }
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    if (isLoggedIn) {
      const q = query(collection(db, "cadastro_clientes_pontos"));
      const unsubscribeCercas = onSnapshot(q, (snap) => {
        const cercasData = [];
        snap.forEach((doc) => { cercasData.push({ id: doc.id, ...doc.data() }); });
        setTodasAsCercas(cercasData);
      }, (error) => console.error("Erro Cercas:", error));
      return () => unsubscribeCercas();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (cargaAtiva) {
      // Usar geofence da própria carga (configurada pelo gestor)
      if (cargaAtiva.cercaVirtual?.ativa && cargaAtiva.cercaVirtual.centro) {
        setGeofenceAtiva(cargaAtiva.cercaVirtual);
      } else {
        // Fallback para geofence do cliente cadastrado
        const nomeClienteRaw = cargaAtiva?.destinoCliente || cargaAtiva?.cliente_destino;
        if (nomeClienteRaw) {
          const nomeLimpo = nomeClienteRaw.toString().toUpperCase().trim();
          const encontrada = todasAsCercas.find(c => (c.cliente || "").toUpperCase().trim() === nomeLimpo);
          if (encontrada && encontrada.geofence) { 
            setGeofenceAtiva(encontrada.geofence); 
          } else {
            setGeofenceAtiva(null);
          }
        }
      }
    } else { 
      setGeofenceAtiva(null); 
    }
  }, [cargaAtiva, todasAsCercas]);

  const buscarRotaOSRM = async (origem, latDest, lngDest) => {
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

  useEffect(() => {
    const atualizarDestinoERota = async () => {
      if (!cargaAtiva) {
        setRotaCoords([]);
        setDestinoCoord(null);
        return;
      }

      // Verificar se já tem trajeto definido
      if (cargaAtiva.trajeto && Array.isArray(cargaAtiva.trajeto) && cargaAtiva.trajeto.length > 0) {
        setRotaCoords(cargaAtiva.trajeto);
        const ultimo = cargaAtiva.trajeto[cargaAtiva.trajeto.length - 1];
        setDestinoCoord({ latitude: ultimo.latitude, longitude: ultimo.longitude });
      } 
      // Usar geofence da carga
      else if (cargaAtiva.cercaVirtual?.centro?.lat) {
        const dLat = cargaAtiva.cercaVirtual.centro.lat; 
        const dLng = cargaAtiva.cercaVirtual.centro.lng;
        setDestinoCoord({ latitude: dLat, longitude: dLng });
        if (location) {
          buscarRotaOSRM(location, dLat, dLng);
        }
      }
      // Fallback para geofence do cliente
      else if (geofenceAtiva?.centro?.lat && location) {
        const dLat = geofenceAtiva.centro.lat; 
        const dLng = geofenceAtiva.centro.lng;
        setDestinoCoord({ latitude: dLat, longitude: dLng });
        buscarRotaOSRM(location, dLat, dLng);
      } 
      // Fallback para geocoding da cidade
      else if (cargaAtiva && location) {
        const cidade = cargaAtiva.destinoCidade || cargaAtiva.cidade_destino;
        if (cidade) {
          const geo = await Location.geocodeAsync(cidade);
          if (geo.length > 0) {
            setDestinoCoord({ latitude: geo[0].latitude, longitude: geo[0].longitude });
            buscarRotaOSRM(location, geo[0].latitude, geo[0].longitude);
          }
        }
      }
    };
    atualizarDestinoERota();
  }, [cargaAtiva?.id, geofenceAtiva, !!location]);

  // Função para verificar chegada ao destino
  const verificarChegadaAoDestino = async () => {
    if (!cargaAtiva || !location || cargaAtiva.finalizada) return;
    
    try {
      const cargaRef = doc(db, "ordens_servico", cargaAtiva.id);
      const cargaSnapshot = await getDoc(cargaRef);
      const cargaData = cargaSnapshot.data();
      
      // Se já está finalizada, não faz nada
      if (cargaData.finalizada) {
        return;
      }
      
      // Se já chegou ao destino e está aguardando confirmação
      if (cargaData.chegouAoDestino && cargaData.confirmacaoPendente && !confirmacaoPendente) {
        setConfirmacaoPendente(true);
        setChegouAoDestino(true);
        return;
      }
      
      // Verificar se está dentro da geofence
      let estaDentro = false;
      
      // Verificar geofence da carga (prioridade)
      if (cargaData.cercaVirtual?.ativa && cargaData.cercaVirtual.centro) {
        const geofence = cargaData.cercaVirtual;
        const dist = getDistance(
          location.latitude, 
          location.longitude, 
          geofence.centro.lat, 
          geofence.centro.lng
        );
        estaDentro = dist <= (parseFloat(geofence.raio) + 30);
      }
      // Fallback para destino coordenadas
      else if (destinoCoord) {
        const dist = getDistance(
          location.latitude, 
          location.longitude, 
          destinoCoord.latitude, 
          destinoCoord.longitude
        );
        estaDentro = dist <= 300; // 300 metros como fallback
      }
      
      // Se entrou na área pela primeira vez
      if (estaDentro && !cargaData.chegouAoDestino) {
        // Atualizar no Firestore
        await updateDoc(cargaRef, {
          chegouAoDestino: true,
          confirmacaoPendente: true,
          dataChegada: serverTimestamp(),
          status: 'AGUARDANDO CONFIRMAÇÃO'
        });
        
        // Atualizar estado local
        setCargaAtiva(prev => ({
          ...prev,
          chegouAoDestino: true,
          confirmacaoPendente: true,
          status: 'AGUARDANDO CONFIRMAÇÃO'
        }));
        
        setChegouAoDestino(true);
        setConfirmacaoPendente(true);
        
        // Mostrar modal de confirmação
        setShowConfirmacaoModal(true);
        
        // Vibração de alerta
        Vibration.vibrate([500, 500, 500, 500]);
      }
      
      // Se saiu da área
      if (!estaDentro && chegouAoDestino && !confirmacaoPendente) {
        setChegouAoDestino(false);
      }
      
    } catch (error) {
      console.error("Erro ao verificar chegada:", error);
    }
  };

  // Monitorar localização para verificar chegada
  useEffect(() => {
    if (location && cargaAtiva && !cargaAtiva.finalizada && viagemIniciada) {
      verificarChegadaAoDestino();
    }
  }, [location, cargaAtiva?.id]);

  // Função para confirmar chegada (chamada pelo motorista)
  const confirmarChegada = async () => {
    if (!cargaAtiva) return;
    
    setFinalizandoViagem(true);
    setShowConfirmacaoModal(false);
    
    try {
      const cargaRef = doc(db, "ordens_servico", cargaAtiva.id);
      
      await updateDoc(cargaRef, {
        finalizada: true,
        confirmacaoPendente: false,
        status: 'FINALIZADA',
        dataFinalizacao: serverTimestamp(),
        // Limpar dados de navegação
        instrucaoAtual: 0
      });
      
      // Atualizar estado local
      const cargaAtualizada = { ...cargaAtiva };
      cargaAtualizada.finalizada = true;
      cargaAtualizada.confirmacaoPendente = false;
      cargaAtualizada.status = 'FINALIZADA';
      
      // Limpar carga ativa após um delay
      setTimeout(() => {
        setCargaAtiva(null);
        setViagemIniciada(false);
        setStatusOperacional('Sem programação');
        setChegouAoDestino(false);
        setConfirmacaoPendente(false);
        setRotaCoords([]);
        setInstrucoesNavegacao([]);
        
        // Sincronizar com Firestore
        sincronizarComFirestore({ 
          statusOperacional: 'Sem programação'
        });
      }, 3000);
      
      Alert.alert(
        "✅ VIAGEM FINALIZADA!",
        "A viagem foi registrada com sucesso no sistema.\n\nEm 3 segundos você será redirecionado para o painel.",
        [{ text: "OK" }]
      );
      
    } catch (error) {
      console.error("Erro ao finalizar:", error);
      Alert.alert("Erro", "Não foi possível finalizar a viagem.");
    } finally {
      setFinalizandoViagem(false);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setIsLoggedIn(true); } 
      else { setUser(null); setIsLoggedIn(false); }
    });
    return () => unsubscribeAuth();
  }, []);

  const sincronizarComFirestore = async (extra = {}) => {
    const cur = auth.currentUser; 
    if (!cur) return;
    try {
      const dados = { 
        motoristaId: cur.uid, 
        email: cur.email, 
        ultimaAtualizacao: serverTimestamp() 
      };
      if (extra.latitude || location?.latitude) {
        dados.latitude = extra.latitude || location.latitude;
        dados.longitude = extra.longitude || location.longitude;
      }
      dados.statusOperacional = extra.statusOperacional || statusOperacional || "Sem programação";
      dados.statusJornada = extra.statusJornada || statusJornada || "fora da jornada";
      dados.velocidade = extra.velocidade !== undefined ? extra.velocidade : currentSpeed; 
      dados.cargaAtiva = cargaAtiva?.id || null;
      dados.viagemIniciada = viagemIniciada;
      
      await setDoc(doc(db, "localizacao_realtime", cur.uid), dados, { merge: true });
    } catch (e) { console.error("Erro sincronia:", e); }
  };

  useEffect(() => {
    if (isLoggedIn && user) {
      const q = query(
        collection(db, "ordens_servico"), 
        and(
          where("motoristaId", "==", user.uid), 
          where("status", "in", ["AGUARDANDO PROGRAMAÇÃO", "PENDENTE ACEITE", "ACEITO", "EM ANDAMENTO", "AGUARDANDO CONFIRMAÇÃO"])
        )
      );
      
      const unsubscribeCargas = onSnapshot(q, (snap) => {
        snap.docChanges().forEach((change) => {
          const d = change.doc.data(); 
          const id = change.doc.id;
          
          // Nova carga ou carga pendente
          if ((change.type === "added" || change.type === "modified") && 
              (d.status === "AGUARDANDO PROGRAMAÇÃO" || d.status === "PENDENTE ACEITE")) {
            
            Vibration.vibrate([0, 500, 500, 500], true);
            
            const temInstrucoes = d.trajetoComInstrucoes && d.trajetoComInstrucoes.length > 0;
            const mensagemInstrucoes = temInstrucoes 
              ? `\n🔊 ${d.trajetoComInstrucoes.length} instruções de navegação disponíveis`
              : '';
            
            const temGeofence = d.cercaVirtual?.ativa;
            const mensagemGeofence = temGeofence 
              ? `\n📍 Sistema de geofence ativo (${d.cercaVirtual.raio}m)` 
              : '';
            
            Alert.alert(
              d.tipoViagem === 'VAZIO' ? "⚪ DESLOCAMENTO DE VAZIO" : "🔔 NOVA CARGA", 
              `Destino: ${d.destinoCliente || d.cliente_destino}${mensagemInstrucoes}${mensagemGeofence}\n\nA viagem iniciará automaticamente ao ser aceita.`, 
              [
                { 
                  text: "RECUSAR", 
                  style: "cancel", 
                  onPress: async () => { 
                    Vibration.cancel(); 
                    await updateDoc(doc(db, "ordens_servico", id), { 
                      status: "RECUSADO" 
                    }); 
                  }
                },
                { 
                  text: "ACEITAR", 
                  onPress: () => { 
                    Vibration.cancel(); 
                    aceitarCarga(id, d); 
                  }
                }
              ]
            );
          }
          
          // Carga aceita - INICIAR VIAGEM AUTOMATICAMENTE
          if (change.type === "modified" && d.status === "ACEITO" && !viagemIniciada) {
            iniciarViagem(id, d);
          }
          
          // Carga em andamento
          if (d.status === "EM ANDAMENTO" || d.status === "AGUARDANDO CONFIRMAÇÃO") {
            setCargaAtiva({ id, ...d });
            setViagemIniciada(true);
            
            if (d.status === "AGUARDANDO CONFIRMAÇÃO") {
              setChegouAoDestino(true);
              setConfirmacaoPendente(true);
              setShowConfirmacaoModal(true);
            }
          }
        });
        
        // Se não há cargas ativas
        if (snap.empty && cargaAtiva) {
          setCargaAtiva(null);
          setViagemIniciada(false);
        }
      });
      
      return () => unsubscribeCargas();
    }
  }, [isLoggedIn, user, viagemIniciada]);

  const aceitarCarga = async (id, d) => {
    try {
      await updateDoc(doc(db, "ordens_servico", id), { 
        status: "ACEITO", 
        aceitoEm: serverTimestamp(),
        dataInicioViagem: serverTimestamp()
      });
      
      // NÃO atualizar estado local aqui - a viagem será iniciada automaticamente
      // quando o Firestore notificar a mudança para "ACEITO"
      
      Alert.alert(
        "✅ CARGA ACEITA!",
        "A viagem será iniciada automaticamente em alguns segundos.",
        [{ text: "OK" }]
      );
      
    } catch (error) {
      console.error("Erro ao aceitar carga:", error);
      Alert.alert("Erro", "Não foi possível aceitar a carga.");
    }
  };

  const iniciarViagem = async (id, d) => {
    try {
      // Atualizar status para EM ANDAMENTO
      await updateDoc(doc(db, "ordens_servico", id), {
        status: "EM ANDAMENTO",
        dataInicioViagem: serverTimestamp()
      });
      
      // Atualizar estado local
      const cargaIniciada = { id, ...d, status: "EM ANDAMENTO" };
      setCargaAtiva(cargaIniciada);
      setViagemIniciada(true);
      setStatusOperacional(d.tipoViagem === 'VAZIO' ? 'Viagem vazio' : 'Viagem carregado');
      
      // Configurar instruções de navegação se houver
      if (d.trajetoComInstrucoes && d.trajetoComInstrucoes.length > 0) {
        setInstrucoesNavegacao(d.trajetoComInstrucoes);
        setInstrucaoAtualIndex(0);
        
        // Falar primeira instrução
        if (d.trajetoComInstrucoes[0]) {
          Speech.speak(d.trajetoComInstrucoes[0].instrucao, {
            language: 'pt-BR',
            pitch: 1.0,
            rate: 0.9
          });
        }
      }
      
      // Sincronizar com Firestore
      sincronizarComFirestore({ 
        statusOperacional: d.tipoViagem === 'VAZIO' ? 'Viagem vazio' : 'Viagem carregado'
      });
      
      Alert.alert(
        "🚚 VIAGEM INICIADA!",
        "A viagem foi iniciada automaticamente.\n\nSiga as instruções de navegação e mantenha o app aberto.",
        [{ text: "ENTENDI" }]
      );
      
    } catch (error) {
      console.error("Erro ao iniciar viagem:", error);
      Alert.alert("Erro", "Não foi possível iniciar a viagem.");
    }
  };

  // Função para falar próxima instrução
  const falarProximaInstrucao = () => {
    if (instrucoesNavegacao.length > 0 && instrucaoAtualIndex < instrucoesNavegacao.length - 1) {
      const proximoIndex = instrucaoAtualIndex + 1;
      const proximaInstrucao = instrucoesNavegacao[proximoIndex];
      
      Speech.speak(proximaInstrucao.instrucao, {
        language: 'pt-BR',
        pitch: 1.0,
        rate: 0.9
      });
      
      setInstrucaoAtualIndex(proximoIndex);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Atenção', 'Preencha tudo.');
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      setUser(res.user); 
      setIsLoggedIn(true);
    } catch (e) { 
      Alert.alert('Erro', 'Verifique os dados.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleLogout = async () => {
    Alert.alert("Sair", "Encerrar sessão?", [
      { text: "Não" }, 
      { 
        text: "Sim", 
        onPress: async () => { 
          await signOut(auth); 
          setIsLoggedIn(false);
          setCargaAtiva(null);
          setViagemIniciada(false);
          Speech.stop();
        }
      }
    ]);
  };

  useEffect(() => {
    let sub;
    if (isLoggedIn) {
      (async () => {
        let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') return;
        
        sub = await Location.watchPositionAsync({ 
          accuracy: Location.Accuracy.High, 
          timeInterval: 2000, 
          distanceInterval: 1 
        }, (loc) => {
          if (loc.coords) { 
            const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
            const finalSpeed = speedKmh < 0 ? 0 : speedKmh;
            setLocation(loc.coords); 
            setCurrentSpeed(finalSpeed);
            sincronizarComFirestore({ 
              latitude: loc.coords.latitude, 
              longitude: loc.coords.longitude,
              velocidade: finalSpeed 
            }); 
          }
        });
      })();
    }
    return () => { if (sub) sub.remove(); };
  }, [isLoggedIn]);

  const renderContent = () => {
    switch (activeTab) {
      case 'painel':
        return (
          <View style={{flex: 1}}>
            <MapViewStatic html={mapHtml} webviewRef={webviewRef} />
            
            {/* Speedometer */}
            <View style={styles.speedometerContainer}>
              <Text style={styles.speedText}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>KM/H</Text>
            </View>
            
            {/* Botão de instruções (se houver) */}
            {instrucoesNavegacao.length > 0 && (
              <TouchableOpacity 
                style={styles.botaoInstrucoes}
                onPress={() => setMostrarInstrucoes(!mostrarInstrucoes)}
              >
                <MaterialIcons name="volume-up" size={24} color="#FFD700" />
                <Text style={styles.botaoInstrucoesTexto}>
                  {mostrarInstrucoes ? 'OCULTAR' : 'VER'} INSTRUÇÕES
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Card da viagem ativa */}
            {cargaAtiva && (
              <View style={[
                styles.floatingRouteCard, 
                chegouAoDestino && {borderColor: '#2ecc71', borderLeftWidth: 5},
                confirmacaoPendente && {borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.05)'}
              ]}>
                <View style={styles.routeHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>
                      {cargaAtiva.tipoViagem === 'VAZIO' ? '⚪ VIAGEM VAZIO' : '🚚 VIAGEM CARREGADO'} • DT {cargaAtiva.dt || '---'}
                    </Text>
                    <Text style={styles.routeInfo} numberOfLines={1}>
                      {cargaAtiva.destinoCliente || cargaAtiva.cliente_destino}
                    </Text>
                    
                    {chegouAoDestino && !confirmacaoPendente && (
                      <Text style={{color: '#2ecc71', fontSize: 10, fontWeight: 'bold', marginTop: 2}}>
                        🎯 APROXIMANDO-SE DO DESTINO
                      </Text>
                    )}
                    
                    {confirmacaoPendente && (
                      <Text style={{color: '#FFD700', fontSize: 10, fontWeight: 'bold', marginTop: 2}}>
                        ⚠️ AGUARDANDO CONFIRMAÇÃO DE CHEGADA
                      </Text>
                    )}
                    
                    {cargaAtiva.cercaVirtual?.ativa && (
                      <Text style={{color: '#3498db', fontSize: 9, marginTop: 2}}>
                        📍 Cerca virtual: {cargaAtiva.cercaVirtual.raio}m
                      </Text>
                    )}
                  </View>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <MaterialIcons 
                      name="location-on" 
                      size={30} 
                      color={confirmacaoPendente ? "#FFD700" : chegouAoDestino ? "#2ecc71" : "#444"} 
                    />
                  </View>
                </View>
                
                {/* Instruções de navegação (se estiverem visíveis) */}
                {mostrarInstrucoes && instrucoesNavegacao.length > 0 && (
                  <View style={styles.instrucoesContainer}>
                    <Text style={styles.instrucoesTitulo}>INSTRUÇÕES DE NAVEGAÇÃO:</Text>
                    <ScrollView style={styles.instrucoesLista} showsVerticalScrollIndicator={false}>
                      {instrucoesNavegacao.map((inst, idx) => (
                        <View key={idx} style={[
                          styles.instrucaoItem,
                          idx === instrucaoAtualIndex && styles.instrucaoAtual
                        ]}>
                          <View style={styles.instrucaoIcone}>
                            {idx === instrucaoAtualIndex ? (
                              <MaterialIcons name="navigation" size={16} color="#FFD700" />
                            ) : idx < instrucaoAtualIndex ? (
                              <MaterialIcons name="check" size={16} color="#2ecc71" />
                            ) : (
                              <MaterialIcons name="more-horiz" size={16} color="#666" />
                            )}
                          </View>
                          <View style={styles.instrucaoConteudo}>
                            <Text style={styles.instrucaoTexto}>{inst.instrucao}</Text>
                            <Text style={styles.instrucaoDetalhes}>
                              {inst.distanciaAteProximo} • {inst.duracao}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                    
                    <TouchableOpacity 
                      style={styles.botaoProximaInstrucao}
                      onPress={falarProximaInstrucao}
                      disabled={instrucaoAtualIndex >= instrucoesNavegacao.length - 1}
                    >
                      <MaterialIcons name="volume-up" size={16} color="#000" />
                      <Text style={styles.botaoProximaInstrucaoTexto}>PRÓXIMA INSTRUÇÃO</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* Botão para abrir navegação completa */}
                {instrucoesNavegacao.length === 0 && (
                  <TouchableOpacity 
                    style={styles.reiniciarNavegacaoBtn}
                    onPress={() => {
                      Alert.alert(
                        "Navegação",
                        "Esta viagem não possui instruções de navegação detalhadas.\n\nSiga para o destino indicado no mapa.",
                        [{ text: "ENTENDI" }]
                      );
                    }}
                  >
                    <MaterialIcons name="directions" size={16} color="#FFD700" />
                    <Text style={styles.reiniciarNavegacaoText}>INFORMAÇÕES DA ROTA</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            {/* Status da viagem */}
            {viagemIniciada && !cargaAtiva?.finalizada && (
              <View style={styles.statusViagemContainer}>
                <View style={[
                  styles.statusViagemDot,
                  { backgroundColor: confirmacaoPendente ? '#FFD700' : chegouAoDestino ? '#2ecc71' : '#FFD700' }
                ]} />
                <Text style={styles.statusViagemTexto}>
                  {confirmacaoPendente ? 'AGUARDANDO CONFIRMAÇÃO' : 
                   chegouAoDestino ? 'CHEGOU AO DESTINO' : 
                   'VIAGEM EM ANDAMENTO'}
                </Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.floatingGps} onPress={() => {
                if (webviewRef.current && location) { 
                  webviewRef.current.postMessage(JSON.stringify({ 
                    type: 'center', 
                    lat: location.latitude, 
                    lng: location.longitude 
                  })); 
                }
            }}>
              <MaterialIcons name="my-location" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
        );
      case 'rotas': return <Rotas auth={auth} db={db} setCargaAtiva={setCargaAtiva} setActiveTab={setActiveTab} />;
      case 'viagens': return <MinhasViagens auth={auth} db={db} />;
      case 'escala': return <Escala auth={auth} db={db} />; 
      case 'jornada': return <Jornada auth={auth} db={db} />;
      case 'perfil': return <Conta auth={auth} db={db} />;
      default: return null;
    }
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.logoText}>DESCARGO</Text>
              <View style={styles.underline} />
              <Text style={styles.subtitle}>PAINEL DO MOTORISTA</Text>
            </View>
            <View style={styles.form}>
              <TextInput 
                style={styles.input} 
                placeholder="E-mail" 
                placeholderTextColor="#666" 
                value={email} 
                onChangeText={setEmail} 
                autoCapitalize="none" 
                keyboardType="email-address" 
              />
              <TextInput 
                style={styles.input} 
                placeholder="Senha" 
                placeholderTextColor="#666" 
                value={password} 
                onChangeText={setPassword} 
                secureTextEntry 
              />
              <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>ENTRAR NO SISTEMA</Text>}
              </TouchableOpacity>
            </View>
            <View style={styles.socialContainer}>
              <Text style={styles.socialTitle}>SUPORTE E REDES SOCIAIS</Text>
              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialIcon} onPress={() => openLink('https://wa.me/5519996969894')}>
                  <FontAwesome name="whatsapp" size={24} color="#25D366" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialIcon} onPress={() => openLink('https://instagram.com/rafasousa_oficial')}>
                  <FontAwesome name="instagram" size={24} color="#E1306C" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialIcon} onPress={() => openLink('https://www.linkedin.com/in/rafael-araujo-64758a1a5/')}>
                  <FontAwesome name="linkedin" size={24} color="#0077B5" />
                </TouchableOpacity>
              </View>
              <Text style={styles.signature}>Desenvolvido por Rafael Araujo</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{flex: 1, paddingTop: activeTab === 'painel' ? 0 : 60}}>
        {renderContent()}
        
        {/* MODAL DE CONFIRMAÇÃO DE CHEGADA */}
        <ConfirmacaoChegadaModal
          visible={showConfirmacaoModal}
          onConfirm={confirmarChegada}
          onCancel={() => setShowConfirmacaoModal(false)}
        />
      </View>
      
      {/* Navigation Bar */}
      <View style={styles.floatingNavContainer}>
        <View style={styles.floatingNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('painel')}>
            <Ionicons name="map" size={24} color={activeTab === 'painel' ? "#FFD700" : "#666"} />
            {activeTab === 'painel' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('rotas')}>
            <MaterialCommunityIcons name="map-marker-path" size={24} color={activeTab === 'rotas' ? "#FFD700" : "#666"} />
            {activeTab === 'rotas' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('viagens')}>
            <MaterialCommunityIcons name="truck-delivery" size={24} color={activeTab === 'viagens' ? "#FFD700" : "#666"} />
            {activeTab === 'viagens' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('escala')}>
            <MaterialCommunityIcons name="calendar-clock" size={24} color={activeTab === 'escala' ? "#FFD700" : "#666"} />
            {activeTab === 'escala' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('jornada')}>
            <Ionicons name="timer" size={24} color={activeTab === 'jornada' ? "#FFD700" : "#666"} />
            {activeTab === 'jornada' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('perfil')}>
            <MaterialCommunityIcons name="shield-account" size={24} color={activeTab === 'perfil' ? "#FFD700" : "#666"} />
            {activeTab === 'perfil' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color="#ff4d4d" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loginContainer: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 30, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 50 },
  logoText: { fontSize: 52, fontWeight: '900', color: '#FFD700', letterSpacing: -2 },
  underline: { height: 4, width: 70, backgroundColor: '#D97706', marginTop: -5 },
  subtitle: { color: '#888', fontSize: 12, fontWeight: 'bold', marginTop: 25, letterSpacing: 2 },
  form: { width: '100%', maxWidth: 400 },
  input: { backgroundColor: '#111', color: '#FFF', padding: 18, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#222', fontSize: 16 },
  button: { backgroundColor: '#FFD700', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#000', fontWeight: '900', fontSize: 16 },
  socialContainer: { marginTop: 40, alignItems: 'center' },
  socialTitle: { color: '#444', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 15 },
  socialRow: { flexDirection: 'row', gap: 25, marginBottom: 20 },
  socialIcon: { padding: 10, backgroundColor: '#111', borderRadius: 50, borderWidth: 1, borderColor: '#222' },
  signature: { color: '#333', fontSize: 10, fontWeight: 'bold' },
  
  // Speedometer
  speedometerContainer: { 
    position: 'absolute', 
    top: 50, 
    right: 20, 
    width: 70, 
    height: 70, 
    backgroundColor: 'rgba(0,0,0,0.9)', 
    borderRadius: 35, 
    borderWidth: 2, 
    borderColor: '#FFD700', 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 10, 
    zIndex: 10 
  },
  speedText: { color: '#FFD700', fontSize: 24, fontWeight: '900' },
  speedUnit: { color: '#FFF', fontSize: 8, fontWeight: 'bold', marginTop: -2 },
  
  // Botão de instruções
  botaoInstrucoes: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FFD700',
    gap: 8,
    zIndex: 10,
  },
  botaoInstrucoesTexto: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Card da viagem
  floatingRouteCard: { 
    position: 'absolute', 
    bottom: 120, 
    left: 20, 
    right: 20, 
    backgroundColor: 'rgba(15,15,15,0.95)', 
    borderRadius: 20, 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#FFD70033', 
    elevation: 5, 
    zIndex: 5,
    maxHeight: '50%'
  },
  routeLabel: { color: '#FFD700', fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  routeInfo: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  routeHeader: { flexDirection: 'row', alignItems: 'center' },
  
  // Instruções de navegação
  instrucoesContainer: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 10,
  },
  instrucoesTitulo: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  instrucoesLista: {
    maxHeight: 150,
  },
  instrucaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  instrucaoAtual: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 5,
  },
  instrucaoIcone: {
    width: 24,
    alignItems: 'center',
    marginRight: 10,
  },
  instrucaoConteudo: {
    flex: 1,
  },
  instrucaoTexto: {
    color: '#FFF',
    fontSize: 12,
    marginBottom: 2,
  },
  instrucaoDetalhes: {
    color: '#666',
    fontSize: 10,
  },
  botaoProximaInstrucao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  botaoProximaInstrucaoTexto: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  reiniciarNavegacaoBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    backgroundColor: '#1a1a00', 
    padding: 10, 
    borderRadius: 10, 
    marginTop: 10, 
    borderWidth: 1, 
    borderColor: '#FFD700' 
  },
  reiniciarNavegacaoText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold' },
  
  // Status da viagem
  statusViagemContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 10,
    zIndex: 10,
  },
  statusViagemDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusViagemTexto: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  floatingGps: { 
    position: 'absolute', 
    bottom: 200, 
    right: 20, 
    backgroundColor: 'rgba(0,0,0,0.9)', 
    padding: 12, 
    borderRadius: 50, 
    borderWidth: 1, 
    borderColor: '#222', 
    zIndex: 5 
  },
  
  floatingNavContainer: { 
    position: 'absolute', 
    bottom: 30, 
    left: 0, 
    right: 0, 
    alignItems: 'center', 
    zIndex: 10 
  },
  floatingNav: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(15,15,15,0.98)', 
    paddingVertical: 12, 
    paddingHorizontal: 15, 
    borderRadius: 40, 
    borderWidth: 1, 
    borderColor: '#222', 
    gap: 15, 
    elevation: 10 
  },
  navItem: { alignItems: 'center', justifyContent: 'center', width: 42 },
  activeIndicator: { position: 'absolute', bottom: -8, width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFD700' },
  
  // Modal de confirmação
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#2ecc71',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  modalMessage: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  modalSubmessage: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#666',
  },
  modalButtonConfirm: {
    backgroundColor: '#2ecc71',
  },
  modalButtonCancelText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalButtonConfirmText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});