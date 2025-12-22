import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Operacao({ aoVoltar }) {
  const [km, setKm] = useState('');
  const [litros, setLitros] = useState('');
  const [fotoHodometro, setFotoHodometro] = useState(null);

  return (
    <View style={styles.containerTelas}>
      <Text style={styles.tituloTela}>Operação / Abastecimento</Text>
      
      <TextInput 
        style={styles.inputFundo} 
        placeholder="KM ATUAL" 
        placeholderTextColor="#666" 
        keyboardType="numeric" 
        value={km} 
        onChangeText={setKm} 
      />
      
      <TextInput 
        style={styles.inputFundo} 
        placeholder="LITROS" 
        placeholderTextColor="#666" 
        keyboardType="numeric" 
        value={litros} 
        onChangeText={setLitros} 
      />

      <TouchableOpacity style={styles.btnFoto}>
          <MaterialCommunityIcons name="camera" size={40} color="#FFD700" />
          <Text style={{color: '#888', fontSize: 10, marginTop: 5}}>FOTO DO HODÔMETRO</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.btnSalvar} 
        onPress={() => Alert.alert("Sucesso", "Dados enviados para o administrador.")}
      >
        <Text style={styles.btnTexto}>SALVAR REGISTRO</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnVoltar} onPress={aoVoltar}>
        <Text style={{color: '#FFF'}}>CANCELAR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  containerTelas: { flex: 1, backgroundColor: '#000', padding: 20, paddingTop: 50 },
  tituloTela: { color: '#FFD700', fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  inputFundo: { backgroundColor: '#1A1A1A', color: '#FFF', padding: 15, borderRadius: 10, marginBottom: 15 },
  btnSalvar: { backgroundColor: '#FFD700', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnTexto: { color: '#000', fontWeight: 'bold' },
  btnVoltar: { padding: 18, alignItems: 'center', marginTop: 10 },
  btnFoto: { width: '100%', height: 120, backgroundColor: '#1A1A1A', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#FFD700' }
});