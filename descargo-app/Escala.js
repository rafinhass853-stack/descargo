import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Alert, 
  ScrollView,
  ActivityIndicator 
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// IMPORTANTE: Certifique-se de que o arquivo firebase.js (com export { auth, db }) 
// esteja dentro da pasta 'descargo-app'
import { auth, db } from "./firebase"; 

import { doc, collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";

// Configuração do calendário para Português
LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
  monthNamesShort: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
  dayNames: ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'],
  dayNamesShort: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

export default function Escala() {
  const [selectedDay, setSelectedDay] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [escalas, setEscalas] = useState({}); 
  const [loadingFirebase, setLoadingFirebase] = useState(true);

  useEffect(() => {
    // Pegamos o motorista logado no App
    const user = auth.currentUser;
    if (!user) {
        setLoadingFirebase(false);
        console.log("Nenhum usuário logado no App.");
        return;
    }

    // Buscamos a subcoleção 'escala' que o gestor preenche na web
    const escalaRef = collection(db, "cadastro_motoristas", user.uid, "escala");
    
    const unsubscribe = onSnapshot(escalaRef, (snapshot) => {
      const dadosCarregados = {};
      snapshot.forEach((doc) => {
        dadosCarregados[doc.id] = doc.data(); 
      });
      setEscalas(dadosCarregados);
      setLoadingFirebase(false);
    }, (error) => {
      console.error("Erro ao carregar escala do Firebase: ", error);
      setLoadingFirebase(false);
    });

    return () => unsubscribe();
  }, []);

  const getMarkedDates = () => {
    const marked = {};
    Object.keys(escalas).forEach(date => {
      marked[date] = {
        customStyles: {
          container: {
            backgroundColor: escalas[date].color || '#333',
            borderRadius: 8,
          },
          text: {
            color: '#000',
            fontWeight: 'bold'
          }
        }
      };
    });
    return marked;
  };

  const handleDayPress = (day) => {
    const info = escalas[day.dateString];
    setSelectedDay({
      date: day.dateString,
      status: info?.status || 'SR',
      legenda: info?.legenda || 'Sem registro do gestor'
    });
    setModalVisible(true);
  };

  const enviarQuestionamento = async () => {
    const user = auth.currentUser;
    if (!motivo.trim()) return Alert.alert("Aviso", "Por favor, descreva o motivo.");
    if (!user) return Alert.alert("Erro", "Sessão expirada.");
    
    setLoading(true);
    try {
      // Cria o registro na coleção que você me mostrou na imagem (questionamentos_escala)
      await addDoc(collection(db, "questionamentos_escala"), {
        motoristaId: user.uid,
        motoristaNome: user.displayName || "Motorista App",
        dataReferencia: selectedDay.date,
        motivo: motivo,
        statusAtual: selectedDay.status,
        lido: false,
        dataEnvio: serverTimestamp()
      });

      Alert.alert("Sucesso", "Enviado para seus gestores.");
      setModalVisible(false);
      setMotivo('');
    } catch (error) {
      console.error("Erro ao enviar questionamento:", error);
      Alert.alert("Erro", "Falha ao enviar para o banco de dados.");
    } finally {
      setLoading(false);
    }
  };

  if (loadingFirebase) {
    return (
      <View style={[styles.container, {justifyContent: 'center'}]}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Minha Escala</Text>
          <Text style={styles.subtitle}>Consulte sua programação</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.calendarCard}>
          <Calendar
            markingType={'custom'}
            markedDates={getMarkedDates()}
            onDayPress={handleDayPress}
            theme={{
              calendarBackground: '#111',
              textSectionTitleColor: '#666',
              dayTextColor: '#fff',
              todayTextColor: '#FFD700',
              monthTextColor: '#FFD700',
              arrowColor: '#FFD700',
            }}
          />
        </View>

        <View style={styles.legendContainer}>
          <Text style={styles.legendHeader}>LEGENDA</Text>
          <View style={styles.legendGrid}>
            <LegendItem color="#2ecc71" sigla="P" desc="Trabalhado" />
            <LegendItem color="#ff85a2" sigla="DS" desc="Descanso" />
            <LegendItem color="#e67e22" sigla="F" desc="Falta" />
            <LegendItem color="#3498db" sigla="FE" desc="Férias" />
          </View>
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes do Dia</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
               <Text style={styles.infoLabel}>Data:</Text>
               <Text style={styles.infoValue}>{selectedDay?.date}</Text>
            </View>
            
            <View style={styles.infoRow}>
               <Text style={styles.infoLabel}>Status:</Text>
               <Text style={[styles.infoValue, {color: '#FFD700'}]}>{selectedDay?.legenda}</Text>
            </View>

            <Text style={[styles.infoLabel, {marginTop: 15}]}>Questionar escala:</Text>
            <TextInput 
              style={styles.input}
              placeholder="Ex: No dia 29 eu trabalhei, mas consta descanso..."
              placeholderTextColor="#444"
              multiline
              value={motivo}
              onChangeText={setMotivo}
            />

            <TouchableOpacity style={styles.sendButton} onPress={enviarQuestionamento}>
               {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.sendButtonText}>ENVIAR QUESTIONAMENTO</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const LegendItem = ({ color, sigla, desc }) => (
  <View style={styles.legendItem}>
    <View style={[styles.siglaBox, { backgroundColor: color }]}>
      <Text style={styles.siglaText}>{sigla}</Text>
    </View>
    <Text style={styles.legendDesc}>{desc}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingHorizontal: 25, paddingVertical: 20 },
  title: { color: '#FFD700', fontSize: 26, fontWeight: '900' },
  subtitle: { color: '#666', fontSize: 12 },
  calendarCard: { marginHorizontal: 15, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  legendContainer: { padding: 20 },
  legendHeader: { color: '#444', fontSize: 11, fontWeight: 'bold', marginBottom: 15 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', width: '45%', gap: 10 },
  siglaBox: { width: 32, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  siglaText: { color: '#000', fontWeight: 'bold', fontSize: 10 },
  legendDesc: { color: '#888', fontSize: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 25 },
  modalContent: { backgroundColor: '#111', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: '#222' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  infoLabel: { color: '#666', fontSize: 12, fontWeight: 'bold' },
  infoValue: { color: '#FFF', fontSize: 14 },
  input: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 15, marginTop: 10, height: 100, textAlignVertical: 'top' },
  sendButton: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  sendButtonText: { color: '#000', fontWeight: 'bold' }
});