import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  and
} from 'firebase/firestore';
import { MaterialCommunityIcons, MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';

export default function Rotas({ auth, db, setCargaAtiva, setActiveTab }) {
  const [loading, setLoading] = useState(true);
  const [rotasDisponiveis, setRotasDisponiveis] = useState([]);

  useEffect(() => {
    if (!auth?.currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "ordens_servico"), 
      and(
        where("motoristaId", "==", auth.currentUser.uid),
        where("status", "in", ["AGUARDANDO PROGRAMAÇÃO", "PENDENTE ACEITE", "ACEITO", "EM ANDAMENTO", "AGUARDANDO CONFIRMAÇÃO"])
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      
      // Ordenar: EM ANDAMENTO primeiro, depois ACEITO, depois PENDENTE
      lista.sort((a, b) => {
        const order = { 
          'EM ANDAMENTO': 1, 
          'AGUARDANDO CONFIRMAÇÃO': 2,
          'ACEITO': 3, 
          'PENDENTE ACEITE': 4, 
          'AGUARDANDO PROGRAMAÇÃO': 5 
        };
        return (order[a.status] || 6) - (order[b.status] || 6);
      });
      
      setRotasDisponiveis(lista);
      setLoading(false);
    }, (error) => {
      console.error("Erro Firestore Rotas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth?.currentUser]);

  const handleAceitarRota = async (rota) => {
    // Se já está aceita ou em andamento, só troca a aba
    if (rota.status === "ACEITO" || rota.status === "EM ANDAMENTO" || rota.status === "AGUARDANDO CONFIRMAÇÃO") {
      setCargaAtiva(rota);
      setActiveTab('painel');
      return;
    }

    try {
      setLoading(true);
      const docRef = doc(db, "ordens_servico", rota.id);
      
      await updateDoc(docRef, {
        status: "ACEITO",
        aceitoEm: serverTimestamp(),
        dataInicioViagem: serverTimestamp(),
        instrucaoAtual: 0
      });
      
      const rotaAtualizada = { 
        ...rota, 
        status: "ACEITO",
        aceitoEm: new Date(),
        dataInicioViagem: new Date()
      };
      
      setCargaAtiva(rotaAtualizada);
      setActiveTab('painel');
      
      // Mensagem informativa sobre o fluxo automático
      Alert.alert(
        "✅ VIAGEM ACEITA!",
        "A viagem será iniciada automaticamente em instantes.\n\n" +
        "📱 Fluxo automático:\n" +
        "1. Viagem inicia automaticamente\n" +
        "2. Navegue até o destino\n" +
        "3. App detecta chegada automaticamente\n" +
        "4. Confirme sua chegada para finalizar",
        [{ text: "ENTENDI", onPress: () => {} }]
      );
      
    } catch (error) {
      console.error("Erro ao aceitar:", error);
      Alert.alert("Erro", "Não foi possível aceitar a viagem.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status, chegouAoDestino, confirmacaoPendente) => {
    if (confirmacaoPendente) {
      return {
        text: "AGUARDANDO CONFIRMAÇÃO",
        color: "#FFD700",
        bgColor: "#3d3d00",
        icon: "alert-circle"
      };
    }
    
    if (chegouAoDestino) {
      return {
        text: "CHEGOU AO DESTINO",
        color: "#2ecc71",
        bgColor: "#1a3a1a",
        icon: "check-circle"
      };
    }
    
    switch (status) {
      case 'EM ANDAMENTO':
        return {
          text: "EM ANDAMENTO",
          color: "#FFD700",
          bgColor: "#3d3d00",
          icon: "truck"
        };
      case 'ACEITO':
        return {
          text: "ACEITA - INICIANDO",
          color: "#3498db",
          bgColor: "#1a3a3d",
          icon: "clock"
        };
      case 'AGUARDANDO CONFIRMAÇÃO':
        return {
          text: "AGUARDANDO CONFIRMAÇÃO",
          color: "#FFD700",
          bgColor: "#3d3d00",
          icon: "alert-circle"
        };
      case 'PENDENTE ACEITE':
        return {
          text: "AGUARDANDO ACEITE",
          color: "#e74c3c",
          bgColor: "#3d1a1a",
          icon: "bell"
        };
      default:
        return {
          text: status || "AGUARDANDO",
          color: "#666",
          bgColor: "#222",
          icon: "clock"
        };
    }
  };

  const renderItem = ({ item }) => {
    const statusInfo = getStatusInfo(item.status, item.chegouAoDestino, item.confirmacaoPendente);
    const temInstrucoes = item.trajetoComInstrucoes && item.trajetoComInstrucoes.length > 0;
    const temTrajeto = item.trajeto && item.trajeto.length > 0;
    const temGeofence = item.cercaVirtual?.ativa;
    const isViagemAtiva = item.status === "EM ANDAMENTO" || item.status === "AGUARDANDO CONFIRMAÇÃO" || item.chegouAoDestino;
    const podeAceitar = item.status === "PENDENTE ACEITE" || item.status === "AGUARDANDO PROGRAMAÇÃO";

    return (
      <View style={[
        styles.card, 
        isViagemAtiva && styles.cardAtiva,
        item.chegouAoDestino && styles.cardChegou,
        item.confirmacaoPendente && styles.cardConfirmacao
      ]}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: statusInfo.bgColor }]}>
            <MaterialCommunityIcons 
              name={statusInfo.icon} 
              size={12} 
              color={statusInfo.color} 
              style={styles.badgeIcon}
            />
            <Text style={[styles.badgeText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            <Text style={styles.dtText}>DT: {item.dt || 'N/A'}</Text>
            
            {/* Indicadores */}
            <View style={styles.indicadores}>
              {temInstrucoes && (
                <View style={styles.indicadorBadge}>
                  <Ionicons name="volume-high" size={10} color="#FFD700" />
                  <Text style={styles.indicadorText}>{item.trajetoComInstrucoes.length}</Text>
                </View>
              )}
              
              {temGeofence && (
                <View style={styles.indicadorBadge}>
                  <FontAwesome name="circle" size={10} color="#3498db" />
                  <Text style={styles.indicadorText}>{item.cercaVirtual?.raio || 100}m</Text>
                </View>
              )}
              
              {temTrajeto && !temInstrucoes && (
                <View style={styles.indicadorBadge}>
                  <MaterialCommunityIcons name="map-marker-path" size={10} color="#666" />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Origem */}
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="store-24-hour" size={20} color="#FFD700" />
          <View style={styles.infoTextGroup}>
            <Text style={styles.label}>ORIGEM</Text>
            <Text style={styles.value} numberOfLines={1}>
              {item.origemCliente || item.cliente_origem || 'Não informada'}
            </Text>
            <Text style={styles.subValue}>
              {item.origemCidade || ''}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Destino */}
        <View style={styles.infoRow}>
          <MaterialIcons name="location-on" size={20} color="#FF4D4D" />
          <View style={styles.infoTextGroup}>
            <Text style={styles.label}>DESTINO FINAL</Text>
            <Text style={styles.value} numberOfLines={1}>
              {item.destinoCliente || item.cliente_destino}
            </Text>
            <Text style={styles.subValue}>
              {item.destinoCidade || item.cidade_destino}
            </Text>
            
            {/* Informações adicionais */}
            <View style={styles.infoAdicional}>
              {item.tipoViagem === 'CARREGADO' && item.peso && (
                <View style={styles.infoTag}>
                  <MaterialCommunityIcons name="weight" size={10} color="#666" />
                  <Text style={styles.infoTagText}>{item.peso}</Text>
                </View>
              )}
              
              {item.tipoViagem && item.tipoViagem !== 'CARREGADO' && (
                <View style={styles.infoTag}>
                  <MaterialIcons 
                    name={item.tipoViagem === 'VAZIO' ? 'drive-eta' : 'build'} 
                    size={10} 
                    color="#666" 
                  />
                  <Text style={styles.infoTagText}>{item.tipoViagem}</Text>
                </View>
              )}
              
              {item.perfilVeiculo && (
                <View style={styles.infoTag}>
                  <MaterialCommunityIcons name="truck" size={10} color="#666" />
                  <Text style={styles.infoTagText}>{item.perfilVeiculo}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Botão de ação */}
        <TouchableOpacity 
          style={[
            styles.btnAcao, 
            isViagemAtiva ? styles.btnAtiva : 
            podeAceitar ? styles.btnAceitar : 
            styles.btnVisualizar
          ]} 
          onPress={() => handleAceitarRota(item)}
          activeOpacity={0.7}
          disabled={!isViagemAtiva && !podeAceitar}
        >
          <Text style={[
            styles.btnText,
            isViagemAtiva && styles.btnTextAtiva,
            podeAceitar && styles.btnTextAceitar
          ]}>
            {isViagemAtiva ? "CONTINUAR VIAGEM" : 
             podeAceitar ? "ACEITAR VIAGEM" : 
             "VER DETALHES"}
          </Text>
          <MaterialCommunityIcons 
            name={isViagemAtiva ? "arrow-right" : podeAceitar ? "check" : "eye"} 
            size={20} 
            color={isViagemAtiva ? "#FFD700" : podeAceitar ? "#000" : "#666"} 
          />
        </TouchableOpacity>
        
        {/* Mensagem informativa para viagens aceitas */}
        {item.status === "ACEITO" && !isViagemAtiva && (
          <View style={styles.infoBox}>
            <MaterialIcons name="info" size={14} color="#3498db" />
            <Text style={styles.infoBoxText}>
              A viagem será iniciada automaticamente em instantes.
            </Text>
          </View>
        )}
        
        {/* Mensagem para confirmação pendente */}
        {item.confirmacaoPendente && (
          <View style={styles.infoBox}>
            <MaterialIcons name="warning" size={14} color="#FFD700" />
            <Text style={styles.infoBoxText}>
              Aguardando sua confirmação de chegada no painel principal.
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading && rotasDisponiveis.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.carregandoText}>Carregando suas viagens...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Minhas Viagens</Text>
          {rotasDisponiveis.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{rotasDisponiveis.length}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.subtitle}>
          Viagens atribuídas à sua frota
        </Text>
      </View>
      
      {rotasDisponiveis.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="truck-off" size={80} color="#222" />
          <Text style={styles.emptyText}>Nenhuma viagem programada</Text>
          <Text style={styles.emptySubText}>
            Aguarde a frota atribuir uma viagem para você.
          </Text>
          <View style={styles.emptyInfo}>
            <MaterialIcons name="info" size={14} color="#666" />
            <Text style={styles.emptyInfoText}>
              Quando uma viagem for atribuída, você receberá uma notificação.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={rotasDisponiveis}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {rotasDisponiveis.length} viagem{rotasDisponiveis.length !== 1 ? 's' : ''} encontrada{rotasDisponiveis.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000', 
    paddingHorizontal: 20, 
    paddingTop: 10 
  },
  centered: { 
    flex: 1, 
    backgroundColor: '#000', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  carregandoText: {
    color: '#666',
    fontSize: 14,
    marginTop: 15,
    fontWeight: '600'
  },
  header: {
    marginBottom: 20,
  },
  headerTitleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
    marginBottom: 5 
  },
  title: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#FFF',
    letterSpacing: -0.5 
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600'
  },
  countBadge: { 
    backgroundColor: '#222', 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  countText: { 
    color: '#FFD700', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  list: { 
    paddingBottom: 120 
  },
  listHeader: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222'
  },
  listHeaderText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  card: { 
    backgroundColor: '#0A0A0A', 
    borderRadius: 18, 
    padding: 18, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#1A1A1A',
    elevation: 3
  },
  cardAtiva: { 
    borderColor: '#FFD70044', 
    backgroundColor: '#0F0F05',
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700'
  },
  cardChegou: {
    borderColor: '#2ecc7144',
    backgroundColor: '#0F150F',
    borderLeftWidth: 4,
    borderLeftColor: '#2ecc71'
  },
  cardConfirmacao: {
    borderColor: '#FFD70044',
    backgroundColor: '#151505',
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700'
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 15 
  },
  badge: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8,
    gap: 6
  },
  badgeIcon: {
    marginRight: 2
  },
  badgeText: { 
    fontSize: 10, 
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  headerRight: { 
    alignItems: 'flex-end', 
    gap: 8 
  },
  dtText: { 
    color: '#555', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  indicadores: {
    flexDirection: 'row',
    gap: 6
  },
  indicadorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3
  },
  indicadorText: {
    color: '#aaa',
    fontSize: 9,
    fontWeight: 'bold'
  },
  infoRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    marginVertical: 6 
  },
  infoTextGroup: { 
    marginLeft: 12, 
    flex: 1 
  },
  label: { 
    color: '#333', 
    fontSize: 9, 
    fontWeight: 'bold', 
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  value: { 
    color: '#EEE', 
    fontSize: 15, 
    fontWeight: 'bold',
    marginBottom: 2
  },
  subValue: { 
    color: '#777', 
    fontSize: 12 
  },
  infoAdicional: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  infoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4
  },
  infoTagText: {
    color: '#666',
    fontSize: 10,
    fontWeight: '600'
  },
  divider: { 
    height: 1, 
    backgroundColor: '#1A1A1A', 
    marginVertical: 10, 
    marginLeft: 32 
  },
  btnAcao: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 12, 
    marginTop: 15,
    gap: 10
  },
  btnAtiva: { 
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#FFD700'
  },
  btnAceitar: { 
    backgroundColor: '#FFD700' 
  },
  btnVisualizar: {
    backgroundColor: '#222'
  },
  btnText: { 
    color: '#000', 
    fontWeight: '900', 
    fontSize: 14, 
    letterSpacing: 0.5 
  },
  btnTextAtiva: {
    color: '#FFD700'
  },
  btnTextAceitar: {
    color: '#000'
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.2)'
  },
  infoBoxText: {
    flex: 1,
    color: '#3498db',
    fontSize: 12,
    lineHeight: 16
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 60,
    paddingHorizontal: 40 
  },
  emptyText: { 
    color: '#444', 
    marginTop: 20, 
    textAlign: 'center', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  emptySubText: { 
    color: '#333', 
    marginTop: 8, 
    textAlign: 'center', 
    fontSize: 14,
    lineHeight: 20
  },
  emptyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
    padding: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    gap: 8,
    maxWidth: 300
  },
  emptyInfoText: {
    flex: 1,
    color: '#666',
    fontSize: 12,
    lineHeight: 16
  }
});