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
  Modal,
  Linking,
  ScrollView
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
import { useGpseCercas } from './GpseCercas'; 
import BotaoRotaAutomatica from './BotaoRotaAutomatica'; 

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
  doc, 
  updateDoc, 
  setDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs 
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

// --- Componentes Internos ---

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

const ConfirmacaoChegadaModal = ({ visible, onConfirm, onCancel, cargaAtiva }) => (
  <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onCancel}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <MaterialIcons name="check-circle" size={40} color="#2ecc71" />
          <Text style={styles.modalTitle}>CHEGOU AO DESTINO!</Text>
        </View>
        
        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.modalMessage}>Você entrou na área de destino. Para finalizar a viagem, confirme sua chegada.</Text>
          
          {/* NOVA SEÇÃO: DETALHES DA CARGA */}
          {cargaAtiva && (
            <View style={styles.detalhesCargaContainer}>
              <Text style={styles.detalhesTitulo}>Detalhes da Viagem:</Text>
              
              <View style={styles.detalhesLinha}>
                <Text style={styles.detalhesLabel}>Destino:</Text>
                <Text style={styles.detalhesValor}>{cargaAtiva.destinoCliente || cargaAtiva.clienteEntrega}</Text>
              </View>
              
              <View style={styles.detalhesLinha}>
                <Text style={styles.detalhesLabel}>Código:</Text>
                <Text style={[styles.detalhesValor, {fontFamily: 'monospace', fontWeight: 'bold'}]}>
                  {cargaAtiva.destinoCodigo || '---'}
                </Text>
              </View>
              
              <View style={styles.detalhesLinha}>
                <Text style={styles.detalhesLabel}>Cidade:</Text>
                <Text style={styles.detalhesValor}>{cargaAtiva.destinoCidade || ''}</Text>
              </View>
              
              <View style={styles.detalhesLinha}>
                <Text style={styles.detalhesLabel}>Tipo:</Text>
                <Text style={[styles.detalhesValor, { 
                  color: cargaAtiva.tipoViagem === 'CARREGADO' ? '#FFD700' : 
                         cargaAtiva.tipoViagem === 'VAZIO' ? '#3498db' : '#e74c3c'
                }]}>
                  {cargaAtiva.tipoViagem || 'CARREGADO'}
                </Text>
              </View>
              
              {/* NOVO: BOTÃO PARA ABRIR GOOGLE MAPS */}
              {cargaAtiva.destinoLink && (
                <TouchableOpacity 
                  style={styles.googleMapsButton}
                  onPress={() => {
                    if (cargaAtiva.destinoLink) {
                      Linking.openURL(cargaAtiva.destinoLink).catch(err => 
                        Alert.alert("Erro", "Não foi possível abrir o Google Maps")
                      );
                    }
                  }}
                >
                  <MaterialIcons name="map" size={16} color="#4285F4" />
                  <Text style={styles.googleMapsText}>Abrir no Google Maps</Text>
                  <MaterialIcons name="open-in-new" size={14} color="#4285F4" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
        
        <View style={styles.modalButtons}>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={onCancel}>
            <Text style={styles.modalButtonCancelText}>AGUARDAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={onConfirm}>
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

const ViagemCard = ({ cargaAtiva, chegouAoDestino, confirmacaoPendente, onOpenGoogleMaps }) => {
  if (!cargaAtiva) return null;
  
  return (
    <TouchableOpacity 
      style={[styles.floatingRouteCard, chegouAoDestino && {borderColor: '#2ecc71', borderLeftWidth: 5}]}
      activeOpacity={0.9}
      onPress={() => {
        if (cargaAtiva.destinoLink) {
          onOpenGoogleMaps(cargaAtiva.destinoLink);
        }
      }}
    >
      <View style={styles.routeHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.routeHeaderTop}>
            <Text style={styles.routeLabel}>
              {cargaAtiva.tipoViagem === 'VAZIO' ? '⚪ VAZIO' : 
               cargaAtiva.tipoViagem === 'MANUTENÇÃO' ? '🔧 MANUTENÇÃO' : '🚚 CARREGADO'} • DT {cargaAtiva.dt || '---'}
            </Text>
            
            {/* NOVO: ÍCONE DO GOOGLE MAPS */}
            {cargaAtiva.destinoLink && (
              <TouchableOpacity 
                onPress={(e) => {
                  e.stopPropagation();
                  if (cargaAtiva.destinoLink) {
                    onOpenGoogleMaps(cargaAtiva.destinoLink);
                  }
                }}
                style={styles.mapIconContainer}
              >
                <MaterialIcons name="map" size={16} color="#4285F4" />
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.routeInfo} numberOfLines={1}>
            {cargaAtiva.destinoCliente || cargaAtiva.clienteEntrega || 'Destino não especificado'}
          </Text>
          
          {/* NOVA LINHA: CÓDIGO DO DESTINO */}
          {cargaAtiva.destinoCodigo && (
            <Text style={styles.codigoDestino}>
              Código: <Text style={{fontFamily: 'monospace', fontWeight: 'bold'}}>{cargaAtiva.destinoCodigo}</Text>
            </Text>
          )}
          
          {/* NOVA LINHA: CIDADES */}
          <View style={styles.cidadesContainer}>
            {cargaAtiva.origemCidade && (
              <Text style={styles.cidadeText}>
                <MaterialIcons name="location-on" size={10} color="#FFD700" /> {cargaAtiva.origemCidade}
              </Text>
            )}
            {cargaAtiva.origemCidade && cargaAtiva.destinoCidade && (
              <Text style={styles.setaCidades}> → </Text>
            )}
            {cargaAtiva.destinoCidade && (
              <Text style={[styles.cidadeText, {color: '#2ecc71'}]}>
                <MaterialIcons name="location-on" size={10} color="#2ecc71" /> {cargaAtiva.destinoCidade}
              </Text>
            )}
          </View>
          
          {confirmacaoPendente && (
            <Text style={{color: '#FFD700', fontSize: 10, fontWeight: 'bold', marginTop: 4}}>
              ⚠️ AGUARDANDO CONFIRMAÇÃO
            </Text>
          )}
        </View>
        <MaterialIcons name="location-on" size={30} color={chegouAoDestino ? "#2ecc71" : "#444"} />
      </View>
      
      {/* BOTÃO DE DETALHES ADICIONAIS */}
      <TouchableOpacity 
        style={styles.detalhesButton}
        onPress={() => {
          Alert.alert(
            "Detalhes da Viagem",
            `Documento: DT ${cargaAtiva.dt || '---'}\n` +
            `Tipo: ${cargaAtiva.tipoViagem || 'CARREGADO'}\n` +
            `Peso: ${cargaAtiva.peso || '0'} Ton\n` +
            `Perfil: ${cargaAtiva.perfilVeiculo || 'Trucado'}\n` +
            `Código Origem: ${cargaAtiva.origemCodigo || '---'}\n` +
            `Código Destino: ${cargaAtiva.destinoCodigo || '---'}\n` +
            `Observação: ${cargaAtiva.observacao || 'Nenhuma'}`,
            [{ text: "OK" }]
          );
        }}
      >
        <Text style={styles.detalhesButtonText}>Ver detalhes completos</Text>
        <MaterialIcons name="arrow-forward" size={14} color="#888" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

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
        <TouchableOpacity key={key} style={styles.navItem} onPress={() => { Vibration.vibrate(10); setActiveTab(key); }}>
          <Icon name={icon} size={26} color={activeTab === key ? "#FFD700" : "#999"} />
          <Text style={[styles.navText, { color: activeTab === key ? "#FFD700" : "#999" }]}>{label}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
        <Ionicons name="log-out" size={26} color="#ff4d4d" />
        <Text style={[styles.navText, { color: "#ff4d4d" }]}>Sair</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// --- App Principal ---

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('painel');
  const [user, setUser] = useState(null);
  const [motoristaProfile, setMotoristaProfile] = useState(null);
  const [location, setLocation] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [cargaAtiva, setCargaAtiva] = useState(null);
  const [viagemIniciada, setViagemIniciada] = useState(false);
  const [statusOperacional, setStatusOperacional] = useState('Sem programação');
  const [showConfirmacaoModal, setShowConfirmacaoModal] = useState(false);
  
  const webviewRef = useRef(null);

  const {
    geofenceAtiva,
    rotaCoords,
    chegouAoDestino,
    confirmacaoPendente,
    setChegouAoDestino,
    setConfirmacaoPendente,
    setRotaCoords
  } = useGpseCercas(db, user, location, cargaAtiva, setCargaAtiva, viagemIniciada);

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
    sincronizarComFirestore: (extra) => sincronizarComFirestore(extra)
  });

  // Função para abrir Google Maps
  const handleOpenGoogleMaps = (url) => {
    if (!url) return;
    
    // Verifica se é um link válido do Google Maps
    const mapsUrl = url.startsWith('http') ? url : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(url)}`;
    
    Linking.openURL(mapsUrl).catch(err => {
      Alert.alert(
        "Erro ao abrir mapa",
        "Não foi possível abrir o Google Maps. Verifique se o link está correto.",
        [{ text: "OK" }]
      );
    });
  };

  // Listener de Auth e Busca de Perfil vinculado
  useEffect(() => { 
    const unsub = onAuthStateChanged(auth, async (u) => { 
      if (u) {
        setUser(u);
        await buscarPerfilMotorista(u.uid);
      } else {
        setUser(null);
        setMotoristaProfile(null);
        setIsLoggedIn(false);
      }
    }); 
    return unsub;
  }, []);

  const buscarPerfilMotorista = async (uid) => {
    try {
      const q = query(collection(db, "cadastro_motoristas"), where("uid", "==", uid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const dados = querySnapshot.docs[0].data();
        setMotoristaProfile(dados);
        setIsLoggedIn(true);
      } else {
        Alert.alert("Erro de Acesso", "Seu usuário não possui um perfil de motorista cadastrado.");
        signOut(auth);
      }
    } catch (error) {
      console.error("Erro ao buscar perfil:", error);
    }
  };

  useEffect(() => {
    if (confirmacaoPendente) setShowConfirmacaoModal(true);
  }, [confirmacaoPendente]);

  useEffect(() => { 
    if (isLoggedIn) monitorarLocalizacao(); 
  }, [isLoggedIn]);

  useEffect(() => { 
    if (location && webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({ 
        type: 'updateLoc', 
        lat: location.latitude, 
        lng: location.longitude, 
        center: false
      }));
    } 
  }, [location?.latitude, location?.longitude]);

  const monitorarLocalizacao = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    
    await Location.watchPositionAsync({ 
      accuracy: Location.Accuracy.High, 
      timeInterval: 30000, 
      distanceInterval: 10 
    }, async (loc) => {
      if (loc.coords) {
        const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
        setLocation(loc.coords); 
        setCurrentSpeed(speedKmh < 0 ? 0 : speedKmh);
        
        webviewRef.current?.postMessage(JSON.stringify({ 
          type: 'updateLoc', 
          lat: loc.coords.latitude, 
          lng: loc.coords.longitude, 
          center: false 
        }));

        let cidade = "---";
        let uf = "";
        try {
          const geo = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude
          });
          if (geo.length > 0) {
            cidade = geo[0].subregion || geo[0].city || "Desconhecido";
            uf = geo[0].region || "";
          }
        } catch (e) { console.log("Erro geocode"); }

        sincronizarComFirestore({ 
          latitude: loc.coords.latitude, 
          longitude: loc.coords.longitude, 
          velocidade: speedKmh,
          cidade: cidade,
          uf: uf
        });
      }
    });
  };

  const sincronizarComFirestore = async (extra = {}) => {
    if (!auth.currentUser || !motoristaProfile) return;
    try {
      const dados = { 
        motoristaId: auth.currentUser.uid, 
        nomeMotorista: motoristaProfile.nome || "Não informado",
        email: auth.currentUser.email, 
        ultimaAtualizacao: serverTimestamp(),
        latitude: extra.latitude || location?.latitude,
        longitude: extra.longitude || location?.longitude,
        statusOperacional: extra.statusOperacional || statusOperacional,
        velocidade: extra.velocidade !== undefined ? extra.velocidade : currentSpeed,
        cidade: extra.cidade || "---",
        uf: extra.uf || "",
        statusJornada: "EM ATIVIDADE", 
        cargaAtiva: cargaAtiva?.id || null,
        cargaAtivaDetalhes: cargaAtiva ? {
          dt: cargaAtiva.dt,
          tipoViagem: cargaAtiva.tipoViagem,
          destinoCliente: cargaAtiva.destinoCliente,
          destinoCodigo: cargaAtiva.destinoCodigo,
          destinoCidade: cargaAtiva.destinoCidade,
          temLinkMaps: !!cargaAtiva.destinoLink
        } : null,
        viagemIniciada: viagemIniciada
      };
      
      await setDoc(doc(db, "localizacao_realtime", auth.currentUser.uid), dados, { merge: true });
    } catch (e) { console.error("Erro sincronia:", e); }
  };

  const confirmarChegada = async () => {
    if (!cargaAtiva) return;
    setShowConfirmacaoModal(false);
    try {
      await updateDoc(doc(db, "ordens_servico", cargaAtiva.id), { 
        finalizada: true, 
        confirmacaoPendente: false, 
        status: 'FINALIZADA', 
        dataFinalizacao: serverTimestamp(),
        observacaoFinalizacao: `Viagem finalizada pelo motorista via app. Código destino: ${cargaAtiva.destinoCodigo || '---'}`
      });
      
      // Registrar log de finalização
      if (motoristaProfile) {
        await setDoc(doc(db, "logs_finalizacao", `${Date.now()}_${cargaAtiva.id}`), {
          cargaId: cargaAtiva.id,
          motoristaId: auth.currentUser.uid,
          motoristaNome: motoristaProfile.nome,
          dt: cargaAtiva.dt,
          destinoCliente: cargaAtiva.destinoCliente,
          destinoCodigo: cargaAtiva.destinoCodigo,
          destinoCidade: cargaAtiva.destinoCidade,
          tipoViagem: cargaAtiva.tipoViagem,
          finalizadoEm: serverTimestamp(),
          utilizadoLinkMaps: !!cargaAtiva.destinoLink
        });
      }
      
      setCargaAtiva(null);
      setViagemIniciada(false);
      setRotaCoords([]);
      Alert.alert("✅ Viagem Finalizada", "A viagem foi registrada como concluída.");
    } catch (error) { 
      console.error("Erro ao finalizar:", error);
      Alert.alert("Erro", "Falha ao finalizar a viagem."); 
    }
  };

  const mapHtml = useMemo(() => {
    if (!location) return null;
    const dest = geofenceAtiva?.centro || (rotaCoords.length > 0 ? {lat: rotaCoords[rotaCoords.length-1].latitude, lng: rotaCoords[rotaCoords.length-1].longitude} : null);
    
    return `
      <!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>body { margin: 0; background: #000; } #map { height: 100vh; }</style>
      </head><body><div id="map"></div><script>
        var map = L.map('map', { zoomControl: false }).setView([${location.latitude}, ${location.longitude}], 15);
        L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
        var marker = L.marker([${location.latitude}, ${location.longitude}], {
          icon: L.divIcon({ html: '<div style="background:#FFD700; width:14px; height:14px; border-radius:50%; border:3px solid #fff;"></div>', className: '', iconSize: [14, 14] })
        }).addTo(map);
        ${dest ? `L.circle([${dest.lat}, ${dest.lng}], { radius: ${geofenceAtiva?.raio || 300}, color: '${chegouAoDestino ? '#2ecc71' : '#FFD700'}', weight: 2, fillOpacity: 0.15 }).addTo(map);` : ''}
        ${rotaCoords.length > 0 ? `L.polyline(${JSON.stringify(rotaCoords.map(c => [c.latitude, c.longitude]))}, {color: '#FFD700', weight: 4}).addTo(map);` : ''}
        window.addEventListener('message', function(e) {
          var d = JSON.parse(e.data);
          if(d.type === 'updateLoc') marker.setLatLng([d.lat, d.lng]);
          if(d.type === 'center') map.flyTo([d.lat, d.lng], 16);
        });
      </script></body></html>
    `;
  }, [location === null, rotaCoords, chegouAoDestino]);

  if (!isLoggedIn) return <TelaLogin onLogin={async (e, p) => signInWithEmailAndPassword(auth, e, p)} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{flex: 1, paddingTop: activeTab === 'painel' ? 0 : 60}}>
        {activeTab === 'painel' ? (
          <View style={{flex: 1}}>
            <MapViewStatic html={mapHtml} webviewRef={webviewRef} />
            <StatusAtual cargaAtiva={cargaAtiva} />
            <Speedometer currentSpeed={currentSpeed} />
            <ViagemCard 
              cargaAtiva={cargaAtiva} 
              chegouAoDestino={chegouAoDestino} 
              confirmacaoPendente={confirmacaoPendente}
              onOpenGoogleMaps={handleOpenGoogleMaps}
            />
            
            <BotaoRotaAutomatica 
              location={location}
              cargaAtiva={cargaAtiva}
              setRotaCoords={setRotaCoords}
              disabled={!viagemIniciada}
              onOpenGoogleMaps={handleOpenGoogleMaps}
            />
            
            <TouchableOpacity style={styles.floatingGps} onPress={() => webviewRef.current?.postMessage(JSON.stringify({ type: 'center', lat: location.latitude, lng: location.longitude }))}>
              <MaterialIcons name="my-location" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
        ) : (
          activeTab === 'viagens' ? <MinhasViagens auth={auth} db={db} /> :
          activeTab === 'escala' ? <Escala auth={auth} db={db} /> :
          activeTab === 'jornada' ? <Jornada auth={auth} db={db} /> : <Conta auth={auth} db={db} />
        )}
      </View>
      <ConfirmacaoChegadaModal 
        visible={showConfirmacaoModal} 
        onConfirm={confirmarChegada} 
        onCancel={() => setShowConfirmacaoModal(false)}
        cargaAtiva={cargaAtiva}
      />
      <NavigationBar activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={() => signOut(auth)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  speedometerContainer: { 
    position: 'absolute', 
    top: 50, 
    right: 20, 
    width: 65, 
    height: 65, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    borderRadius: 35, 
    borderWidth: 2, 
    borderColor: '#FFD700', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 30 
  },
  speedText: { 
    color: '#FFD700', 
    fontSize: 22, 
    fontWeight: '900' 
  },
  speedUnit: { 
    color: '#FFF', 
    fontSize: 8 
  },
  
  // Estilos do ViagemCard atualizados
  floatingRouteCard: { 
    position: 'absolute', 
    bottom: 125, 
    left: 15, 
    right: 15, 
    backgroundColor: 'rgba(15,15,15,0.95)', 
    borderRadius: 15, 
    padding: 15, 
    borderWidth: 1, 
    borderColor: '#333', 
    zIndex: 5 
  },
  routeHeader: { 
    flexDirection: 'row', 
    alignItems: 'flex-start' 
  },
  routeHeaderTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 5 
  },
  routeLabel: { 
    color: '#FFD700', 
    fontSize: 9, 
    fontWeight: 'bold', 
    flex: 1 
  },
  mapIconContainer: { 
    padding: 4, 
    marginLeft: 8 
  },
  routeInfo: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: '900', 
    marginBottom: 4 
  },
  codigoDestino: { 
    color: '#888', 
    fontSize: 10, 
    fontFamily: 'monospace', 
    marginBottom: 4 
  },
  cidadesContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flexWrap: 'wrap',
    marginBottom: 4 
  },
  cidadeText: { 
    color: '#AAA', 
    fontSize: 10, 
    marginRight: 4,
    flexDirection: 'row',
    alignItems: 'center'
  },
  setaCidades: { 
    color: '#666', 
    fontSize: 10, 
    marginHorizontal: 4 
  },
  detalhesButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 10, 
    paddingTop: 10, 
    borderTopWidth: 1, 
    borderTopColor: '#333' 
  },
  detalhesButtonText: { 
    color: '#888', 
    fontSize: 10, 
    marginRight: 5 
  },
  
  floatingGps: { 
    position: 'absolute', 
    bottom: 210, 
    right: 20, 
    backgroundColor: 'rgba(0,0,0,0.9)', 
    padding: 12, 
    borderRadius: 50, 
    zIndex: 5 
  },
  floatingNavContainer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingBottom: 20, 
    paddingHorizontal: 10, 
    zIndex: 100 
  },
  floatingNav: { 
    flexDirection: 'row', 
    backgroundColor: '#151515', 
    paddingVertical: 10, 
    borderRadius: 20, 
    justifyContent: 'space-around' 
  },
  navItem: { 
    alignItems: 'center', 
    flex: 1 
  },
  navText: { 
    fontSize: 8, 
    marginTop: 4 
  },
  
  // Estilos do Modal atualizados
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    backgroundColor: '#111', 
    borderRadius: 20, 
    padding: 20, 
    width: '90%', 
    borderWidth: 1, 
    borderColor: '#FFD700', 
    maxHeight: '80%' 
  },
  modalHeader: { 
    alignItems: 'center', 
    marginBottom: 15 
  },
  modalTitle: { 
    color: '#2ecc71', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginTop: 10 
  },
  modalScroll: { 
    maxHeight: 200, 
    marginBottom: 15 
  },
  modalMessage: { 
    color: '#FFF', 
    textAlign: 'center', 
    marginBottom: 20, 
    fontSize: 14 
  },
  
  detalhesCargaContainer: { 
    backgroundColor: 'rgba(30,30,30,0.7)', 
    borderRadius: 10, 
    padding: 15, 
    marginBottom: 15 
  },
  detalhesTitulo: { 
    color: '#FFD700', 
    fontSize: 12, 
    fontWeight: 'bold', 
    marginBottom: 10 
  },
  detalhesLinha: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 6 
  },
  detalhesLabel: { 
    color: '#AAA', 
    fontSize: 12 
  },
  detalhesValor: { 
    color: '#FFF', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  googleMapsButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(66, 133, 244, 0.1)', 
    padding: 12, 
    borderRadius: 8, 
    marginTop: 10, 
    borderWidth: 1, 
    borderColor: '#4285F4' 
  },
  googleMapsText: { 
    color: '#4285F4', 
    fontSize: 12, 
    fontWeight: 'bold', 
    marginHorizontal: 8 
  },
  
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  modalButton: { 
    flex: 1, 
    padding: 15, 
    borderRadius: 10, 
    alignItems: 'center' 
  },
  modalButtonCancel: { 
    backgroundColor: '#333', 
    marginRight: 10 
  },
  modalButtonConfirm: { 
    backgroundColor: '#2ecc71' 
  },
  modalButtonConfirmText: { 
    color: '#fff', 
    fontWeight: 'bold' 
  },
  modalButtonCancelText: { 
    color: '#fff' 
  }
});