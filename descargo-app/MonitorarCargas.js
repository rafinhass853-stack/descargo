import React, { useEffect } from 'react';
import { Alert, Vibration, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
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

// Configuração de como as notificações aparecem com o app aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldVibrate: true,
  }),
});

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

  // Função para disparar alerta sonoro e visual "impossível de ignorar"
  const dispararAlertaCarga = async (dados) => {
    // 1. Notificação no sistema (aparece na barra de tarefas e faz barulho)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: dados.tipoViagem === 'VAZIO' ? "⚪ DESLOCAMENTO DE VAZIO" : "🔔 NOVA CARGA DISPONÍVEL!",
        body: `Destino: ${dados.destinoCliente || dados.clienteEntrega || 'Ver no app'}.`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });

    // 2. Inicia vibração em loop (500ms vibra, 500ms para...)
    // O 'true' no final faz o loop infinito até Vibration.cancel()
    Vibration.vibrate([0, 500, 500, 500], true);
  };

  const aceitarCarga = async (id, dados) => {
    try {
      Vibration.cancel(); // Para a vibração ao clicar
      await updateDoc(doc(db, "ordens_servico", id), { 
        status: "ACEITO", 
        aceitoEm: serverTimestamp(),
        dataInicioViagem: serverTimestamp()
      });
      Alert.alert("✅ CARGA ACEITA!", "A viagem será iniciada automaticamente.");
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
        cercaVirtual: dados.cercaVirtual || null,
        destinoCliente: dados.destinoCliente || dados.clienteEntrega || "",
        destinoCidade: dados.destinoCidade || dados.destino || ""
      };
      setCargaAtiva(cargaIniciada);
      setViagemIniciada(true);
      
      const novoStatus = dados.tipoViagem === 'VAZIO' ? 'Viagem vazio' : 'Viagem carregado';
      setStatusOperacional(novoStatus);
      
      if (typeof sincronizarComFirestore === 'function') {
        sincronizarComFirestore({ statusOperacional: novoStatus });
      }

      Alert.alert("🚚 VIAGEM INICIADA!", "Mantenha o app aberto para rastreamento.");
    } catch (error) {
      console.error("Erro ao iniciar viagem:", error);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    // Criar canal de notificação para Android
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('cargas', {
        name: 'Alertas de Carga',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
      });
    }

    const q = query(
      collection(db, "ordens_servico"), 
      and(
        where("motoristaId", "==", user.uid), 
        where("status", "in", ["AGUARDANDO PROGRAMAÇÃO", "PENDENTE ACEITE", "ACEITO", "EM ANDAMENTO", "AGUARDANDO CONFIRMAÇÃO"])
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const dados = change.doc.data();
        const id = change.doc.id;

        // Se houver uma carga nova ou modificada para pendente
        if ((change.type === "added" || change.type === "modified") && 
            (dados.status === "AGUARDANDO PROGRAMAÇÃO" || dados.status === "PENDENTE ACEITE")) {
          
          dispararAlertaCarga(dados);

          const temGeofence = dados.cercaVirtual?.ativa;
          const mensagemGeofence = temGeofence ? `\n📍 Geofence ativo (${dados.cercaVirtual.raio}m)` : '';
          
          Alert.alert(
            dados.tipoViagem === 'VAZIO' ? "⚪ DESLOCAMENTO DE VAZIO" : "🔔 NOVA CARGA", 
            `Destino: ${dados.destinoCliente || dados.clienteEntrega}${mensagemGeofence}`, 
            [
              { 
                text: "RECUSAR", 
                style: "cancel", 
                onPress: async () => { 
                  Vibration.cancel(); 
                  await updateDoc(doc(db, "ordens_servico", id), { status: "RECUSADO" }); 
                }
              },
              { 
                text: "ACEITAR", 
                onPress: () => { 
                  Vibration.cancel(); 
                  aceitarCarga(id, dados); 
                }
              }
            ],
            { cancelable: false } // Impede fechar clicando fora
          );
        }

        if (change.type === "modified" && dados.status === "ACEITO" && !viagemIniciada) {
          iniciarViagem(id, dados);
        }

        if (dados.status === "EM ANDAMENTO" || dados.status === "AGUARDANDO CONFIRMAÇÃO") {
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
            Vibration.vibrate(1000); // Alerta curto de chegada
          }
        }
      });

      if (snapshot.empty && cargaAtiva) {
        setCargaAtiva(null);
        setViagemIniciada(false);
        if (typeof sincronizarComFirestore === 'function') {
          sincronizarComFirestore({ statusOperacional: 'Sem programação' });
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid, viagemIniciada, cargaAtiva, sincronizarComFirestore]);

};

export default useMonitorarCargas;