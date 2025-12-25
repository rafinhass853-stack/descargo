import React, { useState, useEffect } from 'react';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, doc, updateDoc 
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { 
  User, Phone, MapPin, CreditCard, ShieldCheck, Mail, 
  Key, Edit, Power, Eye, EyeOff, Fingerprint, Award 
} from 'lucide-react';

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
const auth = getAuth(app);

export default function Motoristas() {
  const [motoristas, setMotoristas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [verSenhas, setVerSenhas] = useState(false);
  const [novoMotorista, setNovoMotorista] = useState({
    nome: '', cpf: '', cnh_cat: '', mopp: 'Não',
    cidade: '', telefone: '', status: 'ATIVO',
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
      alert("Erro: Preencha Nome, CPF, E-mail e Senha!");
      return;
    }

    setCarregando(true);
    try {
      if (editandoId) {
        await updateDoc(doc(db, "cadastro_motoristas", editandoId), novoMotorista);
        alert("Cadastro atualizado!");
        setEditandoId(null);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, novoMotorista.email_app, novoMotorista.senha_app);
        const uid = userCredential.user.uid;
        await addDoc(collection(db, "cadastro_motoristas"), { ...novoMotorista, uid: uid });
        alert("Motorista cadastrado com sucesso!");
      }
      setNovoMotorista({
        nome: '', cpf: '', cnh_cat: '', mopp: 'Não',
        cidade: '', telefone: '', status: 'ATIVO',
        email_app: '', senha_app: ''
      });
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setCarregando(false);
    }
  };

  const prepararEdicao = (m) => {
    setEditandoId(m.id);
    setNovoMotorista({ ...m });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const alternarStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    await updateDoc(doc(db, "cadastro_motoristas", id), { status: novoStatus });
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerAcoes}>
        <h2 style={styles.titulo}>LISTA DE MOTORISTAS CADASTRADOS</h2>
        <button onClick={() => setVerSenhas(!verSenhas)} style={styles.btnRevelar}>
          {verSenhas ? <EyeOff size={16}/> : <Eye size={16}/>} 
          {verSenhas ? 'OCULTAR ACESSOS' : 'VER SENHAS'}
        </button>
      </div>

      <div style={styles.cardForm}>
        <div style={styles.gridForm}>
          <div style={styles.campo}><label style={styles.label}><User size={12}/> Nome</label>
            <input style={styles.input} placeholder="Nome completo" value={novoMotorista.nome} onChange={e => setNovoMotorista({...novoMotorista, nome: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><CreditCard size={12}/> CPF</label>
            <input style={styles.input} placeholder="000.000.000-00" value={novoMotorista.cpf} onChange={e => setNovoMotorista({...novoMotorista, cpf: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><Award size={12}/> CNH</label>
            <input style={styles.input} placeholder="Cat. AE" value={novoMotorista.cnh_cat} onChange={e => setNovoMotorista({...novoMotorista, cnh_cat: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><ShieldCheck size={12}/> MOPP</label>
            <select style={styles.input} value={novoMotorista.mopp} onChange={e => setNovoMotorista({...novoMotorista, mopp: e.target.value})}>
              <option value="Não">Não</option><option value="Sim">Sim</option>
            </select>
          </div>
          <div style={styles.campo}><label style={styles.label}><MapPin size={12}/> Cidade</label>
            <input style={styles.input} placeholder="Cidade/UF" value={novoMotorista.cidade} onChange={e => setNovoMotorista({...novoMotorista, cidade: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><Phone size={12}/> WhatsApp</label>
            <input style={styles.input} placeholder="(00) 00000-0000" value={novoMotorista.telefone} onChange={e => setNovoMotorista({...novoMotorista, telefone: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><Mail size={12}/> E-mail App</label>
            <input style={{...styles.input, borderColor: '#FFD700'}} placeholder="login@app.com" value={novoMotorista.email_app} onChange={e => setNovoMotorista({...novoMotorista, email_app: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><Key size={12}/> Senha App</label>
            <input style={{...styles.input, borderColor: '#FFD700'}} placeholder="Mínimo 6 caracteres" value={novoMotorista.senha_app} onChange={e => setNovoMotorista({...novoMotorista, senha_app: e.target.value})} />
          </div>
        </div>
        
        <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
          <button onClick={salvarMotorista} disabled={carregando} style={{...styles.btnSalvar, backgroundColor: editandoId ? '#2ecc71' : '#FFD700'}}>
            {carregando ? 'PROCESSANDO...' : (editandoId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR MOTORISTA')}
          </button>
          {editandoId && <button onClick={() => setEditandoId(null)} style={styles.btnCancelar}>CANCELAR</button>}
        </div>
      </div>

      <div style={styles.wrapperTabela}>
        <table style={styles.tabela}>
          <thead>
            <tr style={styles.headerTab}>
              <th style={styles.th}>STATUS</th>
              <th style={styles.th}>NOME</th>
              <th style={styles.th}>CPF</th>
              <th style={styles.th}>WHATSAPP</th>
              <th style={styles.th}>CNH</th>
              <th style={styles.th}>MOPP</th>
              <th style={styles.th}>CIDADE</th>
              <th style={styles.th}>E-MAIL</th>
              <th style={styles.th}>SENHA</th>
              <th style={styles.th}>UID</th>
              <th style={styles.th}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map(m => (
              <tr key={m.id} style={styles.linha}>
                <td style={styles.td}><span style={{...styles.badge, backgroundColor: m.status === 'ATIVO' ? '#2ecc71' : '#e74c3c'}}>{m.status}</span></td>
                <td style={{...styles.td, fontWeight: 'bold'}}>{m.nome.toUpperCase()}</td>
                <td style={styles.td}>{m.cpf}</td>
                <td style={styles.td}>{m.telefone}</td>
                <td style={{...styles.td, color: '#FFD700', fontWeight: 'bold'}}>{m.cnh_cat}</td>
                <td style={styles.td}>{m.mopp}</td>
                <td style={styles.td}>{m.cidade}</td>
                <td style={{...styles.td, color: '#FFD700'}}>{m.email_app}</td>
                <td style={styles.td}>{verSenhas ? m.senha_app : '****'}</td>
                <td style={{...styles.td, fontSize: '9px', opacity: 0.5}}>{m.uid || '---'}</td>
                <td style={styles.td}>
                  <div style={{display: 'flex', gap: '5px'}}>
                    <button onClick={() => prepararEdicao(m)} style={styles.btnIcon}><Edit size={14}/></button>
                    <button onClick={() => alternarStatus(m.id, m.status)} style={{...styles.btnIcon, color: m.status === 'ATIVO' ? '#e74c3c' : '#2ecc71'}}><Power size={14}/></button>
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
  headerAcoes: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  titulo: { color: '#FFD700', fontSize: '16px', borderLeft: '4px solid #FFD700', paddingLeft: '10px' },
  btnRevelar: { backgroundColor: '#111', color: '#FFD700', border: '1px solid #FFD700', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' },
  cardForm: { backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '12px', border: '1px solid #222', marginBottom: '25px' },
  gridForm: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { color: '#666', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' },
  input: { backgroundColor: '#111', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none' },
  btnSalvar: { flex: 1, padding: '12px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', color: '#000' },
  btnCancelar: { padding: '12px 20px', backgroundColor: '#e74c3c', border: 'none', borderRadius: '6px', color: '#FFF', cursor: 'pointer' },
  wrapperTabela: { backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid #222', overflowX: 'auto' },
  tabela: { width: '100%', borderCollapse: 'collapse', minWidth: '1200px' },
  headerTab: { backgroundColor: '#111', textAlign: 'left' },
  th: { padding: '15px', color: '#666', fontSize: '10px', fontWeight: 'bold' },
  td: { padding: '12px 15px', fontSize: '12px', borderBottom: '1px solid #111' },
  linha: { borderBottom: '1px solid #111' },
  badge: { padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', color: '#000' },
  btnIcon: { backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#FFF', padding: '6px', borderRadius: '4px', cursor: 'pointer' }
};