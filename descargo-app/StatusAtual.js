import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const StatusAtual = ({ cargaAtiva }) => {
  // Lógica para definir o conteúdo baseado na carga
  const getStatusInfo = () => {
    if (!cargaAtiva) {
      return {
        label: "SEM VIAGEM",
        cor: "#888",
        icon: "truck-off",
        detalhe: "Aguardando programação"
      };
    }

    const destino = cargaAtiva.destinoCidade || cargaAtiva.cidade_destino || "Destino não informado";

    if (cargaAtiva.tipoViagem === 'VAZIO') {
      return {
        label: "EM DESLOCAMENTO VAZIO",
        cor: "#3498db", // Azul
        icon: "truck-fast",
        detalhe: destino
      };
    }

    return {
      label: "VIAGEM CARREGADO",
      cor: "#2ecc71", // Verde
      icon: "truck-check",
      detalhe: destino
    };
  };

  const status = getStatusInfo();

  return (
    <View style={styles.container}>
      <View style={[styles.indicator, { backgroundColor: status.cor }]} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{status.label}</Text>
        <View style={styles.destRow}>
           <MaterialCommunityIcons name="map-marker" size={12} color="#AAA" />
           <Text style={styles.subtitle} numberOfLines={1}>{status.detalhe}</Text>
        </View>
      </View>
      <MaterialCommunityIcons name={status.icon} size={24} color={status.cor} style={styles.icon} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50, // Logo abaixo da StatusBar
    left: 20,
    right: 100, // Espaço para não bater no velocímetro que está na direita
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 20,
  },
  indicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#AAA',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  icon: {
    marginLeft: 10,
  }
});

export default StatusAtual;