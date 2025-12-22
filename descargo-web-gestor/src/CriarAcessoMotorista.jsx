import React, { useState } from 'react';
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { UserPlus, Mail, Lock, Phone, Truck, ShieldCheck, XCircle } from 'lucide-react';

const CriarAcessoMotorista = ({ onFechar }) => {
    const [dados, setDados] = useState({
        nome: '',
        email: '',
        senha: '',
        telefone: '',
        placa: '',
        modeloVeiculo: '',
        tipo: 'motorista' // Definido como motorista por padrão
    });

    const [carregando, setCarregando] = useState(false);

    const handleChange = (e) => {
        setDados({ ...dados, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setCarregando(true);

        try {
            // 1. Salvando os dados no Firestore na coleção de motoristas
            // Isso criará o perfil que o Painel de Cargas vai listar
            await addDoc(collection(db, "motoristas"), {
                ...dados,
                statusApp: 'offline', // Começa offline
                criadoEm: serverTimestamp(),
                ativo: true
            });

            // NOTA: Para criar o login real no Firebase Auth via Painel Gestor 
            // sem deslogar o Admin, você precisará de uma Cloud Function ou 
            // uma lógica de primeiro acesso no App do Motorista.
            
            alert(`Acesso para ${dados.nome} configurado com sucesso!`);
            if(onFechar) onFechar();
        } catch (error) {
            console.error("Erro ao criar acesso:", error);
            alert("Erro ao processar cadastro.");
        } finally {
            setCarregando(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <header style={styles.header}>
                    <div style={styles.titleGroup}>
                        <UserPlus color="#FFD700" size={24} />
                        <h2 style={styles.titulo}>CADASTRAR NOVO MOTORISTA</h2>
                    </div>
                    <button onClick={onFechar} style={styles.closeBtn}><XCircle size={24}/></button>
                </header>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <p style={styles.subtitle}>Informações de Acesso ao App</p>
                    
                    <div style={styles.inputGroup}>
                        <Mail size={18} style={styles.icon} />
                        <input 
                            name="email"
                            placeholder="E-mail do Motorista (Login)" 
                            type="email" 
                            required 
                            onChange={handleChange}
                            style={styles.input} 
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <Lock size={18} style={styles.icon} />
                        <input 
                            name="senha"
                            placeholder="Senha Provisória" 
                            type="password" 
                            required 
                            onChange={handleChange}
                            style={styles.input} 
                        />
                    </div>

                    <hr style={styles.divider} />
                    <p style={styles.subtitle}>Dados Operacionais</p>

                    <div style={styles.grid}>
                        <div style={styles.inputGroup}>
                            <ShieldCheck size={18} style={styles.icon} />
                            <input 
                                name="nome"
                                placeholder="Nome Completo" 
                                required 
                                onChange={handleChange}
                                style={styles.input} 
                            />
                        </div>
                        <div style={styles.inputGroup}>
                            <Phone size={18} style={styles.icon} />
                            <input 
                                name="telefone"
                                placeholder="WhatsApp (DDD)" 
                                required 
                                onChange={handleChange}
                                style={styles.input} 
                            />
                        </div>
                    </div>

                    <div style={styles.grid}>
                        <div style={styles.inputGroup}>
                            <Truck size={18} style={styles.icon} />
                            <input 
                                name="placa"
                                placeholder="Placa do Veículo" 
                                required 
                                onChange={handleChange}
                                style={styles.input} 
                            />
                        </div>
                        <div style={styles.inputGroup}>
                            <Truck size={18} style={styles.icon} />
                            <input 
                                name="modeloVeiculo"
                                placeholder="Modelo (ex: Scania R450)" 
                                required 
                                onChange={handleChange}
                                style={styles.input} 
                            />
                        </div>
                    </div>

                    <button type="submit" disabled={carregando} style={styles.btnCriar}>
                        {carregando ? "PROCESSANDO..." : "LIBERAR ACESSO IMEDIATO"}
                    </button>
                </form>
            </div>
        </div>
    );
};

const styles = {
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
    modal: { backgroundColor: '#111', width: '100%', maxWidth: '500px', borderRadius: '12px', border: '1px solid #333', overflow: 'hidden' },
    header: { padding: '20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161616' },
    titleGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
    titulo: { color: '#FFD700', fontSize: '16px', fontWeight: 'bold', margin: 0 },
    closeBtn: { background: 'none', border: 'none', color: '#555', cursor: 'pointer' },
    form: { padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px' },
    subtitle: { color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' },
    inputGroup: { position: 'relative', display: 'flex', alignItems: 'center' },
    icon: { position: 'absolute', left: '12px', color: '#FFD700' },
    input: { width: '100%', backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '12px 12px 12px 40px', borderRadius: '6px', fontSize: '14px', outline: 'none' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    divider: { border: '0', borderTop: '1px solid #222', margin: '10px 0' },
    btnCriar: { backgroundColor: '#FFD700', color: '#000', border: 'none', padding: '15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: '0.2s' }
};

export default CriarAcessoMotorista;