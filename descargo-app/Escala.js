import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, 
  ScrollView, ActivityIndicator, Dimensions, Alert
} from 'react-native';
import { 
  collection, onSnapshot, doc, setDoc, addDoc, serverTimestamp, query, where, getDocs 
} from "firebase/firestore";
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function Escala({ auth, db }) {
  const [escalaAtual, setEscalaAtual] = useState({});
  const [dataFiltro, setDataFiltro] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const opcoesStatus = {
    'P': { label: 'Trabalhado', color: '#2ecc71' },
    'DS': { label: 'Descanso', color: '#ff85a2' },
    'F': { label: 'Falta', color: '#e67e22' },
    'FE': { label: 'Férias', color: '#3498db' },
    'A': { label: 'Atestado', color: '#f1c40f' },
    'D': { label: 'Demitido', color: '#e74c3c' },
    'C1': { label: 'Contratado', color: '#00ced1' },
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const carregarDadosMotorista = async () => {
      try {
        // Busca o nome do motorista conforme a lógica da tela Conta
        const q = query(
          collection(db, "cadastro_motoristas"), 
          where("uid", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const dados = querySnapshot.docs[0].data();
          setUserData(dados);
        }
      } catch (error) {
        console.error("Erro ao buscar cadastro:", error);
      }
    };

    carregarDadosMotorista();

    const caminhoEscala = collection(db, "cadastro_motoristas", user.uid, "escala");
    const unsub = onSnapshot(caminhoEscala, (snapshot) => {
      const dados = {};
      snapshot.forEach(doc => { dados[doc.id] = doc.data(); });
      setEscalaAtual(dados);
      setLoading(false);
    });

    return () => unsub();
  }, [auth.currentUser]);

  const diasDoMes = useMemo(() => {
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
  }, [dataFiltro]);

  const resumoStatus = useMemo(() => {
    const contagem = {};
    Object.keys(opcoesStatus).forEach(key => contagem[key] = 0);
    diasDoMes.forEach(item => {
      if (item && escalaAtual[item.dataIso]) {
        const statusKey = escalaAtual[item.dataIso].status;
        if (contagem[statusKey] !== undefined) contagem[statusKey] += 1;
      }
    });
    return contagem;
  }, [diasDoMes, escalaAtual]);

  const enviarSolicitacao = async (dataIso, motivo) => {
    if (!motivo || motivo.trim() === "") return;
    try {
      const user = auth.currentUser;
      await setDoc(doc(db, "cadastro_motoristas", user.uid, "escala", dataIso), {
        ajustePendente: true,
        motivoSolicitado: motivo,
        timestamp: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, "notificacoes_ajustes", user.uid), {
        nome: userData?.nome || "Motorista",
        ultimaSolicitacao: serverTimestamp(),
        temPendencia: true
      }, { merge: true });

      await addDoc(collection(db, "notificacoes_ajustes", user.uid, "solicitacoes"), {
        dataReferencia: dataIso,
        mensagem: motivo,
        lida: false,
        criadoEm: serverTimestamp()
      });

      Alert.alert("Sucesso", "Solicitação enviada!");
      setDiaSelecionado(null);
    } catch (error) {
      Alert.alert("Erro", "Falha ao enviar.");
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#FFD700" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }} // Espaço extra para não cobrir o resumo
      >
        {/* HEADER COMPACTO */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Minha Escala</Text>
          <View style={styles.driverBadge}>
            <MaterialIcons name="person" size={14} color="#FFD700" />
            <Text style={styles.driverName}>{userData?.nome?.toUpperCase() || 'CARREGANDO...'}</Text>
          </View>
        </View>

        {/* NAVEGAÇÃO MÊS SUBIDA */}
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => setDataFiltro(new Date(dataFiltro.setMonth(dataFiltro.getMonth() - 1)))}>
            <Ionicons name="chevron-back" size={22} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.monthText}>{dataFiltro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</Text>
          <TouchableOpacity onPress={() => setDataFiltro(new Date(dataFiltro.setMonth(dataFiltro.getMonth() + 1)))}>
            <Ionicons name="chevron-forward" size={22} color="#FFD700" />
          </TouchableOpacity>
        </View>

        {/* GRADE CALENDÁRIO OTIMIZADA */}
        <View style={styles.grid}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <Text key={i} style={styles.weekDayText}>{d}</Text>
          ))}
          {diasDoMes.map((item, idx) => {
            const dado = item ? escalaAtual[item.dataIso] : null;
            const isSel = diaSelecionado?.dataIso === item?.dataIso;
            return (
              <TouchableOpacity 
                key={idx} 
                onPress={() => item && setDiaSelecionado({ ...item, ...dado })}
                style={[
                  styles.dayBox, 
                  { 
                    backgroundColor: item ? '#111' : 'transparent', 
                    borderColor: isSel ? '#FFD700' : '#222', 
                    borderWidth: isSel ? 2 : 1 
                  }
                ]}
              >
                {dado?.color && <View style={[styles.statusLine, { backgroundColor: dado.color }]} />}
                <Text style={[styles.dayNumber, { color: item ? (dado ? '#FFF' : '#666') : 'transparent' }]}>{item?.dia}</Text>
                {dado?.ajustePendente && <View style={styles.pulseDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* RESUMO DOS STATUS - SUBIDO E MAIS VISÍVEL */}
        <View style={styles.resumoContainer}>
          <Text style={styles.resumoTitle}>CONTAGEM DO MÊS</Text>
          <View style={styles.resumoGrid}>
            {Object.entries(opcoesStatus).map(([key, value]) => (
              <View key={key} style={styles.resumoItem}>
                <View style={[styles.resumoDot, { backgroundColor: value.color }]} />
                <Text style={styles.resumoLabel}>{value.label}:</Text>
                <Text style={styles.resumoValue}>{resumoStatus[key] || 0}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CARD DE DETALHE (APARECE AO CLICAR) */}
        {diaSelecionado && (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Dia {diaSelecionado.dia}</Text>
              <TouchableOpacity onPress={() => setDiaSelecionado(null)}>
                <Ionicons name="close-circle" size={24} color="#444" />
              </TouchableOpacity>
            </View>
            <Text style={styles.detailStatus}>
              Status: <Text style={{ color: diaSelecionado.color || '#666' }}>{diaSelecionado.legenda || 'Não definido'}</Text>
            </Text>
            <TouchableOpacity 
              style={styles.ajusteBtn}
              onPress={() => Alert.prompt("Ajuste", "Motivo da alteração:", [{text: "Cancelar"}, {text: "Enviar", onPress: (t) => enviarSolicitacao(diaSelecionado.dataIso, t)}])}
            >
              <Text style={styles.ajusteBtnText}>SOLICITAR AJUSTE</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  
  header: { paddingHorizontal: 20, paddingTop: 45, marginBottom: 5 }, 
  headerTitle: { color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  driverBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 5 },
  driverName: { color: '#FFD700', fontSize: 13, fontWeight: 'bold' },

  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, marginTop: 15 },
  monthText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 15, justifyContent: 'center' },
  weekDayText: { width: (width - 40) / 7, textAlign: 'center', color: '#444', fontSize: 10, fontWeight: '900', marginBottom: 8 },
  dayBox: { width: (width - 50) / 7, height: height * 0.065, margin: 2, borderRadius: 8, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  statusLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 },
  dayNumber: { fontSize: 17, fontWeight: 'bold' },
  pulseDot: { position: 'absolute', top: 5, right: 5, width: 6, height: 6, backgroundColor: '#FFD700', borderRadius: 3 },

  resumoContainer: { marginHorizontal: 20, marginTop: 15, padding: 15, backgroundColor: '#0A0A0A', borderRadius: 15, borderWidth: 1, borderColor: '#1A1A1A' },
  resumoTitle: { color: '#444', fontSize: 10, fontWeight: '900', marginBottom: 12, letterSpacing: 1 },
  resumoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  resumoItem: { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 8 },
  resumoDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  resumoLabel: { color: '#888', fontSize: 11, flex: 1 },
  resumoValue: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

  detailCard: { margin: 20, padding: 20, backgroundColor: '#0D0D0D', borderRadius: 20, borderColor: '#222', borderWidth: 1 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  detailStatus: { color: '#888', fontSize: 15, marginBottom: 15 },
  ajusteBtn: { backgroundColor: '#FFD700', padding: 15, borderRadius: 12, alignItems: 'center' },
  ajusteBtnText: { color: '#000', fontWeight: '900', fontSize: 13 }
});