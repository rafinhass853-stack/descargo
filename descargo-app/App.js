import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, 
  StatusBar, Dimensions, Platform, Alert, Modal, TextInput, ScrollView,
  ActivityIndicator, Linking, Image 
} from 'react-native';
import * as Location from 'expo-location';
import { Camera, CameraView } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth,
  initializeAuth, 
  getReactNativePersistence, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  onSnapshot 
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

// --- INICIALIZAÇÃO FIREBASE ---
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

export default function App() {
  const [usuario, setUsuario] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [telaAtiva, setTelaAtiva] = useState('inicio');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
          
          <TextInput 
            style={styles.inputFundo} 
            placeholder="E-mail" 
            placeholderTextColor="#666" 
            value={email} 
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput 
            style={styles.inputFundo} 
            placeholder="Senha" 
            placeholderTextColor="#666" 
            secureTextEntry 
            value={senha} 
            onChangeText={setSenha}
          />
          
          <TouchableOpacity style={[styles.btnSalvarAbastecimento, {width: '100%'}]} onPress={realizarLoginEmail}>
             <Text style={styles.btnTexto}>ENTRAR NO APP</Text>
          </TouchableOpacity>

          <View style={styles.footerDev}>
            <Text style={styles.textoDev}>Desenvolvido por Rafael Araujo</Text>
            <View style={styles.rowIcones}>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/rafael.araujo1992/')}>
                <MaterialCommunityIcons name="instagram" size={30} color="#E1306C" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/5516988318626')}>
                <MaterialCommunityIcons name="whatsapp" size={30} color="#25D366" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/in/rafael-araujo1992/')}>
                <MaterialCommunityIcons name="linkedin" size={30} color="#0077B5" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('mailto:rafinhass853@gmail.com')}>
                <MaterialCommunityIcons name="email-outline" size={30} color="#FFD700" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      {telaAtiva === 'inicio' ? (
        <Dashboard setTelaAtiva={setTelaAtiva} usuarioEmail={usuario.email} />
      ) : telaAtiva === 'abastecimento' ? (
        <TelaAbastecimento aoVoltar={() => setTelaAtiva('inicio')} />
      ) : telaAtiva === 'conta' ? (
        <TelaConta aoVoltar={() => setTelaAtiva('inicio')} logoff={handleLogout} userEmail={usuario.email} />
      ) : telaAtiva === 'historico' ? (
        <TelaHistorico aoVoltar={() => setTelaAtiva('inicio')} />
      ) : null}
    </SafeAreaView>
  );
}

// --- TELA DASHBOARD ---
function Dashboard({ setTelaAtiva, usuarioEmail }) {
  const [statusJornada, setStatusJornada] = useState(STATUS.OFFLINE);
  const [location, setLocation] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
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

  const tirarFotoERegistrar = async () => {
    if (cameraRef.current) {
      await cameraRef.current.takePictureAsync({ quality: 0.5 });
      setShowCamera(false);
      setStatusJornada(statusJornada === STATUS.OFFLINE ? STATUS.EM_JORNADA : STATUS.OFFLINE);
      Alert.alert("Sucesso", "Ponto registrado!");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.barraTop, { backgroundColor: statusJornada === STATUS.OFFLINE ? '#222' : '#2ecc71' }]}>
        <Text style={[styles.textoStatusTop, { color: statusJornada === STATUS.OFFLINE ? '#FFF' : '#000' }]}>
          {statusJornada === STATUS.OFFLINE ? 'VOCÊ ESTÁ OFFLINE' : `EM JORNADA (${statusJornada})`}
        </Text>
      </View>

      <View style={styles.main}>
        <View style={styles.containerMapa}>
          {location ? (
            <MapView 
              provider={PROVIDER_GOOGLE} 
              style={styles.mapa} 
              initialRegion={location} 
              customMapStyle={mapStyleNoite}
            >
              <Marker coordinate={location}>
                <View style={styles.containerCaminhao}>
                   <MaterialCommunityIcons name="truck-fast" size={35} color="#FFD700" />
                </View>
              </Marker>
            </MapView>
          ) : <View style={styles.mapaSimulado}><Text style={{color: '#FFF'}}>Carregando mapa...</Text></View>}
        </View>

        <View style={styles.overlayCards}>
          <View style={styles.cardResumo}>
            <Text style={styles.labelResumo}>Faturamento Viagem</Text>
            <Text style={styles.valorResumo}>R$ {ganhos}</Text>
          </View>
          <View style={styles.cardResumo}>
            <Text style={styles.labelResumo}>Status Atual</Text>
            <Text style={styles.valorStatusTexto}>{statusViagemDesc}</Text>
          </View>
        </View>

        <View style={styles.areaBotaoCentral}>
            {statusJornada !== STATUS.OFFLINE && (
               <View style={styles.rowBotoes}>
                  <TouchableOpacity style={styles.btnApoio} onPress={() => setStatusJornada(STATUS.ALMOCO)}><Text style={styles.btnApoioText}>ALMOÇO</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnApoio} onPress={() => setStatusJornada(STATUS.PARADA)}><Text style={styles.btnApoioText}>PARADA</Text></TouchableOpacity>
               </View>
            )}
            <TouchableOpacity 
              style={[styles.botaoJornada, { backgroundColor: statusJornada === STATUS.OFFLINE ? '#FFD700' : '#e74c3c' }]} 
              onPress={() => setShowCamera(true)}>
              <Text style={styles.textoJornada}>{statusJornada === STATUS.OFFLINE ? 'INICIAR\nJORNADA' : 'FIM DE\nJORNADA'}</Text>
            </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showCamera} animationType="slide">
        <CameraView style={{flex: 1}} facing="front" ref={cameraRef}>
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.btnCapturar} onPress={tirarFotoERegistrar} />
            <TouchableOpacity onPress={() => setShowCamera(false)}><Text style={{color:'#FFF', marginBottom: 20}}>Cancelar</Text></TouchableOpacity>
          </View>
        </CameraView>
      </Modal>

      <MenuNavegacao setTelaAtiva={setTelaAtiva} />
    </View>
  );
}

// --- TELA ABASTECIMENTO (COM NOVOS CAMPOS E FOTO) ---
function TelaAbastecimento({ aoVoltar }) {
  const [km, setKm] = useState('');
  const [litros, setLitros] = useState('');
  const [valorLitro, setValorLitro] = useState('');
  const [fotoHodometro, setFotoHodometro] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef(null);

  const tirarFotoHodometro = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setFotoHodometro(photo.uri);
      setShowCamera(false);
    }
  };

  return (
    <View style={styles.containerTelas}>
      <Text style={styles.tituloTela}>Abastecimento</Text>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <TextInput style={styles.inputFundo} placeholder="KM ATUAL" placeholderTextColor="#666" keyboardType="numeric" value={km} onChangeText={setKm} />
        <TextInput style={styles.inputFundo} placeholder="LITROS DIESEL" placeholderTextColor="#666" keyboardType="numeric" value={litros} onChangeText={setLitros} />
        <TextInput style={styles.inputFundo} placeholder="VALOR POR LITRO R$" placeholderTextColor="#666" keyboardType="numeric" value={valorLitro} onChangeText={setValorLitro} />

        <Text style={styles.labelInput}>Foto do Hodômetro (Nítida)</Text>
        <TouchableOpacity style={styles.btnFoto} onPress={() => setShowCamera(true)}>
          {fotoHodometro ? (
            <Image source={{ uri: fotoHodometro }} style={styles.previewFoto} />
          ) : (
            <View style={{alignItems: 'center'}}>
              <MaterialCommunityIcons name="camera" size={40} color="#FFD700" />
              <Text style={{color: '#888', fontSize: 12}}>Toque para fotografar painel</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btnSalvarAbastecimento, {marginTop: 20}]} onPress={() => Alert.alert("Sucesso", "Registrado!")}>
          <Text style={styles.btnTexto}>SALVAR REGISTRO</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnVoltar} onPress={aoVoltar}>
          <Text style={[styles.btnTexto, {color: '#FFF'}]}>CANCELAR</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCamera} animationType="slide">
        <CameraView style={{flex: 1}} facing="back" ref={cameraRef}>
          <View style={styles.cameraOverlay}>
            <View style={styles.guiaCamera}><Text style={{color: '#FFD700'}}>Enquadre o Hodômetro</Text></View>
            <TouchableOpacity style={styles.btnCapturar} onPress={tirarFotoHodometro} />
            <TouchableOpacity onPress={() => setShowCamera(false)}><Text style={{color:'#FFF', marginBottom: 20}}>Cancelar</Text></TouchableOpacity>
          </View>
        </CameraView>
      </Modal>
    </View>
  );
}

// --- TELA CONTA (RESTAURADA) ---
function TelaConta({ aoVoltar, logoff, userEmail }) {
  return (
    <View style={styles.containerTelas}>
      <Text style={styles.tituloTela}>Minha Conta</Text>
      <Text style={{color: '#888', marginBottom: 20}}>Logado como: {userEmail}</Text>
      <ScrollView>
        <TouchableOpacity style={styles.itemMenu} onPress={() => Alert.alert("Em breve", "Meus Dados")}>
          <Text style={styles.itemMenuTexto}>👤 Meus Dados / Cadastro</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.itemMenu} onPress={() => Alert.alert("Em breve", "Escala")}>
          <Text style={styles.itemMenuTexto}>📅 Minha Escala</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.itemMenu, {borderColor: '#e74c3c', marginTop: 30}]} onPress={logoff}>
          <Text style={[styles.itemMenuTexto, {color: '#e74c3c'}]}>🚪 Sair do Aplicativo</Text>
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity style={styles.btnVoltar} onPress={aoVoltar}><Text style={[styles.btnTexto, {color: '#FFD700'}]}>VOLTAR AO INÍCIO</Text></TouchableOpacity>
    </View>
  );
}

// --- TELA HISTORICO (RESTAURADA) ---
function TelaHistorico({ aoVoltar }) {
  return (
    <View style={styles.containerTelas}>
      <Text style={styles.tituloTela}>Históricos</Text>
      <TouchableOpacity style={styles.itemMenu} onPress={() => Alert.alert("Aviso", "Abrindo Histórico de Viagens...")}>
        <Text style={styles.itemMenuTexto}>🛣️ Histórico de Viagens</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.itemMenu} onPress={() => Alert.alert("Aviso", "Abrindo Histórico de Ponto...")}>
        <Text style={styles.itemMenuTexto}>⏰ Histórico de Ponto</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnVoltar} onPress={aoVoltar}><Text style={[styles.btnTexto, {color: '#FFD700'}]}>VOLTAR</Text></TouchableOpacity>
    </View>
  );
}

function MenuNavegacao({ setTelaAtiva }) {
  return (
    <View style={styles.menuInferior}>
      <TouchableOpacity style={styles.menuItem} onPress={() => setTelaAtiva('inicio')}>
        <Text style={{fontSize: 22}}>🏠</Text><Text style={styles.menuText}>Início</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={() => setTelaAtiva('historico')}>
        <Text style={{fontSize: 22}}>📊</Text><Text style={styles.menuText}>Histórico</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={() => setTelaAtiva('abastecimento')}>
        <Text style={{fontSize: 22}}>🚛</Text><Text style={styles.menuText}>Operação</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={() => setTelaAtiva('conta')}>
        <Text style={{fontSize: 22}}>👤</Text><Text style={styles.menuText}>Conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  contentLogin: { flexGrow: 1, padding: 35, justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 45, fontWeight: '900', color: '#FFD700' },
  linhaDestaque: { height: 4, backgroundColor: '#FF8C00', width: 80, marginBottom: 40 },
  footerDev: { marginTop: 50, alignItems: 'center' },
  textoDev: { color: '#888', fontSize: 12, marginBottom: 15 },
  rowIcones: { flexDirection: 'row', gap: 20 },
  barraTop: { height: 50, justifyContent: 'center', alignItems: 'center' },
  textoStatusTop: { fontSize: 12, fontWeight: 'bold' },
  main: { flex: 1 },
  containerMapa: { ...StyleSheet.absoluteFillObject },
  mapa: { width: width, height: height },
  mapaSimulado: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  overlayCards: { flexDirection: 'row', justifyContent: 'space-around', position: 'absolute', top: 20, width: '100%' },
  cardResumo: { backgroundColor: 'rgba(26,26,26,0.95)', padding: 15, borderRadius: 12, width: '45%', alignItems: 'center', minHeight: 80, justifyContent: 'center' },
  labelResumo: { color: '#888', fontSize: 10, marginBottom: 5 },
  valorResumo: { color: '#FFD700', fontSize: 20, fontWeight: 'bold' },
  valorStatusTexto: { color: '#FFF', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  areaBotaoCentral: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
  botaoJornada: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  textoJornada: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  rowBotoes: { flexDirection: 'row', marginBottom: 15, gap: 10 },
  btnApoio: { backgroundColor: '#333', padding: 10, borderRadius: 8, width: 100, alignItems: 'center' },
  btnApoioText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  menuInferior: { height: 80, backgroundColor: '#111', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  menuText: { color: '#FFF', fontSize: 11 },
  menuItem: { alignItems: 'center' },
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  btnCapturar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF', marginBottom: 20 },
  containerTelas: { flex: 1, backgroundColor: '#000', padding: 20, paddingTop: 50 },
  tituloTela: { color: '#FFD700', fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  inputFundo: { backgroundColor: '#1A1A1A', color: '#FFF', padding: 15, borderRadius: 10, marginBottom: 15, width: '100%' },
  btnSalvarAbastecimento: { backgroundColor: '#FFD700', padding: 18, borderRadius: 10, alignItems: 'center' },
  btnVoltar: { padding: 18, alignItems: 'center', marginTop: 10 },
  btnTexto: { color: '#000', fontWeight: 'bold' },
  itemMenu: { padding: 20, borderBottomWidth: 1, borderColor: '#222', marginBottom: 10 },
  itemMenuTexto: { color: '#FFF', fontSize: 16 },
  containerCaminhao: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 20, borderWidth: 1, borderColor: '#FFD700' },
  btnFoto: { backgroundColor: '#1A1A1A', height: 150, borderRadius: 10, borderStyle: 'dashed', borderWidth: 2, borderColor: '#333', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  previewFoto: { width: '100%', height: '100%' },
  labelInput: { color: '#FFD700', marginBottom: 10, fontSize: 12, fontWeight: 'bold' },
  guiaCamera: { position: 'absolute', top: '40%', borderWidth: 2, borderColor: '#FFD700', width: '80%', height: 100, alignSelf: 'center', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }
});

const mapStyleNoite = [{"elementType": "geometry", "stylers": [{"color": "#212121"}]}];