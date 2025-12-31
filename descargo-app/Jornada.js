import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, FlatList, ActivityIndicator 
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 

import { db, auth } from './firebase'; 
import { 
  collection, addDoc, serverTimestamp, 
  onSnapshot, query, orderBy, where, limit 
} from 'firebase/firestore';

export default function Jornada({ onOnline }) {
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(false);
  const [hodometro, setHodometro] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [timer, setTimer] = useState('00:00:00');
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const q = query(
        collection(db, "historico_jornadas"),
        where("motoristaId", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(15)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistorico(data);
        
        if (data.length > 0 && data[0].tipo === 'INICIO') {
          setOnline(true);
          if (data[0].timestamp) setStartTime(data[0].timestamp.toDate());
          if (onOnline) onOnline(true);
        } else {
          setOnline(false);
          if (onOnline) onOnline(false);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    let interval;
    if (online && startTime) {
      interval = setInterval(() => {
        const diff = new Date() - startTime;
        const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setTimer(`${hours}:${minutes}:${seconds}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [online, startTime]);

  const registrarEvento = async (tipo) => {
    if (!hodometro) {
      Alert.alert('Atenção', 'Informe o KM atual.');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      let cidade = "Não identificada";
      let uf = "--";
      let coords = null;

      if (status === 'granted') {
        // Tenta pegar a última posição conhecida (é instantâneo)
        let loc = await Location.getLastKnownPositionAsync();
        
        // Se não tiver, pega a atual com precisão baixa (muito rápido)
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.Low 
          });
        }

        if (loc) {
          coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          const geo = await Location.reverseGeocodeAsync(coords);
          if (geo.length > 0) {
            cidade = geo[0].city || geo[0].subregion || "Cidade Desconhecida";
            uf = geo[0].region || "--";
          }
        }
      }
      
      const payload = {
        motoristaId: user.uid,
        motoristaNome: user.displayName || 'Motorista',
        email: user.email,
        tipo: tipo,
        timestamp: serverTimestamp(),
        km: parseFloat(hodometro),
        duracaoFinal: tipo === 'FIM' ? timer : null,
        localizacao: coords,
        cidade: cidade,
        uf: uf
      };

      await addDoc(collection(db, 'historico_jornadas'), payload);

      if (tipo === 'INICIO') {
        setStartTime(new Date());
        setOnline(true);
      } else {
        setOnline(false);
        setStartTime(null);
        setTimer('00:00:00');
      }
      
      setHodometro('');
      Alert.alert("Confirmado!", `${tipo === 'INICIO' ? 'Iniciado' : 'Encerrado'} em ${cidade}-${uf}`);

    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Falha ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.historyCard}>
      <View style={[styles.statusTag, { backgroundColor: item.tipo === 'INICIO' ? '#2ecc71' : '#e74c3c' }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.historyText}>
          {item.tipo === 'INICIO' ? 'INÍCIO DE TURNO' : 'FIM DE TURNO'}
        </Text>
        <Text style={styles.historySub}>
          {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'Processando...'}
        </Text>
        <Text style={styles.locationText}>
          📍 {item.cidade || '---'} - {item.uf || '--'}
        </Text>
        {item.duracaoFinal && <Text style={styles.durationText}>Duração: {item.duracaoFinal}</Text>}
      </View>
      <View style={{alignItems: 'flex-end'}}>
        <Text style={styles.historyKm}>{item.km} KM</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={historico}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>CONTROLE DE JORNADA</Text>

            <View style={styles.cardMain}>
              {online && (
                <View style={styles.timerContainer}>
                  <Text style={styles.timerValue}>{timer}</Text>
                  <Text style={styles.timerLabel}>TEMPO EM MOVIMENTO</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>{online ? 'KM ATUAL (FECHAMENTO)' : 'KM ATUAL (ABERTURA)'}</Text>
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor="#333"
                keyboardType="numeric"
                value={hodometro}
                onChangeText={setHodometro}
              />
              
              {!online ? (
                <TouchableOpacity style={styles.btnStart} onPress={() => registrarEvento('INICIO')} disabled={loading}>
                  {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>INICIAR TRABALHO</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.btnEnd} onPress={() => registrarEvento('FIM')} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTextWhite}>ENCERRAR TRABALHO</Text>}
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.subtitle}>HISTÓRICO RECENTE</Text>
          </>
        }
        contentContainerStyle={{ padding: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  title: { color: '#FFD700', fontSize: 18, fontWeight: '900', textAlign: 'center', marginVertical: 20, letterSpacing: 1 },
  cardMain: { backgroundColor: '#0D0D0D', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: '#1A1A1A' },
  inputLabel: { color: '#555', fontSize: 11, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  input: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 12, fontSize: 32, textAlign: 'center', marginBottom: 25, borderWidth: 1, borderColor: '#333', fontWeight: 'bold' },
  btnStart: { backgroundColor: '#FFD700', padding: 20, borderRadius: 12, alignItems: 'center' },
  btnEnd: { backgroundColor: '#E74C3C', padding: 20, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  btnTextWhite: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  timerContainer: { alignItems: 'center', marginBottom: 20, backgroundColor: '#000', padding: 15, borderRadius: 12 },
  timerLabel: { color: '#FFD700', fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginTop: 5 },
  timerValue: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  subtitle: { color: '#444', fontSize: 12, fontWeight: 'bold', marginTop: 30, marginBottom: 15, textAlign: 'center' },
  historyCard: { backgroundColor: '#0D0D0D', flexDirection: 'row', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1A1A1A' },
  statusTag: { width: 4, height: 35, marginRight: 15, borderRadius: 2 },
  historyText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  historySub: { color: '#444', fontSize: 10, marginTop: 2 },
  locationText: { color: '#888', fontSize: 10, marginTop: 2, fontWeight: '500' },
  durationText: { color: '#2ecc71', fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  historyKm: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});