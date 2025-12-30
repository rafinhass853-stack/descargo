// Status.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Status = ({ status }) => {
  // Define a cor baseada no texto do status
  const getStatusColor = () => {
    if (status.includes('vazio')) return '#888';
    if (status.includes('carregado')) return '#FFD700';
    return '#444'; // Sem programação
  };

  return (
    <View style={[styles.container, { borderColor: getStatusColor() }]}>
      <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
      <Text style={styles.text}>{status.toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 30,
    borderWidth: 1,
    flex: 1, // Faz ele ocupar o espaço disponível ao lado do velocímetro
    marginRight: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
});

export default Status;