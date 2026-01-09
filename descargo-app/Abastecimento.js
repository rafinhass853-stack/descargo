// Abastecimento.js
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Alert, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, 
  Platform, Dimensions 
} from 'react-native';
import { MaterialCommunityIcons, FontAwesome5, Ionicons, FontAwesome } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, doc, updateDoc, deleteDoc 
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

const Abastecimento = ({ auth, db }) => {
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [localizacao, setLocalizacao] = useState(null);
  const [cidadeAtual, setCidadeAtual] = useState('Obtendo localização...');

  // Estado do formulário
  const [form, setForm] = useState({
    tipoCombustivel: 'DIESEL', // DIESEL ou ARLA
    litros: '',
    valorLitro: '',
    valorTotal: '',
    hodometro: '',
    posto: '',
    cidade: '',
    observacoes: ''
  });

  // Buscar localização atual
  useEffect(() => {
    const obterLocalizacao = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setCidadeAtual('Permissão negada');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setLocalizacao(location.coords);

        // Buscar cidade
        const geo = await Location.reverseGeocodeAsync(location.coords);
        if (geo.length > 0) {
          const cidade = geo[0].city || geo[0].subregion || 'Cidade não identificada';
          const uf = geo[0].region || '';
          setCidadeAtual(`${cidade} - ${uf}`);
          setForm(prev => ({ ...prev, cidade: `${cidade} - ${uf}` }));
        }
      } catch (error) {
        console.error('Erro ao obter localização:', error);
        setCidadeAtual('Erro ao obter localização');
      }
    };

    obterLocalizacao();
  }, []);

  // Carregar abastecimentos do Firestore
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "abastecimentos"),
      where("motoristaId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      
      // Ordenar por data mais recente
      lista.sort((a, b) => {
        const dataA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dataB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dataB - dataA;
      });
      
      setAbastecimentos(lista);
      setCarregando(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  // Cálculos automáticos
  useEffect(() => {
    if (form.litros && form.valorLitro) {
      const litros = parseFloat(form.litros.replace(',', '.'));
      const valorLitro = parseFloat(form.valorLitro.replace(',', '.'));
      const valorTotal = litros * valorLitro;
      
      if (!isNaN(valorTotal)) {
        setForm(prev => ({ 
          ...prev, 
          valorTotal: valorTotal.toFixed(2).replace('.', ',') 
        }));
      }
    } else if (form.litros && form.valorTotal) {
      const litros = parseFloat(form.litros.replace(',', '.'));
      const valorTotal = parseFloat(form.valorTotal.replace(',', '.'));
      const valorLitro = valorTotal / litros;
      
      if (!isNaN(valorLitro) && litros > 0) {
        setForm(prev => ({ 
          ...prev, 
          valorLitro: valorLitro.toFixed(3).replace('.', ',') 
        }));
      }
    }
  }, [form.litros, form.valorLitro, form.valorTotal]);

  // Formatação de dados
  const formatarData = (timestamp) => {
    if (!timestamp) return '--/--/--';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return '--/--/--';
    }
  };

  const formatarValor = (valor) => {
    return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
  };

  // Limpar formulário
  const limparFormulario = () => {
    setForm({
      tipoCombustivel: 'DIESEL',
      litros: '',
      valorLitro: '',
      valorTotal: '',
      hodometro: '',
      posto: '',
      cidade: cidadeAtual,
      observacoes: ''
    });
    setEditandoId(null);
  };

  // Abrir modal para editar
  const abrirParaEditar = (abastecimento) => {
    setForm({
      tipoCombustivel: abastecimento.tipoCombustivel || 'DIESEL',
      litros: abastecimento.litros.toString().replace('.', ','),
      valorLitro: abastecimento.valorLitro ? abastecimento.valorLitro.toString().replace('.', ',') : '',
      valorTotal: abastecimento.valorTotal ? abastecimento.valorTotal.toString().replace('.', ',') : '',
      hodometro: abastecimento.hodometro.toString(),
      posto: abastecimento.posto || '',
      cidade: abastecimento.cidade || cidadeAtual,
      observacoes: abastecimento.observacoes || ''
    });
    setEditandoId(abastecimento.id);
    setModalVisible(true);
  };

  // Salvar/Atualizar abastecimento
  const salvarAbastecimento = async () => {
    // Validações
    if (!form.litros || !form.hodometro) {
      Alert.alert("Atenção", "Preencha pelo menos litros e hodômetro.");
      return;
    }

    if (!form.valorLitro && !form.valorTotal) {
      Alert.alert("Atenção", "Informe o valor do litro ou o valor total.");
      return;
    }

    try {
      const dados = {
        motoristaId: auth.currentUser.uid,
        motoristaNome: auth.currentUser.email,
        tipoCombustivel: form.tipoCombustivel,
        litros: parseFloat(form.litros.replace(',', '.')),
        valorLitro: form.valorLitro ? parseFloat(form.valorLitro.replace(',', '.')) : null,
        valorTotal: form.valorTotal ? parseFloat(form.valorTotal.replace(',', '.')) : null,
        hodometro: parseInt(form.hodometro),
        posto: form.posto || 'Não informado',
        cidade: form.cidade || cidadeAtual,
        observacoes: form.observacoes || '',
        timestamp: serverTimestamp(),
        status: 'REGISTRADO',
        localizacao: localizacao ? {
          latitude: localizacao.latitude,
          longitude: localizacao.longitude
        } : null
      };

      // Calcular valores que faltam
      if (!dados.valorTotal && dados.valorLitro) {
        dados.valorTotal = dados.litros * dados.valorLitro;
      } else if (!dados.valorLitro && dados.valorTotal) {
        dados.valorLitro = dados.valorTotal / dados.litros;
      }

      if (editandoId) {
        // Atualizar existente
        await updateDoc(doc(db, "abastecimentos", editandoId), dados);
        Alert.alert("✅ Sucesso", "Abastecimento atualizado!");
      } else {
        // Criar novo
        await addDoc(collection(db, "abastecimentos"), dados);
        Alert.alert("✅ Sucesso", "Abastecimento registrado!");
      }

      setModalVisible(false);
      limparFormulario();
    } catch (error) {
      console.error('Erro ao salvar abastecimento:', error);
      Alert.alert("❌ Erro", "Não foi possível salvar o abastecimento.");
    }
  };

  // Excluir abastecimento
  const excluirAbastecimento = async (id) => {
    Alert.alert(
      "Confirmar Exclusão",
      "Tem certeza que deseja excluir este abastecimento?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Excluir", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "abastecimentos", id));
              Alert.alert("✅ Sucesso", "Abastecimento excluído!");
            } catch (error) {
              console.error('Erro ao excluir:', error);
              Alert.alert("❌ Erro", "Não foi possível excluir.");
            }
          }
        }
      ]
    );
  };

  // Calcular estatísticas
  const calcularEstatisticas = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const doMes = abastecimentos.filter(item => {
      const dataItem = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
      return dataItem >= new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    });
    
    const diesel = doMes.filter(item => item.tipoCombustivel === 'DIESEL');
    const arla = doMes.filter(item => item.tipoCombustivel === 'ARLA');
    
    const totalDiesel = diesel.reduce((sum, item) => sum + (item.valorTotal || 0), 0);
    const totalArla = arla.reduce((sum, item) => sum + (item.valorTotal || 0), 0);
    const litrosDiesel = diesel.reduce((sum, item) => sum + (item.litros || 0), 0);
    const litrosArla = arla.reduce((sum, item) => sum + (item.litros || 0), 0);
    
    return {
      totalGasto: totalDiesel + totalArla,
      totalDiesel,
      totalArla,
      litrosDiesel,
      litrosArla,
      quantidade: doMes.length
    };
  };

  const estatisticas = calcularEstatisticas();

  if (carregando) {
    return (
      <View style={styles.carregandoContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.carregandoText}>Carregando abastecimentos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <FontAwesome5 name="gas-pump" size={28} color="#FFD700" />
        <Text style={styles.headerTitle}>ABASTECIMENTOS</Text>
        <TouchableOpacity 
          style={styles.btnNovo}
          onPress={() => {
            limparFormulario();
            setModalVisible(true);
          }}
        >
          <Ionicons name="add-circle" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {/* LOCALIZAÇÃO ATUAL */}
      <View style={styles.localizacaoCard}>
        <MaterialCommunityIcons name="map-marker" size={20} color="#3498db" />
        <Text style={styles.localizacaoText}>{cidadeAtual}</Text>
      </View>

      {/* ESTATÍSTICAS DO MÊS */}
      <View style={styles.estatisticasContainer}>
        <Text style={styles.estatisticasTitulo}>RESUMO DO MÊS</Text>
        <View style={styles.estatisticasGrid}>
          <View style={styles.estatisticaItem}>
            <Text style={styles.estatisticaValor}>{estatisticas.quantidade}</Text>
            <Text style={styles.estatisticaLabel}>Abastecimentos</Text>
          </View>
          <View style={styles.estatisticaItem}>
            <Text style={styles.estatisticaValor}>
              R$ {estatisticas.totalGasto.toFixed(2).replace('.', ',')}
            </Text>
            <Text style={styles.estatisticaLabel}>Total Gasto</Text>
          </View>
        </View>
        <View style={styles.estatisticasDetalhes}>
          <View style={styles.detalheCombustivel}>
            <View style={[styles.indicador, { backgroundColor: '#FFD700' }]} />
            <Text style={styles.detalheTexto}>
              Diesel: {estatisticas.litrosDiesel.toFixed(1)}L - R$ {estatisticas.totalDiesel.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <View style={styles.detalheCombustivel}>
            <View style={[styles.indicador, { backgroundColor: '#3498db' }]} />
            <Text style={styles.detalheTexto}>
              ARLA: {estatisticas.litrosArla.toFixed(1)}L - R$ {estatisticas.totalArla.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>
      </View>

      {/* LISTA DE ABASTECIMENTOS */}
      <ScrollView style={styles.listaContainer}>
        <Text style={styles.listaTitle}>Últimos Abastecimentos</Text>
        
        {abastecimentos.length === 0 ? (
          <View style={styles.listaVazia}>
            <MaterialCommunityIcons name="gas-station-off" size={50} color="#666" />
            <Text style={styles.listaVaziaText}>Nenhum abastecimento registrado</Text>
            <TouchableOpacity 
              style={styles.btnPrimeiroAbastecimento}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.btnPrimeiroText}>REGISTRAR PRIMEIRO ABASTECIMENTO</Text>
            </TouchableOpacity>
          </View>
        ) : (
          abastecimentos.map((abastecimento) => (
            <TouchableOpacity 
              key={abastecimento.id} 
              style={styles.abastecimentoCard}
              onPress={() => abrirParaEditar(abastecimento)}
              onLongPress={() => excluirAbastecimento(abastecimento.id)}
              activeOpacity={0.8}
            >
              <View style={styles.abastecimentoHeader}>
                <View style={styles.abastecimentoInfo}>
                  <View style={styles.tipoContainer}>
                    <View style={[
                      styles.tipoBadge, 
                      { backgroundColor: abastecimento.tipoCombustivel === 'DIESEL' ? '#FFD700' : '#3498db' }
                    ]}>
                      <Text style={styles.tipoBadgeText}>
                        {abastecimento.tipoCombustivel === 'DIESEL' ? '⛽ DIESEL' : '💧 ARLA'}
                      </Text>
                    </View>
                    <Text style={styles.abastecimentoPosto}>{abastecimento.posto || 'Posto não informado'}</Text>
                  </View>
                  <Text style={styles.abastecimentoData}>{formatarData(abastecimento.timestamp)}</Text>
                  {abastecimento.cidade && (
                    <Text style={styles.abastecimentoCidade}>{abastecimento.cidade}</Text>
                  )}
                </View>
                <View style={styles.valorContainer}>
                  <Text style={styles.valorText}>{formatarValor(abastecimento.valorTotal || 0)}</Text>
                </View>
              </View>
              
              <View style={styles.abastecimentoDetalhes}>
                <View style={styles.detalheItem}>
                  <MaterialCommunityIcons name="water" size={16} color="#3498db" />
                  <Text style={styles.detalheText}>{abastecimento.litros.toFixed(1)} L</Text>
                </View>
                
                <View style={styles.detalheItem}>
                  <MaterialCommunityIcons name="currency-usd" size={16} color="#2ecc71" />
                  <Text style={styles.detalheText}>
                    R$ {(abastecimento.valorLitro || abastecimento.valorTotal / abastecimento.litros).toFixed(3).replace('.', ',')}/L
                  </Text>
                </View>
                
                <View style={styles.detalheItem}>
                  <MaterialCommunityIcons name="speedometer" size={16} color="#FFD700" />
                  <Text style={styles.detalheText}>KM {abastecimento.hodometro}</Text>
                </View>
              </View>
              
              {abastecimento.observacoes && (
                <View style={styles.observacoesContainer}>
                  <MaterialCommunityIcons name="note-text" size={14} color="#AAA" />
                  <Text style={styles.observacoesText} numberOfLines={2}>{abastecimento.observacoes}</Text>
                </View>
              )}
              
              <View style={styles.acoesContainer}>
                <TouchableOpacity 
                  style={styles.btnEditar}
                  onPress={() => abrirParaEditar(abastecimento)}
                >
                  <MaterialCommunityIcons name="pencil" size={16} color="#FFD700" />
                  <Text style={styles.btnEditarText}>Editar</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* MODAL DE REGISTRO/EDIÇÃO */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editandoId ? '✏️ EDITAR ABASTECIMENTO' : '⛽ NOVO ABASTECIMENTO'}
              </Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.btnFecharModal}
              >
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* TIPO DE COMBUSTÍVEL */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tipo de Combustível</Text>
                <View style={styles.tipoCombustivelContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.tipoBtn,
                      form.tipoCombustivel === 'DIESEL' && styles.tipoBtnAtivo
                    ]}
                    onPress={() => setForm({...form, tipoCombustivel: 'DIESEL'})}
                  >
                    <FontAwesome5 name="gas-pump" size={20} color={form.tipoCombustivel === 'DIESEL' ? '#000' : '#666'} />
                    <Text style={[
                      styles.tipoBtnText,
                      form.tipoCombustivel === 'DIESEL' && styles.tipoBtnTextAtivo
                    ]}>DIESEL</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.tipoBtn,
                      form.tipoCombustivel === 'ARLA' && styles.tipoBtnAtivo
                    ]}
                    onPress={() => setForm({...form, tipoCombustivel: 'ARLA'})}
                  >
                    <MaterialCommunityIcons name="water" size={20} color={form.tipoCombustivel === 'ARLA' ? '#000' : '#666'} />
                    <Text style={[
                      styles.tipoBtnText,
                      form.tipoCombustivel === 'ARLA' && styles.tipoBtnTextAtivo
                    ]}>ARLA</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* LOCALIZAÇÃO */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Localização</Text>
                <View style={styles.localizacaoAtualContainer}>
                  <MaterialCommunityIcons name="map-marker" size={16} color="#3498db" />
                  <Text style={styles.localizacaoAtualText}>{form.cidade || cidadeAtual}</Text>
                </View>
              </View>

              {/* POSTO */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nome do Posto</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Posto Shell"
                  value={form.posto}
                  onChangeText={(text) => setForm({...form, posto: text})}
                />
              </View>

              {/* VALORES */}
              <View style={styles.valoresContainer}>
                <View style={styles.valorGroup}>
                  <Text style={styles.formLabel}>Litros</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 100,5"
                    keyboardType="decimal-pad"
                    value={form.litros}
                    onChangeText={(text) => setForm({...form, litros: text})}
                  />
                </View>
                
                <View style={styles.valorGroup}>
                  <Text style={styles.formLabel}>Valor do Litro</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 5,759"
                    keyboardType="decimal-pad"
                    value={form.valorLitro}
                    onChangeText={(text) => setForm({...form, valorLitro: text})}
                  />
                </View>
                
                <View style={styles.valorGroup}>
                  <Text style={styles.formLabel}>Valor Total</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 575,90"
                    keyboardType="decimal-pad"
                    value={form.valorTotal}
                    onChangeText={(text) => setForm({...form, valorTotal: text})}
                  />
                </View>
              </View>

              {/* HODÔMETRO */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Hodômetro (KM)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 150000"
                  keyboardType="number-pad"
                  value={form.hodometro}
                  onChangeText={(text) => setForm({...form, hodometro: text})}
                />
              </View>

              {/* OBSERVAÇÕES */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Observações (Opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Alguma observação importante..."
                  value={form.observacoes}
                  onChangeText={(text) => setForm({...form, observacoes: text})}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* RESUMO DOS CÁLCULOS */}
              {form.litros && (form.valorLitro || form.valorTotal) && (
                <View style={styles.resumoContainer}>
                  <Text style={styles.resumoTitle}>RESUMO DO CÁLCULO</Text>
                  <View style={styles.resumoGrid}>
                    <View style={styles.resumoItem}>
                      <Text style={styles.resumoLabel}>Litros:</Text>
                      <Text style={styles.resumoValor}>{form.litros} L</Text>
                    </View>
                    <View style={styles.resumoItem}>
                      <Text style={styles.resumoLabel}>Valor/Litro:</Text>
                      <Text style={styles.resumoValor}>R$ {form.valorLitro || '--'}</Text>
                    </View>
                    <View style={styles.resumoItem}>
                      <Text style={styles.resumoLabel}>Valor Total:</Text>
                      <Text style={[styles.resumoValor, styles.valorDestaque]}>
                        R$ {form.valorTotal || '--'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* BOTÕES DO MODAL */}
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.btnCancelar}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnCancelarText}>CANCELAR</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.btnSalvar}
                onPress={salvarAbastecimento}
              >
                <MaterialCommunityIcons name="check-circle" size={20} color="#000" />
                <Text style={styles.btnSalvarText}>
                  {editandoId ? 'ATUALIZAR' : 'SALVAR'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 15,
    paddingTop: 60,
  },
  carregandoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carregandoText: {
    color: '#FFD700',
    marginTop: 15,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
    flex: 1,
  },
  btnNovo: {
    padding: 8,
  },
  localizacaoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  localizacaoText: {
    color: '#3498db',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  estatisticasContainer: {
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  estatisticasTitulo: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  estatisticasGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  estatisticaItem: {
    alignItems: 'center',
  },
  estatisticaValor: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  estatisticaLabel: {
    color: '#AAA',
    fontSize: 11,
  },
  estatisticasDetalhes: {
    marginTop: 10,
  },
  detalheCombustivel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  indicador: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  detalheTexto: {
    color: '#DDD',
    fontSize: 12,
  },
  listaContainer: {
    flex: 1,
  },
  listaTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  listaVazia: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 50,
  },
  listaVaziaText: {
    color: '#666',
    fontSize: 14,
    marginTop: 15,
    textAlign: 'center',
  },
  btnPrimeiroAbastecimento: {
    backgroundColor: '#FFD700',
    padding: 15,
    borderRadius: 10,
    marginTop: 25,
    width: '100%',
    alignItems: 'center',
  },
  btnPrimeiroText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  abastecimentoCard: {
    backgroundColor: 'rgba(40, 40, 40, 0.9)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  abastecimentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  abastecimentoInfo: {
    flex: 1,
  },
  tipoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  tipoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  tipoBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  abastecimentoPosto: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  abastecimentoData: {
    color: '#AAA',
    fontSize: 11,
    marginBottom: 3,
  },
  abastecimentoCidade: {
    color: '#3498db',
    fontSize: 11,
    fontStyle: 'italic',
  },
  valorContainer: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  valorText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  abastecimentoDetalhes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
    marginBottom: 12,
  },
  detalheItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detalheText: {
    color: '#DDD',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  observacoesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  observacoesText: {
    color: '#AAA',
    fontSize: 11,
    marginLeft: 8,
    flex: 1,
    fontStyle: 'italic',
  },
  acoesContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  btnEditar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  btnEditarText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  // MODAL STYLES
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  btnFecharModal: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  // FORM STYLES
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    color: '#AAA',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipoCombustivelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tipoBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: '#333',
    marginHorizontal: 5,
  },
  tipoBtnAtivo: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  tipoBtnText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  tipoBtnTextAtivo: {
    color: '#000',
  },
  localizacaoAtualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  localizacaoAtualText: {
    color: '#3498db',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  valoresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  valorGroup: {
    flex: 1,
    marginHorizontal: 5,
  },
  input: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  resumoContainer: {
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  resumoTitle: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  resumoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resumoItem: {
    alignItems: 'center',
    flex: 1,
  },
  resumoLabel: {
    color: '#AAA',
    fontSize: 11,
    marginBottom: 5,
  },
  resumoValor: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  valorDestaque: {
    color: '#2ecc71',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnCancelar: {
    flex: 1,
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  btnCancelarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnSalvar: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    padding: 15,
    borderRadius: 10,
  },
  btnSalvarText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default Abastecimento;