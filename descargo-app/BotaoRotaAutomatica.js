// BotaoRotaAutomatica.js
import React from 'react';
import { TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { 
  obterCoordenadasDoEndereco, 
  calcularRotaAutomatica,
  calcularDistancia,
  formatarTempoEstimado 
} from './GpseCercas';

const BotaoRotaAutomatica = ({ location, cargaAtiva, setRotaCoords, disabled }) => {
  const [loading, setLoading] = React.useState(false);

  const handleIniciarRota = async () => {
    if (!cargaAtiva) {
      alert("Nenhuma carga ativa selecionada.");
      return;
    }

    if (!location) {
      alert("Aguardando GPS...");
      return;
    }

    setLoading(true);
    try {
      // Primeiro tenta obter coordenadas do destino
      let destinoCoords = null;
      
      // Tenta do geofence
      if (cargaAtiva.cercaVirtual?.centro) {
        destinoCoords = cargaAtiva.cercaVirtual.centro;
      }
      // Tenta do campo destinoCoordenadas
      else if (cargaAtiva.destinoCoordenadas) {
        destinoCoords = cargaAtiva.destinoCoordenadas;
      }
      // Tenta do link do Google Maps
      else if (cargaAtiva.destinoLink) {
        destinoCoords = await obterCoordenadasDoEndereco(cargaAtiva.destinoLink);
      }
      // Tenta do nome do cliente + cidade
      else if (cargaAtiva.destinoCliente && cargaAtiva.destinoCidade) {
        const enderecoBusca = `${cargaAtiva.destinoCliente}, ${cargaAtiva.destinoCidade}`;
        destinoCoords = await obterCoordenadasDoEndereco(enderecoBusca);
      }

      if (!destinoCoords) {
        Alert.alert(
          "❌ Erro", 
          "Não foi possível obter as coordenadas do destino.\n\nVerifique se o endereço do destino está cadastrado corretamente.",
          [{ text: "OK" }]
        );
        setLoading(false);
        return;
      }

      // Calcula a rota
      const resultado = await calcularRotaAutomatica(
        { latitude: location.latitude, longitude: location.longitude },
        destinoCoords,
        setRotaCoords,
        cargaAtiva
      );

      if (resultado) {
        // Calcula distância aproximada
        const distanciaMetros = calcularDistancia(
          location.latitude,
          location.longitude,
          destinoCoords.lat || destinoCoords.latitude,
          destinoCoords.lng || destinoCoords.longitude
        );
        
        const distanciaKm = Math.round((distanciaMetros / 1000) * 10) / 10;
        const tempoFormatado = formatarTempoEstimado(distanciaKm);
        
        Alert.alert(
          "✅ Rota Configurada",
          `Rota calculada da sua localização atual até:\n\n📍 ${cargaAtiva.destinoCliente || 'Destino'}\n\n📏 Distância: ${distanciaKm} km\n⏱️ Tempo estimado: ${tempoFormatado}`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "⚠️ Atenção",
          "A rota foi calculada, mas pode haver restrições no caminho.\n\nVerifique a rota no mapa.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Erro ao criar rota automática:", error);
      Alert.alert(
        "❌ Erro", 
        "Não foi possível calcular a rota.\n\nVerifique sua conexão com a internet ou tente novamente.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleIniciarRota}
      disabled={disabled || loading}
      style={{
        position: 'absolute',
        bottom: 280,
        right: 20,
        backgroundColor: (disabled || loading) ? '#666' : '#FFD700',
        padding: 12,
        borderRadius: 50,
        zIndex: 5,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#000" />
      ) : (
        <MaterialIcons name="route" size={24} color="#000" />
      )}
    </TouchableOpacity>
  );
};

export default BotaoRotaAutomatica;