import React, { useState, useEffect } from 'react';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, doc, updateDoc 
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth"; // Importação necessária

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app); // Inicializa o serviço de autenticação

export default function Motoristas() {
  const [motoristas, setMotoristas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [novoMotorista, setNovoMotorista] = useState({
    nome: '', cpf: '', cnh_cat: '', mopp: 'Não', venc_mopp: '',
    cidade: '', nascimento: '', telefone: '', status: 'ATIVO',
    email_app: '', senha_app: '' 
  });

  useEffect(() => {
    const q = query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      setMotoristas(lista);
    });
    return () => unsubscribe();
  }, []);

  const salvarMotorista = async () => {
    if (!novoMotorista.nome || !novoMotorista.cpf || !novoMotorista.email_app || !novoMotorista.senha_app) {
      alert("Preencha Nome, CPF, E-mail e Senha para o App!");
      return;
    }

    setCarregando(true);

    try {
      if (editandoId) {
        // MODO EDIÇÃO
        await updateDoc(doc(db, "cadastro_motoristas", editandoId), novoMotorista);
        alert("Dados atualizados com sucesso!");
        setEditandoId(null);
      } else {
        // 1. CRIA O LOGIN NO AUTHENTICATION
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          novoMotorista.email_app, 
          novoMotorista.senha_app
        );
        const uid = userCredential.user.uid;

        // 2. SALVA NO FIRESTORE COM O UID VINCULADO
        await addDoc(collection(db, "cadastro_motoristas"), {
          ...novoMotorista,
          uid: uid // Vincula o login ao cadastro
        });

        alert("Motorista e Login criados com sucesso!");
      }
      
      setNovoMotorista({
        nome: '', cpf: '', cnh_cat: '', mopp: 'Não', venc_mopp: '',
        cidade: '', nascimento: '', telefone: '', status: 'ATIVO',
        email_app: '', senha_app: ''
      });
    } catch (e) {
      console.error("Erro:", e);
      if (e.code === 'auth/email-already-in-use') {
        alert("Este e-mail já está sendo usado por outro motorista!");
      } else if (e.code === 'auth/weak-password') {
        alert("A senha deve ter pelo menos 6 dígitos!");
      } else {
        alert("Erro ao criar acesso: " + e.message);
      }
    } finally {
      setCarregando(false);
    }
  };

  const prepararEdicao = (m) => {
    setEditandoId(m.id);
    setNovoMotorista({ ...m });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNovoMotorista({
      nome: '', cpf: '', cnh_cat: '', mopp: 'Não', venc_mopp: '',
      cidade: '', nascimento: '', telefone: '', status: 'ATIVO',
      email_app: '', senha_app: ''
    });
  };

  const alternarStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    await updateDoc(doc(db, "cadastro_motoristas", id), { status: novoStatus });
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.titulo}>
        LOGÍSTICA OPERACIONAL - {editandoId ? 'EDITAR MOTORISTA' : 'CADASTRO DE MOTORISTAS'}
      </h2>

      <div style={styles.cardForm}>
        <div style={styles.gridForm}>
          <div style={styles.campo}><label style={styles.label}>Nome do Motorista</label>
            <input placeholder="Ex: Rafael Araujo" style={styles.input} value={novoMotorista.nome} onChange={e => setNovoMotorista({...novoMotorista, nome: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}>CPF</label>
            <input placeholder="000.000.000-00" style={styles.input} value={novoMotorista.cpf} onChange={e => setNovoMotorista({...novoMotorista, cpf: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}>E-mail para o App</label>
            <input placeholder="raabi@teste.com" style={{...styles.input, borderColor: '#FFD700'}} value={novoMotorista.email_app} onChange={e => setNovoMotorista({...novoMotorista, email_app: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}>Senha para o App</label>
            <input placeholder="Mínimo 6 dígitos" type="password" style={{...styles.input, borderColor: '#FFD700'}} value={novoMotorista.senha_app} onChange={e => setNovoMotorista({...novoMotorista, senha_app: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}>Categoria CNH</label>
            <input placeholder="Ex: AE" style={styles.input} value={novoMotorista.cnh_cat} onChange={e => setNovoMotorista({...novoMotorista, cnh_cat: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}>Cidade de Residência</label>
            <input placeholder="Ex: Araraquara - SP" style={styles.input} value={novoMotorista.cidade} onChange={e => setNovoMotorista({...novoMotorista, cidade: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}>Telefone / WhatsApp</label>
            <input placeholder="(00) 00000-0000" style={styles.input} value={novoMotorista.telefone} onChange={e => setNovoMotorista({...novoMotorista, telefone: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}>Possui MOPP?</label>
            <select style={styles.input} value={novoMotorista.mopp} onChange={e => setNovoMotorista({...novoMotorista, mopp: e.target.value})}>
              <option value="Não">Não</option><option value="Sim">Sim</option>
            </select>
          </div>
        </div>
        
        <div style={{display: 'flex', gap: '10px'}}>
          <button onClick={salvarMotorista} disabled={carregando} style={{...styles.btnLancamento, backgroundColor: editandoId ? '#2ecc71' : '#FFD700'}}>
            {carregando ? 'PROCESSANDO...' : (editandoId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR E CRIAR ACESSO')}
          </button>
          {editandoId && (
            <button onClick={cancelarEdicao} style={{...styles.btnLancamento, backgroundColor: '#e74c3c', color: '#FFF'}}>CANCELAR</button>
          )}
        </div>
      </div>

      <div style={styles.containerTabela}>
        <table style={styles.tabela}>
          <thead>
            <tr style={styles.headerTabela}>
              <th>STATUS</th><th>NOME</th><th>E-MAIL APP</th><th>CIDADE</th><th>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map(m => (
              <tr key={m.id} style={styles.linhaTabela}>
                <td><span style={{...styles.badge, backgroundColor: m.status === 'ATIVO' ? '#2ecc71' : '#e74c3c'}}>{m.status}</span></td>
                <td>{m.nome}</td>
                <td style={{color: '#FFD700'}}>{m.email_app}</td>
                <td>{m.cidade}</td>
                <td>
                  <div style={{display: 'flex', gap: '5px'}}>
                    <button onClick={() => prepararEdicao(m)} style={styles.btnAcao}>Editar</button>
                    <button onClick={() => alternarStatus(m.id, m.status)} style={styles.btnAcao}>
                      {m.status === 'ATIVO' ? 'Bloquear' : 'Ativar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#FFF' },
  titulo: { color: '#FFD700', fontSize: '18px', marginBottom: '20px', borderLeft: '4px solid #FFD700', paddingLeft: '10px' },
  cardForm: { backgroundColor: '#111', padding: '20px', borderRadius: '8px', marginBottom: '30px' },
  gridForm: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '10px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { color: '#FFD700', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' },
  input: { backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#FFF', padding: '12px', borderRadius: '4px', fontSize: '14px' },
  btnLancamento: { flex: 1, padding: '15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', marginTop: '20px', cursor: 'pointer' },
  containerTabela: { overflowX: 'auto' },
  tabela: { width: '100%', borderCollapse: 'collapse', marginTop: '10px' },
  headerTabela: { color: '#888', textAlign: 'left', fontSize: '11px', borderBottom: '1px solid #222' },
  linhaTabela: { borderBottom: '1px solid #111', fontSize: '13px', height: '50px' },
  badge: { padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', color: '#000' },
  btnAcao: { backgroundColor: '#222', color: '#FFF', border: '1px solid #444', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }
};