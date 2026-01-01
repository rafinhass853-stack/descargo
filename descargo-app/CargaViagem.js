import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { db } from './firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const CargaViagem = () => {
  const navigation = useNavigation();
  const [viagens, setViagens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      carregarViagens();
    }
  }, [user]);

  const carregarViagens = async () => {
    try {
      setCarregando(true);
      
      // Buscar viagens disponíveis (status = 'disponivel' ou 'pendente')
      const q = query(
        collection(db, 'viagens'),
        where('status', 'in', ['disponivel', 'pendente'])
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const viagensData = [];
        snapshot.forEach((doc) => {
          viagensData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Ordenar por data mais recente
        viagensData.sort((a, b) => b.createdAt - a.createdAt);
        setViagens(viagensData);
        setCarregando(false);
      });
      
      return unsubscribe;
      
    } catch (error) {
      console.error('Erro ao carregar viagens:', error);
      Alert.alert('Erro', 'Não foi possível carregar as viagens');
      setCarregando(false);
    }
  };

  const aceitarViagem = async (viagem) => {
    try {
      Alert.alert(
        'Confirmar Viagem',
        `Deseja aceitar a viagem para ${viagem.destinoCidade}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Aceitar',
            onPress: async () => {
              // Atualizar status da viagem
              await updateDoc(doc(db, 'viagens', viagem.id), {
                status: 'aceita',
                motoristaId: user.uid,
                motoristaNome: user.displayName || user.email,
                aceitaEm: new Date(),
              });
              
              // Navegar para tela de navegação
              navigation.navigate('NavegacaoAudio', {
                viagemId: viagem.id,
                origem: {
                  latitude: viagem.origemLat || -23.5505,
                  longitude: viagem.origemLng || -46.6333,
                  endereco: viagem.origemEndereco || 'São Paulo, SP'
                },
                destino: {
                  latitude: viagem.destinoLat || -23.5635,
                  longitude: viagem.destinoLng || -46.6523,
                  endereco: viagem.destinoEndereco || 'São Paulo, SP'
                }
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Erro ao aceitar viagem:', error);
      Alert.alert('Erro', 'Não foi possível aceitar a viagem');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarViagens().then(() => setRefreshing(false));
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Viagem #{item.id.substring(0, 8)}</Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.status === 'disponivel' ? '#28a745' : '#ffc107' }
        ]}>
          <Text style={styles.statusText}>
            {item.status === 'disponivel' ? 'DISPONÍVEL' : 'PENDENTE'}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardBody}>
        <View style={styles.rotaItem}>
          <Ionicons name="location-outline" size={20} color="#1a73e8" />
          <View style={styles.rotaTextContainer}>
            <Text style={styles.rotaLabel}>Origem:</Text>
            <Text style={styles.rotaValue}>{item.origemEndereco || 'Não informado'}</Text>
          </View>
        </View>
        
        <View style={styles.separator} />
        
        <View style={styles.rotaItem}>
          <Ionicons name="flag-outline" size={20} color="#dc3545" />
          <View style={styles.rotaTextContainer}>
            <Text style={styles.rotaLabel}>Destino:</Text>
            <Text style={styles.rotaValue}>{item.destinoEndereco || 'Não informado'}</Text>
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialIcons name="local-shipping" size={16} color="#666" />
            <Text style={styles.infoText}>{item.tipoCarga || 'Geral'}</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name="account-balance-wallet" size={16} color="#666" />
            <Text style={styles.infoText}>R$ {item.valor?.toFixed(2) || '0,00'}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.cardFooter}>
        <TouchableOpacity 
          style={styles.botaoDetalhes}
          onPress={() => Alert.alert('Detalhes', `Carga: ${item.descricao || 'Sem descrição'}`)}
        >
          <Text style={styles.botaoDetalhesTexto}>Ver Detalhes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.botaoAceitar}
          onPress={() => aceitarViagem(item)}
          disabled={item.status !== 'disponivel'}
        >
          <Text style={styles.botaoAceitarTexto}>
            {item.status === 'disponivel' ? 'ACEITAR VIAGEM' : 'AGUARDANDO'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (carregando && viagens.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.carregandoTexto}>Carregando viagens...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cargas Disponíveis</Text>
        <TouchableOpacity onPress={carregarViagens}>
          <Ionicons name="refresh" size={24} color="#1a73e8" />
        </TouchableOpacity>
      </View>
      
      {viagens.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="local-shipping" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Nenhuma viagem disponível no momento</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={carregarViagens}>
            <Text style={styles.emptyButtonText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={viagens}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1a73e8']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  listContainer: {
    padding: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBody: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  rotaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 5,
  },
  rotaTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  rotaLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  rotaValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 10,
    marginLeft: 30,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#666',
  },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 15,
  },
  botaoDetalhes: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1a73e8',
    borderRadius: 8,
  },
  botaoDetalhesTexto: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  botaoAceitar: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    marginLeft: 8,
  },
  botaoAceitarTexto: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  emptyButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  carregandoTexto: {
    marginTop: 15,
    color: '#666',
    fontSize: 16,
  },
});

export default CargaViagem;