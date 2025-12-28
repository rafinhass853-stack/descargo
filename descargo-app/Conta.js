import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
// O import de ícones deve ficar no topo junto com os outros
import { MaterialIcons } from '@expo/vector-icons';

const Conta = ({ auth, db }) => {
  const [loading, setLoading] = useState(true);
  const [docId, setDocId] = useState(null); 
  
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [cpf, setCpf] = useState('');
  
  const [senhaAtualDigitada, setSenhaAtualDigitada] = useState('');
  const [senhaGravadaNoBanco, setSenhaGravadaNoBanco] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  useEffect(() => {
    const carregarDadosMotorista = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const q = query(
            collection(db, "cadastro_motoristas"), 
            where("uid", "==", user.uid)
          );
          
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const dados = docSnap.data();
            
            setDocId(docSnap.id); 
            setNome(dados.nome || 'Não informado');
            setLogin(dados.email_app || user.email);
            setCpf(dados.cpf || 'Não informado');
            setSenhaGravadaNoBanco(dados.senha_app || '');
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        Alert.alert("Erro", "Não foi possível carregar as informações do seu perfil.");
      } finally {
        setLoading(false);
      }
    };

    carregarDadosMotorista();
  }, [auth.currentUser]);

  const handleUpdatePassword = async () => {
    if (!senhaAtualDigitada || !novaSenha || !confirmarSenha) {
      Alert.alert("Erro", "Preencha todos os campos de senha.");
      return;
    }

    if (senhaAtualDigitada !== senhaGravadaNoBanco) {
      Alert.alert("Erro", "A senha atual digitada não confere com nossos registros.");
      return;
    }

    if (novaSenha.length < 6) {
      Alert.alert("Erro", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      Alert.alert("Erro", "A confirmação da nova senha não coincide.");
      return;
    }

    try {
      setLoading(true);
      const motoristaRef = doc(db, "cadastro_motoristas", docId);

      await updateDoc(motoristaRef, {
        senha_app: novaSenha
      });

      Alert.alert("Sucesso", "Sua senha de acesso ao aplicativo foi atualizada!");
      setSenhaGravadaNoBanco(novaSenha);
      setSenhaAtualDigitada('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Falha ao atualizar senha no banco de dados.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !nome) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{color: '#888', marginTop: 10}}>Carregando perfil...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 100}}>
        <View style={styles.header}>
          <Text style={styles.title}>Minha Conta</Text>
          <Text style={styles.subtitle}>Gerencie suas informações e segurança</Text>
        </View>

        {/* SEÇÃO: DADOS PESSOAIS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados Pessoais</Text>
          
          <Text style={styles.label}>Nome Completo</Text>
          <TextInput style={[styles.input, styles.disabledInput]} value={nome} editable={false} />

          <Text style={styles.label}>Login de Acesso</Text>
          <TextInput style={[styles.input, styles.disabledInput]} value={login} editable={false} />

          <Text style={styles.label}>CPF</Text>
          <TextInput style={[styles.input, styles.disabledInput]} value={cpf} editable={false} />
          
          <View style={styles.infoBox}>
             <MaterialIcons name="info" size={14} color="#555" />
             <Text style={styles.infoText}> Para alterar dados, contate a administração.</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* SEÇÃO: ALTERAR SENHA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alterar Senha do App</Text>
          
          <Text style={styles.label}>Senha Atual</Text>
          <TextInput 
            style={styles.input} 
            secureTextEntry 
            value={senhaAtualDigitada}
            onChangeText={setSenhaAtualDigitada}
            placeholder="Digite sua senha atual"
            placeholderTextColor="#444"
          />

          <Text style={styles.label}>Nova Senha</Text>
          <TextInput 
            style={styles.input} 
            secureTextEntry 
            value={novaSenha}
            onChangeText={setNovaSenha}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#444"
          />

          <Text style={styles.label}>Confirmar Nova Senha</Text>
          <TextInput 
            style={styles.input} 
            secureTextEntry 
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
            placeholder="Repita a nova senha"
            placeholderTextColor="#444"
          />

          <TouchableOpacity 
            style={[styles.button, loading && {opacity: 0.7}]} 
            onPress={handleUpdatePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>SALVAR NOVA SENHA</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20 },
  header: { marginBottom: 30, marginTop: 40 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFD700', letterSpacing: -1 },
  subtitle: { fontSize: 14, color: '#666', marginTop: 5 },
  section: { backgroundColor: '#0A0A0A', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1A1A1A' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#FFF', borderLeftWidth: 3, borderLeftColor: '#FFD700', paddingLeft: 10 },
  label: { fontSize: 11, color: '#FFD700', marginBottom: 8, fontWeight: '900', textTransform: 'uppercase', opacity: 0.8 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 12, padding: 15, marginBottom: 20, fontSize: 16, color: '#FFF' },
  disabledInput: { color: '#666', backgroundColor: '#050505', borderColor: '#111' },
  infoBox: { flexDirection: 'row', alignItems: 'center', marginTop: -5 },
  infoText: { fontSize: 11, color: '#555', fontStyle: 'italic' },
  divider: { height: 25 },
  button: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#000', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});

export default Conta;