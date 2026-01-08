import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const StatusAtual = ({ cargaAtiva }) => {
  
  const getStatusInfo = () => {
    // Caso não haja carga
    if (!cargaAtiva) {
      return {
        label: "SEM PROGRAMAÇÃO",
        cor: "#888",
        icon: "truck-off",
        detalhe: "Aguardando nova carga",
        badgeColor: "#333"
      };
    }

    // Status do painel gestor tem prioridade
    const statusEditado = cargaAtiva.statusOperacional || cargaAtiva.status || "PROGRAMADO";
    const destino = cargaAtiva.destinoCidade || cargaAtiva.cidade_destino || "Destino não informado";

    // Lógica de cores
    let corStatus = "#FFD700"; // Amarelo padrão
    let badgeColor = "#333";
    
    if (cargaAtiva.finalizada) {
      corStatus = "#2ecc71"; // Verde finalizada
      badgeColor = "#2ecc71";
    } else if (cargaAtiva.chegouAoDestino) {
      corStatus = "#2ecc71"; // Verde chegou
      badgeColor = "#2ecc71";
    } else if (cargaAtiva.viagemIniciada) {
      corStatus = "#3498db"; // Azul em rota
      badgeColor = "#3498db";
    } else if (cargaAtiva.tipoViagem === 'VAZIO') {
      corStatus = "#9b59b6"; // Roxo vazio
      badgeColor = "#9b59b6";
    }

    return {
      label: statusEditado.toUpperCase(),
      cor: corStatus,
      badgeColor: badgeColor,
      icon: cargaAtiva.finalizada ? "check-circle" : 
            cargaAtiva.chegouAoDestino ? "map-marker-check" :
            cargaAtiva.viagemIniciada ? "truck-fast" : "truck",
      detalhe: destino
    };
  };

  const status = getStatusInfo();
  const temCarga = !!cargaAtiva;

  return (
    <TouchableOpacity 
      style={[styles.container, temCarga && { borderColor: status.cor }]}
      activeOpacity={0.9}
    >
      <View style={[styles.indicator, { backgroundColor: status.cor }]} />
      
      <View style={styles.textContainer}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: status.cor }]}>{status.label}</Text>
          {temCarga && cargaAtiva.dt && (
            <View style={[styles.dtBadge, { backgroundColor: status.badgeColor }]}>
              <Text style={styles.dtText}>DT {cargaAtiva.dt}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.destRow}>
          <MaterialCommunityIcons name="map-marker" size={12} color="#AAA" />
          <Text style={styles.subtitle} numberOfLines={1}>{status.detalhe}</Text>
        </View>
        
        {temCarga && cargaAtiva.tipoViagem && (
          <Text style={styles.tipoViagem}>
            {cargaAtiva.tipoViagem === 'VAZIO' ? '🚚 VAZIO' : '📦 CARREGADO'}
          </Text>
        )}
      </View>
      
      <MaterialCommunityIcons 
        name={status.icon} 
        size={26} 
        color={status.cor} 
        style={styles.icon} 
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#222',
    zIndex: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  indicator: {
    width: 4,
    height: '80%',
    borderRadius: 2,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  title: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    flex: 1
  },
  dtBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8
  },
  dtText: {
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold'
  },
  subtitle: {
    color: '#AAA',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
    flex: 1
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  tipoViagem: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start'
  },
  icon: {
    marginLeft: 10,
  }
});

export default StatusAtual;