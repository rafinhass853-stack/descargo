import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar, ActivityIndicator, Alert, Vibration, Modal, Linking, ScrollView, Platform, TextInput, KeyboardAvoidingView, AppState, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { MaterialCommunityIcons, Ionicons, MaterialIcons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, doc, updateDoc, setDoc, serverTimestamp, collection, query, where, getDocs, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';

import Conta from './Conta'; 
import Jornada from './Jornada'; 
import Escala from './Escala'; 
import MinhasViagens from './MinhasViagens';
import TelaLogin from './TelaLogin'; 
import StatusAtual from './StatusAtual'; 
import useMonitorarCargas from './MonitorarCargas'; 
import { useGpseCercas } from './GpseCercas'; 
import BotaoRotaAutomatica from './BotaoRotaAutomatica';
import Abastecimento from './Abastecimento';

const { width } = Dimensions.get('window');

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

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data?.locations || !auth.currentUser) return;
  const loc = data.locations[0];
  if (!loc) return;
  const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
  try {
    await setDoc(doc(db, "localizacao_realtime", auth.currentUser.uid), {
      latitude: loc.coords.latitude, 
      longitude: loc.coords.longitude, 
      velocidade: speedKmh < 0 ? 0 : speedKmh,
      ultimaAtualizacao: serverTimestamp(), 
      statusJornada: "EM ATIVIDATE (BACKGROUND)", 
      appState: 'background', 
      batteryLevel: 100
    }, { merge: true });
    await updateDoc(doc(db, "cadastro_motoristas", auth.currentUser.uid), { 
      ultimaLocalizacao: serverTimestamp(), 
      online: true 
    });
  } catch (e) { 
    console.log("Erro background task:", e); 
  }
});

Notifications.setNotificationHandler({ 
  handleNotification: async () => ({ 
    shouldShowAlert: true, 
    shouldPlaySound: true, 
    shouldSetBadge: true 
  }) 
});

const MapViewStatic = React.memo(({ html, webviewRef, onMapReady }) => {
  const [loading, setLoading] = useState(true);
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
            JSON.parse(event.nativeEvent.data); 
          } catch (e) {} 
        }} 
        onLoadEnd={() => { 
          setLoading(false); 
          if (onMapReady) onMapReady(); 
        }}
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
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onCancel}>
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
                    {cargaAtiva.clienteEntrega || cargaAtiva.destinoCliente || '---'}
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
                  <Text style={[styles.detalhesValor, { color: cargaAtiva.tipoViagem === 'VAZIO' ? '#3498db' : '#FFD700' }]}>
                    {cargaAtiva.tipoViagem || 'CARREGADO'}
                  </Text>
                </View>
                
                {/* LEAD TIME INFO */}
                {(cargaAtiva.leadTimeColetaInicio || cargaAtiva.leadTimeEntregaInicio) && (
                  <View style={styles.leadTimeInfoContainer}>
                    <Text style={styles.leadTimeInfoTitle}>⏱️ LEAD TIME:</Text>
                    {cargaAtiva.leadTimeColetaInicio && (
                      <View style={styles.leadTimeItem}>
                        <Text style={styles.leadTimeLabel}>Coleta:</Text>
                        <Text style={styles.leadTimeValue}>
                          {cargaAtiva.leadTimeColetaInicio} → {cargaAtiva.leadTimeColetaFim || 'Em andamento'}
                        </Text>
                      </View>
                    )}
                    {cargaAtiva.leadTimeEntregaInicio && (
                      <View style={styles.leadTimeItem}>
                        <Text style={styles.leadTimeLabel}>Entrega:</Text>
                        <Text style={styles.leadTimeValue}>
                          {cargaAtiva.leadTimeEntregaInicio} → {cargaAtiva.leadTimeEntregaFim || 'Em andamento'}
                        </Text>
                      </View>
                    )}
                    {cargaAtiva.leadTimeTotal && (
                      <Text style={styles.leadTimeTotal}>
                        Total: {cargaAtiva.leadTimeTotal}
                      </Text>
                    )}
                  </View>
                )}
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

// COMPONENTE: CARD DE INFORMAÇÕES DA CARGA COM LEAD TIME
const InfoCargaCard = ({ cargaAtiva, chegouAoDestino, onOpenGoogleMaps }) => {
  if (!cargaAtiva) return (
    <View style={styles.noViagemCard}>
      <MaterialCommunityIcons name="truck-off" size={30} color="#666" />
      <View style={styles.noViagemTextContainer}>
        <Text style={styles.noViagemTitle}>SEM VIAGEM ATIVA</Text>
        <Text style={styles.noViagemSubtitle}>Aguardando nova programação</Text>
      </View>
    </View>
  );

  const statusColor = chegouAoDestino ? '#2ecc71' : 
                     cargaAtiva.viagemIniciada ? '#FFD700' : 
                     cargaAtiva.status === 'PROGRAMADO' ? '#3498db' : '#FFD700';
  
  const isFinalizada = cargaAtiva.finalizada || 
                      cargaAtiva.statusOperacional === 'FINALIZADA' || 
                      cargaAtiva.chegouAoDestino;
  
  const formatarDataHora = (dataString) => {
    if (!dataString) return '--/--/-- --:--';
    try {
      const date = dataString.toDate ? dataString.toDate() : new Date(dataString);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return '--/--/-- --:--';
    }
  };

  // Calcular lead time
  const calcularTempoDecorrido = (inicio, fim) => {
    if (!inicio || !fim) return '00:00:00';
    try {
      const [dataInicio, horaInicio] = inicio.split(' ');
      const [dataFim, horaFim] = fim.split(' ');
      
      const [diaI, mesI, anoI] = dataInicio.split('/');
      const [horaI, minI] = horaInicio.split(':');
      
      const [diaF, mesF, anoF] = dataFim.split('/');
      const [horaF, minF] = horaFim.split(':');
      
      const dataInicioObj = new Date(anoI, mesI - 1, diaI, horaI, minI);
      const dataFimObj = new Date(anoF, mesF - 1, diaF, horaF, minF);
      
      const diffMs = dataFimObj - dataInicioObj;
      const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSegundos = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      return `${diffHoras.toString().padStart(2, '0')}:${diffMinutos.toString().padStart(2, '0')}:${diffSegundos.toString().padStart(2, '0')}`;
    } catch (error) {
      return '00:00:00';
    }
  };

  const leadTimeColeta = cargaAtiva.leadTimeColetaInicio && cargaAtiva.leadTimeColetaFim 
    ? calcularTempoDecorrido(cargaAtiva.leadTimeColetaInicio, cargaAtiva.leadTimeColetaFim)
    : null;
    
  const leadTimeEntrega = cargaAtiva.leadTimeEntregaInicio && cargaAtiva.leadTimeEntregaFim 
    ? calcularTempoDecorrido(cargaAtiva.leadTimeEntregaInicio, cargaAtiva.leadTimeEntregaFim)
    : null;

  return (
    <TouchableOpacity 
      style={[styles.infoCargaCard, { borderLeftColor: statusColor }]} 
      activeOpacity={0.9} 
      onPress={() => { 
        if (cargaAtiva.linkEntrega) onOpenGoogleMaps(cargaAtiva.linkEntrega); 
      }}
    >
      {/* CABEÇALHO COM STATUS E DT */}
      <View style={styles.infoCargaHeader}>
        <View style={styles.headerLeft}>
          <Text style={[styles.cargaTipo, { color: statusColor }]}>
            {cargaAtiva.tipoViagem || 'CARREGADO'}
          </Text>
          <View style={[styles.dtBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.dtText}>DT {cargaAtiva.dt || '---'}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusBadgeText}>
            {isFinalizada ? 'FINALIZADA' :
             chegouAoDestino ? 'NO DESTINO' : 
             cargaAtiva.viagemIniciada ? 'EM ROTA' : 
             cargaAtiva.statusOperacional || cargaAtiva.status || 'PROGRAMADO'}
          </Text>
        </View>
      </View>

      {/* INFORMAÇÕES DA COLETA */}
      <View style={styles.infoSection}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="location-on" size={16} color="#3498db" />
          <Text style={styles.sectionTitle}>COLETA</Text>
        </View>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {cargaAtiva.clienteColeta || '---'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Cidade</Text>
            <Text style={styles.infoValue}>{cargaAtiva.cidadeColeta || cargaAtiva.origemCidade || '---'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Data/Hora</Text>
            <Text style={styles.infoValue}>{formatarDataHora(cargaAtiva.dataColeta)}</Text>
          </View>
        </View>
        
        {/* LEAD TIME COLETA */}
        {cargaAtiva.leadTimeColetaInicio && (
          <View style={styles.leadTimeContainer}>
            <View style={styles.leadTimeRow}>
              <MaterialIcons name="timer" size={12} color="#FFD700" />
              <Text style={styles.leadTimeLabel}>Lead Time Coleta:</Text>
              <Text style={styles.leadTimeValue}>
                {cargaAtiva.leadTimeColetaInicio} → {cargaAtiva.leadTimeColetaFim || 'Em andamento'}
              </Text>
            </View>
            {leadTimeColeta && (
              <Text style={styles.leadTimeDuration}>
                ⏱️ {leadTimeColeta}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* SEPARADOR */}
      <View style={styles.separatorContainer}>
        <View style={styles.separatorLine} />
        <MaterialIcons name="arrow-downward" size={20} color="#FFD700" />
        <View style={styles.separatorLine} />
      </View>

      {/* INFORMAÇÕES DA ENTREGA */}
      <View style={styles.infoSection}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="location-on" size={16} color="#2ecc71" />
          <Text style={styles.sectionTitle}>ENTREGA</Text>
        </View>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {cargaAtiva.clienteEntrega || '---'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Cidade</Text>
            <Text style={styles.infoValue}>{cargaAtiva.destinoCidade || '---'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Data/Hora</Text>
            <Text style={styles.infoValue}>{formatarDataHora(cargaAtiva.dataEntrega)}</Text>
          </View>
        </View>
        
        {/* LEAD TIME ENTREGA */}
        {cargaAtiva.leadTimeEntregaInicio && (
          <View style={styles.leadTimeContainer}>
            <View style={styles.leadTimeRow}>
              <MaterialIcons name="timer" size={12} color="#FFD700" />
              <Text style={styles.leadTimeLabel}>Lead Time Entrega:</Text>
              <Text style={styles.leadTimeValue}>
                {cargaAtiva.leadTimeEntregaInicio} → {cargaAtiva.leadTimeEntregaFim || 'Em andamento'}
              </Text>
            </View>
            {leadTimeEntrega && (
              <Text style={styles.leadTimeDuration}>
                ⏱️ {leadTimeEntrega}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* LEAD TIME TOTAL */}
      {(leadTimeColeta || leadTimeEntrega || cargaAtiva.leadTimeTotal) && (
        <View style={styles.leadTimeTotalContainer}>
          <MaterialIcons name="av-timer" size={16} color="#FFD700" />
          <Text style={styles.leadTimeTotalText}>
            LEAD TIME TOTAL: {cargaAtiva.leadTimeTotal || 'Calculando...'}
          </Text>
        </View>
      )}

      {/* OBSERVAÇÃO (SE HOUVER) */}
      {cargaAtiva.observacao && (
        <View style={styles.observacaoContainer}>
          <MaterialIcons name="info" size={14} color="#FFD700" />
          <Text style={styles.observacaoText} numberOfLines={2}>{cargaAtiva.observacao}</Text>
        </View>
      )}

      {/* BOTÃO DE FINALIZAR SE ESTIVER NO DESTINO */}
      {chegouAoDestino && !isFinalizada && (
        <TouchableOpacity style={styles.btnFinalizar}>
          <MaterialIcons name="check-circle" size={18} color="#2ecc71" />
          <Text style={styles.btnFinalizarText}>CONFIRMAR CHEGADA</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

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
  const lastCargaIdRef = useRef(null);
  const snapshotCounterRef = useRef(0);
  const debounceTimerRef = useRef(null);
  
  const { geofenceAtiva, rotaCoords, chegouAoDestino, confirmacaoPendente, carregandoRota: carregandoRotaHook, setChegouAoDestino, setConfirmacaoPendente, setRotaCoords } = useGpseCercas(db, user, location, cargaAtiva, setCargaAtiva, viagemIniciada);

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
            notificationColor: '#FFD700' 
          },
        });
      }
    } catch (error) { 
      console.log('Erro ao iniciar background task:', error); 
    }
  };

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
      await updateDoc(doc(db, "cadastro_motoristas", auth.currentUser.uid), { 
        ultimaLocalizacao: serverTimestamp(), 
        online: true, 
        statusOperacional: dados.statusOperacional 
      });
    } catch (e) { 
      console.log("Erro sincronia:", e); 
    }
  };

  // LÓGICA MELHORADA PARA CARREGAR VIAGEM ATIVA NO INÍCIO
  useEffect(() => {
    if (!user?.uid) return;
    
    console.log("🔍 [App.js] Iniciando listener para viagens ativas - UID:", user.uid);
    
    // Buscar viagens ativas (não finalizadas)
    const qAtivas = query(
      collection(db, "ordens_servico"), 
      where("motoristaUid", "==", user.uid),
      where("finalizada", "==", false)
    );
    
    // Buscar também em viagens_ativas
    const qViagensAtivas = query(
      collection(db, "viagens_ativas"), 
      where("motoristaUid", "==", user.uid)
    );
    
    const unsub1 = onSnapshot(qAtivas, (snapshot) => {
      console.log(`📥 [App.js] Snapshot ordens_servico: ${snapshot.size} documentos`);
      
      if (snapshot.size > 0) {
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          
          // Verificar se é uma viagem ativa (não finalizada e sem canhoto)
          if (!data.finalizada && !data.urlCanhoto) {
            console.log("✅ [App.js] Viagem ATIVA encontrada em ordens_servico:", {
              id: data.id,
              cliente: data.clienteEntrega,
              status: data.statusOperacional,
              finalizada: data.finalizada,
              canhoto: data.urlCanhoto
            });
            
            if (lastCargaIdRef.current !== data.id) {
              lastCargaIdRef.current = data.id;
              setCargaAtiva(data);
              setStatusOperacional(data.statusOperacional || 'PROGRAMADO');
              setViagemIniciada(data.viagemIniciada || false);
              
              if (data.chegouAoDestino && !data.finalizada) {
                setShowConfirmacaoModal(true);
              }
            }
            return;
          }
        });
      } else {
        // Se não encontrou em ordens_servico, verificar em viagens_ativas
        const unsub2 = onSnapshot(qViagensAtivas, (snapshot2) => {
          console.log(`📥 [App.js] Snapshot viagens_ativas: ${snapshot2.size} documentos`);
          
          if (snapshot2.size > 0) {
            snapshot2.forEach((doc) => {
              const data = { id: doc.id, ...doc.data() };
              
              console.log("✅ [App.js] Viagem encontrada em viagens_ativas:", {
                id: data.id,
                cliente: data.clienteEntrega,
                status: data.statusOperacional
              });
              
              if (lastCargaIdRef.current !== data.id) {
                lastCargaIdRef.current = data.id;
                setCargaAtiva(data);
                setStatusOperacional(data.statusOperacional || 'PROGRAMADO');
                setViagemIniciada(data.viagemIniciada || false);
              }
            });
          } else {
            console.log("⚠️ [App.js] Nenhuma viagem ativa encontrada");
            lastCargaIdRef.current = null;
            setCargaAtiva(null);
            setViagemIniciada(false);
            setStatusOperacional('Sem programação');
          }
        });
        
        return () => unsub2();
      }
    }, (error) => { 
      console.error('[App.js] Erro no listener de ordens_servico:', error); 
    });
    
    return () => { 
      if (unsub1) unsub1(); 
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); 
    };
  }, [user?.uid]);

  // Listener para comandos do gestor
  useEffect(() => { 
    if (!user?.uid) return; 
    const comandosRef = doc(db, "comandos_roteiro", user.uid);
    const unsubscribe = onSnapshot(comandosRef, (docSnap) => { 
      if (docSnap.exists()) { 
        const comando = docSnap.data(); 
        console.log('Comando recebido:', comando.tipo);
        
        if (comando.tipo === "NOVA_VIAGEM") {
          console.log("📨 Comando de nova viagem recebido");
          // Recarregar viagens
          setTimeout(() => {
            // Forçar recarga das viagens
            lastCargaIdRef.current = null;
            setCargaAtiva(null);
            // Disparar um evento para recarregar
          }, 1000);
        }
        
        if (comando.tipo === "ATUALIZAR_ROTEIRO") {
          Alert.alert("🔄 Roteiro Atualizado", "Sua viagem foi atualizada pelo gestor.");
        }
      } 
    }); 
    return () => unsubscribe(); 
  }, [user?.uid]);

  useEffect(() => {
    console.log("🔄 [DEBUG] Estado da carga atual:", { 
      temCarga: !!cargaAtiva, 
      id: cargaAtiva?.id, 
      cliente: cargaAtiva?.clienteEntrega, 
      status: cargaAtiva?.statusOperacional, 
      finalizada: cargaAtiva?.finalizada,
      chegouAoDestino: cargaAtiva?.chegouAoDestino,
      leadTime: {
        coleta: cargaAtiva?.leadTimeColetaInicio,
        entrega: cargaAtiva?.leadTimeEntregaInicio
      }
    }); 
  }, [cargaAtiva]);

  const enviarKmObrigatorio = async () => {
    if (!hodometroInput.trim()) { 
      Alert.alert("Atenção", "Informe o KM atual do hodômetro."); 
      return; 
    }
    setEnviandoKm(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let cidade = "S/L", uf = "";
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
          
          // Verificar se tem viagem ativa imediatamente após login
          setTimeout(() => {
            console.log("🔍 [Login] Verificando viagens ativas após login...");
            // A listener já vai ser acionada pelo efeito acima
          }, 3000);
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

  useEffect(() => {
    if (!user) return; 
    const unsub = onSnapshot(doc(db, "configuracoes", "controle_app"), (docSnap) => {
      if (docSnap.exists()) { 
        const isPedindo = docSnap.data().pedirHodometro; 
        setSolicitacaoHodometro(isPedindo);
        if (isPedindo && !lastSolicitacaoStatus.current) { 
          Vibration.vibrate([500, 200, 500]);
          Alert.alert("📊 Hodômetro Solicitado", "O gestor solicitou a leitura do hodômetro.", [{ text: "OK", onPress: () => {} }]);
        } 
        lastSolicitacaoStatus.current = isPedindo;
      }
    }); 
    return () => unsub(); 
  }, [user]);

  useEffect(() => { 
    const subscription = AppState.addEventListener('change', nextAppState => { 
      setAppState(nextAppState); 
    }); 
    return () => subscription.remove(); 
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return; 
    let isMounted = true; 
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync(); 
      if (status !== 'granted') { 
        Alert.alert("Permissão necessária", "Precisamos da permissão de localização."); 
        return; 
      }
      
      if (locationWatchRef.current) locationWatchRef.current.remove();
      
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
      if (locationWatchRef.current) locationWatchRef.current.remove(); 
    }; 
  }, [isLoggedIn]);

  const mapHtml = useMemo(() => {
    if (!location) return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>body { margin: 0; background: #000; } #map { height: 100vh; }</style></head>
      <body><div id="map"></div><script>var map = L.map('map').setView([-21.78, -48.17], 6);L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',{subdomains:['mt0','mt1','mt2','mt3']}).addTo(map);</script></body></html>`;
    
    const dest = geofenceAtiva?.centro || (rotaCoords.length > 0 ? {lat: rotaCoords[rotaCoords.length-1].latitude, lng: rotaCoords[rotaCoords.length-1].longitude} : null);
    
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>body { margin: 0; background: #000; } #map { height: 100vh; }.leaflet-control-zoom { margin-top: 60px !important; }</style></head>
      <body><div id="map"></div><script>var map = L.map('map', { zoomControl: true, scrollWheelZoom: true, touchZoom: true, doubleClickZoom: true }).setView([${location.latitude}, ${location.longitude}], 15);
      L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',{subdomains:['mt0','mt1','mt2','mt3'],attribution:'© Google Maps'}).addTo(map);
      var motoristaIcon = L.divIcon({html:'<div style="background:#FFD700; width:18px; height:18px; border-radius:50%; border:3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',className:'motorista-marker',iconSize:[18,18],iconAnchor:[9,9]});
      var marker = L.marker([${location.latitude}, ${location.longitude}], { icon: motoristaIcon, zIndexOffset: 1000 }).addTo(map);${dest ? `
      var destinoIcon = L.divIcon({html:'<div style="background:#2ecc71; width:12px; height:12px; border-radius:50%; border:2px solid #fff;"></div>',className:'destino-marker',iconSize:[12,12],iconAnchor:[6,6]});
      var destinoMarker = L.marker([${dest.lat || dest.latitude}, ${dest.lng || dest.longitude}], { icon: destinoIcon }).addTo(map);
      L.circle([${dest.lat || dest.latitude}, ${dest.lng || dest.longitude}], { radius: ${geofenceAtiva?.raio || 300}, color: '${chegouAoDestino ? '#2ecc71' : '#FFD700'}', weight: 2, fillOpacity: 0.15 }).addTo(map);` : ''}${rotaCoords.length > 0 ? `
      var rotaPoints = ${JSON.stringify(rotaCoords.map(c => [c.latitude, c.longitude]))};L.polyline(rotaPoints, { color: '#FFD700', weight: 4, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }).addTo(map);` : ''}
      window.addEventListener('message', function(e) { try { var data = JSON.parse(e.data); if(data.type === 'updateLoc') { marker.setLatLng([data.lat, data.lng]); map.panTo([data.lat, data.lng]); }
      if(data.type === 'center') { map.flyTo([data.lat, data.lng], 16, { duration: 1 }); } } catch(err) { console.error('Erro parse message:', err); } }); map.invalidateSize();</script></body></html>`;
  }, [location, rotaCoords, chegouAoDestino, geofenceAtiva]);

  if (!isLoggedIn) return <TelaLogin onLogin={async (e, p) => signInWithEmailAndPassword(auth, e, p)} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      
      <Modal visible={solicitacaoHodometro} transparent={false} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.lockScreen}>
          <View style={styles.lockContent}>
            <MaterialCommunityIcons name="gauge" size={100} color="#000" />
            <Text style={styles.lockTitle}>HODÔMETRO SOLICITADO</Text>
            <Text style={styles.lockSub}>Informe o KM atual para liberar o aplicativo.</Text>
            
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
            
            <Text style={styles.lockInfo}>Este dado é obrigatório para continuar usando o app.</Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={{flex: 1, paddingTop: activeTab === 'painel' ? 0 : 60}}>
        {activeTab === 'painel' ? (
          <View style={{flex: 1}}>
            <MapViewStatic html={mapHtml} webviewRef={webviewRef} onMapReady={() => console.log('Mapa pronto')} />
            <StatusAtual cargaAtiva={cargaAtiva} />
            
            <View style={styles.speedometerContainer}>
              <Text style={styles.speedText}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>KM/H</Text>
            </View>
            
            {/* CARD DE INFORMAÇÕES COM LEAD TIME */}
            <InfoCargaCard 
              cargaAtiva={cargaAtiva} 
              chegouAoDestino={chegouAoDestino} 
              onOpenGoogleMaps={(url) => Linking.openURL(url)} 
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
        ) : activeTab === 'abastecimento' ? (
          <Abastecimento auth={auth} db={db} />
        ) : (
          <Conta auth={auth} db={db} />
        )}
      </View>

      <ConfirmacaoChegadaModal 
        visible={showConfirmacaoModal} 
        onConfirm={() => {}} 
        onCancel={() => setShowConfirmacaoModal(false)} 
        cargaAtiva={cargaAtiva} 
      />
      
      {/* BARRA DE MENUS - AJUSTADA */}
      <View style={styles.floatingNavContainer}>
        <View style={styles.floatingNav}>
          {[
            { key: 'painel', icon: 'map', label: 'Início', lib: Ionicons },
            { key: 'viagens', icon: 'truck-delivery', label: 'Cargas', lib: MaterialCommunityIcons },
            { key: 'abastecimento', icon: 'gas-station', label: 'Abastec.', lib: MaterialCommunityIcons },
            { key: 'escala', icon: 'calendar-clock', label: 'Escala', lib: MaterialCommunityIcons },
            { key: 'jornada', icon: 'timer', label: 'Jornada', lib: Ionicons },
            { key: 'perfil', icon: 'shield-account', label: 'Perfil', lib: MaterialCommunityIcons }
          ].map(({ key, icon, label, lib: IconLib }) => (
            <TouchableOpacity 
              key={key} 
              style={styles.navItem} 
              onPress={() => setActiveTab(key)} 
              activeOpacity={0.7}
            >
              <View style={styles.navIconContainer}>
                <IconLib name={icon} size={22} color={activeTab === key ? "#FFD700" : "#999"} />
              </View>
              <Text style={[styles.navText, { color: activeTab === key ? "#FFD700" : "#999" }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

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
  
  // ESTILOS DO CARD DE INFORMAÇÕES
  infoCargaCard: {
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
    zIndex: 5,
  },
  
  infoCargaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  cargaTipo: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 10,
  },
  
  dtBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  
  dtText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  
  statusBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  infoSection: {
    marginBottom: 15,
  },
  
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  sectionTitle: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  
  infoItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  
  infoLabel: {
    color: '#AAA',
    fontSize: 10,
    marginBottom: 4,
  },
  
  infoValue: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // LEAD TIME STYLES
  leadTimeContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  
  leadTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  leadTimeLabel: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 6,
    marginRight: 8,
  },
  
  leadTimeValue: {
    color: '#FFF',
    fontSize: 10,
    flex: 1,
  },
  
  leadTimeDuration: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  
  leadTimeTotalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  
  leadTimeTotalText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  
  observacaoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  
  observacaoText: {
    color: '#FFD700',
    fontSize: 11,
    marginLeft: 8,
    flex: 1,
    fontStyle: 'italic',
  },
  
  btnFinalizar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderWidth: 1,
    borderColor: '#2ecc71',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  
  btnFinalizarText: {
    color: '#2ecc71',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
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
  
  // BARRA DE MENUS - AJUSTADA
  floatingNavContainer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingBottom: Platform.OS === 'ios' ? 25 : 15,
    paddingHorizontal: 10, 
    zIndex: 100, 
    backgroundColor: 'transparent' 
  },
  
  floatingNav: { 
    flexDirection: 'row', 
    backgroundColor: '#151515', 
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderRadius: 20, 
    justifyContent: 'space-around', 
    borderWidth: 1, 
    borderColor: '#333', 
    elevation: 10, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 5 }, 
    shadowOpacity: 0.5, 
    shadowRadius: 10,
    minHeight: 65,
  },
  
  navItem: { 
    alignItems: 'center', 
    flex: 1,
    paddingVertical: 4,
    justifyContent: 'center',
  }, 
  
  navIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    marginBottom: 3,
  },
  
  navText: { 
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
    minHeight: 14,
    includeFontPadding: false,
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
  
  // LEAD TIME INFO IN MODAL
  leadTimeInfoContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  
  leadTimeInfoTitle: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  
  leadTimeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  
  leadTimeTotal: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
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