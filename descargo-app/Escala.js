import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, 
  ScrollView, ActivityIndicator, Dimensions, Alert 
} from 'react-native';
import { 
  collection, onSnapshot, doc, setDoc, getDoc, addDoc, serverTimestamp 
} from "firebase/firestore";
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Escala({ auth, db }) {
  const [escalaAtual, setEscalaAtual] = useState({});
  const [dataFiltro, setDataFiltro] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  const opcoesLegenda = [
    { status: 'P', label: 'Trabalhado', color: '#2ecc71' },
    { status: 'DS', label: 'Descanso', color: '#ff85a2' },
    { status: 'F', label: 'Falta', color: '#e67e22' },
    { status: 'FE', label: 'Férias', color: '#3498db' },
    { status: 'A', label: 'Atestado', color: '#f1c40f' },
    { status: 'D', label: 'Demitido', color: '#e74c3c' },
  ];

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Puxa os dados reais do motorista no Firestore
    const obterDadosUsuario = async () => {
      try {
        const docRef = doc(db, "cadastro_motoristas", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setUserData(snap.data());
        }
      } catch (error) {
        console.error("Erro ao buscar cadastro:", error);
      }
    };
    obterDadosUsuario();

    // Monitora a escala específica deste ID
    const caminhoEscala = collection(db, "cadastro_motoristas", user.uid, "escala");
    const unsub = onSnapshot(caminhoEscala, (snapshot) => {
      const dados = {};
      snapshot.forEach(doc => { dados[doc.id] = doc.data(); });
      setEscalaAtual(dados);
      setLoading(false);
    });

    return () => unsub();
  }, [auth.currentUser]);

  const enviarNotificacao = async (dataIso, motivo) => {
    if (!motivo || motivo.trim() === "") return;
    
    try {
      const user = auth.currentUser;
      const motoristaID = user.uid; // Puxa o ID exato (ex: EQKOOlGd9j6w9cEtacrx)

      // 1. Registra na escala do motorista
      const escalaDocRef = doc(db, "cadastro_motoristas", motoristaID, "escala", dataIso);
      await setDoc(escalaDocRef, {
        ajustePendente: true,
        motivoSolicitado: motivo,
        timestamp: serverTimestamp()
      }, { merge: true });

      // 2. GRAVAÇÃO NA COLEÇÃO DE NOTIFICAÇÕES USANDO O ID DO MOTORISTA
      // Aqui criamos o documento com o ID fixo do usuário logado
      const pastaMotoristaRef = doc(db, "notificacoes_ajustes", motoristaID);
      
      // Salva ou atualiza os dados básicos do motorista na "capa" da notificação
      await setDoc(pastaMotoristaRef, {
        nome: userData?.nome || "Nome não carregado",
        email: user.email,
        ultimaSolicitacao: serverTimestamp(),
        temPendencia: true
      }, { merge: true });

      // Adiciona a solicitação específica na subcoleção para histórico
      const subSoliRef = collection(db, "notificacoes_ajustes", motoristaID, "solicitacoes");
      await addDoc(subSoliRef, {
        dataReferencia: dataIso,
        mensagem: motivo,
        lida: false,
        criadoEm: serverTimestamp()
      });

      Alert.alert("Sucesso", "Solicitação enviada!");
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Falha ao gravar no Firebase.");
    }
  };

  const gerenciarCliqueDia = (item) => {
    if (!item) return;
    Alert.prompt(
      "Solicitar Ajuste",
      `Data: ${item.dia}/${dataFiltro.getMonth() + 1}`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Enviar", onPress: (txt) => enviarNotificacao(item.dataIso, txt) }
      ]
    );
  };

  const gerarDias = () => {
    const ano = dataFiltro.getFullYear();
    const mes = dataFiltro.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const dias = [];
    for (let i = 0; i < primeiroDia; i++) dias.push(null);
    for (let d = 1; d <= totalDias; d++) {
      const dataIso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({ dia: d, dataIso });
    }
    return dias;
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#FFD700" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MINHA ESCALA</Text>
        <Text style={styles.subTitle}>Olá, {userData?.nome || 'Motorista'}</Text>
        
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => setDataFiltro(new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() - 1, 1))}>
            <Ionicons name="chevron-back" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {dataFiltro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
          </Text>
          <TouchableOpacity onPress={() => setDataFiltro(new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + 1, 1))}>
            <Ionicons name="chevron-forward" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.calendarContainer}>
          <View style={styles.grid}>
            {gerarDias().map((item, idx) => {
              const dado = item ? escalaAtual[item.dataIso] : null;
              return (
                <TouchableOpacity 
                  key={idx} 
                  onPress={() => gerenciarCliqueDia(item)}
                  style={[
                    styles.dayBox,
                    { 
                      backgroundColor: dado?.color || '#1a1a1a', 
                      opacity: item ? 1 : 0,
                      borderWidth: dado?.ajustePendente ? 2 : 0,
                      borderColor: '#FFD700'
                    }
                  ]}
                >
                  <Text style={styles.dayNumber}>{item?.dia}</Text>
                  {dado?.status && <Text style={styles.statusTag}>{dado.status}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 50 },
  headerTitle: { color: '#FFD700', fontSize: 24, fontWeight: 'bold' },
  subTitle: { color: '#666', fontSize: 14, marginBottom: 10 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 10, borderRadius: 10 },
  monthText: { color: '#FFF', fontWeight: 'bold' },
  calendarContainer: { padding: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayBox: { width: (width - 40) / 7 - 4, height: 60, margin: 2, borderRadius: 8, padding: 5, justifyContent: 'space-between' },
  dayNumber: { color: '#888', fontSize: 12 },
  statusTag: { color: '#000', fontWeight: 'bold', alignSelf: 'flex-end' }
});