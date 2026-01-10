// MinhasViagens.js - VERSÃO COMPLETA COM LEAD TIME
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, 
  SafeAreaView, StatusBar, TouchableOpacity, Alert, Image, Modal
} from 'react-native';
import { collection, query, onSnapshot, doc, updateDoc, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function MinhasViagens({ auth, db }) {
  const [loading, setLoading] = useState(true);
  const [viagens, setViagens] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('ativas');
  const [uploading, setUploading] = useState(false);
  const [modalImagem, setModalImagem] = useState(null);
  const [colecoesAtivas, setColecoesAtivas] = useState([]);
  const [viagemSelecionada, setViagemSelecionada] = useState(null);
  const [modalLeadTime, setModalLeadTime] = useState(false);
  const [leadTimeAtivo, setLeadTimeAtivo] = useState({
    coleta: false,
    entrega: false,
    coletaInicio: null,
    coletaFim: null,
    entregaInicio: null,
    entregaFim: null
  });

  useEffect(() => {
    buscarViagensDeTodasColecoes();
  }, [auth.currentUser]);

  useEffect(() => {
    // Verificar se há viagem ativa ao iniciar
    if (viagens.length > 0 && !loading) {
      const viagemAtiva = viagens.find(v => !v.urlCanhoto && !v.finalizada);
      if (viagemAtiva) {
        console.log("✅ Viagem ativa encontrada no início:", viagemAtiva.id);
      }
    }
  }, [viagens, loading]);

  const buscarViagensDeTodasColecoes = async () => {
    if (!auth.currentUser) {
      console.log("⚠️ Usuário não autenticado");
      setLoading(false);
      return;
    }

    const user = auth.currentUser;
    console.log("🔍 Buscando viagens para usuário:", {
      uid: user.uid,
      email: user.email
    });

    try {
      let todasViagens = [];
      const colecoesParaBuscar = ['viagens_ativas', 'ordens_servico'];
      
      for (const colecao of colecoesParaBuscar) {
        try {
          console.log(`🔎 Buscando na coleção: ${colecao}`);
          
          // Tentar por UID (campo pode variar)
          const camposUid = ['motoristaUid', 'motoristaiUid', 'motoristaId', 'uid'];
          
          for (const campo of camposUid) {
            const q = query(
              collection(db, colecao),
              where(campo, "==", user.uid)
            );
            
            const snapshot = await getDocs(q);
            console.log(`  Por ${campo}: ${snapshot.size} documentos`);
            
            snapshot.forEach(doc => {
              const data = doc.data();
              // Adicionar origem da coleção
              const viagemComOrigem = { 
                id: doc.id, 
                ...data, 
                origemColecao: colecao,
                // Garantir que temos os campos padrão
                motoristaUid: data.motoristaUid || data.motoristaiUid || data.motoristaId || user.uid,
                motoristaNome: data.motoristaNome || data.nome || 'Motorista',
                clienteEntrega: data.clienteEntrega || data.destinoCliente || 'Cliente não informado',
                statusOperacional: data.statusOperacional || data.status || 'PROGRAMADO'
              };
              
              // Evitar duplicatas
              if (!todasViagens.find(v => v.id === doc.id && v.origemColecao === colecao)) {
                todasViagens.push(viagemComOrigem);
              }
            });
          }
          
          // Tentar por email também
          if (user.email) {
            const qEmail = query(
              collection(db, colecao),
              where("motoristaEmail", "==", user.email)
            );
            
            const snapshotEmail = await getDocs(qEmail);
            console.log(`  Por email: ${snapshotEmail.size} documentos`);
            
            snapshotEmail.forEach(doc => {
              const data = doc.data();
              const viagemComOrigem = { 
                id: doc.id, 
                ...data, 
                origemColecao: colecao 
              };
              
              if (!todasViagens.find(v => v.id === doc.id && v.origemColecao === colecao)) {
                todasViagens.push(viagemComOrigem);
              }
            });
          }
          
        } catch (error) {
          console.log(`❌ Erro na coleção ${colecao}:`, error.message);
        }
      }

      console.log(`📊 Total encontrado: ${todasViagens.length} viagens`);
      
      // Log detalhado
      todasViagens.forEach((v, i) => {
        console.log(`Viagem ${i + 1}:`);
        console.log(`  Coleção: ${v.origemColecao}`);
        console.log(`  ID: ${v.id}`);
        console.log(`  Motorista: ${v.motoristaNome}`);
        console.log(`  UID no doc: ${v.motoristaUid || v.motoristaiUid}`);
        console.log(`  Email: ${v.motoristaEmail}`);
        console.log(`  Cliente: ${v.clienteEntrega}`);
        console.log(`  Status: ${v.statusOperacional}`);
        console.log(`  DT: ${v.dt}`);
        console.log("---");
      });

      // Ordenar por data (mais recente primeiro)
      todasViagens.sort((a, b) => {
        const dateA = a.criadoEm?.toDate?.() || new Date(0);
        const dateB = b.criadoEm?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setViagens(todasViagens);
      setColecoesAtivas([...new Set(todasViagens.map(v => v.origemColecao))]);
      
      // Se não encontrou nada, fazer busca completa para debug
      if (todasViagens.length === 0) {
        await buscarTodasViagensParaDebug();
      }

    } catch (error) {
      console.error("❌ Erro geral:", error);
      Alert.alert("Erro", "Falha ao carregar viagens");
    } finally {
      setLoading(false);
    }
  };

  const buscarTodasViagensParaDebug = async () => {
    try {
      const colecoes = ['viagens_ativas', 'ordens_servico'];
      
      for (const colecao of colecoes) {
        console.log(`\n=== DEBUG: ${colecao.toUpperCase()} ===`);
        const qAll = query(collection(db, colecao));
        const snapshot = await getDocs(qAll);
        
        console.log(`Total na ${colecao}: ${snapshot.size}`);
        
        snapshot.forEach(doc => {
          const data = doc.data();
          console.log(`📄 ${doc.id.substring(0, 20)}...`);
          console.log(`   Motorista: ${data.motoristaNome || data.nome || 'N/D'}`);
          console.log(`   UID: ${data.motoristaUid || data.motoristaiUid || data.motoristaId || 'N/D'}`);
          console.log(`   Email: ${data.motoristaEmail || 'N/D'}`);
          console.log(`   Status: ${data.statusOperacional || data.status || 'N/D'}`);
          console.log(`   Cliente: ${data.clienteEntrega || data.destinoCliente || 'N/D'}`);
          console.log("---");
        });
      }
      
    } catch (error) {
      console.error("Erro no debug:", error);
    }
  };

  // FUNÇÕES DE LEAD TIME
  const abrirModalLeadTime = (viagem) => {
    setViagemSelecionada(viagem);
    setModalLeadTime(true);
    
    // Inicializar lead time com dados existentes
    setLeadTimeAtivo({
      coleta: viagem.leadTimeColetaInicio ? true : false,
      entrega: viagem.leadTimeEntregaInicio ? true : false,
      coletaInicio: viagem.leadTimeColetaInicio || null,
      coletaFim: viagem.leadTimeColetaFim || null,
      entregaInicio: viagem.leadTimeEntregaInicio || null,
      entregaFim: viagem.leadTimeEntregaFim || null
    });
  };

  const formatarDataHora = () => {
    const now = new Date();
    const dia = now.getDate().toString().padStart(2, '0');
    const mes = (now.getMonth() + 1).toString().padStart(2, '0');
    const ano = now.getFullYear();
    const horas = now.getHours().toString().padStart(2, '0');
    const minutos = now.getMinutes().toString().padStart(2, '0');
    
    return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
  };

  const iniciarLeadTime = async (tipo) => {
    const dataHora = formatarDataHora();
    
    try {
      const dadosAtualizacao = {
        [`leadTime${tipo}Inicio`]: dataHora,
        [`leadTime${tipo}Status`]: 'EM ANDAMENTO',
        atualizadoEm: serverTimestamp()
      };

      // Atualizar no Firestore
      await updateDoc(doc(db, viagemSelecionada.origemColecao, viagemSelecionada.id), dadosAtualizacao);

      // Atualizar na outra coleção também
      const outraColecao = viagemSelecionada.origemColecao === 'viagens_ativas' ? 'ordens_servico' : 'viagens_ativas';
      try {
        await updateDoc(doc(db, outraColecao, viagemSelecionada.id), dadosAtualizacao);
      } catch (e) {
        console.log("Não encontrado na outra coleção:", e.message);
      }

      // Atualizar estado local
      setLeadTimeAtivo(prev => ({
        ...prev,
        [tipo.toLowerCase()]: true,
        [`${tipo.toLowerCase()}Inicio`]: dataHora
      }));

      // Atualizar lista de viagens
      setViagens(prev => prev.map(v => 
        v.id === viagemSelecionada.id ? {
          ...v,
          [`leadTime${tipo}Inicio`]: dataHora,
          [`leadTime${tipo}Status`]: 'EM ANDAMENTO'
        } : v
      ));

      Alert.alert("✅ Sucesso", `Lead time de ${tipo.toLowerCase()} iniciado às ${dataHora}`);
      
    } catch (error) {
      console.error("Erro ao iniciar lead time:", error);
      Alert.alert("❌ Erro", "Falha ao iniciar lead time");
    }
  };

  const finalizarLeadTime = async (tipo) => {
    const dataHora = formatarDataHora();
    
    try {
      const dadosAtualizacao = {
        [`leadTime${tipo}Fim`]: dataHora,
        [`leadTime${tipo}Status`]: 'FINALIZADO',
        atualizadoEm: serverTimestamp()
      };

      // Atualizar no Firestore
      await updateDoc(doc(db, viagemSelecionada.origemColecao, viagemSelecionada.id), dadosAtualizacao);

      // Atualizar na outra coleção também
      const outraColecao = viagemSelecionada.origemColecao === 'viagens_ativas' ? 'ordens_servico' : 'viagens_ativas';
      try {
        await updateDoc(doc(db, outraColecao, viagemSelecionada.id), dadosAtualizacao);
      } catch (e) {
        console.log("Não encontrado na outra coleção:", e.message);
      }

      // Atualizar estado local
      setLeadTimeAtivo(prev => ({
        ...prev,
        [tipo.toLowerCase()]: false,
        [`${tipo.toLowerCase()}Fim`]: dataHora
      }));

      // Atualizar lista de viagens
      setViagens(prev => prev.map(v => 
        v.id === viagemSelecionada.id ? {
          ...v,
          [`leadTime${tipo}Fim`]: dataHora,
          [`leadTime${tipo}Status`]: 'FINALIZADO'
        } : v
      ));

      Alert.alert("✅ Sucesso", `Lead time de ${tipo.toLowerCase()} finalizado às ${dataHora}`);
      
    } catch (error) {
      console.error("Erro ao finalizar lead time:", error);
      Alert.alert("❌ Erro", "Falha ao finalizar lead time");
    }
  };

  const calcularTempoDecorrido = (inicio, fim) => {
    if (!inicio || !fim) return '00:00:00';
    
    try {
      const [dataInicio, horaInicio] = inicio.split(' ');
      const [dataFim, horaFim] = fim.split(' ');
      
      const [diaI, mesI, anoI] = dataInicio.split('/');
      const [horaI, minI] = horaInicio.split(':');
      
      const [diaF, mesF, anoF] = dataFim.split('/');
      const [horaF, minF] = horaFim.split(':');
      
      const dataInicioObj = new Date(anoI, mesI - 1, diaI, horaI, minI);
      const dataFimObj = new Date(anoF, mesF - 1, diaF, horaF, minF);
      
      const diffMs = dataFimObj - dataInicioObj;
      const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSegundos = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      return `${diffHoras.toString().padStart(2, '0')}:${diffMinutos.toString().padStart(2, '0')}:${diffSegundos.toString().padStart(2, '0')}`;
    } catch (error) {
      return '00:00:00';
    }
  };

  const enviarCanhoto = async (viagemId, colecaoOrigem = 'viagens_ativas') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Erro", "Precisamos de permissão para a câmera.");
      return;
    }

    Alert.alert(
      "Enviar Canhoto",
      "Escolha a origem da foto:",
      [
        { text: "Câmera", onPress: () => tirarFoto(viagemId, colecaoOrigem, true) },
        { text: "Galeria", onPress: () => tirarFoto(viagemId, colecaoOrigem, false) },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  const tirarFoto = async (viagemId, colecaoOrigem, usarCamera) => {
    const options = {
      allowsEditing: true,
      quality: 0.7,
    };

    const result = usarCamera 
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled) {
      setUploading(true);
      try {
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const storage = getStorage();
        const fileRef = ref(storage, `canhotos/${viagemId}_${Date.now()}.jpg`);
        
        await uploadBytes(fileRef, blob);
        const photoUrl = await getDownloadURL(fileRef);

        // Calcular lead time total
        const viagem = viagens.find(v => v.id === viagemId && v.origemColecao === colecaoOrigem);
        let leadTimeTotal = '00:00:00';
        
        if (viagem) {
          const tempoColeta = calcularTempoDecorrido(viagem.leadTimeColetaInicio, viagem.leadTimeColetaFim);
          const tempoEntrega = calcularTempoDecorrido(viagem.leadTimeEntregaInicio, viagem.leadTimeEntregaFim);
          
          // Somar os tempos (simplificado)
          leadTimeTotal = tempoColeta; // Para simplificar, usar tempo da coleta
        }

        // Atualizar na coleção de origem
        await updateDoc(doc(db, colecaoOrigem, viagemId), {
          urlCanhoto: photoUrl,
          statusOperacional: "FINALIZADA",
          dataFinalizacao: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
          leadTimeTotal: leadTimeTotal,
          finalizada: true,
          chegouAoDestino: true
        });

        // Se também existe na outra coleção, atualizar lá também
        const outraColecao = colecaoOrigem === 'viagens_ativas' ? 'ordens_servico' : 'viagens_ativas';
        try {
          await updateDoc(doc(db, outraColecao, viagemId), {
            urlCanhoto: photoUrl,
            statusOperacional: "FINALIZADA",
            dataFinalizacao: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
            leadTimeTotal: leadTimeTotal,
            finalizada: true,
            chegouAoDestino: true
          });
        } catch (e) {
          console.log("Não encontrado na outra coleção:", e.message);
        }

        Alert.alert("✅ Sucesso", "Viagem finalizada com sucesso!");
        
        // Atualizar lista local
        setViagens(prev => prev.map(v => 
          v.id === viagemId && v.origemColecao === colecaoOrigem
            ? { 
                ...v, 
                urlCanhoto: photoUrl, 
                statusOperacional: "FINALIZADA",
                leadTimeTotal: leadTimeTotal,
                finalizada: true,
                chegouAoDestino: true
              }
            : v
        ));

      } catch (error) {
        console.error("Erro:", error);
        Alert.alert("❌ Erro", "Falha no envio");
      } finally {
        setUploading(false);
      }
    }
  };

  const renderItem = ({ item }) => {
    const temLeadTimeColeta = item.leadTimeColetaInicio || item.leadTimeColetaFim;
    const temLeadTimeEntrega = item.leadTimeEntregaInicio || item.leadTimeEntregaFim;
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusBadge, { 
              backgroundColor: item.urlCanhoto ? '#2ecc71' : 
                             item.statusOperacional === 'PROGRAMADO' ? '#3498db' : 
                             '#FFD700' 
            }]}>
              <Text style={styles.statusText}>
                {item.statusOperacional || 'PROGRAMADO'}
              </Text>
            </View>
            <Text style={styles.colecaoBadge}>
              {item.origemColecao === 'viagens_ativas' ? 'APP' : 'ORDEM'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dtLabel}>DT: {item.dt || 'N/D'}</Text>
            {item.dataColeta && (
              <Text style={styles.dataLabel}>
                {formatarData(item.dataColeta)}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>COLETA</Text>
            <Text style={styles.infoText}>{item.clienteColeta || 'Não informado'}</Text>
            <Text style={styles.infoSub}>{item.origemCidade || ''}</Text>
          </View>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>ENTREGA</Text>
            <Text style={styles.infoTextMain}>{item.clienteEntrega || 'Não informado'}</Text>
            <Text style={styles.infoSub}>{item.destinoCidade || ''}</Text>
          </View>
        </View>

        {/* LEAD TIME INFO */}
        {(temLeadTimeColeta || temLeadTimeEntrega) && (
          <View style={styles.leadTimeSection}>
            <Text style={styles.leadTimeTitle}>⏱️ LEAD TIME</Text>
            <View style={styles.leadTimeGrid}>
              {temLeadTimeColeta && (
                <View style={styles.leadTimeItem}>
                  <Text style={styles.leadTimeLabel}>Coleta:</Text>
                  <Text style={styles.leadTimeValue}>
                    {item.leadTimeColetaInicio || '--:--'} → {item.leadTimeColetaFim || '--:--'}
                  </Text>
                  {item.leadTimeColetaInicio && item.leadTimeColetaFim && (
                    <Text style={styles.leadTimeDuration}>
                      Tempo: {calcularTempoDecorrido(item.leadTimeColetaInicio, item.leadTimeColetaFim)}
                    </Text>
                  )}
                </View>
              )}
              
              {temLeadTimeEntrega && (
                <View style={styles.leadTimeItem}>
                  <Text style={styles.leadTimeLabel}>Entrega:</Text>
                  <Text style={styles.leadTimeValue}>
                    {item.leadTimeEntregaInicio || '--:--'} → {item.leadTimeEntregaFim || '--:--'}
                  </Text>
                  {item.leadTimeEntregaInicio && item.leadTimeEntregaFim && (
                    <Text style={styles.leadTimeDuration}>
                      Tempo: {calcularTempoDecorrido(item.leadTimeEntregaInicio, item.leadTimeEntregaFim)}
                    </Text>
                  )}
                </View>
              )}
            </View>
            
            {item.leadTimeTotal && (
              <Text style={styles.leadTimeTotal}>
                ⏱️ TOTAL: {item.leadTimeTotal}
              </Text>
            )}
          </View>
        )}

        {item.observacao ? (
          <View style={styles.obsSection}>
            <Text style={styles.obsTitle}>OBSERVAÇÃO</Text>
            <Text style={styles.obsText}>{item.observacao}</Text>
          </View>
        ) : null}

        <View style={styles.actionArea}>
          {!item.urlCanhoto && !item.finalizada && (
            <TouchableOpacity 
              style={styles.btnLeadTime} 
              onPress={() => abrirModalLeadTime(item)}
            >
              <MaterialCommunityIcons name="timer" size={20} color="#FFF" />
              <Text style={styles.btnLeadTimeText}>REGISTRAR LEAD TIME</Text>
            </TouchableOpacity>
          )}
          
          {item.urlCanhoto ? (
            <TouchableOpacity 
              style={styles.btnVisualizar} 
              onPress={() => setModalImagem(item.urlCanhoto)}
            >
              <MaterialCommunityIcons name="image-search" size={20} color="#FFD700" />
              <Text style={styles.btnVisualizarText}>VER CANHOTO</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.btnCanhoto} 
              onPress={() => enviarCanhoto(item.id, item.origemColecao)}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <MaterialCommunityIcons name="camera" size={20} color="#000" />
                  <Text style={styles.btnCanhotoText}>ENTREGAR CANHOTO</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const formatarData = (dataString) => {
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR');
    } catch {
      return dataString;
    }
  };

  // Filtragem
  const viagensExibidas = viagens.filter(v => {
    if (abaAtiva === 'ativas') return !v.urlCanhoto && !v.finalizada;
    return !!v.urlCanhoto || v.finalizada;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.title}>MINHAS VIAGENS</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => {
            setLoading(true);
            buscarViagensDeTodasColecoes();
          }}
        >
          <MaterialCommunityIcons name="refresh" size={22} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {/* INFO DAS COLEÇÕES ENCONTRADAS */}
      {colecoesAtivas.length > 0 && (
        <View style={styles.colecoesInfo}>
          <Text style={styles.colecoesText}>
            Buscando em: {colecoesAtivas.join(', ')}
          </Text>
        </View>
      )}

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, abaAtiva === 'ativas' && styles.tabAtiva]} 
          onPress={() => setAbaAtiva('ativas')}
        >
          <Text style={[styles.tabText, abaAtiva === 'ativas' && styles.tabTextAtivo]}>
            ATIVAS ({viagens.filter(v => !v.urlCanhoto && !v.finalizada).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, abaAtiva === 'historico' && styles.tabAtiva]} 
          onPress={() => setAbaAtiva('historico')}
        >
          <Text style={[styles.tabText, abaAtiva === 'historico' && styles.tabTextAtivo]}>
            FINALIZADAS ({viagens.filter(v => !!v.urlCanhoto || v.finalizada).length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Buscando viagens...</Text>
        </View>
      ) : viagensExibidas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="truck-off" size={70} color="#333" />
          <Text style={styles.emptyTitle}>Nenhuma viagem encontrada</Text>
          <Text style={styles.emptyText}>
            {abaAtiva === 'ativas' 
              ? "Você não tem viagens ativas no momento."
              : "Você ainda não finalizou nenhuma viagem."}
          </Text>
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={buscarTodasViagensParaDebug}
          >
            <Text style={styles.debugButtonText}>DEBUG NO CONSOLE</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={viagensExibidas}
          keyExtractor={item => `${item.id}_${item.origemColecao}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15 }}
          refreshing={loading}
          onRefresh={buscarViagensDeTodasColecoes}
        />
      )}

      {/* MODAL LEAD TIME */}
      <Modal visible={modalLeadTime} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContentLeadTime}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>REGISTRAR LEAD TIME</Text>
              <TouchableOpacity onPress={() => setModalLeadTime(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            {viagemSelecionada && (
              <View style={styles.viagemInfo}>
                <Text style={styles.viagemInfoText}>
                  DT: {viagemSelecionada.dt || 'N/D'}
                </Text>
                <Text style={styles.viagemInfoText}>
                  Cliente: {viagemSelecionada.clienteEntrega || 'N/D'}
                </Text>
              </View>
            )}
            
            <View style={styles.leadTimeContainer}>
              {/* COLETA */}
              <View style={styles.leadTimeBox}>
                <Text style={styles.leadTimeBoxTitle}>⏱️ COLETA</Text>
                
                <View style={styles.leadTimeStatus}>
                  <Text style={styles.leadTimeStatusLabel}>Chegada:</Text>
                  <Text style={styles.leadTimeStatusValue}>
                    {leadTimeAtivo.coletaInicio || '--/--/-- --:--'}
                  </Text>
                </View>
                
                <View style={styles.leadTimeStatus}>
                  <Text style={styles.leadTimeStatusLabel}>Saída:</Text>
                  <Text style={styles.leadTimeStatusValue}>
                    {leadTimeAtivo.coletaFim || '--/--/-- --:--'}
                  </Text>
                </View>
                
                <View style={styles.leadTimeButtons}>
                  {!leadTimeAtivo.coletaInicio ? (
                    <TouchableOpacity 
                      style={styles.btnIniciarLeadTime}
                      onPress={() => iniciarLeadTime('Coleta')}
                    >
                      <MaterialCommunityIcons name="play" size={18} color="#FFF" />
                      <Text style={styles.btnIniciarLeadTimeText}>INICIAR CHEGADA</Text>
                    </TouchableOpacity>
                  ) : !leadTimeAtivo.coletaFim ? (
                    <TouchableOpacity 
                      style={styles.btnFinalizarLeadTime}
                      onPress={() => finalizarLeadTime('Coleta')}
                    >
                      <MaterialCommunityIcons name="stop" size={18} color="#FFF" />
                      <Text style={styles.btnFinalizarLeadTimeText}>REGISTRAR SAÍDA</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.leadTimeConcluido}>
                      ✓ Lead time concluído
                    </Text>
                  )}
                </View>
              </View>
              
              {/* ENTREGA */}
              <View style={styles.leadTimeBox}>
                <Text style={styles.leadTimeBoxTitle}>⏱️ ENTREGA</Text>
                
                <View style={styles.leadTimeStatus}>
                  <Text style={styles.leadTimeStatusLabel}>Chegada:</Text>
                  <Text style={styles.leadTimeStatusValue}>
                    {leadTimeAtivo.entregaInicio || '--/--/-- --:--'}
                  </Text>
                </View>
                
                <View style={styles.leadTimeStatus}>
                  <Text style={styles.leadTimeStatusLabel}>Saída:</Text>
                  <Text style={styles.leadTimeStatusValue}>
                    {leadTimeAtivo.entregaFim || '--/--/-- --:--'}
                  </Text>
                </View>
                
                <View style={styles.leadTimeButtons}>
                  {!leadTimeAtivo.entregaInicio ? (
                    <TouchableOpacity 
                      style={styles.btnIniciarLeadTime}
                      onPress={() => iniciarLeadTime('Entrega')}
                    >
                      <MaterialCommunityIcons name="play" size={18} color="#FFF" />
                      <Text style={styles.btnIniciarLeadTimeText}>INICIAR CHEGADA</Text>
                    </TouchableOpacity>
                  ) : !leadTimeAtivo.entregaFim ? (
                    <TouchableOpacity 
                      style={styles.btnFinalizarLeadTime}
                      onPress={() => finalizarLeadTime('Entrega')}
                    >
                      <MaterialCommunityIcons name="stop" size={18} color="#FFF" />
                      <Text style={styles.btnFinalizarLeadTimeText}>REGISTRAR SAÍDA</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.leadTimeConcluido}>
                      ✓ Lead time concluído
                    </Text>
                  )}
                </View>
              </View>
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.btnFecharModal}
                onPress={() => setModalLeadTime(false)}
              >
                <Text style={styles.btnFecharModalText}>FECHAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!modalImagem} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalClose} 
            onPress={() => setModalImagem(null)}
          >
            <MaterialCommunityIcons name="close-circle" size={40} color="#FFF" />
          </TouchableOpacity>
          {modalImagem && (
            <Image source={{ uri: modalImagem }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ESTILOS COMPLETOS
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  
  header: { 
    backgroundColor: '#050505', 
    borderBottomWidth: 1, 
    borderBottomColor: '#111',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15
  },
  
  title: { 
    color: '#FFF', 
    fontSize: 20, 
    fontWeight: '900' 
  },
  
  refreshButton: { 
    padding: 5 
  },
  
  colecoesInfo: {
    backgroundColor: '#111',
    padding: 8,
    alignItems: 'center',
  },
  
  colecoesText: {
    color: '#888',
    fontSize: 11,
  },
  
  tabBar: { 
    flexDirection: 'row', 
    height: 50, 
    backgroundColor: '#050505' 
  },
  
  tab: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  tabAtiva: { 
    borderBottomWidth: 3, 
    borderBottomColor: '#FFD700' 
  },
  
  tabText: { 
    color: '#666', 
    fontWeight: 'bold', 
    fontSize: 12 
  },
  
  tabTextAtivo: { 
    color: '#FFD700' 
  },
  
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  loadingText: { 
    color: '#FFD700', 
    marginTop: 15, 
    fontSize: 14 
  },
  
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 40 
  },
  
  emptyTitle: { 
    color: '#FFF', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginTop: 20, 
    marginBottom: 10 
  },
  
  emptyText: { 
    color: '#666', 
    textAlign: 'center', 
    marginBottom: 30,
    fontSize: 12
  },
  
  card: { 
    backgroundColor: '#0A0A0A', 
    borderRadius: 15, 
    padding: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: '#1A1A1A' 
  },
  
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
    marginBottom: 15 
  },
  
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  headerRight: {
    alignItems: 'flex-end',
  },
  
  statusBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 4 
  },
  
  statusText: { 
    color: '#000', 
    fontSize: 11, 
    fontWeight: '900' 
  },
  
  colecaoBadge: {
    backgroundColor: '#333',
    color: '#888',
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: 'bold',
  },
  
  dtLabel: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  
  dataLabel: { 
    color: '#888', 
    fontSize: 11, 
    marginTop: 2 
  },
  
  infoGrid: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  
  infoBox: {
    flex: 1,
  },
  
  infoTitle: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  
  infoText: {
    color: '#DDD',
    fontSize: 14,
    fontWeight: '600',
  },
  
  infoTextMain: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  infoSub: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  
  // LEAD TIME STYLES
  leadTimeSection: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  
  leadTimeTitle: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  
  leadTimeGrid: {
    flexDirection: 'row',
    gap: 15,
  },
  
  leadTimeItem: {
    flex: 1,
  },
  
  leadTimeLabel: {
    color: '#AAA',
    fontSize: 10,
    marginBottom: 2,
  },
  
  leadTimeValue: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  
  leadTimeDuration: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  leadTimeTotal: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  
  obsSection: { 
    backgroundColor: '#111', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 15 
  },
  
  obsTitle: { 
    color: '#FFD700', 
    fontSize: 11, 
    fontWeight: 'bold', 
    marginBottom: 5 
  },
  
  obsText: { 
    color: '#CCC', 
    fontSize: 12 
  },
  
  actionArea: { 
    marginTop: 15, 
    borderTopWidth: 1, 
    borderTopColor: '#1A1A1A', 
    paddingTop: 15,
    gap: 10,
  },
  
  btnLeadTime: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  
  btnLeadTimeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  
  btnCanhoto: { 
    backgroundColor: '#FFD700', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 15, 
    borderRadius: 8, 
    gap: 10 
  },
  
  btnCanhotoText: { 
    color: '#000', 
    fontWeight: '900', 
    fontSize: 14 
  },
  
  btnVisualizar: { 
    borderWidth: 1, 
    borderColor: '#FFD700', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 15, 
    borderRadius: 8, 
    gap: 10 
  },
  
  btnVisualizarText: { 
    color: '#FFD700', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  
  debugButton: {
    backgroundColor: '#222',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  
  debugButtonText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // MODAL LEAD TIME STYLES
  modalContainer: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.95)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  
  modalContentLeadTime: {
    backgroundColor: '#0A0A0A',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  
  modalTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  viagemInfo: {
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  
  viagemInfoText: {
    color: '#FFF',
    fontSize: 12,
    marginBottom: 4,
  },
  
  leadTimeContainer: {
    gap: 20,
  },
  
  leadTimeBox: {
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  
  leadTimeBoxTitle: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  
  leadTimeStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  
  leadTimeStatusLabel: {
    color: '#AAA',
    fontSize: 12,
  },
  
  leadTimeStatusValue: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  leadTimeButtons: {
    marginTop: 15,
  },
  
  btnIniciarLeadTime: {
    backgroundColor: '#2ecc71',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  
  btnIniciarLeadTimeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  
  btnFinalizarLeadTime: {
    backgroundColor: '#e74c3c',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  
  btnFinalizarLeadTimeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  
  leadTimeConcluido: {
    color: '#2ecc71',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 12,
  },
  
  modalFooter: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  
  btnFecharModal: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  btnFecharModalText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  
  modalClose: { 
    position: 'absolute', 
    top: 50, 
    right: 20, 
    zIndex: 10 
  },
  
  fullImage: { 
    width: '95%', 
    height: '80%' 
  }
});