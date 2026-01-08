import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, 
  TouchableOpacity, TextInput, Modal, Alert, Platform, Vibration, KeyboardAvoidingView
} from 'react-native';
import { 
  collection, onSnapshot, query, orderBy, where, addDoc, 
  serverTimestamp, updateDoc, doc 
} from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export default function Jornada({ auth, db }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [solicitacaoAtiva, setSolicitacaoAtiva] = useState(false);
  const [jornadaAtiva, setJornadaAtiva] = useState(false);
  const [dadosInicio, setDadosInicio] = useState(null);
  const [tempoAtivo, setTempoAtivo] = useState(0);
  const [hodometro, setHodometro] = useState('');

  const user = auth.currentUser;
  const lastSolicitacaoStatus = useRef(false);

  // 1. CONFIGURAÇÃO DE NOTIFICAÇÕES
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('alertas-gestor', {
          name: 'Alertas de Hodômetro',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFD700',
        });
      }
    })();
  }, []);

  // 2. MONITORAMENTO EM TEMPO REAL (STATUS DE BLOQUEIO E HISTÓRICO)
  useEffect(() => {
    if (!user) return;

    // Monitora se o gestor está pedindo hodômetro
    const unsubStatus = onSnapshot(doc(db, "configuracoes", "controle_app"), (docSnap) => {
      if (docSnap.exists()) {
        const isPedindo = docSnap.data().pedirHodometro;
        setSolicitacaoAtiva(isPedindo);

        if (isPedindo === true && lastSolicitacaoStatus.current === false) {
          enviarNotificacaoLocal();
          Vibration.vibrate([500, 200, 500, 200, 500]); 
        }
        lastSolicitacaoStatus.current = isPedindo;
      }
    });

    // Monitora o histórico de jornadas
    const q = query(
      collection(db, "historico_jornadas"), 
      where("motoristaId", "==", user.uid), 
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistorico(docs);
      
      // Verifica se a última ação foi um INÍCIO para manter o cronômetro
      const ultimoRegistro = docs.find(d => d.tipo === 'INICIO' || d.tipo === 'FIM');
      if (ultimoRegistro && ultimoRegistro.tipo === 'INICIO') {
        setJornadaAtiva(true);
        setDadosInicio(ultimoRegistro);
        const inicio = ultimoRegistro.timestamp?.toDate();
        if (inicio) setTempoAtivo(Math.floor((new Date() - inicio) / 1000));
      } else {
        setJornadaAtiva(false);
      }
      setLoading(false);
    });

    return () => { unsubStatus(); unsubscribe(); };
  }, [user]);

  const enviarNotificacaoLocal = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚠️ AÇÃO NECESSÁRIA",
        body: "O gestor solicitou o seu KM atual agora!",
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  };

  useEffect(() => {
    let intervalo;
    if (jornadaAtiva) intervalo = setInterval(() => setTempoAtivo(prev => prev + 1), 1000);
    return () => clearInterval(intervalo);
  }, [jornadaAtiva]);

  const formatarTempo = (seg) => {
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // FUNÇÃO DE ENVIO COM LIBERAÇÃO AUTOMÁTICA
  const enviarHodometro = async () => {
    const valorKm = parseFloat(hodometro.replace(',', '.'));
    if (!hodometro.trim() || isNaN(valorKm)) {
      Alert.alert('Atenção', 'Informe um valor de KM válido.');
      return;
    }

    setRegistrando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let cidade = "Desconhecida";
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const geo = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
        if (geo.length > 0) cidade = geo[0].city || geo[0].subregion || "Cidade";
      }

      // Se o app estiver bloqueado, tratamos como um LOG de verificação
      // Caso contrário, segue o fluxo normal de INICIO/FIM
      const tipoRegistro = solicitacaoAtiva ? 'LOG_SOLICITADO' : (jornadaAtiva ? 'FIM' : 'INICIO');
      
      // 1. Salva o registro no histórico
      await addDoc(collection(db, 'historico_jornadas'), {
        motoristaId: user.uid,
        motoristaNome: user.displayName || user.email,
        tipo: tipoRegistro,
        timestamp: serverTimestamp(),
        km: valorKm,
        duracaoFinal: tipoRegistro === 'FIM' ? formatarTempo(tempoAtivo) : null,
        cidade: cidade
      });

      // 2. ATUALIZA O BANCO PARA LIBERAR O APP (MUDA PARA FALSE)
      if (solicitacaoAtiva) {
        await updateDoc(doc(db, "configuracoes", "controle_app"), {
          pedirHodometro: false
        });
      }

      setHodometro('');
      Alert.alert("Sucesso", "Informações enviadas. Aplicativo liberado!");
    } catch (e) {
      console.log(e);
      Alert.alert("Erro", "Falha ao processar o registro.");
    } finally {
      setRegistrando(false);
    }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator color="#FFD700" size="large" /></View>;

  return (
    <View style={styles.container}>
      {/* MODAL DE BLOQUEIO TOTAL */}
      <Modal visible={solicitacaoAtiva} transparent={false} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalLock}>
          <View style={styles.modalLockContent}>
            <MaterialIcons name="speed" size={80} color="#FFD700" />
            <Text style={styles.lockTitle}>HODÔMETRO SOLICITADO</Text>
            <Text style={styles.lockSub}>Informe o KM atual para continuar utilizando o aplicativo.</Text>
            
            <TextInput 
              style={styles.inputLock} 
              placeholder="000000" 
              placeholderTextColor="#333" 
              keyboardType="numeric" 
              value={hodometro} 
              onChangeText={setHodometro}
              autoFocus
            />

            <TouchableOpacity 
              style={[styles.btnConfirmarLock, { opacity: registrando ? 0.6 : 1 }]} 
              onPress={enviarHodometro}
              disabled={registrando}
            >
              {registrando ? <ActivityIndicator color="#000" /> : <Text style={styles.btnConfirmarText}>ENVIAR E LIBERAR</Text>}
            </TouchableOpacity>

            <Text style={styles.warningFooter}>⚠️ O sistema será liberado após o envio.</Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CONTEÚDO PRINCIPAL (HISTÓRICO) */}
      <View style={{ flex: 1, opacity: solicitacaoAtiva ? 0.1 : 1 }}>
        {jornadaAtiva ? (
          <View style={styles.bannerAtivo}>
            <Text style={styles.bannerTitle}>JORNADA EM CURSO</Text>
            <Text style={styles.bannerTimer}>{formatarTempo(tempoAtivo)}</Text>
            <Text style={styles.bannerLoc}>📍 {dadosInicio?.cidade} • Início: {dadosInicio?.km} KM</Text>
            
            <TouchableOpacity 
              style={styles.btnEncerrar} 
              onPress={() => Alert.alert("Encerrar", "Deseja finalizar sua jornada?", [
                { text: "Não" },
                { text: "Sim, Finalizar", onPress: () => { /* Abre teclado para KM de fim */ } }
              ])}
            >
              <Text style={styles.btnEncerrarText}>ENCERRAR JORNADA</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.btnIniciarManual} onPress={() => { /* Lógica para iniciar manual se necessário */ }}>
             <MaterialIcons name="play-circle-filled" size={24} color="#000" />
             <Text style={styles.btnIniciarManualText}>INICIAR NOVA JORNADA</Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={historico}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.indicator, { backgroundColor: item.tipo === 'INICIO' ? '#2ecc71' : (item.tipo === 'FIM' ? '#e74c3c' : '#FFD700') }]} />
              <View style={{ flex: 1, padding: 12 }}>
                <View style={styles.cardHeader}>
                  <Text style={styles.tipoText}>{item.tipo}</Text>
                  <Text style={styles.kmText}>{item.km} KM</Text>
                </View>
                <Text style={styles.dataText}>
                  {item.timestamp?.toDate().toLocaleString('pt-BR')} • {item.cidade}
                </Text>
                {item.duracaoFinal && <Text style={styles.duracaoText}>Duração: {item.duracaoFinal}</Text>}
              </View>
            </View>
          )}
          ListHeaderComponent={() => <Text style={styles.headerTitle}>HISTÓRICO DE ATIVIDADES</Text>}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 15 },
  
  // Modal de Trava
  modalLock: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 30 },
  modalLockContent: { width: '100%', alignItems: 'center' },
  lockTitle: { color: '#FFD700', fontSize: 24, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  lockSub: { color: '#888', textAlign: 'center', marginTop: 10, fontSize: 16, marginBottom: 30 },
  inputLock: { backgroundColor: '#111', color: '#fff', width: '100%', padding: 20, borderRadius: 15, fontSize: 40, textAlign: 'center', borderWidth: 2, borderColor: '#FFD700', marginBottom: 20 },
  btnConfirmarLock: { backgroundColor: '#FFD700', width: '100%', padding: 20, borderRadius: 15, alignItems: 'center' },
  btnConfirmarText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
  warningFooter: { color: '#444', marginTop: 20, fontSize: 12, fontWeight: 'bold' },
  
  // Estilos da Lista e Banner
  headerTitle: { color: '#444', fontSize: 11, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  card: { backgroundColor: '#111', marginBottom: 10, borderRadius: 10, flexDirection: 'row', overflow: 'hidden' },
  indicator: { width: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  tipoText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  kmText: { color: '#FFD700', fontWeight: 'bold' },
  dataText: { color: '#555', fontSize: 11, marginTop: 4 },
  duracaoText: { color: '#888', fontSize: 11, marginTop: 2, fontWeight: 'bold' },
  
  bannerAtivo: { backgroundColor: '#111', padding: 20, borderRadius: 15, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#FFD700' },
  bannerTitle: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  bannerTimer: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 5 },
  bannerLoc: { color: '#888', fontSize: 12, marginBottom: 15 },
  
  btnEncerrar: { backgroundColor: '#e74c3c', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnEncerrarText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  
  btnIniciarManual: { backgroundColor: '#FFD700', padding: 20, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  btnIniciarManualText: { color: '#000', fontWeight: 'bold', marginLeft: 10 }
});