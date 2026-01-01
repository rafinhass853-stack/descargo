import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import MapView, { Polyline, Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const NavegacaoAudio = ({ 
  visible = false, 
  onClose, 
  viagemData,
  db,
  auth
}) => {
  const [origem, setOrigem] = useState(viagemData?.origem || { 
    latitude: -23.5505, 
    longitude: -46.6333,
    endereco: 'Local atual'
  });
  const [destino, setDestino] = useState(viagemData?.destino || {
    latitude: -23.5635, 
    longitude: -46.6523,
    endereco: 'Destino'
  });
  const [localizacaoAtual, setLocalizacaoAtual] = useState(null);
  const [coordenadasRota, setCoordenadasRota] = useState([]);
  const [instrucoes, setInstrucoes] = useState([]);
  const [instrucaoAtual, setInstrucaoAtual] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [distanciaTotal, setDistanciaTotal] = useState(0);
  const [duracaoTotal, setDuracaoTotal] = useState(0);
  const [distanciaRestante, setDistanciaRestante] = useState(0);
  const [navegacaoAtiva, setNavegacaoAtiva] = useState(false);
  const [chegouDestino, setChegouDestino] = useState(false);
  const [mostrarTodasInstrucoes, setMostrarTodasInstrucoes] = useState(false);
  
  // Refs
  const mapRef = useRef(null);
  const watchPositionSubscription = useRef(null);
  const ultimaInstrucaoFalada = useRef(null);

  // Dados da viagem
  const viagem = viagemData?.dadosViagem || {};
  const temGeofence = viagem.cercaVirtual?.ativa;
  const geofence = viagem.cercaVirtual;

  useEffect(() => {
    if (visible && viagemData) {
      solicitarPermissoes();
      setOrigem(viagemData.origem || origem);
      setDestino(viagemData.destino || destino);
      
      // Se a viagem já tem instruções, usa elas
      if (viagem.trajetoComInstrucoes && viagem.trajetoComInstrucoes.length > 0) {
        setInstrucoes(viagem.trajetoComInstrucoes);
        setCarregando(false);
      }
    }
    
    return () => {
      pararMonitoramento();
      pararNavegacao();
    };
  }, [visible, viagemData]);

  useEffect(() => {
    if (visible && origem && destino && !viagem.trajetoComInstrucoes) {
      calcularRotaOSRM();
    } else if (visible && viagem.trajetoComInstrucoes) {
      // Se já tem instruções, só precisa calcular a rota no mapa
      calcularRotaParaMapa();
    }
  }, [visible, origem, destino, viagem.trajetoComInstrucoes]);

  const solicitarPermissoes = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos da sua localização para navegação');
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      setLocalizacaoAtual(location.coords);
      
    } catch (error) {
      console.error('Erro permissões:', error);
    }
  };

  const iniciarMonitoramento = async () => {
    try {
      // Monitoramento APENAS em foreground
      watchPositionSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 3000,
        },
        (novaLocalizacao) => {
          setLocalizacaoAtual(novaLocalizacao.coords);
          
          if (mapRef.current && navegacaoAtiva) {
            mapRef.current.animateToRegion({
              latitude: novaLocalizacao.coords.latitude,
              longitude: novaLocalizacao.coords.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }, 1000);
          }
          
          if (navegacaoAtiva) {
            verificarInstrucoes(novaLocalizacao.coords);
            verificarGeofence(novaLocalizacao.coords);
          }
        }
      );
    } catch (error) {
      console.error('Erro monitoramento:', error);
    }
  };

  const pararMonitoramento = () => {
    if (watchPositionSubscription.current) {
      watchPositionSubscription.current.remove();
      watchPositionSubscription.current = null;
    }
  };

  const calcularRotaParaMapa = async () => {
    try {
      setCarregando(true);
      
      if (viagem.trajeto && viagem.trajeto.length > 0) {
        // Usar trajeto já definido
        setCoordenadasRota(viagem.trajeto.map(c => ({
          latitude: c.latitude,
          longitude: c.longitude
        })));
        
        // Calcular distância aproximada
        let distanciaAprox = 0;
        for (let i = 1; i < viagem.trajeto.length; i++) {
          distanciaAprox += calcularDistancia(
            viagem.trajeto[i-1].latitude,
            viagem.trajeto[i-1].longitude,
            viagem.trajeto[i].latitude,
            viagem.trajeto[i].longitude
          );
        }
        
        setDistanciaTotal(distanciaAprox);
        setDistanciaRestante(distanciaAprox);
        setDuracaoTotal(Math.round(distanciaAprox / 833.33)); // 50km/h em média
        
      } else {
        // Calcular rota entre origem e destino
        const url = `https://router.project-osrm.org/route/v1/driving/${
          origem.longitude},${origem.latitude};${destino.longitude},${destino.latitude
        }?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordenadas = route.geometry.coordinates.map(coord => ({
            longitude: coord[0],
            latitude: coord[1]
          }));
          
          setCoordenadasRota(coordenadas);
          setDistanciaTotal(route.distance);
          setDuracaoTotal(route.duration);
          setDistanciaRestante(route.distance);
        }
      }
      
      // Ajustar mapa para mostrar rota
      if (mapRef.current && coordenadasRota.length > 0) {
        setTimeout(() => {
          mapRef.current.fitToCoordinates(coordenadasRota, {
            edgePadding: { top: 100, right: 100, bottom: 200, left: 100 },
            animated: true,
          });
        }, 500);
      }
      
    } catch (error) {
      console.error('Erro rota:', error);
      // Rota alternativa simples
      setCoordenadasRota([
        { latitude: origem.latitude, longitude: origem.longitude },
        { latitude: destino.latitude, longitude: destino.longitude }
      ]);
      setDistanciaTotal(10000);
      setDuracaoTotal(1800);
      
    } finally {
      setCarregando(false);
    }
  };

  const calcularRotaOSRM = async () => {
    try {
      setCarregando(true);
      
      const url = `https://router.project-osrm.org/route/v1/driving/${
        origem.longitude},${origem.latitude};${destino.longitude},${destino.latitude
      }?overview=full&geometries=geojson&steps=true&annotations=true&language=pt`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.routes || data.routes.length === 0) {
        throw new Error('Rota não encontrada');
      }
      
      const route = data.routes[0];
      const leg = route.legs[0];
      
      // Converter coordenadas
      const coordenadas = route.geometry.coordinates.map(coord => ({
        longitude: coord[0],
        latitude: coord[1]
      }));
      
      // Processar instruções
      const instrucoesProcessadas = leg.steps.map((step, index) => {
        let texto = step.maneuver.instruction || '';
        
        // Traduções para português
        texto = texto
          .replace(/Turn left/gi, 'Vire à esquerda')
          .replace(/Turn right/gi, 'Vire à direita')
          .replace(/Continue/gi, 'Continue')
          .replace(/Head/gi, 'Siga')
          .replace(/onto/gi, 'em')
          .replace(/Sharp left/gi, 'Vire acentuadamente à esquerda')
          .replace(/Sharp right/gi, 'Vire acentuadamente à direita')
          .replace(/Slight left/gi, 'Vire levemente à esquerda')
          .replace(/Slight right/gi, 'Vire levemente à direita')
          .replace(/straight/gi, 'em frente')
          .replace(/destination/gi, 'destino')
          .replace(/arrived/gi, 'chegou')
          .replace(/Exit roundabout/gi, 'Saia da rotatória')
          .replace(/roundabout/gi, 'rotatória');
        
        return {
          id: index,
          texto: texto,
          distancia: step.distance,
          duracao: step.duration,
          distanciaFormatada: step.distance < 1000 ? `${Math.round(step.distance)}m` : `${(step.distance / 1000).toFixed(1)}km`,
          duracaoFormatada: step.duration < 60 ? `${Math.round(step.duration)}s` : step.duration < 3600 ? `${Math.round(step.duration / 60)}min` : `${Math.round(step.duration / 3600)}h ${Math.round((step.duration % 3600) / 60)}min`
        };
      });
      
      // Adicionar instrução de chegada
      instrucoesProcessadas.push({
        id: instrucoesProcessadas.length,
        texto: `Você chegou em ${destino.endereco || 'destino'}`,
        distancia: 0,
        duracao: 0,
        distanciaFormatada: '0m',
        duracaoFormatada: '0s'
      });
      
      setCoordenadasRota(coordenadas);
      setInstrucoes(instrucoesProcessadas);
      setDistanciaTotal(route.distance);
      setDuracaoTotal(route.duration);
      setDistanciaRestante(route.distance);
      
      // Ajustar mapa para mostrar rota
      if (mapRef.current && coordenadas.length > 0) {
        setTimeout(() => {
          mapRef.current.fitToCoordinates(coordenadas, {
            edgePadding: { top: 100, right: 100, bottom: 200, left: 100 },
            animated: true,
          });
        }, 500);
      }
      
    } catch (error) {
      console.error('Erro rota OSRM:', error);
      Alert.alert(
        'Informação',
        'Não foi possível calcular a rota detalhada. Use a navegação básica.',
        [{ text: 'OK' }]
      );
      
      calcularRotaParaMapa();
      
    } finally {
      setCarregando(false);
    }
  };

  const verificarInstrucoes = (coords) => {
    if (!coords || instrucoes.length === 0) return;
    
    for (let i = 0; i < instrucoes.length; i++) {
      const instrucao = instrucoes[i];
      
      // Para simplificar, vamos apenas verificar se está próximo do destino
      const distanciaAoDestino = calcularDistancia(
        coords.latitude,
        coords.longitude,
        destino.latitude,
        destino.longitude
      );
      
      if (distanciaAoDestino < 500 && instrucao.id === instrucoes.length - 1 && instrucao.id !== ultimaInstrucaoFalada.current) {
        setInstrucaoAtual(instrucao);
        falarInstrucao(instrucao.texto);
        ultimaInstrucaoFalada.current = instrucao.id;
        
        // Atualizar distância restante
        setDistanciaRestante(distanciaAoDestino);
        break;
      }
    }
  };

  const verificarGeofence = (coords) => {
    if (!temGeofence || !geofence?.centro || chegouDestino) return;
    
    const distancia = calcularDistancia(
      coords.latitude,
      coords.longitude,
      geofence.centro.lat,
      geofence.centro.lng
    );
    
    if (distancia <= (geofence.raio + 30)) {
      setChegouDestino(true);
      falarInstrucao(`Você entrou na área de destino de ${destino.endereco}. Prepare-se para confirmar a chegada.`);
    }
  };

  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  };

  const falarInstrucao = (texto) => {
    if (!texto || !navegacaoAtiva) return;
    
    Speech.speak(texto, {
      language: 'pt-BR',
      pitch: 1.0,
      rate: 0.9,
      volume: 1.0
    });
  };

  const iniciarNavegacao = async () => {
    try {
      setNavegacaoAtiva(true);
      
      // Apenas inicia monitoramento em foreground
      if (!watchPositionSubscription.current) {
        iniciarMonitoramento();
      }
      
      // Falar instrução inicial
      if (instrucoes.length > 0) {
        falarInstrucao(`Iniciando navegação para ${destino.endereco}. ${instrucoes[0].texto}`);
      } else {
        falarInstrucao(`Iniciando navegação para ${destino.endereco}. Siga em frente.`);
      }
      
      Alert.alert('Navegação Iniciada', 'Siga as instruções por voz. Mantenha o app aberto.');
      
    } catch (error) {
      console.error('Erro iniciar navegação:', error);
      Alert.alert('Informação', 'Navegação por voz iniciada sem monitoramento de localização.');
    }
  };

  const pararNavegacao = () => {
    try {
      setNavegacaoAtiva(false);
      Speech.stop();
      Alert.alert('Navegação Parada', 'Navegação por voz desativada.');
      
    } catch (error) {
      console.error('Erro parar navegação:', error);
    }
  };

  const formatarDistancia = (metros) => {
    if (metros < 1000) {
      return `${Math.round(metros)} m`;
    }
    return `${(metros / 1000).toFixed(1)} km`;
  };

  const formatarTempo = (segundos) => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    
    if (horas > 0) {
      return `${horas}h ${minutos}m`;
    }
    return `${minutos} min`;
  };

  if (!visible) return null;

  if (carregando) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.carregandoContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.carregandoTexto}>Carregando rota...</Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              if (navegacaoAtiva) {
                pararNavegacao();
              }
              onClose && onClose();
            }} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>NAVEGAÇÃO DA VIAGEM</Text>
            <Text style={styles.headerSubtitle}>
              DT: {viagem.dt || '---'} • {viagem.destinoCliente || 'Destino'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {temGeofence && (
              <View style={styles.geofenceBadge}>
                <FontAwesome name="circle" size={12} color="#1a73e8" />
                <Text style={styles.geofenceBadgeText}>{geofence.raio}m</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Mapa */}
        <MapView
          ref={mapRef}
          style={styles.mapa}
          provider={PROVIDER_GOOGLE}
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={navegacaoAtiva}
          initialRegion={{
            latitude: origem.latitude,
            longitude: origem.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {/* Rota */}
          {coordenadasRota.length > 0 && (
            <Polyline
              coordinates={coordenadasRota}
              strokeWidth={4}
              strokeColor={navegacaoAtiva ? "#FFD700" : "#1a73e8"}
              lineDashPattern={navegacaoAtiva ? [] : [5, 5]}
            />
          )}
          
          {/* Marcadores */}
          <Marker coordinate={origem} title="Origem" pinColor="green" />
          <Marker coordinate={destino} title="Destino" pinColor="red" />
          
          {/* Geofence (se houver) */}
          {temGeofence && geofence.centro && (
            <Circle
              center={{
                latitude: geofence.centro.lat,
                longitude: geofence.centro.lng
              }}
              radius={geofence.raio}
              strokeColor="#1a73e8"
              strokeWidth={2}
              fillColor="rgba(26, 115, 232, 0.1)"
            />
          )}
        </MapView>
        
        {/* Painel inferior */}
        <View style={styles.painelInferior}>
          {/* Informações da viagem */}
          <View style={styles.infoViagem}>
            <View style={styles.infoItem}>
              <MaterialIcons name="location-on" size={16} color="#666" />
              <Text style={styles.infoLabel}>Destino:</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {viagem.destinoCliente || destino.endereco}
              </Text>
            </View>
            {viagem.tipoViagem && (
              <View style={styles.infoItem}>
                <MaterialIcons name="local-shipping" size={16} color="#666" />
                <Text style={styles.infoLabel}>Tipo:</Text>
                <Text style={styles.infoValue}>{viagem.tipoViagem}</Text>
              </View>
            )}
          </View>
          
          {/* Instrução atual */}
          {instrucaoAtual ? (
            <View style={styles.instrucaoContainer}>
              <MaterialIcons name="directions" size={28} color="#FFD700" />
              <View style={styles.instrucaoConteudo}>
                <Text style={styles.instrucaoTexto}>{instrucaoAtual.texto}</Text>
                <Text style={styles.instrucaoDetalhes}>
                  {instrucaoAtual.distanciaFormatada} • {instrucaoAtual.duracaoFormatada}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.instrucaoContainer}>
              <MaterialIcons name="info" size={28} color="#666" />
              <View style={styles.instrucaoConteudo}>
                <Text style={styles.instrucaoTexto}>
                  {instrucoes.length > 0 ? 'Pronto para navegar' : 'Navegação básica disponível'}
                </Text>
                <Text style={styles.instrucaoDetalhes}>
                  {instrucoes.length > 0 ? `${instrucoes.length} instruções disponíveis` : 'Siga para o destino indicado'}
                </Text>
              </View>
            </View>
          )}
          
          {/* Resumo */}
          <View style={styles.resumoContainer}>
            <View style={styles.resumoItem}>
              <Text style={styles.resumoLabel}>Distância</Text>
              <Text style={styles.resumoValor}>{formatarDistancia(distanciaTotal)}</Text>
            </View>
            <View style={styles.resumoItem}>
              <Text style={styles.resumoLabel}>Tempo</Text>
              <Text style={styles.resumoValor}>{formatarTempo(duracaoTotal)}</Text>
            </View>
            <View style={styles.resumoItem}>
              <Text style={styles.resumoLabel}>Restante</Text>
              <Text style={styles.resumoValor}>{formatarDistancia(distanciaRestante)}</Text>
            </View>
          </View>
          
          {/* Controles */}
          <View style={styles.controles}>
            {instrucoes.length > 0 && (
              <TouchableOpacity 
                style={[styles.botao, styles.botaoSecundario]}
                onPress={() => setMostrarTodasInstrucoes(!mostrarTodasInstrucoes)}
              >
                <MaterialIcons name="list" size={20} color="#fff" />
                <Text style={styles.botaoTexto}>
                  {mostrarTodasInstrucoes ? 'OCULTAR' : 'VER TODAS'}
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[
                styles.botao, 
                navegacaoAtiva ? styles.botaoPerigo : styles.botaoPrimario
              ]}
              onPress={navegacaoAtiva ? pararNavegacao : iniciarNavegacao}
            >
              <MaterialIcons 
                name={navegacaoAtiva ? "stop" : "volume-up"} 
                size={24} 
                color="#fff" 
              />
              <Text style={styles.botaoTexto}>
                {navegacaoAtiva ? 'PARAR VOZ' : 'INICIAR VOZ'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Lista de todas as instruções */}
          {mostrarTodasInstrucoes && instrucoes.length > 0 && (
            <View style={styles.todasInstrucoesContainer}>
              <ScrollView style={styles.instrucoesScroll} showsVerticalScrollIndicator={false}>
                {instrucoes.map((inst, idx) => (
                  <View key={idx} style={[
                    styles.instrucaoListaItem,
                    idx === 0 && styles.instrucaoPrimeira,
                    idx === instrucoes.length - 1 && styles.instrucaoUltima
                  ]}>
                    <View style={styles.instrucaoListaNumero}>
                      <Text style={styles.instrucaoListaNumeroTexto}>{idx + 1}</Text>
                    </View>
                    <View style={styles.instrucaoListaConteudo}>
                      <Text style={styles.instrucaoListaTexto}>{inst.texto}</Text>
                      <View style={styles.instrucaoListaDetalhes}>
                        <Text style={styles.instrucaoListaDistancia}>{inst.distanciaFormatada}</Text>
                        <Text style={styles.instrucaoListaDuracao}>{inst.duracaoFormatada}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Aviso sobre geofence */}
          {temGeofence && (
            <View style={styles.geofenceAviso}>
              <FontAwesome name="info-circle" size={14} color="#1a73e8" />
              <Text style={styles.geofenceAvisoTexto}>
                Ao entrar na área de destino ({geofence.raio}m), você será solicitado a confirmar a chegada.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  carregandoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  carregandoTexto: {
    marginTop: 15,
    fontSize: 16,
    color: '#FFD700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#000',
  },
  backButton: {
    padding: 5,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#fff',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  geofenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 115, 232, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  geofenceBadgeText: {
    color: '#1a73e8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mapa: {
    flex: 1,
  },
  painelInferior: {
    backgroundColor: 'white',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    maxHeight: height * 0.45,
  },
  infoViagem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: 'bold',
  },
  infoValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    maxWidth: 120,
  },
  instrucaoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  instrucaoConteudo: {
    flex: 1,
    marginLeft: 12,
  },
  instrucaoTexto: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  instrucaoDetalhes: {
    fontSize: 13,
    color: '#666',
  },
  resumoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resumoItem: {
    alignItems: 'center',
    flex: 1,
  },
  resumoLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 5,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  resumoValor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  controles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 25,
    flex: 0.48,
  },
  botaoPrimario: {
    backgroundColor: '#FFD700',
  },
  botaoSecundario: {
    backgroundColor: '#333',
  },
  botaoPerigo: {
    backgroundColor: '#dc3545',
  },
  botaoTexto: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
  
  // Lista de instruções
  todasInstrucoesContainer: {
    marginTop: 10,
    marginBottom: 15,
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    backgroundColor: '#fafafa',
  },
  instrucoesScroll: {
    padding: 10,
  },
  instrucaoListaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  instrucaoPrimeira: {
    borderTopWidth: 0,
  },
  instrucaoUltima: {
    borderBottomWidth: 0,
  },
  instrucaoListaNumero: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  instrucaoListaNumeroTexto: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  instrucaoListaConteudo: {
    flex: 1,
  },
  instrucaoListaTexto: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  instrucaoListaDetalhes: {
    flexDirection: 'row',
    gap: 15,
  },
  instrucaoListaDistancia: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  instrucaoListaDuracao: {
    fontSize: 11,
    color: '#666',
  },
  
  // Aviso geofence
  geofenceAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 115, 232, 0.05)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 5,
  },
  geofenceAvisoTexto: {
    flex: 1,
    fontSize: 11,
    color: '#1a73e8',
    lineHeight: 16,
  },
});

export default NavegacaoAudio;