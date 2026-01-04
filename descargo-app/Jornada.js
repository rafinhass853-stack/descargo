import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, 
  TouchableOpacity, TextInput, Modal, Alert 
} from 'react-native';
import { 
  collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp, updateDoc, doc 
} from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export default function Jornada({ auth, db }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  
  // Estados de Controle
  const [jornadaAtiva, setJornadaAtiva] = useState(false);
  const [dadosInicio, setDadosInicio] = useState(null);
  const [tempoAtivo, setTempoAtivo] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [hodometro, setHodometro] = useState('');
  
  // Estados para Edição
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [itemParaEditar, setItemParaEditar] = useState(null);
  const [novoKm, setNovoKm] = useState('');

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "historico_jornadas"), where("motoristaId", "==", user.uid), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistorico(docs);
      if (docs.length > 0 && docs[0].tipo === 'INICIO') {
        setJornadaAtiva(true);
        setDadosInicio(docs[0]);
        const inicio = docs[0].timestamp?.toDate();
        if (inicio) setTempoAtivo(Math.floor((new Date() - inicio) / 1000));
      } else {
        setJornadaAtiva(false);
        setDadosInicio(null);
        setModalVisible(true);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

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

  const manipularJornada = async () => {
    const valorKm = parseFloat(hodometro.replace(',', '.'));
    if (!hodometro.trim() || isNaN(valorKm)) {
      Alert.alert('Erro', 'Informe um valor de hodômetro válido.');
      return;
    }
    setRegistrando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let cidade = "Desconhecida", uf = "--", coords = null;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        const geo = await Location.reverseGeocodeAsync(coords);
        if (geo.length > 0) {
          cidade = geo[0].city || geo[0].subregion || "Cidade";
          uf = geo[0].region || "--";
        }
      }
      const tipo = jornadaAtiva ? 'FIM' : 'INICIO';
      await addDoc(collection(db, 'historico_jornadas'), {
        motoristaId: user.uid,
        motoristaNome: user.displayName || user.email,
        tipo: tipo,
        timestamp: serverTimestamp(),
        km: valorKm,
        duracaoFinal: tipo === 'FIM' ? formatarTempo(tempoAtivo) : null,
        cidade, uf, localizacao: coords
      });
      setModalVisible(false);
      setHodometro('');
    } catch (e) { Alert.alert("Erro", "Falha ao registrar."); }
    finally { setRegistrando(false); }
  };

  // Função para salvar a edição do KM
  const salvarEdicaoKm = async () => {
    const valorKm = parseFloat(novoKm.replace(',', '.'));
    if (isNaN(valorKm)) {
      Alert.alert('Erro', 'Valor de KM inválido.');
      return;
    }
    try {
      const docRef = doc(db, "historico_jornadas", itemParaEditar.id);
      await updateDoc(docRef, { km: valorKm });
      setModalEditVisible(false);
      setItemParaEditar(null);
      Alert.alert("Sucesso", "KM atualizado corretamente.");
    } catch (e) { Alert.alert("Erro", "Não foi possível atualizar."); }
  };

  const abrirEdicao = (item) => {
    setItemParaEditar(item);
    setNovoKm(item.km.toString());
    setModalEditVisible(true);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => abrirEdicao(item)} activeOpacity={0.7}>
      <View style={[styles.indicator, { backgroundColor: item.tipo === 'INICIO' ? '#2ecc71' : '#e74c3c' }]} />
      <View style={{ flex: 1, padding: 12 }}>
        <View style={styles.cardHeader}>
          <Text style={styles.tipoText}>{item.tipo === 'INICIO' ? '🚀 INÍCIO' : '🏁 FIM'}</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.kmText}>{item.km} KM</Text>
            <MaterialIcons name="edit" size={14} color="#FFD700" style={{marginLeft: 8}} />
          </View>
        </View>
        <View style={styles.locContainer}>
          <MaterialIcons name="location-on" size={14} color="#FFD700" />
          <Text style={styles.locText}>{item.cidade} - {item.uf}</Text>
        </View>
        <Text style={styles.dataText}>{item.timestamp?.toDate().toLocaleString('pt-BR')}</Text>
        {item.duracaoFinal && <Text style={styles.duracaoText}>Tempo: {item.duracaoFinal}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {jornadaAtiva && (
        <View style={styles.bannerAtivo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>EM JORNADA</Text>
            <Text style={styles.bannerTimer}>{formatarTempo(tempoAtivo)}</Text>
            <Text style={styles.bannerLoc}>📍 {dadosInicio?.cidade} ({dadosInicio?.km} KM)</Text>
          </View>
          <TouchableOpacity style={styles.btnEncerrar} onPress={() => setModalVisible(true)}>
            <Text style={styles.btnEncerrarText}>ENCERRAR</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={historico}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={() => <Text style={styles.headerTitle}>HISTÓRICO (Clique p/ editar)</Text>}
      />

      {/* Modal Registro (Início/Fim) */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{jornadaAtiva ? 'FINALIZAR DIA' : 'INICIAR DIA'}</Text>
          <TextInput style={styles.input} placeholder="KM atual" placeholderTextColor="#666" keyboardType="numeric" value={hodometro} onChangeText={setHodometro} />
          <TouchableOpacity style={[styles.btnConfirmar, {backgroundColor: jornadaAtiva ? '#e74c3c' : '#FFD700'}]} onPress={manipularJornada}>
            {registrando ? <ActivityIndicator color="#000" /> : <Text style={styles.btnConfirmarText}>CONFIRMAR</Text>}
          </TouchableOpacity>
        </View></View>
      </Modal>

      {/* Modal de EDIÇÃO de KM */}
      <Modal visible={modalEditVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>CORRIGIR KM</Text>
          <Text style={{color: '#888', textAlign: 'center', marginBottom: 10}}>Registro de {itemParaEditar?.tipo}</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={novoKm} onChangeText={setNovoKm} autoFocus />
          <View style={{flexDirection: 'row', gap: 10}}>
            <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#333'}]} onPress={() => setModalEditVisible(false)}>
              <Text style={{color: '#fff'}}>CANCELAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#FFD700'}]} onPress={salvarEdicaoKm}>
              <Text style={{color: '#000', fontWeight: 'bold'}}>SALVAR</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 15 },
  headerTitle: { color: '#888', fontSize: 11, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
  card: { backgroundColor: '#111', marginBottom: 10, borderRadius: 10, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  indicator: { width: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  tipoText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  kmText: { color: '#FFD700', fontWeight: 'bold' },
  locContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  locText: { color: '#bbb', fontSize: 13, marginLeft: 4 },
  dataText: { color: '#666', fontSize: 11, marginTop: 4 },
  duracaoText: { color: '#2ecc71', fontSize: 13, fontWeight: 'bold', marginTop: 8 },
  bannerAtivo: { backgroundColor: '#111', padding: 20, borderRadius: 15, marginBottom: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: '#FFD700' },
  bannerTitle: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  bannerTimer: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  bannerLoc: { color: '#888', fontSize: 12, marginTop: 5 },
  btnEncerrar: { backgroundColor: '#e74c3c', padding: 12, borderRadius: 8 },
  btnEncerrarText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 30 },
  modalContent: { backgroundColor: '#1a1a1a', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 10, fontSize: 24, textAlign: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#444' },
  btnConfirmar: { padding: 16, borderRadius: 10, alignItems: 'center' },
  btnConfirmarText: { fontWeight: 'bold' },
  btnAction: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' }
});