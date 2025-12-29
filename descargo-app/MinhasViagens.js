import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MinhasViagens() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Minhas Viagens</Text>
      <Text style={styles.text}>Histórico de viagens concluídas.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFD700', fontSize: 24, fontWeight: 'bold' },
  text: { color: '#FFF', marginTop: 10 }
});