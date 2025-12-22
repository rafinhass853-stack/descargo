import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, 
  StatusBar, Dimensions, Platform, Alert, Modal, TextInput, ScrollView,
  ActivityIndicator, Linking, Image, FlatList 
} from 'react-native';
import * as Location from 'expo-location';
import { Camera, CameraView } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// --- BIBLIOTECAS PARA PDF ---
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, initializeAuth, getReactNativePersistence, 
  onAuthStateChanged, signInWithEmailAndPassword, signOut 
} from "firebase/auth";
import { 
  getFirestore, doc, onSnapshot, collection, addDoc, 
  query, where, getDocs, orderBy, serverTimestamp,
  setDoc 
} from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// --- CONFIGURAÇÃO DO MAPA ---
let MapView, Marker, PROVIDER_GOOGLE;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
} else {
  const MapsWeb = require('@teovilla/react-native-web-maps');
  MapView = MapsWeb.default;
  Marker = MapsWeb.Marker;
}

const { width, height } = Dimensions.get('window');

const STATUS = {
  OFFLINE: 'OFFLINE',
  EM_JORNADA: 'EM_JORNADA',
  ALMOCO: 'ALMOCO',
  PARADA: 'PARADA'
};

const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

let auth;
try {
  auth = getAuth(app);
} catch (e) {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
}

const mapStyleNoite = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

const formatarTempo = (s) => {
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const segs = s % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
};

export default function App() {
  const [usuario, setUsuario] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [telaAtiva, setTelaAtiva] = useState('inicio');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [statusJornada, setStatusJornada] = useState(STATUS.OFFLINE);
  const [segundos, setSegundos] = useState(0);

  // --- LOGICA DE RASTREAMENTO GLOBAL (LOGADO = RASTREANDO) ---
  useEffect(() => {
    let watchId;

    const iniciarRastreamentoGpsGlobal = async (userEmail) => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000, // 30 segundos
          distanceInterval: 10,
        },
        async (locationData) => {
          const { latitude, longitude } = locationData.coords;
          
          try {
            await setDoc(doc(db, "localizacao_realtime", userEmail), {
              usuario: userEmail,
              lat: latitude,
              lng: longitude,
              ultimaAtualizacao: serverTimestamp(),
              status: statusJornada // Envia o status atual, mesmo que seja OFFLINE
            }, { merge: true });
          } catch (e) {
            console.log("Erro GPS Global:", e);
          }
        }
      );
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setLoading(false);
      
      if (user) {
        iniciarRastreamentoGpsGlobal(user.email);
      } else {
        if (watchId) watchId.remove();
      }
    });

    return () => {
      unsubscribe();
      if (watchId) watchId.remove();
    };
  }, [statusJornada]); // Relacionado ao status para atualizar o status no mapa também

  useEffect(() => {
    let intervalo = null;
    if (statusJornada !== STATUS.OFFLINE) {
      intervalo = setInterval(() => {
        setSegundos(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(intervalo);
    }
    return () => clearInterval(intervalo);
  }, [statusJornada]);

  const realizarLoginEmail = () => {
    if (!email || !senha) {
      Alert.alert("Atenção", "Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    signInWithEmailAndPassword(auth, email.trim(), senha)
      .catch(() => Alert.alert("Erro no Login", "Verifique suas credenciais."))
      .finally(() => setLoading(false));
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      setUsuario(null);
      setTelaAtiva('inicio');
      setStatusJornada(STATUS.OFFLINE);
      setSegundos(0);
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, {justifyContent: 'center'}]}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!usuario) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.contentLogin}>
          <Text style={styles.logo}>DESCARGO</Text>
          <View style={styles.linhaDestaque} />
          <TextInput style={styles.inputFundo} placeholder="E-mail" placeholderTextColor="#666" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.inputFundo} placeholder="Senha" placeholderTextColor="#666" secureTextEntry value={senha} onChangeText={setSenha} />
          <TouchableOpacity style={[styles.btnSalvarAbastecimento, {width: '100%'}]} onPress={realizarLoginEmail}>
             <Text style={styles.btnTexto}>ENTRAR NO APP</Text>
          </TouchableOpacity>
          <View style={styles.footerDev}>
            <Text style={styles.textoDev}>Desenvolvido por Rafael Araujo</Text>
            <View style={styles.rowIcones}>
              <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/5516988318626')}><MaterialCommunityIcons name="whatsapp" size={30} color="#25D366" /></TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/rafael.araujo1992/')}><MaterialCommunityIcons name="instagram" size={30} color="#E1306C" /></TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      {telaAtiva === 'inicio' ? (
        <Dashboard 
            setTelaAtiva={setTelaAtiva} 
            usuarioEmail={usuario.email} 
            statusJornada={statusJornada} 
            setStatusJornada={setStatusJornada}
            segundos={segundos}
            setSegundos={setSegundos}
        />
      ) : telaAtiva === 'abastecimento' ? (
        <TelaAbastecimento aoVoltar={() => setTelaAtiva('inicio')} />
      ) : telaAtiva === 'conta' ? (
        <TelaConta aoVoltar={() => setTelaAtiva('inicio')} logoff={handleLogout} userEmail={usuario.email} />
      ) : telaAtiva === 'historico' ? (
        <TelaGerenciadorHistorico aoVoltar={() => setTelaAtiva('inicio')} userEmail={usuario.email} />
      ) : null}
    </SafeAreaView>
  );
}

// --- TELA DASHBOARD ---
function Dashboard({ setTelaAtiva, usuarioEmail, statusJornada, setStatusJornada, segundos, setSegundos }) {
  const [location, setLocation] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [statusAlvo, setStatusAlvo] = useState(null);
  const cameraRef = useRef(null);
  const [ganhos, setGanhos] = useState("0,00");
  const [statusViagemDesc, setStatusViagemDesc] = useState("Sem programação");

  useEffect(() => {
    const docRef = doc(db, "viagens_ativas", usuarioEmail);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGanhos(data.faturamento || "0,00");
        setStatusViagemDesc(data.status_descricao || "Sem programação");
      }
    });
    return () => unsubscribe();
  }, [usuarioEmail]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let locationRes = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: locationRes.coords.latitude,
          longitude: locationRes.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      }
    })();
  }, []);

  const mudarStatusComFoto = (novoStatus) => {
    setStatusAlvo(novoStatus);
    setShowCamera(true);
  };

  const confirmarMudancaStatus = async () => {
    if (cameraRef.current) {
      try {
        await cameraRef.current.takePictureAsync({ quality: 0.5 });
        const dataHoje = new Date().toISOString().split('T')[0];
        
        await addDoc(collection(db, "historico_ponto"), {
          usuario: usuarioEmail,
          status: statusAlvo,
          data: dataHoje,
          hora: new Date().toLocaleTimeString(),
          timestamp: serverTimestamp(),
          coordenadas: location ? { lat: location.latitude, lng: location.longitude } : null,
          duracaoAnterior: statusJornada !== STATUS.OFFLINE ? formatarTempo(segundos) : "00:00:00"
        });

        setShowCamera(false);
        setSegundos(0); 
        setStatusJornada(statusAlvo);
        Alert.alert("Sucesso", "Ponto registrado!");
      } catch (e) {
        Alert.alert("Erro", "Erro ao salvar.");
      }
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.barraTop, { backgroundColor: statusJornada === STATUS.OFFLINE ? '#222' : '#2ecc71' }]}>
        <Text style={[styles.textoStatusTop, { color: statusJornada === STATUS.OFFLINE ? '#FFF' : '#000' }]}>
          {statusJornada === STATUS.OFFLINE ? 'VOCÊ ESTÁ OFFLINE' : `${statusJornada} (${formatarTempo(segundos)})`}
        </Text>
      </View>

      <View style={styles.main}>
        <View style={styles.containerMapa}>
          {location ? (
            <MapView provider={PROVIDER_GOOGLE} style={styles.mapa} initialRegion={location} customMapStyle={mapStyleNoite}>
              <Marker coordinate={location}>
                <View style={styles.containerCaminhao}><MaterialCommunityIcons name="truck-fast" size={35} color="#FFD700" /></View>
              </Marker>
            </MapView>
          ) : <View style={styles.mapaSimulado}><Text style={{color: '#FFF'}}>Carregando mapa...</Text></View>}
        </View>

        <View style={styles.overlayCards}>
          <View style={styles.cardResumo}><Text style={styles.labelResumo}>Faturamento</Text><Text style={styles.valorResumo}>R$ {ganhos}</Text></View>
          <View style={styles.cardResumo}><Text style={styles.labelResumo}>Status</Text><Text style={styles.valorStatusTexto}>{statusViagemDesc}</Text></View>
        </View>

        <View style={styles.areaBotaoCentral}>
            {statusJornada === STATUS.OFFLINE ? (
              <TouchableOpacity style={[styles.botaoJornada, { backgroundColor: '#FFD700' }]} onPress={() => mudarStatusComFoto(STATUS.EM_JORNADA)}>
                <Text style={styles.textoJornada}>INICIAR{"\n"}JORNADA</Text>
              </TouchableOpacity>
            ) : (
              <View style={{alignItems: 'center'}}>
                <View style={styles.rowBotoes}>
                  <TouchableOpacity style={styles.btnApoio} onPress={() => mudarStatusComFoto(STATUS.ALMOCO)}><Text style={styles.btnApoioText}>ALMOÇO</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnApoio} onPress={() => mudarStatusComFoto(STATUS.PARADA)}><Text style={styles.btnApoioText}>PARADA</Text></TouchableOpacity>
                </View>
                {statusJornada !== STATUS.EM_JORNADA && (
                    <TouchableOpacity style={[styles.botaoJornada, { backgroundColor: '#3498db', marginBottom: 15 }]} onPress={() => mudarStatusComFoto(STATUS.EM_JORNADA)}>
                        <Text style={styles.textoJornada}>RETORNAR</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.botaoJornada, { backgroundColor: '#e74c3c' }]} onPress={() => mudarStatusComFoto(STATUS.OFFLINE)}>
                  <Text style={styles.textoJornada}>FIM DE{"\n"}JORNADA</Text>
                </TouchableOpacity>
              </View>
            )}
        </View>
      </View>

      <Modal visible={showCamera} animationType="slide">
        <CameraView style={{flex: 1}} facing="front" ref={cameraRef}>
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.btnCapturar} onPress={confirmarMudancaStatus} />
            <TouchableOpacity onPress={() => setShowCamera(false)}><Text style={{color:'#FFF', marginBottom: 20}}>Cancelar</Text></TouchableOpacity>
          </View>
        </CameraView>
      </Modal>
      <MenuNavegacao setTelaAtiva={setTelaAtiva} />
    </View>
  );
}

// --- TELAS DE HISTÓRICO, ABASTECIMENTO E CONTA (MANTIDAS) ---

function TelaGerenciadorHistorico({ aoVoltar, userEmail }) {
  const [subTela, setSubTela] = useState('menu');
  if (subTela === 'viagens') return <TelaHistoricoViagens aoVoltar={() => setSubTela('menu')} userEmail={userEmail} />;
  if (subTela === 'ponto') return <TelaHistoricoPonto aoVoltar={() => setSubTela('menu')} userEmail={userEmail} />;
  return (
    <View style={styles.containerTelas}>
      <Text style={styles.tituloTela}>Históricos</Text>
      <TouchableOpacity style={styles.itemMenu} onPress={() => setSubTela('viagens')}>
        <Text style={styles.itemMenuTexto}>🛣️ Histórico de Viagens</Text>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.itemMenu} onPress={() => setSubTela('ponto')}>
        <Text style={styles.itemMenuTexto}>⏰ Histórico de Ponto (PDF)</Text>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnVoltar} onPress={aoVoltar}><Text style={[styles.btnTexto, {color: '#FFD700'}]}>VOLTAR</Text></TouchableOpacity>
    </View>
  );
}

function TelaHistoricoViagens({ aoVoltar, userEmail }) {
    const [viagens, setViagens] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const q = query(collection(db, "historico_viagens"), where("motorista", "==", userEmail), orderBy("data_fim", "desc"));
        getDocs(q).then(snapshot => {
            const lista = [];
            snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
            setViagens(lista);
            setLoading(false);
        });
    }, []);
    return (
        <View style={styles.containerTelas}>
            <Text style={styles.tituloTela}>Minhas Viagens</Text>
            {loading ? <ActivityIndicator color="#FFD700" /> : (
                <FlatList 
                    data={viagens}
                    keyExtractor={item => item.id}
                    renderItem={({item}) => (
                        <View style={styles.cardHistoricoItem}>
                            <Text style={{color: '#FFD700', fontWeight: 'bold'}}>{item.rota}</Text>
                            <Text style={{color: '#888', fontSize: 12}}>{item.data_fim}</Text>
                            <Text style={{color: '#FFF', marginTop: 5}}>Valor: R$ {item.valor}</Text>
                        </View>
                    )}
                />
            )}
            <TouchableOpacity style={styles.btnVoltar} onPress={aoVoltar}><Text style={{color: '#FFD700'}}>VOLTAR</Text></TouchableOpacity>
        </View>
    );
}

function TelaHistoricoPonto({ aoVoltar, userEmail }) {
  const [registros, setRegistros] = useState([]);
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  useEffect(() => {
    const q = query(collection(db, "historico_ponto"), where("usuario", "==", userEmail), orderBy("timestamp", "desc"));
    getDocs(q).then(snapshot => {
      const lista = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
      setRegistros(lista);
    });
  }, []);
  const gerarPDF = async (data) => {
    const pontosDoDia = registros.filter(r => r.data === data).reverse();
    let htmlContent = `<html><body style="font-family:sans-serif;padding:20px;">
      <h1 style="color:#FF8C00;">Relatório de Ponto - DESCARGO</h1>
      <p><strong>Motorista:</strong> ${userEmail}</p><p><strong>Data:</strong> ${data}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <tr style="background:#f2f2f2;"><th>Hora</th><th>Ação</th><th>Duração Anterior</th></tr>
        ${pontosDoDia.map(p => `<tr><td style="border:1px solid #ddd;padding:8px;">${p.hora}</td><td style="border:1px solid #ddd;padding:8px;">${p.status}</td><td style="border:1px solid #ddd;padding:8px;">${p.duracaoAnterior || '-'}</td></tr>`).join('')}
      </table></body></html>`;
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri);
  };
  const datasUnicas = [...new Set(registros.map(item => item.data))];
  return (
    <View style={styles.containerTelas}>
      <Text style={styles.tituloTela}>Folha de Ponto</Text>
      {diaSelecionado ? (
        <View style={{flex: 1}}>
          <TouchableOpacity onPress={() => setDiaSelecionado(null)}><Text style={{color: '#FFD700', marginBottom: 10}}>← Voltar</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btnPDF, {alignSelf: 'flex-end', marginBottom: 10}]} onPress={() => gerarPDF(diaSelecionado)}>
             <Text style={{fontWeight: 'bold'}}>GERAR PDF</Text>
          </TouchableOpacity>
          <FlatList 
            data={registros.filter(r => r.data === diaSelecionado).reverse()}
            renderItem={({item}) => (
              <View style={styles.cardHistoricoItem}>
                <Text style={{color: '#FFD700'}}>{item.hora} - {item.status}</Text>
                <Text style={{color: '#888', fontSize: 11}}>Duração: {item.duracaoAnterior}</Text>
              </View>
            )}
          />
        </View>
      ) : (
        <ScrollView>
          {datasUnicas.map(data => (
            <TouchableOpacity key={data} style={styles.itemMenu} onPress={() => setDiaSelecionado(data)}>
              <Text style={styles.itemMenuTexto}>📅 {data}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <TouchableOpacity style={styles.btnVoltar} onPress={aoVoltar}><Text style={{color: '#FFD700'}}>VOLTAR</Text></TouchableOpacity>
    </View>
  );
}

function TelaAbastecimento({ aoVoltar }) {
  const [km, setKm] = useState('');
  const [litros, setLitros] = useState('');
  const [fotoHodometro, setFotoHodometro] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef(null);
  return (
    <View style={styles.containerTelas}>
      <Text style={styles.tituloTela}>Abastecimento</Text>
      <TextInput style={styles.inputFundo} placeholder="KM ATUAL" placeholderTextColor="#666" keyboardType="numeric" value={km} onChangeText={setKm} />
      <TextInput style={styles.inputFundo} placeholder="LITROS" placeholderTextColor="#666" keyboardType="numeric" value={litros} onChangeText={setLitros} />
      <TouchableOpacity style={styles.btnFoto} onPress={() => setShowCamera(true)}>
          {fotoHodometro ? <Image source={{ uri: fotoHodometro }} style={styles.previewFoto} /> : <MaterialCommunityIcons name="camera" size={40} color="#FFD700" />}
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btnSalvarAbastecimento, {marginTop: 20}]} onPress={() => Alert.alert("Sucesso", "Registrado!")}><Text style={styles.btnTexto}>SALVAR</Text></TouchableOpacity>
      <TouchableOpacity style={styles.btnVoltar} onPress={aoVoltar}><Text style={{color: '#FFF'}}>CANCELAR</Text></TouchableOpacity>
      <Modal visible={showCamera} animationType="slide">
        <CameraView style={{flex: 1}} facing="back" ref={cameraRef}>
          <View style={styles.cameraOverlay}>
             <TouchableOpacity style={styles.btnCapturar} onPress={async () => {
                 const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
                 setFotoHodometro(photo.uri);
                 setShowCamera(false);
             }} />
          </View>
        </CameraView>
      </Modal>
    </View>
  );
}

function TelaConta({ aoVoltar, logoff, userEmail }) {
  return (
    <View style={styles.containerTelas}>
      <Text style={styles.tituloTela}>Minha Conta</Text>
      <Text style={{color: '#888', marginBottom: 20}}>Logado como: {userEmail}</Text>
      <TouchableOpacity style={styles.itemMenu} onPress={logoff}><Text style={{color: '#e74c3c'}}>Sair do Aplicativo</Text></TouchableOpacity>
      <TouchableOpacity style={styles.btnVoltar} onPress={aoVoltar}><Text style={{color: '#FFD700'}}>VOLTAR</Text></TouchableOpacity>
    </View>
  );
}

function MenuNavegacao({ setTelaAtiva }) {
  return (
    <View style={styles.menuInferior}>
      <TouchableOpacity style={styles.menuItem} onPress={() => setTelaAtiva('inicio')}><MaterialCommunityIcons name="home-outline" size={24} color="#FFF" /><Text style={styles.menuText}>Início</Text></TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={() => setTelaAtiva('historico')}><MaterialCommunityIcons name="history" size={24} color="#FFF" /><Text style={styles.menuText}>Históricos</Text></TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={() => setTelaAtiva('abastecimento')}><MaterialCommunityIcons name="truck-fast-outline" size={24} color="#FFF" /><Text style={styles.menuText}>Operação</Text></TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={() => setTelaAtiva('conta')}><MaterialCommunityIcons name="account-outline" size={24} color="#FFF" /><Text style={styles.menuText}>Conta</Text></TouchableOpacity>
    </View>
  );
}

// --- ESTILOS ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  contentLogin: { flexGrow: 1, padding: 35, justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 45, fontWeight: '900', color: '#FFD700' },
  linhaDestaque: { height: 4, backgroundColor: '#FF8C00', width: 80, marginBottom: 40 },
  footerDev: { marginTop: 50, alignItems: 'center' },
  textoDev: { color: '#888', fontSize: 12, marginBottom: 15 },
  rowIcones: { flexDirection: 'row', gap: 20 },
  barraTop: { height: 60, justifyContent: 'center', alignItems: 'center', paddingTop: 10 },
  textoStatusTop: { fontSize: 12, fontWeight: 'bold' },
  main: { flex: 1 },
  containerMapa: { ...StyleSheet.absoluteFillObject },
  mapa: { width: width, height: height },
  mapaSimulado: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  overlayCards: { flexDirection: 'row', justifyContent: 'space-around', position: 'absolute', top: 20, width: '100%' },
  cardResumo: { backgroundColor: 'rgba(26,26,26,0.95)', padding: 15, borderRadius: 12, width: '45%', alignItems: 'center' },
  labelResumo: { color: '#888', fontSize: 10, marginBottom: 5 },
  valorResumo: { color: '#FFD700', fontSize: 20, fontWeight: 'bold' },
  valorStatusTexto: { color: '#FFF', fontSize: 12, textAlign: 'center' },
  areaBotaoCentral: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
  botaoJornada: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  textoJornada: { fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  rowBotoes: { flexDirection: 'row', marginBottom: 15, gap: 10 },
  btnApoio: { backgroundColor: '#333', padding: 10, borderRadius: 8, width: 90, alignItems: 'center' },
  btnApoioText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  menuInferior: { height: 80, backgroundColor: '#111', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  menuText: { color: '#FFF', fontSize: 11 },
  menuItem: { alignItems: 'center' },
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  btnCapturar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF', marginBottom: 40 },
  containerTelas: { flex: 1, backgroundColor: '#000', padding: 20, paddingTop: 50 },
  tituloTela: { color: '#FFD700', fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  inputFundo: { backgroundColor: '#1A1A1A', color: '#FFF', padding: 15, borderRadius: 10, marginBottom: 15, width: '100%' },
  btnSalvarAbastecimento: { backgroundColor: '#FFD700', padding: 18, borderRadius: 10, alignItems: 'center' },
  btnVoltar: { padding: 18, alignItems: 'center', marginTop: 10 },
  btnTexto: { color: '#000', fontWeight: 'bold' },
  itemMenu: { padding: 20, borderBottomWidth: 1, borderColor: '#222', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemMenuTexto: { color: '#FFF', fontSize: 16 },
  cardHistoricoItem: { backgroundColor: '#111', padding: 15, borderRadius: 10, marginBottom: 10 },
  containerCaminhao: { backgroundColor: '#000', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: '#FFD700' },
  btnFoto: { width: '100%', height: 150, backgroundColor: '#1A1A1A', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#FFD700' },
  previewFoto: { width: '100%', height: '100%', borderRadius: 10 },
  btnPDF: { backgroundColor: '#FFD700', padding: 8, borderRadius: 5 }
});