import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

const Conta = ({ auth, db }) => {
  const [loading, setLoading] = useState(true);
  const [docId, setDocId] = useState(null); // Para guardar o ID do documento (EQKool...)
  
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
          // Busca na coleção onde o CAMPO 'uid' é igual ao uid do Auth
          const q = query(
            collection(db, "cadastro_motoristas"), 
            where("uid", "==", user.uid)
          );
          
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const dados = docSnap.data();
            
            setDocId(docSnap.id); // Guarda o ID do documento para o update posterior
            setNome(dados.nome || 'Não informado');
            setLogin(dados.email_app || user.email);
            setCpf(dados.cpf || 'Não informado');
            setSenhaGravadaNoBanco(dados.senha_app || '');
          } else {
            console.log("Nenhum documento encontrado para o UID:", user.uid);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        Alert.alert("Erro", "Não foi possível carregar as informações.");
      } finally {
        setLoading(false);
      }
    };

    carregarDadosMotorista();
  }, [auth.currentUser]);

  const handleUpdatePassword = async () => {
    if (!senhaAtualDigitada || !novaSenha || !confirmarSenha) {
      Alert.alert("Erro", "Preencha todos os campos.");
      return;
    }

    if (senhaAtualDigitada !== senhaGravadaNoBanco) {
      Alert.alert("Erro", "A senha atual está incorreta.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      Alert.alert("Erro", "As senhas não coincidem.");
      return;
    }

    try {
      setLoading(true);
      const motoristaRef = doc(db, "cadastro_motoristas", docId);

      await updateDoc(motoristaRef, {
        senha_app: novaSenha
      });

      Alert.alert("Sucesso", "Senha atualizada!");
      setSenhaGravadaNoBanco(novaSenha);
      setSenhaAtualDigitada('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error) {
      Alert.alert("Erro", "Falha ao atualizar no banco.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !nome) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Minha Conta</Text>
        <Text style={styles.subtitle}>Informações do Motorista</Text>
      </View>

      {/* Espaço Vermelho: Apenas Leitura */}
      <View style={styles.section}>
        <Text style={styles.label}>Nome Completo</Text>
        <TextInput style={[styles.input, styles.disabledInput]} value={nome} editable={false} />

        <Text style={styles.label}>Login (E-mail)</Text>
        <TextInput style={[styles.input, styles.disabledInput]} value={login} editable={false} />

        <Text style={styles.label}>CPF</Text>
        <TextInput style={[styles.input, styles.disabledInput]} value={cpf} editable={false} />
        <Text style={styles.infoText}>* Dados protegidos. Fale com o administrador para alterar.</Text>
      </View>

      <View style={styles.divider} />

      {/* Seção de Senha: Única que o usuário altera */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Segurança</Text>
        
        <Text style={styles.label}>Senha Atual</Text>
        <TextInput 
          style={styles.input} 
          secureTextEntry 
          value={senhaAtualDigitada}
          onChangeText={setSenhaAtualDigitada}
          placeholder="Confirme sua senha atual"
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
          placeholderTextColor="#444"
        />

        <TouchableOpacity style={styles.button} onPress={handleUpdatePassword}>
          <Text style={styles.buttonText}>ATUALIZAR SENHA</Text>
        </TouchableOpacity>
      </View>
      <View style={{height: 100}} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  header: { marginBottom: 30, marginTop: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  subtitle: { fontSize: 16, color: '#888' },
  section: { backgroundColor: '#111', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#222' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#FFD700' },
  label: { fontSize: 12, color: '#666', marginBottom: 5, fontWeight: 'bold', textTransform: 'uppercase' },
  input: { backgroundColor: '#000', borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 12, marginBottom: 15, fontSize: 16, color: '#FFF' },
  disabledInput: { color: '#888', borderColor: '#222' },
  infoText: { fontSize: 11, color: '#555', fontStyle: 'italic' },
  divider: { height: 20 },
  button: { backgroundColor: '#FFD700', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#000', fontSize: 14, fontWeight: '900' },
});

export default Conta;