import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Jornada() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Minha Jornada</Text>
      <Text style={styles.text}>Controle de horários e descansos.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFD700', fontSize: 24, fontWeight: 'bold' },
  text: { color: '#FFF', marginTop: 10 }
});