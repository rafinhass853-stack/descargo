import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  StyleSheet,
  Modal
} from 'react-native';
import {
  X,
  Search,
  User,
  MapPin,
  Navigation,
  ArrowRight,
  Bell,
  Trash2,
  Truck,
  Container,
  Target,
  Shield,
  AlertCircle,
  Map,
  ExternalLink,
  CheckCircle
} from 'lucide-react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

const GOOGLE_MAPS_API_KEY = 'AIzaSyDT5OptLHwnCVPuevN5Ie8SFWxm4mRPAl4';

// FUNÇÃO AUXILIAR: Extrai coordenadas do link do Google Maps
const extrairCoordenadasDoLink = (url) => {
  if (!url) return null;
  
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,               // Padrão: @-23.123,-46.456
    /q=(-?\d+\.\d+),(-?\d+\.\d+)/,              // Padrão: ?q=-23.123,-46.456
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,           // Padrão: !3d-23.123!4d-46.456
    /maps\/(?:place|search)\/[^@]+@(-?\d+\.\d+),(-?\d+\.\d+)/, // Padrão: maps/place/...@-23.123,-46.456
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      return { lat, lng };
    }
  }
  return null;
};

const obterCoordenadasDoEndereco = async (endereco) => {
  if (!endereco) return null;
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
  } catch (error) {
    console.error("Erro ao buscar coordenadas:", error);
  }
  return null;
};

const AcoesCargas = ({ cargaSelecionada, onFechar, onConfirmar }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [carretas, setCarretas] = useState([]);
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [configurandoGeofence, setConfigurandoGeofence] = useState(false);
  const [coordenadasExtraidas, setCoordenadasExtraidas] = useState(null);

  useEffect(() => {
    const qMot = query(
      collection(db, "cadastro_motoristas"), 
      where("status", "==", "ATIVO"), 
      orderBy("nome", "asc")
    );

    const unsubMot = onSnapshot(qMot, (snapshot) => {
      setMotoristas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setCarregando(false);
    }, () => setCarregando(false));

    const unsubVeic = onSnapshot(collection(db, "cadastro_veiculos"), (snapshot) => {
      setVeiculos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCarr = onSnapshot(collection(db, "carretas"), (snapshot) => {
      setCarretas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubMot();
      unsubVeic();
      unsubCarr();
    };
  }, []);

  // Extrair coordenadas do link quando o componente carrega
  useEffect(() => {
    if (cargaSelecionada?.destinoLink) {
      const coords = extrairCoordenadasDoLink(cargaSelecionada.destinoLink);
      setCoordenadasExtraidas(coords);
      console.log("📌 Coordenadas extraídas do link:", coords);
    }
  }, [cargaSelecionada]);

  const getConjuntoMotorista = (motoristaId) => {
    if (!motoristaId) return null;
    const cavalo = veiculos.find(v => v.motorista_id === motoristaId);
    const carreta = carretas.find(c => c.motorista_id === motoristaId);
    return {
      cavalo: cavalo ? cavalo.placa : '---',
      carreta: carreta ? carreta.placa : '---'
    };
  };

  const desvincularCarga = async () => {
    Alert.alert(
      "Confirmar",
      `Deseja remover o vínculo da DT ${cargaSelecionada?.dt}?\n\nIsso resetará o status da viagem.`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Desvincular", 
          style: "destructive",
          onPress: async () => {
            setProcessando('desvincular');
            try {
              // Remover notificações da carga
              const q = query(collection(db, "notificacoes_cargas"), where("cargaId", "==", cargaSelecionada.id));
              const snapshot = await getDocs(q);
              await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, "notificacoes_cargas", d.id))));

              // Resetar status da carga
              const cargaRef = doc(db, "ordens_servico", cargaSelecionada.id);
              await updateDoc(cargaRef, {
                motoristaId: "",
                motoristaNome: "",
                status: "AGUARDANDO PROGRAMAÇÃO",
                atribuidoEm: null,
                trajetoComInstrucoes: [],
                instrucaoAtual: 0,
                chegouAoDestino: false,
                finalizada: false,
                confirmacaoPendente: false,
                dataChegada: null,
                dataFinalizacao: null,
                dataInicioViagem: null
              });

              if (onConfirmar) await onConfirmar(null);
              onFechar();
              Alert.alert("✅", "Vínculo removido com sucesso!");
            } catch (e) {
              console.error(e);
              Alert.alert("Erro", "Erro ao remover vínculo.");
            } finally {
              setProcessando(null);
            }
          }
        }
      ]
    );
  };

  const configurarGeofenceParaCarga = async (cargaData) => {
    // Se já tem geofence configurada, retorna ela
    if (cargaData.cercaVirtual?.centro) {
      console.log("Usando geofence já configurada:", cargaData.cercaVirtual.centro);
      return cargaData.cercaVirtual;
    }
    
    setConfigurandoGeofence(true);
    try {
      let coordenadas = null;
      
      // PRIORIDADE 1: Coordenadas já extraídas do link
      if (coordenadasExtraidas) {
        coordenadas = coordenadasExtraidas;
        console.log("Usando coordenadas já extraídas do link:", coordenadas);
      }
      // PRIORIDADE 2: Coordenadas já salvas na carga
      else if (cargaData?.destinoCoordenadas) {
        coordenadas = cargaData.destinoCoordenadas;
        console.log("Usando coordenadas salvas na carga:", coordenadas);
      }
      // PRIORIDADE 3: Extrair do link do Google Maps
      else if (cargaData.destinoLink) {
        console.log("Extraindo coordenadas do link:", cargaData.destinoLink);
        coordenadas = extrairCoordenadasDoLink(cargaData.destinoLink);
      }
      
      // PRIORIDADE 4: Se não encontrou pelo link, tenta pelo endereço via geocoding
      if (!coordenadas && cargaData.destinoCidade) {
        const enderecoBusca = `${cargaData.destinoCliente || 'Destino'}, ${cargaData.destinoCidade}`;
        console.log("Buscando coordenadas do endereço:", enderecoBusca);
        coordenadas = await obterCoordenadasDoEndereco(enderecoBusca);
      }
      
      console.log("Coordenadas finais encontradas:", coordenadas);
      
      return {
        tipo: 'circle',
        raio: cargaData.cercaVirtual?.raio || 100,
        centro: coordenadas,
        coordenadas: [],
        ativa: true
      };
    } catch (error) {
      console.error("Erro ao configurar geofence:", error);
      return { 
        tipo: 'circle', 
        raio: 100, 
        centro: null, 
        coordenadas: [], 
        ativa: true 
      };
    } finally {
      setConfigurandoGeofence(false);
    }
  };

  const enviarCargaAoMotorista = async (motorista) => {
    if (!cargaSelecionada) {
      Alert.alert("Aviso", "Nenhuma carga selecionada.");
      return;
    }

    setProcessando(motorista.id);
    setConfigurandoGeofence(true);
    
    try {
      const emailLimpo = motorista.email_app?.toLowerCase().trim() || "";
      const cargaId = cargaSelecionada?.id;
      const motoristaUID = motorista.uid || motorista.id;
      
      // 1. CONFIGURAR GEOFENCE com prioridade para coordenadas do link
      let geofenceConfig = null;
      let coordenadasParaEnvio = null;
      
      // Verifica se já temos coordenadas extraídas
      if (coordenadasExtraidas) {
        coordenadasParaEnvio = coordenadasExtraidas;
        console.log("📌 Usando coordenadas já extraídas:", coordenadasParaEnvio);
      } 
      // Verifica se a carga já tem coordenadas salvas
      else if (cargaSelecionada?.destinoCoordenadas) {
        coordenadasParaEnvio = cargaSelecionada.destinoCoordenadas;
        console.log("📌 Usando coordenadas salvas na carga:", coordenadasParaEnvio);
      }
      // Tenta extrair do link agora
      else if (cargaSelecionada?.destinoLink) {
        coordenadasParaEnvio = extrairCoordenadasDoLink(cargaSelecionada.destinoLink);
        console.log("📌 Extraindo coordenadas do link agora:", coordenadasParaEnvio);
      }
      
      // Se conseguiu coordenadas, monta a geofence
      if (coordenadasParaEnvio) {
        geofenceConfig = {
          tipo: 'circle',
          raio: cargaSelecionada?.cercaVirtual?.raio || 100,
          centro: coordenadasParaEnvio,
          coordenadas: [],
          ativa: true
        };
        console.log("🎯 Geofence configurada com coordenadas do link:", geofenceConfig);
      } else {
        // Fallback: configura geofence da forma antiga
        geofenceConfig = await configurarGeofenceParaCarga(cargaSelecionada);
        console.log("🎯 Geofence configurada via fallback:", geofenceConfig);
      }
      
      const conjunto = getConjuntoMotorista(motorista.id);

      // 2. DADOS COMPLETOS PARA ENVIAR AO MOTORISTA
      const dadosParaEnvio = {
        cargaId: cargaId || "N/A",
        motoristaId: motoristaUID,
        motoristaEmail: emailLimpo,
        motoristaNome: motorista.nome,
        dt: cargaSelecionada?.dt || "S/DT",
        cavalo: conjunto?.cavalo || "---",
        carreta: conjunto?.carreta || "---",
        peso: cargaSelecionada?.peso || "0",
        origem: cargaSelecionada?.origemCidade || "",
        destino: cargaSelecionada?.destinoCidade || "",
        clienteColeta: cargaSelecionada?.origemCliente || "",
        clienteEntrega: cargaSelecionada?.destinoCliente || "",
        codigoOrigem: cargaSelecionada?.origemCodigo || "",
        codigoDestino: cargaSelecionada?.destinoCodigo || "",
        observacao: cargaSelecionada?.observacao || "",
        tipoViagem: cargaSelecionada?.tipoViagem || "CARREGADO",
        perfilVeiculo: cargaSelecionada?.perfilVeiculo || "Trucado",
        
        // LINKS DO GOOGLE MAPS (CRÍTICO!)
        linkColeta: cargaSelecionada?.origemLink || "",
        linkEntrega: cargaSelecionada?.destinoLink || "",
        linkGoogleMapsDestino: cargaSelecionada?.destinoLink || "",
        
        // COORDENADAS (ESSENCIAL PARA A ROTA!)
        destinoCoordenadas: coordenadasParaEnvio || geofenceConfig.centro,
        
        // Informações completas da geofence
        cercaVirtual: geofenceConfig,
        
        // Dados estruturais completos para o app
        origemCliente: cargaSelecionada?.origemCliente || "",
        origemCidade: cargaSelecionada?.origemCidade || "",
        origemCodigo: cargaSelecionada?.origemCodigo || "",
        destinoCliente: cargaSelecionada?.destinoCliente || cargaSelecionada?.clienteEntrega || "",
        destinoCidade: cargaSelecionada?.destinoCidade || cargaSelecionada?.destino || "",
        destinoCodigo: cargaSelecionada?.destinoCodigo || cargaSelecionada?.codigoDestino || "",
        destinoData: cargaSelecionada?.destinoData || "",
        
        // Flags para o app
        temRotaAutomatica: true,
        podeGerarRota: true,
        coordenadasValidas: !!(coordenadasParaEnvio || geofenceConfig.centro),
        instrucaoAtual: 0,
        status: "pendente",
        vinculo: "FROTA",
        timestamp: serverTimestamp(),
        
        // Status da viagem
        chegouAoDestino: false,
        finalizada: false,
        confirmacaoPendente: false
      };

      console.log("📤 Enviando dados COMPLETOS para o app:", dadosParaEnvio);

      // 3. Enviar notificação para o app do motorista
      await addDoc(collection(db, "notificacoes_cargas"), dadosParaEnvio);

      // 4. Atualizar a carga no sistema com TODAS as informações
      const cargaRef = doc(db, "ordens_servico", cargaId);
      await updateDoc(cargaRef, {
        motoristaId: motoristaUID,
        motoristaNome: motorista.nome,
        status: "PENDENTE ACEITE",
        
        // GARANTIR que as coordenadas estão salvas
        destinoCoordenadas: coordenadasParaEnvio || geofenceConfig.centro,
        
        // Garantir que o link está salvo
        destinoLink: cargaSelecionada?.destinoLink || "",
        
        // Geofence atualizada
        cercaVirtual: geofenceConfig,
        
        // Flags importantes
        temRotaAutomatica: true,
        coordenadasValidas: !!(coordenadasParaEnvio || geofenceConfig.centro),
        
        // Dados de controle
        instrucaoAtual: 0,
        chegouAoDestino: false,
        finalizada: false,
        confirmacaoPendente: false,
        dataChegada: null,
        dataFinalizacao: null,
        dataInicioViagem: null,
        atribuidoEm: serverTimestamp(),
        
        // Dados completos
        origemCliente: cargaSelecionada?.origemCliente || "",
        origemCidade: cargaSelecionada?.origemCidade || "",
        origemCodigo: cargaSelecionada?.origemCodigo || "",
        destinoCliente: cargaSelecionada?.destinoCliente || "",
        destinoCidade: cargaSelecionada?.destinoCidade || "",
        destinoCodigo: cargaSelecionada?.destinoCodigo || ""
      });

      // 5. MENSAGEM DE SUCESSO DETALHADA
      const temCoordenadas = !!(coordenadasParaEnvio || geofenceConfig.centro);
      const temLink = !!cargaSelecionada?.destinoLink;
      
      let mensagemSucesso = `✅ Carga ${cargaSelecionada?.dt} enviada para ${motorista.nome}!\n\n`;
      
      if (temCoordenadas && temLink) {
        mensagemSucesso += `📌 Coordenadas extraídas do link\n`;
        mensagemSucesso += `🔗 Link do Google Maps configurado\n`;
        mensagemSucesso += `🚀 Rota automática disponível no app\n\n`;
        mensagemSucesso += `📍 ${coordenadasParaEnvio?.lat?.toFixed(6) || geofenceConfig.centro?.lat?.toFixed(6)}, `;
        mensagemSucesso += `${coordenadasParaEnvio?.lng?.toFixed(6) || geofenceConfig.centro?.lng?.toFixed(6)}`;
      } else if (temCoordenadas) {
        mensagemSucesso += `📌 Coordenadas configuradas\n`;
        mensagemSucesso += `⚠️ Sem link do Google Maps\n`;
        mensagemSucesso += `🚀 Rota automática disponível`;
      } else if (temLink) {
        mensagemSucesso += `⚠️ Não foi possível extrair coordenadas do link\n`;
        mensagemSucesso += `🔗 Link do Google Maps configurado\n`;
        mensagemSucesso += `❌ Motorista precisará gerar rota manualmente`;
      } else {
        mensagemSucesso += `❌ Sem coordenadas nem link\n`;
        mensagemSucesso += `⚠️ Motorista pode ter problemas para gerar rota`;
      }
      
      Alert.alert("Sucesso", mensagemSucesso);
      
      if (onConfirmar) await onConfirmar({ 
        id: motoristaUID, 
        nome: motorista.nome,
        cargaId: cargaId,
        linkDestino: cargaSelecionada?.destinoLink || "",
        temCoordenadas: temCoordenadas
      });
      
      onFechar();
    } catch (e) {
      console.error("Erro ao enviar carga:", e);
      Alert.alert("❌ Erro", "Erro ao enviar carga ao motorista.\n\nVerifique o console para detalhes.");
    } finally {
      setProcessando(null);
      setConfigurandoGeofence(false);
    }
  };

  const filtrados = motoristas.filter(m => 
    m.nome?.toLowerCase().includes(busca.toLowerCase()) || m.cpf?.includes(busca)
  );

  const possuiGeofence = cargaSelecionada?.cercaVirtual?.ativa;
  const geofenceConfigurada = cargaSelecionada?.cercaVirtual?.centro;
  const possuiLinkDestino = cargaSelecionada?.destinoLink;
  const possuiCoordenadasSalvas = cargaSelecionada?.destinoCoordenadas;
  const possuiCoordenadasExtraidas = !!coordenadasExtraidas;

  return (
    <View style={styles.container}>
      
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.iconContainer}>
            <User size={20} color="#000" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Atribuir Viagem</Text>
            <View style={styles.headerSubtitle}>
              <Text style={styles.dtText}>DT {cargaSelecionada?.dt}</Text>
              <Text style={styles.arrow}>➔</Text>
              <Text style={styles.destinoText} numberOfLines={1}>
                {cargaSelecionada?.destinoCliente}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={onFechar} style={styles.closeButton}>
          <X size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* INFO DA CARGA */}
      <View style={styles.cargaInfoContainer}>
        <View style={styles.gridInfo}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>ORIGEM</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {cargaSelecionada?.origemCliente || 'Não informado'}
            </Text>
            <Text style={styles.infoCity}>{cargaSelecionada?.origemCidade || ''}</Text>
          </View>
          <View style={[styles.infoColumn, styles.infoColumnRight]}>
            <Text style={[styles.infoLabel, styles.infoLabelDestino]}>DESTINO</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {cargaSelecionada?.destinoCliente || 'Não informado'}
            </Text>
            <Text style={styles.infoCity}>{cargaSelecionada?.destinoCidade || ''}</Text>
          </View>
        </View>
        
        {/* INFO DO LINK DO GOOGLE MAPS */}
        {possuiLinkDestino && (
          <View style={styles.linkContainer}>
            <View style={styles.linkHeader}>
              <ExternalLink size={12} color="#10b981" />
              <Text style={styles.linkTitle}>LINK GOOGLE MAPS</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(cargaSelecionada.destinoLink)}
                style={styles.linkButton}
              >
                <ExternalLink size={12} color="#10b981" />
              </TouchableOpacity>
            </View>
            <Text style={styles.linkUrl} numberOfLines={1}>
              {cargaSelecionada?.destinoLink}
            </Text>
            
            {/* STATUS DAS COORDENADAS */}
            <View style={styles.coordStatus}>
              {possuiCoordenadasExtraidas ? (
                <>
                  <CheckCircle size={10} color="#10b981" />
                  <Text style={styles.coordSuccess}>
                    📌 Coordenadas extraídas com sucesso
                  </Text>
                  <Text style={styles.coordCoordinates}>
                    {coordenadasExtraidas.lat.toFixed(6)}, {coordenadasExtraidas.lng.toFixed(6)}
                  </Text>
                </>
              ) : possuiCoordenadasSalvas ? (
                <>
                  <CheckCircle size={10} color="#10b981" />
                  <Text style={styles.coordSuccess}>
                    ✓ Coordenadas já salvas na carga
                  </Text>
                </>
              ) : (
                <>
                  <AlertCircle size={10} color="#f59e0b" />
                  <Text style={styles.coordWarning}>
                    ⚠️ Não foi possível extrair coordenadas deste link
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
      </View>

      {/* INFO DO FLUXO */}
      <View style={styles.fluxoContainer}>
        <Shield size={14} color="#60a5fa" />
        <View style={styles.fluxoContent}>
          <Text style={styles.fluxoTitle}>FLUXO AUTOMÁTICO</Text>
          <Text style={styles.fluxoDescription}>
            Finalização automática via geofence no destino.
          </Text>
          
          {configurandoGeofence && (
            <View style={styles.configuringContainer}>
              <ActivityIndicator size="small" color="#60a5fa" />
              <Text style={styles.configuringText}>Configurando geofence...</Text>
            </View>
          )}
          
          {geofenceConfigurada && (
            <View style={styles.geofenceConfigured}>
              <Text style={styles.geofenceText}>
                ✓ Geofence configurada: {cargaSelecionada?.cercaVirtual?.raio || 100}m
              </Text>
            </View>
          )}
          
          {possuiCoordenadasExtraidas && (
            <View style={styles.coordsAvailable}>
              <Text style={styles.coordsAvailableText}>
                ✓ Coordenadas do link disponíveis para rota automática
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* PESQUISA */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={16} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            placeholder="Pesquisar motorista..."
            placeholderTextColor="#6b7280"
            style={styles.searchInput}
            value={busca}
            onChangeText={setBusca}
          />
        </View>
      </View>

      {/* LISTA DE MOTORISTAS */}
      <ScrollView style={styles.motoristasList} contentContainerStyle={styles.motoristasGrid}>
        {carregando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
          </View>
        ) : (
          filtrados.map((mot) => {
            const conjunto = getConjuntoMotorista(mot.id);
            return (
              <TouchableOpacity
                key={mot.id}
                onPress={() => enviarCargaAoMotorista(mot)}
                disabled={processando || configurandoGeofence}
                style={styles.motoristaCard}
              >
                <View style={styles.motoristaInfo}>
                  <Text style={styles.motoristaNome} numberOfLines={1}>
                    {mot.nome}
                  </Text>
                  <View style={styles.motoristaDetails}>
                    <View style={styles.motoristaDetail}>
                      <MapPin size={10} color="#6b7280" />
                      <Text style={styles.motoristaDetailText}>
                        {mot.cidade || 'Base'}
                      </Text>
                    </View>
                    {conjunto && (
                      <View style={styles.veiculosContainer}>
                        <View style={styles.veiculoItem}>
                          <Truck size={10} color="#f59e0b" />
                          <Text style={styles.veiculoPlaca}>{conjunto.cavalo}</Text>
                        </View>
                        <View style={styles.veiculoItem}>
                          <Container size={10} color="#60a5fa" />
                          <Text style={styles.veiculoPlaca}>{conjunto.carreta}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
                {processando === mot.id ? (
                  <ActivityIndicator size="small" color="#f59e0b" />
                ) : (
                  <ArrowRight size={14} color="#f59e0b" />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* CARGA JÁ VINCULADA */}
      {cargaSelecionada?.motoristaNome && (
        <View style={styles.vinculadoContainer}>
          <View>
            <Text style={styles.vinculadoLabel}>Vinculado:</Text>
            <Text style={styles.vinculadoNome}>{cargaSelecionada.motoristaNome}</Text>
            <Text style={styles.vinculadoStatus}>
              Status: {cargaSelecionada.status || 'AGUARDANDO'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={desvincularCarga}
            disabled={processando === 'desvincular'}
            style={styles.desvincularButton}
          >
            {processando === 'desvincular' ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Trash2 size={16} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* STATUS DO ENVIO */}
      <View style={styles.envioContainer}>
        <View style={styles.envioIconContainer}>
          <Map size={12} color="#a78bfa" />
        </View>
        <View style={styles.envioContent}>
          <Text style={styles.envioTitle}>INFORMAÇÕES PARA ENVIO</Text>
          <View style={styles.envioGrid}>
            <Text style={styles.envioGridLabel}>Tipo:</Text>
            <Text style={styles.envioGridValue}>
              {cargaSelecionada?.tipoViagem || 'CARREGADO'}
            </Text>
            
            <Text style={styles.envioGridLabel}>Peso:</Text>
            <Text style={styles.envioGridValue}>
              {cargaSelecionada?.peso || '0'} Ton
            </Text>
            
            <Text style={styles.envioGridLabel}>Código Destino:</Text>
            <Text style={styles.envioGridValue}>
              {cargaSelecionada?.destinoCodigo || '---'}
            </Text>
            
            <Text style={styles.envioGridLabel}>Data Entrega:</Text>
            <Text style={styles.envioGridValue}>
              {cargaSelecionada?.destinoData ? new Date(cargaSelecionada.destinoData).toLocaleDateString() : '---'}
            </Text>
            
            <Text style={styles.envioGridLabel}>Coordenadas:</Text>
            <Text style={styles.envioGridValue}>
              {possuiCoordenadasExtraidas ? '✓ Extraídas do link' : 
               possuiCoordenadasSalvas ? '✓ Salvas na carga' : 
               '❌ Não disponíveis'}
            </Text>
            
            <Text style={styles.envioGridLabel}>Link Maps:</Text>
            <Text style={styles.envioGridValue}>
              {possuiLinkDestino ? '✓ Disponível' : '❌ Não informado'}
            </Text>
          </View>
          
          {possuiLinkDestino && (
            <View style={styles.envioLinkAvailable}>
              <Text style={styles.envioLinkAvailableText}>
                ✓ Link do Google Maps será enviado ao app do motorista
              </Text>
            </View>
          )}
          
          {possuiCoordenadasExtraidas && (
            <View style={styles.envioCoordsAvailable}>
              <Text style={styles.envioCoordsAvailableText}>
                ✓ Coordenadas extraídas permitem rota automática
              </Text>
            </View>
          )}
          
          {!possuiCoordenadasExtraidas && !possuiCoordenadasSalvas && (
            <View style={styles.envioWarning}>
              <Text style={styles.envioWarningText}>
                ⚠️ Sem coordenadas disponíveis para rota automática
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    overflow: 'hidden'
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  headerSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  dtText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  arrow: {
    color: '#6b7280',
    fontSize: 10
  },
  destinoText: {
    color: '#d1d5db',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    flexShrink: 1
  },
  closeButton: {
    padding: 8,
    borderRadius: 20
  },
  cargaInfoContainer: {
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.1)'
  },
  gridInfo: {
    flexDirection: 'row',
    marginBottom: 8
  },
  infoColumn: {
    flex: 1
  },
  infoColumnRight: {
    alignItems: 'flex-end'
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#60a5fa',
    textTransform: 'uppercase'
  },
  infoLabelDestino: {
    color: '#10b981'
  },
  infoValue: {
    fontSize: 10,
    color: '#e5e7eb'
  },
  infoCity: {
    fontSize: 9,
    color: '#6b7280'
  },
  linkContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4
  },
  linkTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#10b981',
    textTransform: 'uppercase',
    flex: 1
  },
  linkButton: {
    padding: 2
  },
  linkUrl: {
    fontSize: 9,
    color: '#d1d5db'
  },
  coordStatus: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4
  },
  coordSuccess: {
    fontSize: 9,
    color: '#10b981',
    fontWeight: 'bold',
    marginLeft: 4
  },
  coordCoordinates: {
    fontSize: 8,
    color: '#6b7280',
    fontFamily: 'monospace',
    marginLeft: 'auto'
  },
  coordWarning: {
    fontSize: 9,
    color: '#f59e0b',
    marginLeft: 4
  },
  fluxoContainer: {
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.1)',
    flexDirection: 'row',
    gap: 8
  },
  fluxoContent: {
    flex: 1
  },
  fluxoTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#60a5fa',
    textTransform: 'uppercase'
  },
  fluxoDescription: {
    fontSize: 9,
    color: '#9ca3af'
  },
  configuringContainer: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  configuringText: {
    fontSize: 9,
    color: '#60a5fa'
  },
  geofenceConfigured: {
    marginTop: 4,
    padding: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 4
  },
  geofenceText: {
    fontSize: 9,
    color: '#93c5fd'
  },
  coordsAvailable: {
    marginTop: 4,
    padding: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)'
  },
  coordsAvailableText: {
    fontSize: 9,
    color: '#a7f3d0'
  },
  searchContainer: {
    padding: 12
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8
  },
  searchIcon: {
    marginLeft: 12,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 16,
    color: '#ffffff',
    fontSize: 12
  },
  motoristasList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  motoristasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  loadingContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  motoristaCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  motoristaInfo: {
    flex: 1,
    marginRight: 8
  },
  motoristaNome: {
    color: '#e5e7eb',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  motoristaDetails: {
    marginTop: 4,
    gap: 4
  },
  motoristaDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  motoristaDetailText: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '500'
  },
  veiculosContainer: {
    flexDirection: 'row',
    gap: 8
  },
  veiculoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  veiculoPlaca: {
    fontSize: 8,
    fontWeight: 'bold',
    color: 'rgba(245, 158, 11, 0.7)'
  },
  vinculadoContainer: {
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(239, 68, 68, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  vinculadoLabel: {
    fontSize: 9,
    color: '#ef4444',
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  vinculadoNome: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: 'bold'
  },
  vinculadoStatus: {
    fontSize: 9,
    color: '#9ca3af'
  },
  desvincularButton: {
    backgroundColor: '#ef4444',
    padding: 8,
    borderRadius: 8
  },
  envioContainer: {
    padding: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.1)',
    flexDirection: 'row',
    gap: 8
  },
  envioIconContainer: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    padding: 4,
    borderRadius: 4
  },
  envioContent: {
    flex: 1
  },
  envioTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#a78bfa',
    textTransform: 'uppercase'
  },
  envioGrid: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  envioGridLabel: {
    width: '50%',
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2
  },
  envioGridValue: {
    width: '50%',
    fontSize: 9,
    color: '#e5e7eb',
    marginTop: 2,
    fontWeight: 'bold'
  },
  envioLinkAvailable: {
    marginTop: 8,
    padding: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 4
  },
  envioLinkAvailableText: {
    fontSize: 9,
    color: '#c4b5fd'
  },
  envioCoordsAvailable: {
    marginTop: 8,
    padding: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)'
  },
  envioCoordsAvailableText: {
    fontSize: 9,
    color: '#a7f3d0'
  },
  envioWarning: {
    marginTop: 8,
    padding: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)'
  },
  envioWarningText: {
    fontSize: 9,
    color: '#fde68a'
  }
});

export default AcoesCargas;