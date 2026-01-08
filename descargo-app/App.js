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
  ScrollView,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  AppState
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { MaterialCommunityIcons, Ionicons, MaterialIcons } from '@expo/vector-icons';

// --- COMPONENTES CUSTOMIZADOS ---
import Conta from './Conta'; 
import Jornada from './Jornada';
import Escala from './Escala';
import MinhasViagens from './MinhasViagens';
import TelaLogin from './TelaLogin';
import StatusAtual from './StatusAtual';
import useMonitorarCargas from './MonitorarCargas'; 
import { useGpseCercas } from './GpseCercas'; 
import BotaoRotaAutomatica from './BotaoRotaAutomatica'; 

// --- FIREBASE ---
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
  getDocs,
  onSnapshot,
  addDoc,
  deleteDoc
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
  auth = initializeAuth(app, { persistence: getReactNativePersistence(ReactNativeAsyncStorage) });
} catch (e) { 
  auth = getAuth(app); 
}
const db = getFirestore(app);

const LOCATION_TASK_NAME = 'background-location-task';

// --- BACKGROUND TASK ---
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return;
  }
  
  if (data && data.locations) {
    const { locations } = data;
    const loc = locations[0];
    
    if (auth.currentUser && loc) {
      const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
      try {
        await setDoc(doc(db, "localizacao_realtime", auth.currentUser.uid), {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          velocidade: speedKmh < 0 ? 0 : speedKmh,
          ultimaAtualizacao: serverTimestamp(),
          statusJornada: "EM ATIVIDADE (BACKGROUND)",
          appState: 'background',
          batteryLevel: 100
        }, { merge: true });
        
        const motoristaRef = doc(db, "cadastro_motoristas", auth.currentUser.uid);
        await updateDoc(motoristaRef, {
          ultimaLocalizacao: serverTimestamp(),
          online: true
        });
        
      } catch (e) { 
        console.log("Erro background task:", e); 
      }
    }
  }
});

// --- NOTIFICAÇÕES ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// --- COMPONENTE DO MAPA ---
const MapViewStatic = React.memo(({ html, webviewRef, onMapReady }) => {
  const [loading, setLoading] = useState(true);
  
  const handleLoadEnd = () => {
    setLoading(false);
    if (onMapReady) onMapReady();
  };

  if (!html) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.loadingText}>Carregando mapa...</Text>
    </View>
  );
  
  return (
    <>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      )}
      <WebView 
        ref={webviewRef} 
        originWhitelist={['*']} 
        source={{ html }} 
        style={{ flex: 1, backgroundColor: '#000' }} 
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            console.log('Message from WebView:', data);
          } catch (e) {}
        }} 
        onLoadEnd={handleLoadEnd}
        androidLayerType="hardware" 
        domStorageEnabled={true} 
        javaScriptEnabled={true} 
        startInLoadingState={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </>
  );
}, (prev, next) => prev.html === next.html);

// --- MODAL DE CONFIRMAÇÃO ---
const ConfirmacaoChegadaModal = ({ visible, onConfirm, onCancel, cargaAtiva }) => {
  const [loading, setLoading] = useState(false);
  
  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

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
            <MaterialIcons name="check-circle" size={50} color="#2ecc71" />
            <Text style={styles.modalTitle}>CHEGOU AO DESTINO!</Text>
          </View>
          
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalMessage}>
              Você entrou na área de destino. Para finalizar a viagem, confirme sua chegada.
            </Text>
            
            {cargaAtiva && (
              <View style={styles.detalhesCargaContainer}>
                <Text style={styles.detalhesTitulo}>📋 Detalhes da Viagem:</Text>
                
                <View style={styles.detalhesLinha}>
                  <Text style={styles.detalhesLabel}>DT:</Text>
                  <Text style={styles.detalhesValor}>{cargaAtiva.dt || '---'}</Text>
                </View>
                
                <View style={styles.detalhesLinha}>
                  <Text style={styles.detalhesLabel}>Destino:</Text>
                  <Text style={styles.detalhesValor}>
                    {cargaAtiva.destinoCliente || cargaAtiva.clienteEntrega || '---'}
                  </Text>
                </View>
                
                <View style={styles.detalhesLinha}>
                  <Text style={styles.detalhesLabel}>Código:</Text>
                  <Text style={[styles.detalhesValor, {fontFamily: 'monospace', fontWeight: 'bold'}]}>
                    {cargaAtiva.destinoCodigo || cargaAtiva.codigoDestino || '---'}
                  </Text>
                </View>
                
                <View style={styles.detalhesLinha}>
                  <Text style={styles.detalhesLabel}>Cidade:</Text>
                  <Text style={styles.detalhesValor}>{cargaAtiva.destinoCidade || ''}</Text>
                </View>
                
                <View style={styles.detalhesLinha}>
                  <Text style={styles.detalhesLabel}>Tipo:</Text>
                  <Text style={[styles.detalhesValor, { 
                    color: cargaAtiva.tipoViagem === 'VAZIO' ? '#3498db' : '#FFD700'
                  }]}>
                    {cargaAtiva.tipoViagem || 'CARREGADO'}
                  </Text>
                </View>
              </View>
            )}
            
            <Text style={styles.modalWarning}>
              ⚠️ Após confirmar, a viagem será marcada como finalizada.
            </Text>
          </ScrollView>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalButtonCancel]} 
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.modalButtonCancelText}>AGUARDAR</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalButtonConfirm]} 
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalButtonConfirmText}>CONFIRMAR CHEGADA</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- CARD DE VIAGEM ---
const ViagemCard = ({ cargaAtiva, chegouAoDestino, onOpenGoogleMaps, onIniciarViagem }) => {
  if (!cargaAtiva) {
    return (
      <View style={styles.noViagemCard}>
        <MaterialCommunityIcons name="truck-off" size={30} color="#666" />
        <View style={styles.noViagemTextContainer}>
          <Text style={styles.noViagemTitle}>SEM VIAGEM ATIVA</Text>
          <Text style={styles.noViagemSubtitle}>Aguardando nova programação</Text>
        </View>
      </View>
    );
  }

  const podeIniciar = !cargaAtiva.viagemIniciada && cargaAtiva.status === 'PROGRAMADO';
  const statusColor = chegouAoDestino ? '#2ecc71' : 
                     cargaAtiva.viagemIniciada ? '#FFD700' : '#3498db';

  return (
    <TouchableOpacity 
      style={[styles.floatingRouteCard, { borderLeftColor: statusColor }]}
      activeOpacity={0.9}
      onPress={() => {
        if (cargaAtiva.linkEntrega) {
          onOpenGoogleMaps(cargaAtiva.linkEntrega);
        }
      }}
    >
      <View style={styles.routeHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.routeHeaderTop}>
            <Text style={[styles.routeLabel, { color: statusColor }]}>
              {cargaAtiva.tipoViagem || 'CARREGADO'} • DT {cargaAtiva.dt || '---'}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusBadgeText}>
                {chegouAoDestino ? 'NO DESTINO' : 
                 cargaAtiva.viagemIniciada ? 'EM ROTA' : 
                 cargaAtiva.status || 'PROGRAMADO'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.routeInfo} numberOfLines={1}>
            {cargaAtiva.destinoCliente || cargaAtiva.clienteEntrega || 'Destino'}
          </Text>
          
          <View style={styles.cidadesContainer}>
            {cargaAtiva.origemCidade && (
              <Text style={styles.cidadeText}>{cargaAtiva.origemCidade}</Text>
            )}
            <MaterialIcons name="arrow-forward" size={14} color="#666" />
            {cargaAtiva.destinoCidade && (
              <Text style={[styles.cidadeText, {color: '#2ecc71', fontWeight: 'bold'}]}>
                {cargaAtiva.destinoCidade}
              </Text>
            )}
          </View>
          
          {cargaAtiva.observacao && (
            <Text style={styles.observacaoText} numberOfLines={2}>
              📝 {cargaAtiva.observacao}
            </Text>
          )}
        </View>
        
        <MaterialIcons name="location-on" size={30} color={statusColor} />
      </View>
      
      {podeIniciar && (
        <TouchableOpacity 
          style={styles.iniciarButton}
          onPress={onIniciarViagem}
        >
          <MaterialCommunityIcons name="play-circle" size={20} color="#000" />
          <Text style={styles.iniciarButtonText}>INICIAR VIAGEM</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// --- APP PRINCIPAL ---
function App() {
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
  
  const [solicitacaoHodometro, setSolicitacaoHodometro] = useState(false);
  const [hodometroInput, setHodometroInput] = useState('');
  const [enviandoKm, setEnviandoKm] = useState(false);
  
  const [carregandoRota, setCarregandoRota] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  
  const webviewRef = useRef(null);
  const lastSolicitacaoStatus = useRef(false);
  const locationWatchRef = useRef(null);
  const viagemListenerRef = useRef(null);

  // --- INICIAR BACKGROUND TASK ---
  const iniciarBackgroundTask = async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 50,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Monitoramento GPS Ativo',
            notificationBody: 'Sua localização está sendo monitorada',
            notificationColor: '#FFD700',
          },
        });
        console.log('Background task iniciada');
      }
    } catch (error) {
      console.log('Erro ao iniciar background task:', error);
    }
  };

  // --- SINCRONIZAR COM FIRESTORE ---
  const sincronizarComFirestore = async (extra = {}) => {
    if (!auth.currentUser || !motoristaProfile) return;
    
    try {
      const dados = { 
        motoristaId: auth.currentUser.uid, 
        motoristaUid: auth.currentUser.uid,
        nomeMotorista: motoristaProfile.nome || "Não informado",
        cpfMotorista: motoristaProfile.cpf || "",
        telefoneMotorista: motoristaProfile.telefone || "",
        empresa: motoristaProfile.empresa || "Transportadora",
        ultimaAtualizacao: serverTimestamp(),
        latitude: extra.latitude || location?.latitude,
        longitude: extra.longitude || location?.longitude,
        statusOperacional: extra.statusOperacional || statusOperacional,
        velocidade: extra.velocidade !== undefined ? extra.velocidade : currentSpeed,
        cidade: extra.cidade || "---",
        uf: extra.uf || "",
        bairro: extra.bairro || "",
        endereco: extra.endereco || "",
        statusJornada: "EM ATIVIDADE", 
        viagemIniciada: viagemIniciada,
        cargaAtiva: cargaAtiva ? true : false,
        appState: appState,
        batteryLevel: 100,
        timestamp: Date.now()
      };
      
      await setDoc(doc(db, "localizacao_realtime", auth.currentUser.uid), dados, { merge: true });
      
      const motoristaRef = doc(db, "cadastro_motoristas", auth.currentUser.uid);
      await updateDoc(motoristaRef, {
        ultimaLocalizacao: serverTimestamp(),
        online: true,
        statusOperacional: dados.statusOperacional
      });
      
    } catch (e) { 
      console.log("Erro sincronia:", e); 
    }
  };

  // --- HOOK DE MONITORAMENTO DE CARGAS ---
  const {
    geofenceAtiva, 
    rotaCoords, 
    chegouAoDestino, 
    confirmacaoPendente,
    carregandoRota: carregandoRotaHook,
    setChegouAoDestino, 
    setConfirmacaoPendente, 
    setRotaCoords
  } = useGpseCercas(db, user, location, cargaAtiva, setCargaAtiva, viagemIniciada);

  // --- MONITORAR CARGAS DO PAINEL GESTOR ---
  useEffect(() => {
    if (!user?.uid) return;
    
    const q = query(
      collection(db, "ordens_servico"), 
      where("motoristaUid", "==", user.uid)
    );
    
    viagemListenerRef.current = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = { id: doc.id, ...doc.data() };
        
        setCargaAtiva(data);
        setStatusOperacional(data.statusOperacional || 'PROGRAMADO');
        setViagemIniciada(data.viagemIniciada || false);
        
        if (data.chegouAoDestino && !data.finalizada) {
          setShowConfirmacaoModal(true);
        }
        
        console.log('Nova carga recebida:', data);
        
        Notifications.scheduleNotificationAsync({
          content: {
            title: '📦 Nova Viagem Programada!',
            body: `Destino: ${data.destinoCliente || data.clienteEntrega}`,
            data: { type: 'nova_viagem' },
          },
          trigger: null,
        });
      } else {
        setCargaAtiva(null);
        setViagemIniciada(false);
        setStatusOperacional('Sem programação');
      }
    }, (error) => {
      console.error('Erro no listener de ordens_servico:', error);
    });
    
    return () => {
      if (viagemListenerRef.current) {
        viagemListenerRef.current();
      }
    };
  }, [user?.uid]);

  // --- MONITORAR COMANDOS DO PAINEL ---
  useEffect(() => {
    if (!user?.uid) return;
    
    const comandosRef = doc(db, "comandos_roteiro", user.uid);
    const unsubscribe = onSnapshot(comandosRef, (docSnap) => {
      if (docSnap.exists()) {
        const comando = docSnap.data();
        console.log('Comando recebido:', comando);
        
        if (comando.tipo === "NOVA_VIAGEM") {
          Alert.alert(
            "📋 Nova Viagem Recebida!",
            `Destino: ${comando.destinoCliente || comando.clienteEntrega}\n` +
            `Cidade: ${comando.destinoCidade || ''}`,
            [
              { text: "Visualizar", onPress: () => setActiveTab('viagens') },
              { text: "OK" }
            ]
          );
          
          Vibration.vibrate([500, 200, 500, 200, 500]);
        }
        
        if (comando.tipo === "ATUALIZAR_ROTEIRO") {
          Alert.alert("🔄 Roteiro Atualizado", "Sua viagem foi atualizada pelo gestor.");
        }
      }
    });
    
    return () => unsubscribe();
  }, [user?.uid]);

  // --- TRAVA DE HODÔMETRO ---
  const enviarKmObrigatorio = async () => {
    if (!hodometroInput.trim()) {
      Alert.alert("Atenção", "Informe o KM atual do hodômetro.");
      return;
    }
    
    setEnviandoKm(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let cidade = "S/L";
      let uf = "";
      
      if (status === 'granted' && location) {
        const geo = await Location.reverseGeocodeAsync({
          latitude: location.latitude,
          longitude: location.longitude
        });
        if (geo.length > 0) {
          cidade = geo[0].subregion || geo[0].city || "Cidade";
          uf = geo[0].region || "";
        }
      }

      await addDoc(collection(db, 'historico_jornadas'), {
        motoristaId: user.uid,
        motoristaNome: motoristaProfile?.nome || user.email,
        tipo: 'LOG_SOLICITADO',
        timestamp: serverTimestamp(),
        km: parseFloat(hodometroInput.replace(',', '.')),
        cidade: cidade,
        uf: uf,
        origem: 'APP_MOBILE',
        status: 'ENVIADO'
      });

      await updateDoc(doc(db, "configuracoes", "controle_app"), { 
        pedirHodometro: false,
        ultimoHodometro: parseFloat(hodometroInput.replace(',', '.')),
        ultimoEnvio: serverTimestamp()
      });
      
      setHodometroInput('');
      Alert.alert("✅ Sucesso", "KM enviado! Aplicativo liberado.");
      
    } catch (e) {
      console.error('Erro ao enviar hodômetro:', e);
      Alert.alert("❌ Erro", "Falha ao enviar dados. Tente novamente.");
    } finally {
      setEnviandoKm(false);
    }
  };

  // --- LISTENER DE AUTH ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => { 
      if (u) {
        setUser(u);
        
        const q = query(collection(db, "cadastro_motoristas"), where("uid", "==", u.uid));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const profile = snap.docs[0].data();
          setMotoristaProfile(profile);
          setIsLoggedIn(true);
          
          setTimeout(() => {
            iniciarBackgroundTask();
          }, 2000);
          
        } else {
          Alert.alert("Erro", "Perfil de motorista não encontrado.");
          await signOut(auth);
        }
      } else {
        setUser(null); 
        setIsLoggedIn(false);
        setMotoristaProfile(null);
      }
    }); 
    
    return unsubscribe;
  }, []);

  // --- MONITORAR SOLICITAÇÃO DE HODÔMETRO ---
  useEffect(() => {
    if (!user) return;
    
    const unsub = onSnapshot(doc(db, "configuracoes", "controle_app"), (docSnap) => {
      if (docSnap.exists()) {
        const isPedindo = docSnap.data().pedirHodometro;
        setSolicitacaoHodometro(isPedindo);
        
        if (isPedindo && !lastSolicitacaoStatus.current) {
          Vibration.vibrate([500, 200, 500]);
          Alert.alert(
            "📊 Hodômetro Solicitado",
            "O gestor solicitou a leitura do hodômetro.",
            [{ text: "OK", onPress: () => {} }]
          );
        }
        lastSolicitacaoStatus.current = isPedindo;
      }
    });
    
    return () => unsub();
  }, [user]);

  // --- MONITORAR APP STATE ---
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
    });
    
    return () => subscription.remove();
  }, []);

  // --- MONITORAMENTO GPS EM PRIMEIRO PLANO ---
  useEffect(() => {
    if (!isLoggedIn) return;
    
    let isMounted = true;
    
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permissão necessária", "Precisamos da permissão de localização.");
        return;
      }
      
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
      }
      
      locationWatchRef.current = await Location.watchPositionAsync(
        { 
          accuracy: Location.Accuracy.BestForNavigation, 
          timeInterval: 5000, 
          distanceInterval: 10 
        }, 
        async (loc) => {
          if (!isMounted) return;
          
          const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
          setLocation(loc.coords); 
          setCurrentSpeed(speedKmh < 0 ? 0 : speedKmh);
          
          if (webviewRef.current) {
            webviewRef.current.postMessage(JSON.stringify({ 
              type: 'updateLoc', 
              lat: loc.coords.latitude, 
              lng: loc.coords.longitude 
            }));
          }
          
          let cidade = "---", uf = "", bairro = "", endereco = "";
          try {
            const geo = await Location.reverseGeocodeAsync(loc.coords);
            if (geo.length > 0) { 
              cidade = geo[0].city || geo[0].subregion || "---";
              uf = geo[0].region || "";
              bairro = geo[0].district || "";
              endereco = `${geo[0].street || ""} ${geo[0].streetNumber || ""}`.trim();
            }
          } catch (e) {}
          
          sincronizarComFirestore({ 
            latitude: loc.coords.latitude, 
            longitude: loc.coords.longitude, 
            velocidade: speedKmh, 
            cidade, 
            uf,
            bairro,
            endereco
          });
        }
      );
    })();
    
    return () => {
      isMounted = false;
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
      }
    };
  }, [isLoggedIn]);

  // --- FUNÇÃO PARA INICIAR VIAGEM ---
  const iniciarViagem = async () => {
    if (!cargaAtiva) return;
    
    try {
      await updateDoc(doc(db, "ordens_servico", cargaAtiva.id), {
        viagemIniciada: true,
        status: 'EM ROTA',
        statusOperacional: 'EM ROTA',
        dataInicio: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
      
      await updateDoc(doc(db, "cadastro_motoristas", user.uid), {
        statusEscala: 'EM ROTA'
      });
      
      setViagemIniciada(true);
      setStatusOperacional('EM ROTA');
      
      Alert.alert("✅ Viagem Iniciada", "Boa viagem! O sistema começou a monitorar seu trajeto.");
      
    } catch (error) {
      console.error('Erro ao iniciar viagem:', error);
      Alert.alert("❌ Erro", "Não foi possível iniciar a viagem.");
    }
  };

  // --- CONFIRMAR CHEGADA ---
  const confirmarChegadaFinal = async () => {
    if (!cargaAtiva) return;
    
    try {
      await updateDoc(doc(db, "ordens_servico", cargaAtiva.id), { 
        finalizada: true, 
        status: 'FINALIZADA', 
        statusOperacional: 'FINALIZADA',
        dataFinalizacao: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
      
      await updateDoc(doc(db, "cadastro_motoristas", user.uid), {
        statusEscala: 'DISPONÍVEL'
      });
      
      await deleteDoc(doc(db, "comandos_roteiro", user.uid));
      
      setCargaAtiva(null); 
      setViagemIniciada(false); 
      setRotaCoords([]);
      setStatusOperacional('DISPONÍVEL');
      setShowConfirmacaoModal(false);
      
      Alert.alert("✅ Sucesso", "Viagem finalizada com sucesso!");
      
    } catch (error) { 
      Alert.alert("❌ Erro", "Falha ao finalizar a viagem."); 
    }
  };

  // --- HTML DO MAPA ---
  const mapHtml = useMemo(() => {
    if (!location) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
            body { margin: 0; background: #000; } 
            #map { height: 100vh; }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            var map = L.map('map').setView([-21.78, -48.17], 6);
            L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
              subdomains: ['mt0','mt1','mt2','mt3']
            }).addTo(map);
          </script>
        </body>
        </html>
      `;
    }
    
    const dest = geofenceAtiva?.centro || 
                (rotaCoords.length > 0 ? 
                 {lat: rotaCoords[rotaCoords.length-1].latitude, 
                  lng: rotaCoords[rotaCoords.length-1].longitude} : null);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; background: #000; } 
          #map { height: 100vh; }
          .leaflet-control-zoom { margin-top: 60px !important; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { 
            zoomControl: true,
            scrollWheelZoom: true,
            touchZoom: true,
            doubleClickZoom: true
          }).setView([${location.latitude}, ${location.longitude}], 15);
          
          L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            subdomains: ['mt0','mt1','mt2','mt3'],
            attribution: '© Google Maps'
          }).addTo(map);
          
          var motoristaIcon = L.divIcon({
            html: '<div style="background:#FFD700; width:18px; height:18px; border-radius:50%; border:3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
            className: 'motorista-marker',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });
          
          var marker = L.marker([${location.latitude}, ${location.longitude}], {
            icon: motoristaIcon,
            zIndexOffset: 1000
          }).addTo(map);
          
          ${dest ? `
            var destinoIcon = L.divIcon({
              html: '<div style="background:#2ecc71; width:12px; height:12px; border-radius:50%; border:2px solid #fff;"></div>',
              className: 'destino-marker',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            });
            
            var destinoMarker = L.marker([${dest.lat || dest.latitude}, ${dest.lng || dest.longitude}], {
              icon: destinoIcon
            }).addTo(map);
            
            L.circle([${dest.lat || dest.latitude}, ${dest.lng || dest.longitude}], {
              radius: ${geofenceAtiva?.raio || 300},
              color: '${chegouAoDestino ? '#2ecc71' : '#FFD700'}',
              weight: 2,
              fillOpacity: 0.15
            }).addTo(map);
          ` : ''}
          
          ${rotaCoords.length > 0 ? `
            var rotaPoints = ${JSON.stringify(rotaCoords.map(c => [c.latitude, c.longitude]))};
            L.polyline(rotaPoints, {
              color: '#FFD700',
              weight: 4,
              opacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          ` : ''}
          
          window.addEventListener('message', function(e) {
            try {
              var data = JSON.parse(e.data);
              
              if(data.type === 'updateLoc') {
                marker.setLatLng([data.lat, data.lng]);
                map.panTo([data.lat, data.lng]);
              }
              
              if(data.type === 'center') {
                map.flyTo([data.lat, data.lng], 16, {
                  duration: 1
                });
              }
            } catch(err) {
              console.error('Erro parse message:', err);
            }
          });
          
          map.invalidateSize();
        </script>
      </body>
      </html>
    `;
  }, [location, rotaCoords, chegouAoDestino, geofenceAtiva]);

  if (!isLoggedIn) {
    return <TelaLogin onLogin={async (e, p) => signInWithEmailAndPassword(auth, e, p)} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      
      {/* MODAL HODÔMETRO */}
      <Modal visible={solicitacaoHodometro} transparent={false} animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.lockScreen}
        >
          <View style={styles.lockContent}>
            <MaterialCommunityIcons name="gauge" size={100} color="#000" />
            <Text style={styles.lockTitle}>HODÔMETRO SOLICITADO</Text>
            <Text style={styles.lockSub}>
              Informe o KM atual para liberar o aplicativo.
            </Text>
            
            <TextInput 
              style={styles.lockInput}
              placeholder="000000"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={hodometroInput}
              onChangeText={setHodometroInput}
              autoFocus
              maxLength={7}
            />
            
            <TouchableOpacity 
              style={styles.lockBtn} 
              onPress={enviarKmObrigatorio} 
              disabled={enviandoKm || !hodometroInput.trim()}
            >
              {enviandoKm ? (
                <ActivityIndicator color="#FFD700" />
              ) : (
                <Text style={styles.lockBtnText}>ENVIAR AGORA</Text>
              )}
            </TouchableOpacity>
            
            <Text style={styles.lockInfo}>
              Este dado é obrigatório para continuar usando o app.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CONTEÚDO PRINCIPAL */}
      <View style={{flex: 1, paddingTop: activeTab === 'painel' ? 0 : 60}}>
        {activeTab === 'painel' ? (
          <View style={{flex: 1}}>
            <MapViewStatic 
              html={mapHtml} 
              webviewRef={webviewRef} 
              onMapReady={() => console.log('Mapa pronto')}
            />
            
            <StatusAtual cargaAtiva={cargaAtiva} />
            
            <View style={styles.speedometerContainer}>
              <Text style={styles.speedText}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>KM/H</Text>
            </View>
            
            <ViagemCard 
              cargaAtiva={cargaAtiva} 
              chegouAoDestino={chegouAoDestino}
              onOpenGoogleMaps={(url) => Linking.openURL(url)}
              onIniciarViagem={iniciarViagem}
            />
            
            <BotaoRotaAutomatica 
              location={location} 
              cargaAtiva={cargaAtiva} 
              setRotaCoords={setRotaCoords} 
              disabled={!viagemIniciada} 
              onOpenGoogleMaps={(url) => Linking.openURL(url)} 
            />
            
            <TouchableOpacity 
              style={styles.floatingGps}
              onPress={() => {
                if (location && webviewRef.current) {
                  webviewRef.current.postMessage(JSON.stringify({ 
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
        ) : activeTab === 'viagens' ? (
          <MinhasViagens auth={auth} db={db} />
        ) : activeTab === 'escala' ? (
          <Escala auth={auth} db={db} />
        ) : activeTab === 'jornada' ? (
          <Jornada auth={auth} db={db} />
        ) : (
          <Conta auth={auth} db={db} />
        )}
      </View>

      {/* MODAL DE CONFIRMAÇÃO */}
      <ConfirmacaoChegadaModal 
        visible={showConfirmacaoModal}
        onConfirm={confirmarChegadaFinal}
        onCancel={() => setShowConfirmacaoModal(false)}
        cargaAtiva={cargaAtiva}
      />

      {/* NAVEGAÇÃO */}
      <View style={styles.floatingNavContainer}>
        <View style={styles.floatingNav}>
          {[
            { key: 'painel', icon: 'map', label: 'Início', lib: Ionicons },
            { key: 'viagens', icon: 'truck-delivery', label: 'Cargas', lib: MaterialCommunityIcons },
            { key: 'escala', icon: 'calendar-clock', label: 'Escala', lib: MaterialCommunityIcons },
            { key: 'jornada', icon: 'timer', label: 'Jornada', lib: Ionicons },
            { key: 'perfil', icon: 'shield-account', label: 'Perfil', lib: MaterialCommunityIcons },
          ].map(({ key, icon, label, lib: IconLib }) => (
            <TouchableOpacity 
              key={key} 
              style={styles.navItem} 
              onPress={() => setActiveTab(key)}
              activeOpacity={0.7}
            >
              <IconLib 
                name={icon} 
                size={24} 
                color={activeTab === key ? "#FFD700" : "#999"} 
              />
              <Text style={[
                styles.navText, 
                { color: activeTab === key ? "#FFD700" : "#999" }
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// --- ESTILOS ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  loadingContainer: { 
    flex: 1, 
    backgroundColor: '#000', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  loadingText: {
    color: '#FFD700',
    marginTop: 10,
    fontSize: 14
  },
  lockScreen: { 
    flex: 1, 
    backgroundColor: '#FFD700', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 30 
  },
  lockContent: { 
    width: '100%', 
    alignItems: 'center' 
  },
  lockTitle: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: '#000', 
    marginTop: 20, 
    textAlign: 'center' 
  },
  lockSub: { 
    fontSize: 16, 
    color: '#000', 
    textAlign: 'center', 
    marginTop: 10, 
    marginBottom: 40, 
    opacity: 0.8, 
    fontWeight: '600' 
  },
  lockInput: { 
    backgroundColor: '#000', 
    color: '#FFD700', 
    width: '100%', 
    borderRadius: 15, 
    padding: 20, 
    fontSize: 40, 
    textAlign: 'center', 
    fontWeight: 'bold', 
    marginBottom: 20,
    letterSpacing: 2
  },
  lockBtn: { 
    backgroundColor: '#000', 
    width: '100%', 
    padding: 22, 
    borderRadius: 15, 
    alignItems: 'center', 
    elevation: 10,
    marginBottom: 20
  },
  lockBtnText: { 
    color: '#FFD700', 
    fontSize: 18, 
    fontWeight: '900' 
  },
  lockInfo: {
    color: '#000',
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 10
  },
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
    zIndex: 30,
    elevation: 10,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10
  },
  speedText: { 
    color: '#FFD700', 
    fontSize: 24, 
    fontWeight: '900' 
  },
  speedUnit: { 
    color: '#FFF', 
    fontSize: 9, 
    fontWeight: 'bold',
    marginTop: -5
  },
  noViagemCard: {
    position: 'absolute', 
    bottom: 125, 
    left: 15, 
    right: 15, 
    backgroundColor: 'rgba(15,15,15,0.95)', 
    borderRadius: 15, 
    padding: 20,
    borderWidth: 1, 
    borderColor: '#333', 
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center'
  },
  noViagemTextContainer: {
    marginLeft: 15,
    flex: 1
  },
  noViagemTitle: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2
  },
  noViagemSubtitle: {
    color: '#AAA',
    fontSize: 12
  },
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
    borderLeftWidth: 5,
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
    fontSize: 10, 
    fontWeight: 'bold' 
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10
  },
  statusBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold'
  },
  routeInfo: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: '900', 
    marginBottom: 4 
  },
  cidadesContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  cidadeText: { 
    color: '#AAA', 
    fontSize: 12,
    marginHorizontal: 4
  },
  observacaoText: {
    color: '#888',
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic'
  },
  iniciarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 10,
    marginTop: 10
  },
  iniciarButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8
  },
  floatingGps: { 
    position: 'absolute', 
    bottom: 210, 
    right: 20, 
    backgroundColor: 'rgba(0,0,0,0.9)', 
    padding: 12, 
    borderRadius: 50, 
    zIndex: 5,
    elevation: 5 
  },
  floatingNavContainer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingBottom: Platform.OS === 'ios' ? 30 : 20, 
    paddingHorizontal: 10, 
    zIndex: 100,
    backgroundColor: 'transparent'
  },
  floatingNav: { 
    flexDirection: 'row', 
    backgroundColor: '#151515', 
    paddingVertical: 12, 
    borderRadius: 20, 
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#333',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10
  },
  navItem: { 
    alignItems: 'center', 
    flex: 1 
  },
  navText: { 
    fontSize: 9, 
    marginTop: 4, 
    fontWeight: '600' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20
  },
  modalContent: { 
    backgroundColor: '#111', 
    borderRadius: 20, 
    padding: 20, 
    width: '100%', 
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
    fontSize: 20, 
    fontWeight: 'bold', 
    marginTop: 10,
    textAlign: 'center'
  },
  modalScroll: { 
    maxHeight: 300, 
    marginBottom: 15 
  },
  modalMessage: { 
    color: '#FFF', 
    textAlign: 'center', 
    marginBottom: 20,
    fontSize: 16,
    lineHeight: 22
  },
  detalhesCargaContainer: { 
    backgroundColor: 'rgba(30,30,30,0.7)', 
    borderRadius: 10, 
    padding: 15, 
    marginBottom: 15 
  },
  detalhesTitulo: { 
    color: '#FFD700', 
    fontSize: 14, 
    fontWeight: 'bold', 
    marginBottom: 10 
  },
  detalhesLinha: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 8 
  },
  detalhesLabel: { 
    color: '#AAA', 
    fontSize: 13 
  },
  detalhesValor: { 
    color: '#FFF', 
    fontSize: 13,
    fontWeight: '600'
  },
  modalWarning: {
    color: '#e74c3c',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic'
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
    fontWeight: 'bold',
    fontSize: 14
  },
  modalButtonCancelText: { 
    color: '#fff',
    fontSize: 14
  }
});

export default App;