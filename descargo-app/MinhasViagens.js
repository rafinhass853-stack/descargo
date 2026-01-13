// MinhasViagens.js - VERSÃO CORRIGIDA (sem expo-camera)
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, 
  SafeAreaView, StatusBar, TouchableOpacity, Alert, Image, Modal,
  ScrollView, TextInput, Dimensions, Platform
} from 'react-native';
import { collection, query, onSnapshot, doc, updateDoc, where, getDocs, serverTimestamp, addDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const { width, height } = Dimensions.get('window');

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

  // ESTADOS PARA UPLOAD MULTIPLO
  const [modalUpload, setModalUpload] = useState(false);
  const [viagemParaUpload, setViagemParaUpload] = useState(null);
  const [fotosSelecionadas, setFotosSelecionadas] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // NOVO: MODAL PARA VER/EDITAR DOCUMENTOS DE VIAGENS FINALIZADAS
  const [modalDocumentos, setModalDocumentos] = useState(false);
  const [viagemDocumentos, setViagemDocumentos] = useState(null);
  const [editandoObservacoes, setEditandoObservacoes] = useState(false);
  const [novaObservacao, setNovaObservacao] = useState('');

  // ESTADO PARA OTIMIZAÇÃO DE CAMERA
  const [processandoCamera, setProcessandoCamera] = useState(false);
  const [qualidadeCamera] = useState(0.7); // Reduz qualidade para performance

  useEffect(() => {
    buscarViagensDeTodasColecoes();
    // Solicitar permissões no início
    solicitarPermissoes();
  }, [auth.currentUser]);

  const solicitarPermissoes = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissões necessárias',
        'Precisamos das permissões da câmera e galeria para tirar fotos dos documentos.',
        [{ text: 'OK' }]
      );
    }
  };

  useEffect(() => {
    // Configurar listener para atualizações em tempo real apenas para viagens ativas
    if (auth.currentUser && viagens.some(v => !v.finalizada)) {
      const unsubscribe = onSnapshot(
        query(collection(db, 'viagens_ativas'), where('motoristaUid', '==', auth.currentUser.uid)),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'modified') {
              setViagens(prev => prev.map(v => 
                v.id === change.doc.id ? { ...v, ...change.doc.data() } : v
              ));
            }
          });
        }
      );
      return () => unsubscribe();
    }
  }, [auth.currentUser, viagens]);

  const buscarViagensDeTodasColecoes = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const user = auth.currentUser;
    setLoading(true);

    try {
      let todasViagens = [];
      const colecoesParaBuscar = ['viagens_ativas', 'ordens_servico'];
      
      // Busca otimizada com Promise.all
      const promises = colecoesParaBuscar.map(async (colecao) => {
        try {
          const q = query(
            collection(db, colecao),
            where('motoristaUid', '==', user.uid)
          );
          const snapshot = await getDocs(q);
          
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            origemColecao: colecao
          }));
        } catch (error) {
          console.log(`Erro na coleção ${colecao}:`, error.message);
          return [];
        }
      });

      const resultados = await Promise.all(promises);
      todasViagens = resultados.flat();

      // Ordenar por status (ativas primeiro) e data
      todasViagens.sort((a, b) => {
        // Viagens não finalizadas primeiro
        if (!a.finalizada && b.finalizada) return -1;
        if (a.finalizada && !b.finalizada) return 1;
        
        // Depois por data
        const dateA = a.criadoEm?.toDate?.() || new Date(0);
        const dateB = b.criadoEm?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setViagens(todasViagens);
      setColecoesAtivas([...new Set(todasViagens.map(v => v.origemColecao))]);

    } catch (error) {
      console.error("Erro ao carregar viagens:", error);
      Alert.alert("Erro", "Falha ao carregar viagens");
    } finally {
      setLoading(false);
    }
  };

  // NOVA FUNÇÃO: ABRIR DOCUMENTOS DE VIAGEM FINALIZADA
  const abrirDocumentosViagem = (viagem) => {
    setViagemDocumentos(viagem);
    setNovaObservacao(viagem.observacoesMotorista || '');
    setModalDocumentos(true);
  };

  // NOVA FUNÇÃO: SALVAR OBSERVAÇÃO EDITADA
  const salvarObservacaoEditada = async () => {
    if (!viagemDocumentos) return;

    try {
      const dadosAtualizacao = {
        observacoesMotorista: novaObservacao,
        atualizadoEm: serverTimestamp()
      };

      await updateDoc(doc(db, viagemDocumentos.origemColecao, viagemDocumentos.id), dadosAtualizacao);

      // Atualizar na outra coleção
      const outraColecao = viagemDocumentos.origemColecao === 'viagens_ativas' ? 'ordens_servico' : 'viagens_ativas';
      try {
        await updateDoc(doc(db, outraColecao, viagemDocumentos.id), dadosAtualizacao);
      } catch (e) {
        console.log("Não encontrado na outra coleção");
      }

      // Atualizar estado local
      setViagens(prev => prev.map(v => 
        v.id === viagemDocumentos.id && v.origemColecao === viagemDocumentos.origemColecao
          ? { ...v, observacoesMotorista: novaObservacao }
          : v
      ));

      setViagemDocumentos(prev => ({ ...prev, observacoesMotorista: novaObservacao }));
      setEditandoObservacoes(false);
      Alert.alert("✅ Sucesso", "Observação atualizada!");
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      Alert.alert("❌ Erro", "Falha ao salvar observação");
    }
  };

  // FUNÇÕES DE LEAD TIME
  const abrirModalLeadTime = (viagem) => {
    setViagemSelecionada(viagem);
    setModalLeadTime(true);
    
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

      await updateDoc(doc(db, viagemSelecionada.origemColecao, viagemSelecionada.id), dadosAtualizacao);

      // Atualizar estado local
      setLeadTimeAtivo(prev => ({
        ...prev,
        [tipo.toLowerCase()]: true,
        [`${tipo.toLowerCase()}Inicio`]: dataHora
      }));

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

      await updateDoc(doc(db, viagemSelecionada.origemColecao, viagemSelecionada.id), dadosAtualizacao);

      // Atualizar estado local
      setLeadTimeAtivo(prev => ({
        ...prev,
        [tipo.toLowerCase()]: false,
        [`${tipo.toLowerCase()}Fim`]: dataHora
      }));

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

  // FUNÇÃO PARA ENVIAR CANHOTO
  const enviarCanhoto = async (viagem) => {
    setViagemParaUpload(viagem);
    setModalUpload(true);
    setFotosSelecionadas([]);
    setObservacoes('');
  };

  // FUNÇÃO OTIMIZADA PARA ADICIONAR FOTOS
  const adicionarFotos = async (usarCamera = false) => {
    try {
      // Configurar opções otimizadas
      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: qualidadeCamera, // Qualidade reduzida para melhor performance
        base64: false,
        exif: false, // Desabilitar dados EXIF para performance
        allowsMultipleSelection: true,
        selectionLimit: 20, // Limite aumentado
      };

      setProcessandoCamera(true); // Indicador de processamento

      const result = usarCamera 
        ? await ImagePicker.launchCameraAsync({
            ...options,
            cameraType: ImagePicker.CameraType.back,
          })
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets) {
        const novasFotos = result.assets.map(asset => ({
          uri: asset.uri,
          nome: `foto_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`,
          tipo: 'image/jpeg',
          enviada: false,
          tamanho: asset.fileSize || 0
        }));
        
        setFotosSelecionadas(prev => [...prev, ...novasFotos]);
      }
    } catch (error) {
      console.error("Erro ao adicionar fotos:", error);
      Alert.alert("Erro", "Falha ao acessar a câmera ou galeria");
    } finally {
      setProcessandoCamera(false);
    }
  };

  // MODAL DE UPLOAD MULTIPLO OTIMIZADO
  const ModalUploadCanhoto = ({ visible, onClose, viagem, onFinalizar }) => {
    const [uploadingIndividual, setUploadingIndividual] = useState(false);
    const [fotosLocais, setFotosLocais] = useState(fotosSelecionadas);
    const [obsLocal, setObsLocal] = useState(observacoes);
    
    useEffect(() => {
      setFotosLocais(fotosSelecionadas);
    }, [fotosSelecionadas]);
    
    useEffect(() => {
      setObsLocal(observacoes);
    }, [observacoes]);

    const removerFoto = (index) => {
      const novasFotos = [...fotosLocais];
      novasFotos.splice(index, 1);
      setFotosLocais(novasFotos);
      setFotosSelecionadas(novasFotos);
    };

    const uploadFoto = async (foto, viagemId, index) => {
      try {
        const response = await fetch(foto.uri);
        const blob = await response.blob();
        const storage = getStorage();
        
        const fileName = `${viagemId}_${Date.now()}_${index}.jpg`;
        const fileRef = ref(storage, `canhotos/${fileName}`);
        
        await uploadBytes(fileRef, blob);
        const photoUrl = await getDownloadURL(fileRef);
        
        const fotosAtualizadas = [...fotosLocais];
        fotosAtualizadas[index] = { ...fotosAtualizadas[index], enviada: true, url: photoUrl };
        setFotosLocais(fotosAtualizadas);
        
        return photoUrl;
      } catch (error) {
        console.error("Erro upload foto:", error);
        throw error;
      }
    };

    const enviarTodasFotos = async () => {
      if (fotosLocais.length === 0) {
        Alert.alert("Atenção", "Adicione pelo menos uma foto.");
        return;
      }

      setUploadingIndividual(true);
      setUploadProgress(0);
      
      try {
        const urls = [];
        
        for (let i = 0; i < fotosLocais.length; i++) {
          const foto = fotosLocais[i];
          if (!foto.enviada) {
            const url = await uploadFoto(foto, viagem.id, i);
            urls.push(url);
          } else {
            urls.push(foto.url);
          }
          
          setUploadProgress(Math.round(((i + 1) / fotosLocais.length) * 100));
        }

        Alert.alert(
          "CONFIRMAR ENVIO",
          `Deseja enviar ${fotosLocais.length} documento(s)?`,
          [
            { text: "CANCELAR", style: "cancel" },
            { 
              text: "ENVIAR", 
              onPress: () => onFinalizar(urls, obsLocal)
            }
          ]
        );

      } catch (error) {
        console.error("Erro no upload:", error);
        Alert.alert("❌ Erro", "Falha no envio das fotos.");
      } finally {
        setUploadingIndividual(false);
      }
    };

    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalContainerUpload}>
          <View style={styles.modalContentUpload}>
            <View style={styles.modalHeaderUpload}>
              <Text style={styles.modalTitleUpload}>ENVIAR DOCUMENTOS</Text>
              <TouchableOpacity onPress={onClose} disabled={uploadingIndividual}>
                <MaterialCommunityIcons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollUpload} showsVerticalScrollIndicator={false}>
              <View style={styles.viagemInfoUpload}>
                <Text style={styles.viagemInfoTextUpload}>
                  DT: {viagem?.dt || 'N/D'} - {viagem?.clienteEntrega || 'N/D'}
                </Text>
                <Text style={styles.viagemInfoSubUpload}>
                  Tire fotos dos documentos necessários
                </Text>
              </View>

              {processandoCamera && (
                <View style={styles.cameraLentaOverlay}>
                  <ActivityIndicator size="large" color="#FFD700" />
                  <Text style={styles.cameraLentaText}>Processando...</Text>
                </View>
              )}

              <View style={styles.fotosCounter}>
                <MaterialCommunityIcons name="camera" size={20} color="#FFD700" />
                <Text style={styles.fotosCounterText}>
                  {fotosLocais.length} documento(s)
                </Text>
              </View>

              <View style={styles.botoesAdicionarContainer}>
                <TouchableOpacity 
                  style={[styles.btnAdicionarFoto, (uploadingIndividual || processandoCamera) && styles.btnDisabled]}
                  onPress={() => adicionarFotos(true)}
                  disabled={uploadingIndividual || processandoCamera}
                >
                  <MaterialCommunityIcons name="camera-plus" size={24} color="#FFF" />
                  <Text style={styles.btnAdicionarTexto}>TIRAR FOTO</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.btnAdicionarFoto, (uploadingIndividual || processandoCamera) && styles.btnDisabled]}
                  onPress={() => adicionarFotos(false)}
                  disabled={uploadingIndividual || processandoCamera}
                >
                  <MaterialCommunityIcons name="image-multiple" size={24} color="#FFF" />
                  <Text style={styles.btnAdicionarTexto}>GALERIA</Text>
                </TouchableOpacity>
              </View>

              {uploadingIndividual && (
                <View style={styles.uploadProgressContainer}>
                  <Text style={styles.uploadProgressText}>
                    Enviando: {uploadProgress}%
                  </Text>
                  <View style={styles.uploadProgressBar}>
                    <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                </View>
              )}

              {fotosLocais.length > 0 && (
                <View style={styles.fotosListaContainer}>
                  <Text style={styles.fotosListaTitulo}>DOCUMENTOS SELECIONADOS:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.fotosLista}>
                      {fotosLocais.map((foto, index) => (
                        <View key={index} style={styles.fotoItem}>
                          <Image 
                            source={{ uri: foto.uri }} 
                            style={styles.fotoThumbnail} 
                            resizeMode="cover"
                          />
                          <View style={styles.fotoInfo}>
                            <Text style={styles.fotoNome}>
                              Doc {index + 1}
                            </Text>
                            <TouchableOpacity 
                              style={styles.btnRemoverFoto}
                              onPress={() => removerFoto(index)}
                              disabled={foto.enviada}
                            >
                              <MaterialCommunityIcons 
                                name={foto.enviada ? "check-circle" : "close-circle"} 
                                size={20} 
                                color={foto.enviada ? "#2ecc71" : "#e74c3c"} 
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              <View style={styles.observacoesContainer}>
                <Text style={styles.observacoesLabel}>Observações:</Text>
                <TextInput
                  style={styles.observacoesInput}
                  placeholder="Ex: Nota fiscal, devolução, problemas, etc."
                  placeholderTextColor="#666"
                  value={obsLocal}
                  onChangeText={setObsLocal}
                  multiline
                  numberOfLines={3}
                  editable={!uploadingIndividual}
                />
              </View>

              <View style={styles.legendaContainer}>
                <View style={styles.legendaItem}>
                  <MaterialCommunityIcons name="information" size={14} color="#FFD700" />
                  <Text style={styles.legendaText}>
                    Você pode adicionar até 20 documentos
                  </Text>
                </View>
                <View style={styles.legendaItem}>
                  <MaterialCommunityIcons name="information" size={14} color="#FFD700" />
                  <Text style={styles.legendaText}>
                    Toque na foto para visualizar
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActionsUpload}>
              <TouchableOpacity 
                style={[styles.btnCancelarUpload, uploadingIndividual && styles.btnDisabled]}
                onPress={onClose}
                disabled={uploadingIndividual}
              >
                <Text style={styles.btnCancelarUploadText}>CANCELAR</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.btnEnviarUpload, 
                  (fotosLocais.length === 0 || uploadingIndividual) && styles.btnEnviarDisabled
                ]}
                onPress={enviarTodasFotos}
                disabled={fotosLocais.length === 0 || uploadingIndividual}
              >
                {uploadingIndividual ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="cloud-upload" size={20} color="#000" />
                    <Text style={styles.btnEnviarUploadText}>
                      ENVIAR ({fotosLocais.length})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const finalizarViagemComFotos = async (urlsFotos, obs, viagem) => {
    try {
      const dadosAtualizacao = {
        urlCanhoto: urlsFotos[0],
        urlsCanhotos: urlsFotos,
        statusOperacional: "FINALIZADA",
        dataFinalizacao: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        finalizada: true,
        chegouAoDestino: true,
        observacoesMotorista: obs || '',
        quantidadeFotos: urlsFotos.length
      };

      await updateDoc(doc(db, viagem.origemColecao, viagem.id), dadosAtualizacao);

      // Salvar histórico de documentos
      await addDoc(collection(db, 'documentos_viagem'), {
        viagemId: viagem.id,
        motoristaUid: auth.currentUser.uid,
        motoristaNome: viagem.motoristaNome,
        tipo: 'CANHOTOS',
        urls: urlsFotos,
        quantidade: urlsFotos.length,
        observacoes: obs,
        dt: viagem.dt,
        cliente: viagem.clienteEntrega,
        dataEnvio: serverTimestamp(),
        status: 'ENVIADO'
      });

      Alert.alert("✅ Sucesso", `Viagem finalizada com ${urlsFotos.length} documento(s)!`);
      
      setViagens(prev => prev.map(v => 
        v.id === viagem.id && v.origemColecao === viagem.origemColecao
          ? { ...v, ...dadosAtualizacao }
          : v
      ));

      setModalUpload(false);
      setFotosSelecionadas([]);
      setObservacoes('');
      
    } catch (error) {
      console.error("Erro finalizar:", error);
      Alert.alert("❌ Erro", "Falha ao finalizar viagem.");
    }
  };

  // MODAL PARA VER/EDITAR DOCUMENTOS
  const ModalDocumentosViagem = ({ visible, viagem, onClose }) => {
    if (!viagem) return null;

    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalContainerDocumentos}>
          <View style={styles.modalContentDocumentos}>
            <View style={styles.modalHeaderDocumentos}>
              <Text style={styles.modalTitleDocumentos}>DOCUMENTOS DA VIAGEM</Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialCommunityIcons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.scrollDocumentos} showsVerticalScrollIndicator={false}>
              <View style={styles.infoViagemDocumentos}>
                <Text style={styles.infoTitleDocumentos}>DT: {viagem.dt || 'N/D'}</Text>
                <Text style={styles.infoTextDocumentos}>Cliente: {viagem.clienteEntrega || 'N/D'}</Text>
                <Text style={styles.infoSubDocumentos}>
                  Finalizada em: {viagem.dataFinalizacao ? 
                    new Date(viagem.dataFinalizacao).toLocaleDateString('pt-BR') : 
                    'Data não disponível'}
                </Text>
              </View>

              <View style={styles.sectionDocumentos}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="file-document" size={20} color="#FFD700" />
                  <Text style={styles.sectionTitle}>DOCUMENTOS ENVIADOS</Text>
                </View>
                
                {viagem.urlsCanhotos && viagem.urlsCanhotos.length > 0 ? (
                  <View style={styles.documentosGrid}>
                    {viagem.urlsCanhotos.map((url, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.documentoItem}
                        onPress={() => setModalImagem(url)}
                      >
                        <Image source={{ uri: url }} style={styles.documentoThumbnail} />
                        <Text style={styles.documentoNome}>Documento {index + 1}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : viagem.urlCanhoto ? (
                  <TouchableOpacity 
                    style={styles.documentoItem}
                    onPress={() => setModalImagem(viagem.urlCanhoto)}
                  >
                    <Image source={{ uri: viagem.urlCanhoto }} style={styles.documentoThumbnail} />
                    <Text style={styles.documentoNome}>Canhoto Principal</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.semDocumentos}>Nenhum documento enviado</Text>
                )}
              </View>

              <View style={styles.sectionDocumentos}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="lead-pencil" size={20} color="#FFD700" />
                  <Text style={styles.sectionTitle}>OBSERVAÇÕES</Text>
                  <TouchableOpacity 
                    style={styles.btnEditar}
                    onPress={() => setEditandoObservacoes(true)}
                  >
                    <MaterialCommunityIcons name="pencil" size={16} color="#FFD700" />
                  </TouchableOpacity>
                </View>
                
                {editandoObservacoes ? (
                  <View style={styles.editObservacoes}>
                    <TextInput
                      style={styles.inputObservacoes}
                      value={novaObservacao}
                      onChangeText={setNovaObservacao}
                      multiline
                      numberOfLines={4}
                      placeholder="Digite suas observações..."
                    />
                    <View style={styles.editButtons}>
                      <TouchableOpacity 
                        style={styles.btnCancelarEdit}
                        onPress={() => {
                          setEditandoObservacoes(false);
                          setNovaObservacao(viagem.observacoesMotorista || '');
                        }}
                      >
                        <Text style={styles.btnCancelarEditText}>CANCELAR</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.btnSalvarEdit}
                        onPress={salvarObservacaoEditada}
                      >
                        <Text style={styles.btnSalvarEditText}>SALVAR</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.observacoesText}>
                    {viagem.observacoesMotorista || 'Nenhuma observação registrada.'}
                  </Text>
                )}
              </View>

              {viagem.leadTimeColetaInicio && (
                <View style={styles.sectionDocumentos}>
                  <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons name="timer" size={20} color="#FFD700" />
                    <Text style={styles.sectionTitle}>LEAD TIME</Text>
                  </View>
                  <View style={styles.leadTimeInfo}>
                    <Text style={styles.leadTimeItemDoc}>
                      <Text style={styles.leadTimeLabelDoc}>Coleta:</Text> 
                      {viagem.leadTimeColetaInicio} → {viagem.leadTimeColetaFim || '--:--'}
                    </Text>
                    <Text style={styles.leadTimeItemDoc}>
                      <Text style={styles.leadTimeLabelDoc}>Entrega:</Text> 
                      {viagem.leadTimeEntregaInicio || '--:--'} → {viagem.leadTimeEntregaFim || '--:--'}
                    </Text>
                    {viagem.leadTimeTotal && (
                      <Text style={styles.leadTimeTotalDoc}>
                        Total: {viagem.leadTimeTotal}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderItem = ({ item }) => {
    const isFinalizada = item.finalizada || item.urlCanhoto;
    
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => isFinalizada && abrirDocumentosViagem(item)}
        activeOpacity={isFinalizada ? 0.7 : 1}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusBadge, { 
              backgroundColor: isFinalizada ? '#2ecc71' : 
                             item.statusOperacional === 'PROGRAMADO' ? '#3498db' : 
                             '#FFD700' 
            }]}>
              <Text style={styles.statusText}>
                {isFinalizada ? 'FINALIZADA' : item.statusOperacional || 'PROGRAMADO'}
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
        {(item.leadTimeColetaInicio || item.leadTimeEntregaInicio) && (
          <View style={styles.leadTimeSection}>
            <Text style={styles.leadTimeTitle}>⏱️ LEAD TIME</Text>
            <View style={styles.leadTimeGrid}>
              {item.leadTimeColetaInicio && (
                <View style={styles.leadTimeItem}>
                  <Text style={styles.leadTimeLabel}>Coleta:</Text>
                  <Text style={styles.leadTimeValue}>
                    {item.leadTimeColetaInicio} → {item.leadTimeColetaFim || '--:--'}
                  </Text>
                </View>
              )}
              
              {item.leadTimeEntregaInicio && (
                <View style={styles.leadTimeItem}>
                  <Text style={styles.leadTimeLabel}>Entrega:</Text>
                  <Text style={styles.leadTimeValue}>
                    {item.leadTimeEntregaInicio || '--:--'} → {item.leadTimeEntregaFim || '--:--'}
                  </Text>
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

        <View style={styles.actionArea}>
          {!isFinalizada ? (
            <>
              <TouchableOpacity 
                style={styles.btnLeadTime} 
                onPress={() => abrirModalLeadTime(item)}
              >
                <MaterialCommunityIcons name="timer" size={20} color="#FFF" />
                <Text style={styles.btnLeadTimeText}>REGISTRAR LEAD TIME</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.btnCanhoto} 
                onPress={() => enviarCanhoto(item)}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="camera" size={20} color="#000" />
                    <Text style={styles.btnCanhotoText}>ENVIAR DOCUMENTOS</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.btnVisualizar} 
              onPress={() => abrirDocumentosViagem(item)}
            >
              <MaterialCommunityIcons name="file-document-multiple" size={20} color="#FFD700" />
              <Text style={styles.btnVisualizarText}>VER DOCUMENTOS</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
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

  const viagensExibidas = viagens.filter(v => {
    if (abaAtiva === 'ativas') return !v.urlCanhoto && !v.finalizada;
    return !!v.urlCanhoto || v.finalizada;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <View style={styles.header}>
        <Text style={styles.title}>MINHAS VIAGENS</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => {
              setLoading(true);
              buscarViagensDeTodasColecoes();
            }}
          >
            <MaterialCommunityIcons name="refresh" size={22} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => Alert.alert(
              "Ajuda",
              "• Toque em uma viagem finalizada para ver documentos\n• Use REGISTRAR LEAD TIME para tempos\n• Tire fotos dos documentos para envio"
            )}
          >
            <MaterialCommunityIcons name="help-circle" size={22} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, abaAtiva === 'ativas' && styles.tabAtiva]} 
          onPress={() => setAbaAtiva('ativas')}
        >
          <MaterialCommunityIcons 
            name="truck-delivery" 
            size={20} 
            color={abaAtiva === 'ativas' ? '#FFD700' : '#666'} 
          />
          <Text style={[styles.tabText, abaAtiva === 'ativas' && styles.tabTextAtivo]}>
            ATIVAS ({viagens.filter(v => !v.urlCanhoto && !v.finalizada).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, abaAtiva === 'historico' && styles.tabAtiva]} 
          onPress={() => setAbaAtiva('historico')}
        >
          <MaterialCommunityIcons 
            name="check-circle" 
            size={20} 
            color={abaAtiva === 'historico' ? '#FFD700' : '#666'} 
          />
          <Text style={[styles.tabText, abaAtiva === 'historico' && styles.tabTextAtivo]}>
            FINALIZADAS ({viagens.filter(v => !!v.urlCanhoto || v.finalizada).length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Carregando viagens...</Text>
        </View>
      ) : viagensExibidas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons 
            name={abaAtiva === 'ativas' ? "truck-off" : "file-document"} 
            size={70} 
            color="#333" 
          />
          <Text style={styles.emptyTitle}>
            {abaAtiva === 'ativas' ? 'Nenhuma viagem ativa' : 'Nenhuma viagem finalizada'}
          </Text>
          <Text style={styles.emptyText}>
            {abaAtiva === 'ativas' 
              ? "Você não tem viagens em andamento no momento."
              : "Toque em uma viagem ativa para ver seus documentos."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={viagensExibidas}
          keyExtractor={item => `${item.id}_${item.origemColecao}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          windowSize={5}
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
                <View style={styles.leadTimeBoxHeader}>
                  <MaterialCommunityIcons name="package-variant" size={24} color="#FFD700" />
                  <Text style={styles.leadTimeBoxTitle}>COLETA</Text>
                </View>
                
                <View style={styles.leadTimeStatus}>
                  <Text style={styles.leadTimeStatusLabel}>Chegada:</Text>
                  <Text style={styles.leadTimeStatusValue}>
                    {leadTimeAtivo.coletaInicio || '--:--'}
                  </Text>
                </View>
                
                <View style={styles.leadTimeStatus}>
                  <Text style={styles.leadTimeStatusLabel}>Saída:</Text>
                  <Text style={styles.leadTimeStatusValue}>
                    {leadTimeAtivo.coletaFim || '--:--'}
                  </Text>
                </View>
                
                <View style={styles.leadTimeButtons}>
                  {!leadTimeAtivo.coletaInicio ? (
                    <TouchableOpacity 
                      style={styles.btnIniciarLeadTime}
                      onPress={() => iniciarLeadTime('Coleta')}
                    >
                      <MaterialCommunityIcons name="play-circle" size={20} color="#FFF" />
                      <Text style={styles.btnIniciarLeadTimeText}>INICIAR CHEGADA</Text>
                    </TouchableOpacity>
                  ) : !leadTimeAtivo.coletaFim ? (
                    <TouchableOpacity 
                      style={styles.btnFinalizarLeadTime}
                      onPress={() => finalizarLeadTime('Coleta')}
                    >
                      <MaterialCommunityIcons name="stop-circle" size={20} color="#FFF" />
                      <Text style={styles.btnFinalizarLeadTimeText}>REGISTRAR SAÍDA</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.leadTimeConcluido}>
                      <MaterialCommunityIcons name="check-circle" size={20} color="#2ecc71" />
                      <Text style={styles.leadTimeConcluidoText}>Concluído</Text>
                    </View>
                  )}
                </View>
              </View>
              
              {/* ENTREGA */}
              <View style={styles.leadTimeBox}>
                <View style={styles.leadTimeBoxHeader}>
                  <MaterialCommunityIcons name="truck-delivery" size={24} color="#FFD700" />
                  <Text style={styles.leadTimeBoxTitle}>ENTREGA</Text>
                </View>
                
                <View style={styles.leadTimeStatus}>
                  <Text style={styles.leadTimeStatusLabel}>Chegada:</Text>
                  <Text style={styles.leadTimeStatusValue}>
                    {leadTimeAtivo.entregaInicio || '--:--'}
                  </Text>
                </View>
                
                <View style={styles.leadTimeStatus}>
                  <Text style={styles.leadTimeStatusLabel}>Saída:</Text>
                  <Text style={styles.leadTimeStatusValue}>
                    {leadTimeAtivo.entregaFim || '--:--'}
                  </Text>
                </View>
                
                <View style={styles.leadTimeButtons}>
                  {!leadTimeAtivo.entregaInicio ? (
                    <TouchableOpacity 
                      style={styles.btnIniciarLeadTime}
                      onPress={() => iniciarLeadTime('Entrega')}
                    >
                      <MaterialCommunityIcons name="play-circle" size={20} color="#FFF" />
                      <Text style={styles.btnIniciarLeadTimeText}>INICIAR CHEGADA</Text>
                    </TouchableOpacity>
                  ) : !leadTimeAtivo.entregaFim ? (
                    <TouchableOpacity 
                      style={styles.btnFinalizarLeadTime}
                      onPress={() => finalizarLeadTime('Entrega')}
                    >
                      <MaterialCommunityIcons name="stop-circle" size={20} color="#FFF" />
                      <Text style={styles.btnFinalizarLeadTimeText}>REGISTRAR SAÍDA</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.leadTimeConcluido}>
                      <MaterialCommunityIcons name="check-circle" size={20} color="#2ecc71" />
                      <Text style={styles.leadTimeConcluidoText}>Concluído</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.btnFecharModal}
                onPress={() => setModalLeadTime(false)}
              >
                <Text style={styles.btnFecharModalText}>VOLTAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE UPLOAD */}
      <ModalUploadCanhoto
        visible={modalUpload}
        onClose={() => {
          setModalUpload(false);
          setFotosSelecionadas([]);
          setObservacoes('');
        }}
        viagem={viagemParaUpload}
        onFinalizar={(urls, obs) => {
          if (viagemParaUpload) {
            finalizarViagemComFotos(urls, obs, viagemParaUpload);
          }
        }}
      />

      {/* MODAL DE DOCUMENTOS */}
      <ModalDocumentosViagem
        visible={modalDocumentos}
        viagem={viagemDocumentos}
        onClose={() => {
          setModalDocumentos(false);
          setEditandoObservacoes(false);
          setNovaObservacao('');
        }}
      />

      {/* MODAL DE IMAGEM */}
      <Modal visible={!!modalImagem} transparent animationType="fade">
        <View style={styles.modalImagemContainer}>
          <TouchableOpacity 
            style={styles.modalImagemClose} 
            onPress={() => setModalImagem(null)}
          >
            <MaterialCommunityIcons name="close" size={30} color="#FFF" />
          </TouchableOpacity>
          {modalImagem && (
            <Image 
              source={{ uri: modalImagem }} 
              style={styles.fullImage} 
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ESTILOS OTIMIZADOS (mantém os mesmos estilos da versão anterior)
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 25 : 12,
  },
  
  title: { 
    color: '#FFF', 
    fontSize: 20, 
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  
  headerButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  
  headerButton: {
    padding: 5,
  },
  
  tabBar: { 
    flexDirection: 'row', 
    height: 50, 
    backgroundColor: '#050505',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  
  tab: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  
  tabAtiva: { 
    borderBottomWidth: 3, 
    borderBottomColor: '#FFD700' 
  },
  
  tabText: { 
    color: '#666', 
    fontWeight: '600', 
    fontSize: 12 
  },
  
  tabTextAtivo: { 
    color: '#FFD700',
    fontWeight: 'bold',
  },
  
  listContent: {
    padding: 10,
    paddingBottom: 20,
  },
  
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#000',
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
    padding: 40,
    backgroundColor: '#000',
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
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  
  card: { 
    backgroundColor: '#0A0A0A', 
    borderRadius: 12, 
    padding: 15, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#1A1A1A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
    marginBottom: 12,
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
    paddingVertical: 4, 
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  
  statusText: { 
    color: '#000', 
    fontSize: 10, 
    fontWeight: '900',
    textAlign: 'center',
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
    gap: 12,
    marginBottom: 12,
  },
  
  infoBox: {
    flex: 1,
  },
  
  infoTitle: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  
  infoText: {
    color: '#DDD',
    fontSize: 13,
    fontWeight: '600',
  },
  
  infoTextMain: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  
  infoSub: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  
  leadTimeSection: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.1)',
  },
  
  leadTimeTitle: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  
  leadTimeGrid: {
    flexDirection: 'row',
    gap: 12,
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
    fontWeight: '500',
  },
  
  leadTimeTotal: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  
  actionArea: { 
    marginTop: 12, 
    paddingTop: 12,
    borderTopWidth: 1, 
    borderTopColor: '#1A1A1A', 
    gap: 8,
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
    padding: 12, 
    borderRadius: 8, 
    gap: 10 
  },
  
  btnCanhotoText: { 
    color: '#000', 
    fontWeight: '900', 
    fontSize: 13 
  },
  
  btnVisualizar: { 
    backgroundColor: 'rgba(255, 215, 0, 0.1)', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 12, 
    borderRadius: 8, 
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  
  btnVisualizarText: { 
    color: '#FFD700', 
    fontWeight: 'bold', 
    fontSize: 13 
  },
  
  // MODAL LEAD TIME STYLES
  modalContainer: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.9)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 15,
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
    marginBottom: 15,
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
    fontSize: 13,
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
  
  leadTimeBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  
  leadTimeBoxTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  leadTimeStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  
  leadTimeStatusLabel: {
    color: '#AAA',
    fontSize: 13,
  },
  
  leadTimeStatusValue: {
    color: '#FFF',
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 13,
  },
  
  leadTimeConcluido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  
  leadTimeConcluidoText: {
    color: '#2ecc71',
    fontSize: 13,
    fontWeight: 'bold',
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
    fontSize: 13,
  },
  
  // MODAL UPLOAD STYLES
  modalContainerUpload: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },

  modalContentUpload: {
    backgroundColor: '#0A0A0A',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#333',
  },

  modalHeaderUpload: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },

  modalTitleUpload: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },

  modalScrollUpload: {
    maxHeight: height * 0.6,
  },

  cameraLentaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    borderRadius: 15,
  },

  cameraLentaText: {
    color: '#FFD700',
    marginTop: 10,
    fontSize: 14,
  },

  viagemInfoUpload: {
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },

  viagemInfoTextUpload: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  viagemInfoSubUpload: {
    color: '#888',
    fontSize: 12,
  },

  fotosCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },

  fotosCounterText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 10,
  },

  botoesAdicionarContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },

  btnAdicionarFoto: {
    flex: 1,
    backgroundColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    gap: 10,
  },

  btnAdicionarTexto: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },

  btnDisabled: {
    opacity: 0.5,
  },

  uploadProgressContainer: {
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },

  uploadProgressText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  uploadProgressBar: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },

  uploadProgressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },

  fotosListaContainer: {
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },

  fotosListaTitulo: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  fotosLista: {
    flexDirection: 'row',
    gap: 10,
  },

  fotoItem: {
    width: 100,
    backgroundColor: '#222',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },

  fotoThumbnail: {
    width: '100%',
    height: 80,
    backgroundColor: '#000',
  },

  fotoInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
  },

  fotoNome: {
    color: '#FFF',
    fontSize: 10,
    flex: 1,
  },

  btnRemoverFoto: {
    padding: 2,
  },

  observacoesContainer: {
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },

  observacoesLabel: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  observacoesInput: {
    backgroundColor: '#222',
    color: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
  },

  legendaContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 15,
    gap: 8,
  },

  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  legendaText: {
    color: '#FFD700',
    fontSize: 11,
  },

  modalActionsUpload: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },

  btnCancelarUpload: {
    flex: 1,
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },

  btnCancelarUploadText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },

  btnEnviarUpload: {
    flex: 2,
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    gap: 10,
  },

  btnEnviarDisabled: {
    backgroundColor: '#666',
    opacity: 0.5,
  },

  btnEnviarUploadText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
  },

  // MODAL DOCUMENTOS STYLES
  modalContainerDocumentos: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },

  modalContentDocumentos: {
    backgroundColor: '#0A0A0A',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#333',
  },

  modalHeaderDocumentos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },

  modalTitleDocumentos: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },

  scrollDocumentos: {
    maxHeight: height * 0.7,
  },

  infoViagemDocumentos: {
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },

  infoTitleDocumentos: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  infoTextDocumentos: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 4,
  },

  infoSubDocumentos: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },

  sectionDocumentos: {
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },

  sectionTitle: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },

  btnEditar: {
    padding: 5,
  },

  documentosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },

  documentoItem: {
    width: (width - 100) / 3,
    alignItems: 'center',
  },

  documentoThumbnail: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    backgroundColor: '#000',
    marginBottom: 5,
  },

  documentoNome: {
    color: '#AAA',
    fontSize: 10,
    textAlign: 'center',
  },

  semDocumentos: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    padding: 20,
  },

  editObservacoes: {
    marginTop: 10,
  },

  inputObservacoes: {
    backgroundColor: '#222',
    color: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 10,
  },

  editButtons: {
    flexDirection: 'row',
    gap: 10,
  },

  btnCancelarEdit: {
    flex: 1,
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },

  btnCancelarEditText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  btnSalvarEdit: {
    flex: 1,
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },

  btnSalvarEditText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },

  observacoesText: {
    color: '#CCC',
    fontSize: 13,
    lineHeight: 18,
    padding: 10,
    backgroundColor: '#222',
    borderRadius: 8,
  },

  leadTimeInfo: {
    gap: 8,
  },

  leadTimeItemDoc: {
    color: '#FFF',
    fontSize: 12,
    marginBottom: 4,
  },

  leadTimeLabelDoc: {
    color: '#FFD700',
    fontWeight: 'bold',
  },

  leadTimeTotalDoc: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },

  modalImagemContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.98)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalImagemClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
  },

  fullImage: { 
    width: width - 40, 
    height: height - 100,
  }
});