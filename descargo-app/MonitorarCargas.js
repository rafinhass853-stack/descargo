import React, { useEffect } from 'react';
import { Alert, Vibration } from 'react-native';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  and 
} from 'firebase/firestore';

const useMonitorarCargas = ({
  db,
  user,
  viagemIniciada,
  cargaAtiva,
  setCargaAtiva,
  setViagemIniciada,
  setChegouAoDestino,
  setConfirmacaoPendente,
  setShowConfirmacaoModal,
  setStatusOperacional,
  sincronizarComFirestore
}) => {
  
  const aceitarCarga = async (id, dados) => {
    try {
      await updateDoc(doc(db, "ordens_servico", id), { 
        status: "ACEITO", 
        aceitoEm: serverTimestamp(),
        dataInicioViagem: serverTimestamp()
      });
      Alert.alert("✅ CARGA ACEITA!", "A viagem será iniciada automaticamente em alguns segundos.", [{ text: "OK" }]);
    } catch (error) {
      console.error("Erro ao aceitar carga:", error);
      Alert.alert("Erro", "Não foi possível aceitar a carga.");
    }
  };

  const iniciarViagem = async (id, dados) => {
    try {
      await updateDoc(doc(db, "ordens_servico", id), {
        status: "EM ANDAMENTO",
        dataInicioViagem: serverTimestamp()
      });
      
      const cargaIniciada = { 
        id, 
        ...dados, 
        status: "EM ANDAMENTO",
        // ADICIONADO: Garantir que os dados de geofence estejam presentes
        cercaVirtual: dados.cercaVirtual || null,
        destinoCliente: dados.destinoCliente || dados.clienteEntrega || "",
        destinoCidade: dados.destinoCidade || dados.destino || ""
      };
      setCargaAtiva(cargaIniciada);
      setViagemIniciada(true);
      
      const novoStatus = dados.tipoViagem === 'VAZIO' ? 'Viagem vazio' : 'Viagem carregado';
      setStatusOperacional(novoStatus);
      
      // PROTEÇÃO ADICIONADA AQUI
      if (typeof sincronizarComFirestore === 'function') {
        sincronizarComFirestore({ statusOperacional: novoStatus });
      }

      Alert.alert("🚚 VIAGEM INICIADA!", "A viagem foi iniciada automaticamente.\n\nMantenha o app aberto para rastreamento.", [{ text: "ENTENDI" }]);
    } catch (error) {
      console.error("Erro ao iniciar viagem:", error);
      Alert.alert("Erro", "Não foi possível iniciar a viagem.");
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "ordens_servico"), 
      and(
        where("motoristaId", "==", user.uid), 
        where("status", "in", ["AGUARDANDO PROGRAMAÇÃO", "PENDENTE ACEITE", "ACEITO", "EM ANDAMENTO", "AGUARDANDO CONFIRMAÇÃO"])
      )
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const dados = change.doc.data();
          const id = change.doc.id;

          if ((change.type === "added" || change.type === "modified") && 
              (dados.status === "AGUARDANDO PROGRAMAÇÃO" || dados.status === "PENDENTE ACEITE")) {
            
            Vibration.vibrate([0, 500, 500, 500], true);
            const temGeofence = dados.cercaVirtual?.ativa;
            const mensagemGeofence = temGeofence 
              ? `\n📍 Sistema de geofence ativo (${dados.cercaVirtual.raio}m)` 
              : '';
            
            Alert.alert(
              dados.tipoViagem === 'VAZIO' ? "⚪ DESLOCAMENTO DE VAZIO" : "🔔 NOVA CARGA", 
              `Destino: ${dados.destinoCliente || dados.clienteEntrega || 'Sem destino especificado'}${mensagemGeofence}\n\nA viagem iniciará automaticamente ao ser aceita.`, 
              [
                { 
                  text: "RECUSAR", 
                  style: "cancel", 
                  onPress: async () => { 
                    Vibration.cancel(); 
                    await updateDoc(doc(db, "ordens_servico", id), { 
                      status: "RECUSADO" 
                    }); 
                  }
                },
                { 
                  text: "ACEITAR", 
                  onPress: () => { 
                    Vibration.cancel(); 
                    aceitarCarga(id, dados); 
                  }
                }
              ]
            );
          }

          if (change.type === "modified" && dados.status === "ACEITO" && !viagemIniciada) {
            iniciarViagem(id, dados);
          }

          if (dados.status === "EM ANDAMENTO" || dados.status === "AGUARDANDO CONFIRMAÇÃO") {
            // ADICIONADO: Garantir que todos os dados necessários estejam presentes
            const cargaCompleta = {
              id,
              ...dados,
              destinoCliente: dados.destinoCliente || dados.clienteEntrega || "",
              destinoCidade: dados.destinoCidade || dados.destino || "",
              cercaVirtual: dados.cercaVirtual || null
            };
            setCargaAtiva(cargaCompleta);
            setViagemIniciada(true);
            
            if (dados.status === "AGUARDANDO CONFIRMAÇÃO") {
              setChegouAoDestino(true);
              setConfirmacaoPendente(true);
              setShowConfirmacaoModal(true);
            }
          }
        });

        if (snapshot.empty && cargaAtiva) {
          setCargaAtiva(null);
          setViagemIniciada(false);
          // PROTEÇÃO ADICIONADA AQUI TAMBÉM
          if (typeof sincronizarComFirestore === 'function') {
            sincronizarComFirestore({ statusOperacional: 'Sem programação' });
          }
        }
      },
      (error) => {
        console.error("Erro ao monitorar cargas:", error);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, viagemIniciada, cargaAtiva, sincronizarComFirestore]);

};

export default useMonitorarCargas;