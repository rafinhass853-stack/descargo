import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator, 
  Alert, 
  Vibration,
  Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, Ionicons, MaterialIcons } from '@expo/vector-icons';

// Componentes
import Conta from './Conta'; 
import Jornada from './Jornada';
import Escala from './Escala';
import MinhasViagens from './MinhasViagens';
import TelaLogin from './TelaLogin';
import StatusAtual from './StatusAtual';
import useMonitorarCargas from './MonitorarCargas'; 
import { getDistance, buscarRotaOSRM } from './MapUtils';

// Firebase
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
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

// Config Firebase
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
  auth = initializeAuth(app, { persistence: getReactNativePersistence(ReactNativeAsyncStorage) });
} catch (e) { auth = getAuth(app); }
const db = getFirestore(app);

// Componentes Internos Otimizados
const MapViewStatic = React.memo(({ html, webviewRef }) => {
  if (!html) return (
    <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" color="#FFD700" />
    </View>
  );
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
      startInLoadingState={false}
    />
  );
}, (prev, next) => prev.html === next.html);

const ConfirmacaoChegadaModal = ({ visible, onConfirm, onCancel }) => (
  <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onCancel}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <MaterialIcons name="check-circle" size={40} color="#2ecc71" />
          <Text style={styles.modalTitle}>CHEGOU AO DESTINO!</Text>
        </View>
        <Text style={styles.modalMessage}>Você entrou na área de destino. Para finalizar a viagem, confirme sua chegada.</Text>
        <Text style={styles.modalSubmessage}>Esta ação registrará a finalização da viagem no sistema.</Text>
        <View style={styles.modalButtons}>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={onCancel}>
            <Text style={styles.modalButtonCancelText}>AGUARDAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={onConfirm}>
            <MaterialIcons name="check" size={20} color="#fff" />
            <Text style={styles.modalButtonConfirmText}>CONFIRMAR CHEGADA</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const Speedometer = ({ currentSpeed }) => (
  <View style={styles.speedometerContainer}>
    <Text style={styles.speedText}>{currentSpeed}</Text>
    <Text style={styles.speedUnit}>KM/H</Text>
  </View>
);

const ViagemCard = ({ cargaAtiva, chegouAoDestino, confirmacaoPendente }) => {
  if (!cargaAtiva) return null;
  
  return (
    <View style={[
      styles.floatingRouteCard, 
      chegouAoDestino && {borderColor: '#2ecc71', borderLeftWidth: 5},
      confirmacaoPendente && {borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.05)'}
    ]}>
      <View style={styles.routeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeLabel}>{cargaAtiva.tipoViagem === 'VAZIO' ? '⚪ VIAGEM VAZIO' : '🚚 VIAGEM CARREGADO'} • DT {cargaAtiva.dt || '---'}</Text>
          <Text style={styles.routeInfo} numberOfLines={1}>
            {/* PRIORIDADE: Campos do AcoesCargas primeiro */}
            {cargaAtiva.destinoCliente || cargaAtiva.clienteEntrega || cargaAtiva.cliente_destino || 'Destino não especificado'}
          </Text>
          {chegouAoDestino && !confirmacaoPendente && <Text style={{color: '#2ecc71', fontSize: 10, fontWeight: 'bold', marginTop: 2}}>🎯 APROXIMANDO-SE DO DESTINO</Text>}
          {confirmacaoPendente && <Text style={{color: '#FFD700', fontSize: 10, fontWeight: 'bold', marginTop: 2}}>⚠️ AGUARDANDO CONFIRMAÇÃO DE CHEGADA</Text>}
          
          {/* INFO DA GEOFENCE DO ACOESCARGAS */}
          {cargaAtiva.cercaVirtual?.ativa && (
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 2}}>
              <MaterialIcons name="target" size={12} color="#3498db" />
              <Text style={{color: '#3498db', fontSize: 9, marginLeft: 4}}>
                Cerca virtual: {cargaAtiva.cercaVirtual.raio}m • 
                {cargaAtiva.cercaVirtual.centro ? ' Com coordenadas' : ' Sem coordenadas'}
              </Text>
            </View>
          )}
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <MaterialIcons name="location-on" size={30} color={confirmacaoPendente ? "#FFD700" : chegouAoDestino ? "#2ecc71" : "#444"} />
        </View>
      </View>
    </View>
  );
};

const StatusViagem = ({ confirmacaoPendente, chegouAoDestino }) => (
  <View style={styles.statusViagemContainer}>
    <View style={[styles.statusViagemDot, { backgroundColor: confirmacaoPendente ? '#FFD700' : chegouAoDestino ? '#2ecc71' : '#FFD700' }]} />
    <Text style={styles.statusViagemTexto}>
      {confirmacaoPendente ? 'AGUARDANDO CONFIRMAÇÃO' : chegouAoDestino ? 'CHEGOU AO DESTINO' : 'VIAGEM EM ANDAMENTO'}
    </Text>
  </View>
);

const NavigationBar = ({ activeTab, setActiveTab, handleLogout }) => (
  <View style={styles.floatingNavContainer}>
    <View style={styles.floatingNav}>
      {[
        { key: 'painel', icon: 'map', label: 'Início', component: Ionicons },
        { key: 'viagens', icon: 'truck-delivery', label: 'Cargas', component: MaterialCommunityIcons },
        { key: 'escala', icon: 'calendar-clock', label: 'Escala', component: MaterialCommunityIcons },
        { key: 'jornada', icon: 'timer', label: 'Jornada', component: Ionicons },
        { key: 'perfil', icon: 'shield-account', label: 'Perfil', component: MaterialCommunityIcons },
      ].map(({ key, icon, label, component: Icon }) => (
        <TouchableOpacity 
          key={key} 
          style={styles.navItem} 
          onPress={() => {
            Vibration.vibrate(10);
            setActiveTab(key);
          }}
        >
          <Icon name={icon} size={26} color={activeTab === key ? "#FFD700" : "#999"} />
          <Text style={[styles.navText, { color: activeTab === key ? "#FFD700" : "#999" }]}>{label}</Text>
          {activeTab === key && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
        <Ionicons name="log-out" size={26} color="#ff4d4d" />
        <Text style={[styles.navText, { color: "#ff4d4d" }]}>Sair</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default function App() {
  // Estados preservados
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('painel');
  const [user, setUser] = useState(null);
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
  
  const webviewRef = useRef(null);

  // Hook personalizado (mantido conforme original)
  useMonitorarCargas({
    db,
    user,
    viagemIniciada,
    cargaAtiva,
    setCargaAtiva,
    setViagemIniciada,
    setChegouAoDestino,
    setConfirmacaoPendente,
    setShowConfirmacaoModal,
    setStatusOperacional,
    sincronizarComFirestore
  });

  // Efeitos Principais
  useEffect(() => { onAuthStateChanged(auth, (u) => { setUser(u); setIsLoggedIn(!!u); }); }, []);
  useEffect(() => { if (isLoggedIn) carregarCercas(); }, [isLoggedIn]);
  
  // Atualização de posição SEM PISCAR
  useEffect(() => { 
    if (location && webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({ 
        type: 'updateLoc', 
        lat: location.latitude, 
        lng: location.longitude,
        center: !hasCentered
      }));
      if (!hasCentered) setHasCentered(true);
    } 
  }, [location?.latitude, location?.longitude]);

  useEffect(() => { 
    if (cargaAtiva) {
      console.log('useEffect cargaAtiva mudou:', {
        id: cargaAtiva.id,
        temCercaVirtual: !!cargaAtiva.cercaVirtual,
        cercaAtiva: cargaAtiva.cercaVirtual?.ativa,
        centro: cargaAtiva.cercaVirtual?.centro
      });
      atualizarGeofence(); 
    }
  }, [cargaAtiva, todasAsCercas]);

  useEffect(() => { 
    if (cargaAtiva?.id || geofenceAtiva || !!location) {
      console.log('useEffect atualizarDestinoERota chamado');
      atualizarDestinoERota(); 
    }
  }, [cargaAtiva?.id, geofenceAtiva]);

  useEffect(() => { 
    if (location && cargaAtiva && !cargaAtiva.finalizada && viagemIniciada) {
      verificarChegadaAoDestino(); 
    }
  }, [location, cargaAtiva?.id]);

  useEffect(() => { 
    if (isLoggedIn) {
      monitorarLocalizacao(); 
    }
  }, [isLoggedIn]);

  // Funções Completas
  const handleLoginFromComponent = async (email, password) => {
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      setUser(res.user); setIsLoggedIn(true);
    } catch (e) { Alert.alert('Erro', 'Verifique os dados.'); throw e; }
    finally { setLoading(false); }
  };

  const handleLogout = () => Alert.alert("Sair", "Encerrar sessão?", [
    { text: "Não" },
    { text: "Sim", onPress: async () => { 
      await signOut(auth); 
      setIsLoggedIn(false); 
      setCargaAtiva(null); 
      setViagemIniciada(false); 
    } }
  ]);

  const carregarCercas = () => {
    try {
      const q = query(collection(db, "cadastro_clientes_pontos"));
      return onSnapshot(q, (snap) => {
          const cercasData = [];
          snap.forEach((doc) => cercasData.push({ id: doc.id, ...doc.data() }));
          setTodasAsCercas(cercasData);
          console.log('Cercas carregadas:', cercasData.length);
      });
    } catch (error) { console.error("Erro cercas:", error); }
  };

  const atualizarGeofence = () => {
    if (!cargaAtiva) { 
      console.log('atualizarGeofence: Sem carga ativa');
      setGeofenceAtiva(null); 
      return; 
    }
    
    console.log('atualizarGeofence - cargaAtiva:', {
      temCercaVirtual: !!cargaAtiva.cercaVirtual,
      cercaAtiva: cargaAtiva.cercaVirtual?.ativa,
      temCentro: !!cargaAtiva.cercaVirtual?.centro
    });
    
    // PRIORIDADE 1: Usar a cerca virtual do AcoesCargas se existir
    if (cargaAtiva.cercaVirtual?.ativa && cargaAtiva.cercaVirtual.centro) {
      console.log('Usando cerca virtual do AcoesCargas');
      setGeofenceAtiva(cargaAtiva.cercaVirtual);
      return;
    }
    
    // PRIORIDADE 2: Tentar buscar pelo nome do cliente no cadastro
    const nomeClienteRaw = cargaAtiva?.destinoCliente || cargaAtiva?.clienteEntrega || cargaAtiva?.cliente_destino;
    if (nomeClienteRaw) {
      const nomeLimpo = nomeClienteRaw.toString().toUpperCase().trim();
      const encontrada = todasAsCercas.find(c => (c.cliente || "").toUpperCase().trim() === nomeLimpo);
      
      console.log('Buscando pelo nome do cliente:', {
        nomeBuscado: nomeLimpo,
        encontrou: !!encontrada
      });
      
      setGeofenceAtiva(encontrada?.geofence ? encontrada.geofence : null);
    } else {
      console.log('Nenhum nome de cliente encontrado na carga');
      setGeofenceAtiva(null);
    }
  };

  const atualizarDestinoERota = async () => {
    if (!cargaAtiva) { 
      console.log('atualizarDestinoERota: Sem carga ativa');
      setRotaCoords([]); 
      setDestinoCoord(null); 
      return; 
    }
    
    console.log('atualizarDestinoERota - cargaAtiva:', {
      temTrajeto: !!cargaAtiva.trajeto,
      temCercaVirtual: !!cargaAtiva.cercaVirtual,
      temCentroCerca: !!cargaAtiva.cercaVirtual?.centro
    });
    
    // PRIORIDADE 1: Trajeto existente
    if (cargaAtiva.trajeto?.length > 0) {
      console.log('Usando trajeto existente');
      setRotaCoords(cargaAtiva.trajeto);
      const ultimo = cargaAtiva.trajeto[cargaAtiva.trajeto.length - 1];
      setDestinoCoord({ latitude: ultimo.latitude, longitude: ultimo.longitude });
    } 
    // PRIORIDADE 2: Usar cerca virtual do AcoesCargas
    else if (cargaAtiva.cercaVirtual?.centro?.lat) {
      console.log('Usando centro da cerca virtual do AcoesCargas');
      const { lat, lng } = cargaAtiva.cercaVirtual.centro;
      setDestinoCoord({ latitude: lat, longitude: lng });
      if (location) buscarRotaOSRM(location, lat, lng, setRotaCoords);
    } 
    // PRIORIDADE 3: Usar geofence do cadastro de clientes
    else if (geofenceAtiva?.centro?.lat && location) {
      console.log('Usando geofence do cadastro de clientes');
      const { lat, lng } = geofenceAtiva.centro;
      setDestinoCoord({ latitude: lat, longitude: lng });
      buscarRotaOSRM(location, lat, lng, setRotaCoords);
    } else {
      console.log('Nenhuma coordenada de destino encontrada');
      setDestinoCoord(null);
      setRotaCoords([]);
    }
  };

  const verificarChegadaAoDestino = async () => {
    if (!cargaAtiva || !location || cargaAtiva.finalizada) return;
    
    try {
      const cargaRef = doc(db, "ordens_servico", cargaAtiva.id);
      const cargaSnapshot = await getDoc(cargaRef);
      const cargaData = cargaSnapshot.data();
      
      if (cargaData.finalizada) return;
      
      if (cargaData.chegouAoDestino && cargaData.confirmacaoPendente && !confirmacaoPendente) {
        setConfirmacaoPendente(true); 
        setChegouAoDestino(true); 
        return;
      }
      
      let estaDentro = false;
      let dist = 0;
      
      // PRIORIDADE 1: Verificar usando a cerca virtual do AcoesCargas
      if (cargaAtiva.cercaVirtual?.centro) {
        dist = getDistance(
          location.latitude, 
          location.longitude, 
          cargaAtiva.cercaVirtual.centro.lat, 
          cargaAtiva.cercaVirtual.centro.lng
        );
        estaDentro = dist <= cargaAtiva.cercaVirtual.raio;
        console.log('Verificando cerca virtual do AcoesCargas:', {
          distancia: dist,
          raio: cargaAtiva.cercaVirtual.raio,
          estaDentro,
          centro: cargaAtiva.cercaVirtual.centro
        });
      } 
      // PRIORIDADE 2: Verificar usando destinoCoord ou geofenceAtiva
      else {
        const dest = geofenceAtiva?.centro || destinoCoord;
        if (dest) {
          dist = getDistance(
            location.latitude, 
            location.longitude, 
            dest.lat || dest.latitude, 
            dest.lng || dest.longitude
          );
          estaDentro = dist <= (geofenceAtiva?.raio || 300);
          console.log('Verificando destino/geofence:', {
            distancia: dist,
            raio: geofenceAtiva?.raio || 300,
            estaDentro
          });
        }
      }
      
      if (estaDentro && !cargaData.chegouAoDestino) {
        console.log('Motorista entrou na área de destino!', { distancia: dist });
        await updateDoc(cargaRef, { 
          chegouAoDestino: true, 
          confirmacaoPendente: true, 
          dataChegada: serverTimestamp(), 
          status: 'AGUARDANDO CONFIRMAÇÃO' 
        });
        
        setCargaAtiva(prev => ({ 
          ...prev, 
          chegouAoDestino: true, 
          confirmacaoPendente: true, 
          status: 'AGUARDANDO CONFIRMAÇÃO' 
        }));
        
        setChegouAoDestino(true); 
        setConfirmacaoPendente(true); 
        setShowConfirmacaoModal(true); 
        Vibration.vibrate([500, 500, 500, 500]);
      }
    } catch (error) { 
      console.error("Erro chegada:", error); 
    }
  };

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
        dataFinalizacao: serverTimestamp() 
      });
      
      setTimeout(() => {
        setCargaAtiva(null); 
        setViagemIniciada(false); 
        setStatusOperacional('Sem programação');
        setChegouAoDestino(false); 
        setConfirmacaoPendente(false); 
        setRotaCoords([]);
        sincronizarComFirestore({ statusOperacional: 'Sem programação' });
      }, 3000);
      
      Alert.alert("✅ VIAGEM FINALIZADA!", "Sucesso no registro.");
    } catch (error) { 
      Alert.alert("Erro", "Falha ao finalizar."); 
    }
    finally { 
      setFinalizandoViagem(false); 
    }
  };

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
      
      dados.statusOperacional = extra.statusOperacional || statusOperacional;
      dados.velocidade = extra.velocidade !== undefined ? extra.velocidade : currentSpeed;
      dados.cargaAtiva = cargaAtiva?.id || null;
      dados.viagemIniciada = viagemIniciada;
      
      await setDoc(doc(db, "localizacao_realtime", cur.uid), dados, { merge: true });
    } catch (e) { 
      console.error("Erro sincronia:", e); 
    }
  };

  const monitorarLocalizacao = async () => {
    let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') return;
    
    const sub = await Location.watchPositionAsync({ 
      accuracy: Location.Accuracy.High, 
      timeInterval: 2000, 
      distanceInterval: 1 
    }, (loc) => {
        if (loc.coords) {
          const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
          setLocation(loc.coords); 
          setCurrentSpeed(speedKmh < 0 ? 0 : speedKmh);
          sincronizarComFirestore({ 
            latitude: loc.coords.latitude, 
            longitude: loc.coords.longitude, 
            velocidade: speedKmh 
          });
        }
    });
    
    return () => { 
      if (sub) sub.remove(); 
    };
  };

  // HTML DO MAPA (Memoizado para não dar refresh e piscar)
  const mapHtml = useMemo(() => {
    if (!location) return null;
    
    const lat = location.latitude;
    const lng = location.longitude;
    const rotaJson = JSON.stringify(rotaCoords.map(c => [c.latitude, c.longitude]));
    
    // Config da Cerca no JS - DESTAQUE PARA A CERCA DO ACOESCARGAS
    let cercaJs = '';
    const dest = cargaAtiva?.cercaVirtual?.centro || geofenceAtiva?.centro || 
                 (destinoCoord ? {lat: destinoCoord.latitude, lng: destinoCoord.longitude} : null);
    const raio = cargaAtiva?.cercaVirtual?.raio || geofenceAtiva?.raio || 300;
    
    if (dest) {
        const cor = chegouAoDestino ? '#2ecc71' : '#FFD700';
        const peso = cargaAtiva?.cercaVirtual ? 3 : 2; // Linha mais grossa se for do AcoesCargas
        const opacidade = cargaAtiva?.cercaVirtual ? 0.2 : 0.15; // Mais visível se for do AcoesCargas
        
        cercaJs = `
          L.circle([${dest.lat}, ${dest.lng}], { 
            radius: ${raio}, 
            color: '${cor}', 
            weight: ${peso}, 
            fillOpacity: ${opacidade}
          }).addTo(map);
          
          // Adicionar marcador no centro se for do AcoesCargas
          ${cargaAtiva?.cercaVirtual ? `
            L.marker([${dest.lat}, ${dest.lng}], {
              icon: L.divIcon({
                html: '<div style="background-color:#FFD700; width:8px; height:8px; border-radius:50%; border:2px solid #fff;"></div>',
                className: '',
                iconSize: [8, 8]
              })
            }).addTo(map);
          ` : ''}
        `;
    }

    return `
      <!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style> 
        body { margin: 0; padding: 0; background: #000; overflow: hidden; } 
        #map { height: 100vh; width: 100vw; } 
      </style>
      </head><body><div id="map"></div><script>
        var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 16);
        L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { 
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] 
        }).addTo(map);
        
        var motoristaIcon = L.divIcon({ 
          html: '<div style="background-color:#FFD700; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>', 
          className: '', 
          iconSize: [16, 16], 
          iconAnchor: [8, 8] 
        });
        var marker = L.marker([${lat}, ${lng}], {icon: motoristaIcon}).addTo(map);
        
        ${cercaJs}
        
        var rota = ${rotaJson};
        if(rota.length > 0) {
          L.polyline(rota, {color: '#FFD700', weight: 6, opacity: 0.8}).addTo(map);
        }

        window.addEventListener('message', function(e) {
          try {
            var data = JSON.parse(e.data);
            if(data.type === 'updateLoc') {
              marker.setLatLng([data.lat, data.lng]);
              if(data.center) map.panTo([data.lat, data.lng]);
            }
            if(data.type === 'center') map.flyTo([data.lat, data.lng], 16);
          } catch(err) {}
        });
      </script></body></html>
    `;
  }, [rotaCoords.length, !!cargaAtiva?.cercaVirtual, chegouAoDestino]);

  // Renderização principal
  const renderContent = () => {
    switch (activeTab) {
      case 'painel':
        return (
          <View style={{flex: 1}}>
            <MapViewStatic html={mapHtml} webviewRef={webviewRef} />
            <StatusAtual cargaAtiva={cargaAtiva} />
            <Speedometer currentSpeed={currentSpeed} />
            <ViagemCard 
              cargaAtiva={cargaAtiva} 
              chegouAoDestino={chegouAoDestino} 
              confirmacaoPendente={confirmacaoPendente} 
            />
            {viagemIniciada && !cargaAtiva?.finalizada && (
              <StatusViagem 
                confirmacaoPendente={confirmacaoPendente} 
                chegouAoDestino={chegouAoDestino} 
              />
            )}
            <TouchableOpacity 
              style={styles.floatingGps} 
              onPress={() => {
                if (location) {
                  webviewRef.current?.postMessage(JSON.stringify({ 
                    type: 'center', 
                    lat: location.latitude, 
                    lng: location.longitude 
                  }));
                }
              }}
            >
              <MaterialIcons name="my-location" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
        );
      case 'viagens': return <MinhasViagens auth={auth} db={db} />;
      case 'escala': return <Escala auth={auth} db={db} />;
      case 'jornada': return <Jornada auth={auth} db={db} />;
      case 'perfil': return <Conta auth={auth} db={db} />;
      default: return null;
    }
  };

  if (!isLoggedIn) return <TelaLogin onLogin={handleLoginFromComponent} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{flex: 1, paddingTop: activeTab === 'painel' ? 0 : 60}}>
        {renderContent()}
        <ConfirmacaoChegadaModal 
          visible={showConfirmacaoModal} 
          onConfirm={confirmarChegada} 
          onCancel={() => setShowConfirmacaoModal(false)} 
        />
      </View>
      <NavigationBar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        handleLogout={handleLogout} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
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
    zIndex: 30 
  },
  speedText: { color: '#FFD700', fontSize: 24, fontWeight: '900' },
  speedUnit: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },
  floatingRouteCard: { 
    position: 'absolute', 
    bottom: 135, 
    left: 15, 
    right: 15, 
    backgroundColor: 'rgba(15,15,15,0.98)', 
    borderRadius: 15, 
    padding: 15, 
    borderWidth: 1, 
    borderColor: '#333', 
    elevation: 8, 
    zIndex: 5 
  },
  routeLabel: { color: '#FFD700', fontSize: 9, fontWeight: 'bold' },
  routeInfo: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  routeHeader: { flexDirection: 'row', alignItems: 'center' },
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
    zIndex: 10 
  },
  statusViagemDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusViagemTexto: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  floatingGps: { 
    position: 'absolute', 
    bottom: 220, 
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
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingBottom: 25, 
    paddingHorizontal: 10, 
    zIndex: 100 
  },
  floatingNav: { 
    flexDirection: 'row', 
    backgroundColor: '#151515', 
    paddingVertical: 12, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#333', 
    justifyContent: 'space-around' 
  },
  navItem: { alignItems: 'center', flex: 1 },
  navText: { fontSize: 9, fontWeight: 'bold', marginTop: 4 },
  activeIndicator: { 
    position: 'absolute', 
    top: -12, 
    width: 20, 
    height: 3, 
    backgroundColor: '#FFD700' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.8)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  modalContent: { 
    backgroundColor: '#111', 
    borderRadius: 20, 
    padding: 25, 
    width: '100%', 
    maxWidth: 400, 
    borderWidth: 2, 
    borderColor: '#FFD700' 
  },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#2ecc71', fontSize: 20, fontWeight: 'bold' },
  modalMessage: { color: '#FFF', fontSize: 16, textAlign: 'center' },
  modalSubmessage: { 
    color: '#888', 
    fontSize: 14, 
    textAlign: 'center', 
    marginVertical: 10 
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 20 
  },
  modalButton: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#333', marginRight: 10 },
  modalButtonConfirm: { backgroundColor: '#2ecc71' },
  modalButtonConfirmText: { color: '#fff', fontWeight: 'bold' },
  modalButtonCancelText: { color: '#fff' }
});