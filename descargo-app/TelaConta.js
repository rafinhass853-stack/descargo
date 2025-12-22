import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function TelaConta({ aoVoltar, logoff, userEmail }) {
  return (
    <View style={styles.containerTelas}>
      <Text style={styles.tituloTela}>Minha Conta</Text>
      <Text style={{color: '#888', marginBottom: 20, textAlign: 'center'}}>
        Logado como: {userEmail}
      </Text>
      
      <TouchableOpacity style={styles.itemMenu} onPress={logoff}>
        <Text style={{color: '#e74c3c', fontWeight: 'bold'}}>Sair do Aplicativo</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnVoltar} onPress={aoVoltar}>
        <Text style={{color: '#FFD700', fontWeight: 'bold'}}>VOLTAR AO MAPA</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  containerTelas: { flex: 1, backgroundColor: '#000', padding: 20, paddingTop: 50 },
  tituloTela: { color: '#FFD700', fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  itemMenu: { padding: 20, borderBottomWidth: 1, borderColor: '#222', alignItems: 'center' },
  btnVoltar: { padding: 18, alignItems: 'center', marginTop: 20 }
});