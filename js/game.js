// ==================== LER PARÂMETROS DA URL ====================
const urlParams = new URLSearchParams(window.location.search);
let nivelDificuldade = urlParams.get('diff') || 'medio';
const nomeJogadorParam = urlParams.get('nick') || 'Você';

// ==================== ESTADO GLOBAL ====================
const estado = {
  fase: 'inicio',
  turno: 1,
  jogadorAtual: 1,
  primeiroTurno: true,
  campeonato: {
    vitoriasJ1: 0,
    vitoriasJ2: 0,
    rodadaAtual: 1,
    melhorDe: parseInt(urlParams.get('bestof')) || 3,
    historico: []
  },
  jogadores: {
    1: criarJogadorInicial(1),
    2: criarJogadorInicial(2)
  },
  deckCompartilhado: [...ALL_CARDS],
  cartaSelecionada: null,
  acaoPendente: null,
  atacanteSelecionado: null,
  hasAttacked: false,
  processandoAnimacao: false,
  log: []
};

// Função auxiliar para nomes dos jogadores
function nomeJogador(id) {
    return id === 1 ? nomeJogadorParam : 'Computador';
}

function criarJogadorInicial(id) {
  return {
    id,
    hp: 4000,
    deck: [],
    mao: [],
    zonaMonstros: [null, null, null],
    zonaMagias: [null, null, null],
    cemiterio: []
  };
}

// ==================== FUNÇÕES AUXILIARES ====================
function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function comprarCarta(jogadorId, quantidade = 1) {
  const jogador = estado.jogadores[jogadorId];
  for (let i = 0; i < quantidade; i++) {
    if (jogador.deck.length === 0) {
      finalizarDuelo(jogadorId === 1 ? 2 : 1, 'Deck vazio');
      return false;
    }
    let carta;
    if (jogadorId === 2 && nivelDificuldade === 'dificil' && estado.fase !== 'inicio') {
      carta = escolherCartaParaIA(jogadorId);
      const idx = jogador.deck.indexOf(carta);
      if (idx !== -1) jogador.deck.splice(idx, 1);
      else carta = jogador.deck.shift();
    } else {
      carta = jogador.deck.shift();
    }
    if (jogador.mao.length < 5) jogador.mao.push(carta);
  }
  return true;
}

function escolherCartaParaIA(jogadorId) {
  const jogador = estado.jogadores[jogadorId];
  const deck = jogador.deck;
  const inimigo = estado.jogadores[jogadorId === 1 ? 2 : 1];
  let melhorCarta = deck[0];
  let melhorPontuacao = -Infinity;

  for (const carta of deck) {
    let pontos = 0;
    if (carta.tipo === 'monstro') {
      pontos += carta.atk / 100;
      if (carta.efeito === 'ao_invocar_causa_500_dano_direto') pontos += 5;
      if (carta.efeito === 'dano_perfurante') pontos += 3;
    } else if (carta.tipo === 'magia') {
      if (carta.efeito === 'curar_2000' && jogador.hp < 2500) pontos += 10;
      if (carta.efeito === 'destruir_inimigo' && inimigo.zonaMonstros.some(m => m && m.atk > 2000)) pontos += 12;
      if (carta.efeito === 'comprar_2' && jogador.mao.length < 3) pontos += 8;
    } else if (carta.tipo === 'armadilha') {
      pontos += 6;
    }
    if (pontos > melhorPontuacao) {
      melhorPontuacao = pontos;
      melhorCarta = carta;
    }
  }
  return melhorCarta;
}

function adicionarLog(mensagem) {
  estado.log.push(mensagem);
  renderLog();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== MONTAGEM DE DECK ====================
function montarDeck(jogadorId, deckCompleto, nivel) {
  let deck = [];
  const monstrosFortes = deckCompleto.filter(c => c.tipo === 'monstro' && c.atk > 2000);
  const monstrosFracos = deckCompleto.filter(c => c.tipo === 'monstro' && c.atk <= 2000);
  const magias = deckCompleto.filter(c => c.tipo === 'magia');
  const armadilhas = deckCompleto.filter(c => c.tipo === 'armadilha');

  if (nivel === 'facil') {
    if (jogadorId === 2) {
      const monstrosPermitidos = embaralhar([...monstrosFracos]);
      const magiaPermitida = embaralhar([...magias]).slice(0, 1);
      const armadilhaPermitida = embaralhar([...armadilhas]).slice(0, 1);
      deck = [...monstrosPermitidos.slice(0, 18), ...magiaPermitida, ...armadilhaPermitida];
      while (deck.length < 20 && monstrosPermitidos.length > deck.length) {
        deck.push(monstrosPermitidos[deck.length]);
      }
      deck = embaralhar(deck);
    } else {
      const fortesEscolhidos = embaralhar([...monstrosFortes]).slice(0, 3);
      const restante = embaralhar([...deckCompleto.filter(c => !fortesEscolhidos.includes(c))]);
      deck = [...fortesEscolhidos, ...restante.slice(0, 17)];
      deck = embaralhar(deck);
    }
  } else {
    const numMagiasArmadilhas = 5 + Math.floor(Math.random() * 6);
    const magiasEscolhidas = embaralhar([...magias]).slice(0, Math.ceil(numMagiasArmadilhas / 2));
    const armadilhasEscolhidas = embaralhar([...armadilhas]).slice(0, Math.floor(numMagiasArmadilhas / 2));
    const magiaArmadilha = [...magiasEscolhidas, ...armadilhasEscolhidas];
    const monstros = embaralhar([...monstrosFortes, ...monstrosFracos]);
    deck = [...magiaArmadilha, ...monstros.slice(0, 20 - magiaArmadilha.length)];
    deck = embaralhar(deck);
  }
  return deck.slice(0, 20);
}

// ==================== INICIALIZAÇÃO ====================
function iniciarCampeonato() {
  // Esconder modais finais
  document.getElementById('modal-endgame').classList.add('hidden');
  document.getElementById('modal-round-winner').classList.add('hidden');
  
  estado.campeonato.vitoriasJ1 = 0;
  estado.campeonato.vitoriasJ2 = 0;
  estado.campeonato.rodadaAtual = 1;
  iniciarNovoDuelo();
}

function iniciarNovoDuelo() {
  estado.jogadores[1] = criarJogadorInicial(1);
  estado.jogadores[2] = criarJogadorInicial(2);

  estado.jogadores[1].deck = montarDeck(1, [...ALL_CARDS], nivelDificuldade);
  estado.jogadores[2].deck = montarDeck(2, [...ALL_CARDS], nivelDificuldade);

  for (let i = 0; i < 5; i++) {
    comprarCarta(1);
    comprarCarta(2);
  }

  estado.jogadorAtual = Math.random() < 0.5 ? 1 : 2;
  estado.turno = 1;
  estado.primeiroTurno = true;
  estado.hasAttacked = false;
  estado.fase = 'main';
  estado.cartaSelecionada = null;
  estado.acaoPendente = null;
  estado.atacanteSelecionado = null;
  estado.processandoAnimacao = false;
  // Resetar o preview (a primeira carta vazia)
  document.getElementById('card-preview').classList.add('hidden');
  document.getElementById('card-effect-display').classList.add('hidden');

  render();
  adicionarLog(`--- Novo duelo iniciado! Sorteio: ${nomeJogador(estado.jogadorAtual)} começa. ---`);
  if (estado.jogadorAtual === 1) {
    adicionarLog('Você não pode atacar no primeiro turno.');
  } else {
    setTimeout(() => aiTurn(estado), 1200);
  }
}

// ==================== TROCA DE TURNOS ====================
function encerrarTurno() {
  if (estado.fase === 'fim') return;

  if (estado.fase === 'batalha') {
    estado.fase = 'main';
    estado.hasAttacked = true;
    estado.atacanteSelecionado = null;
    limparDestaques();
    adicionarLog('Fase de batalha encerrada.');
  }

  estado.jogadores[1].zonaMonstros.forEach(m => {
    if (m) {
      m.jaAtacou = false;
      m.ataquesRestantes = m.efeito === 'pode_atacar_duas_vezes' ? 2 : 1;
      m.invocadoEsteTurno = false;
      m.posicaoMudouEsteTurno = false;
    }
  });
  estado.jogadores[2].zonaMonstros.forEach(m => {
    if (m) {
      m.jaAtacou = false;
      m.ataquesRestantes = m.efeito === 'pode_atacar_duas_vezes' ? 2 : 1;
      m.invocadoEsteTurno = false;
      m.posicaoMudouEsteTurno = false;
    }
  });

  retornarMonstrosTemporarios(1);
  retornarMonstrosTemporarios(2);

  estado.jogadorAtual = estado.jogadorAtual === 1 ? 2 : 1;
  estado.turno++;
  estado.primeiroTurno = false;
  estado.hasAttacked = false;
  estado.fase = 'main';
  estado.cartaSelecionada = null;
  estado.acaoPendente = null;
  estado.atacanteSelecionado = null;
  estado.processandoAnimacao = false;
  limparDestaques();

  const jogador = estado.jogadores[estado.jogadorAtual];
  if (!comprarCarta(estado.jogadorAtual, 5 - jogador.mao.length)) return;

  render();
  adicionarLog(`--- Turno ${estado.turno} - ${nomeJogador(estado.jogadorAtual)} ---`);

  if (estado.jogadorAtual === 2) setTimeout(() => aiTurn(estado), 1200);
}

function retornarMonstrosTemporarios(jogadorId) {
  const jogador = estado.jogadores[jogadorId];
  const donoOriginal = jogadorId === 1 ? 2 : 1;
  const dono = estado.jogadores[donoOriginal];
  for (let i = 0; i < jogador.zonaMonstros.length; i++) {
    const monstro = jogador.zonaMonstros[i];
    if (monstro && monstro.temporario) {
      jogador.zonaMonstros[i] = null;
      const slotVazio = dono.zonaMonstros.findIndex(slot => slot === null);
      if (slotVazio !== -1) {
        dono.zonaMonstros[slotVazio] = monstro;
        monstro.temporario = false;
      } else {
        dono.cemiterio.push(monstro);
        adicionarLog(`${monstro.nome} retornou ao cemitério do dono original.`);
      }
    }
  }
}

// ==================== AÇÕES DO JOGADOR ====================
function selecionarCartaDaMao(index) {
  if (estado.fase !== 'main' || estado.jogadorAtual !== 1 || estado.processandoAnimacao) return;
  const jogador = estado.jogadores[1];
  if (index >= jogador.mao.length) return;
  const carta = jogador.mao[index];

  estado.cartaSelecionada = null;
  estado.acaoPendente = null;
  estado.atacanteSelecionado = null;
  limparDestaques();
  esconderModalPosicao();

  if (carta.tipo === 'monstro') {
    const slotsVazios = jogador.zonaMonstros.filter(slot => slot === null).length;
    if (slotsVazios === 0) {
      adicionarLog('Sua zona de monstros está cheia.');
      return;
    }
    estado.cartaSelecionada = index;
    mostrarModalPosicao();
  } else if (carta.tipo === 'magia') {
    estado.cartaSelecionada = index;
    if (carta.efeito === 'buff_500' || carta.efeito === 'buff_1000') {
      estado.acaoPendente = { tipo: 'magia_buff', valor: carta.efeito === 'buff_500' ? 500 : 1000 };
      destacarMonstrosProprios();
      adicionarLog(`Escolha um monstro seu para receber +${estado.acaoPendente.valor} de ATK/DEF.`);
    } else if (carta.efeito === 'destruir_inimigo') {
      estado.acaoPendente = { tipo: 'magia_destruir' };
      destacarMonstrosInimigos();
      adicionarLog('Escolha um monstro inimigo para destruir.');
    } else if (carta.efeito === 'destruir_todos_inimigos') {
      usarMagia(1, index, null);
    } else if (carta.efeito === 'reviver_monstro') {
      if (jogador.cemiterio.length === 0) {
        adicionarLog('Seu cemitério está vazio.');
        return;
      }
      estado.acaoPendente = { tipo: 'reviver' };
      const maisForte = jogador.cemiterio.reduce((a, b) => (b.atk > a.atk ? b : a));
      usarMagia(1, index, { tipo: 'cemiterio', index: jogador.cemiterio.indexOf(maisForte) });
    } else if (carta.efeito === 'roubar_monstro') {
      estado.acaoPendente = { tipo: 'roubar' };
      destacarMonstrosInimigos();
      adicionarLog('Escolha um monstro inimigo para assumir o controle.');
    } else if (carta.efeito === 'curar_2000') {
      usarMagia(1, index, null);
    } else if (carta.efeito === 'destruir_magias_armadilhas') {
      usarMagia(1, index, null);
    } else if (carta.efeito === 'comprar_2' || carta.efeito === 'comprar_3_dano_1000') {
      usarMagia(1, index, null);
    }
  } else if (carta.tipo === 'armadilha') {
    const slotVazio = jogador.zonaMagias.findIndex(slot => slot === null);
    if (slotVazio !== -1) baixarArmadilha(1, index, slotVazio);
    else adicionarLog('Zona de magias/armadilhas cheia.');
  }
}

// ==================== MODAL DE POSIÇÃO ====================
function mostrarModalPosicao() { document.getElementById('modal-position').classList.remove('hidden'); }
function esconderModalPosicao() { document.getElementById('modal-position').classList.add('hidden'); }

document.getElementById('btn-ataque').addEventListener('click', () => {
  if (estado.cartaSelecionada !== null) {
    estado.acaoPendente = { tipo: 'invocar', posicao: 'ataque' };
    esconderModalPosicao();
    destacarSlotsMonstroVazios(1);
    adicionarLog(`Selecione um slot vazio para invocar ${estado.jogadores[1].mao[estado.cartaSelecionada].nome} em ataque.`);
  }
});
document.getElementById('btn-defesa').addEventListener('click', () => {
  if (estado.cartaSelecionada !== null) {
    estado.acaoPendente = { tipo: 'invocar', posicao: 'defesa' };
    esconderModalPosicao();
    destacarSlotsMonstroVazios(1);
    adicionarLog(`Selecione um slot vazio para invocar ${estado.jogadores[1].mao[estado.cartaSelecionada].nome} em defesa.`);
  }
});

// ==================== INVOCAR MONSTRO ====================
function invocarMonstro(jogadorId, maoIndex, slotIndex, posicao) {
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'monstro') return false;
  if (slotIndex < 0 || slotIndex > 2 || jogador.zonaMonstros[slotIndex] !== null) return false;

  jogador.mao.splice(maoIndex, 1);
  const monstro = {
    ...carta,
    posicao,
    jaAtacou: false,
    ataquesRestantes: carta.efeito === 'pode_atacar_duas_vezes' ? 2 : 1,
    bonusAtk: 0,
    bonusDef: 0,
    temporario: false,
    invocadoEsteTurno: true,
    posicaoMudouEsteTurno: false
  };
  jogador.zonaMonstros[slotIndex] = monstro;
  adicionarLog(`${nomeJogador(jogadorId)} invocou ${carta.nome} na posição ${posicao}.`);
  verificarArmadilhaInvocacao(jogadorId, slotIndex);
  aplicarEfeitoInvocacao(jogadorId, slotIndex);

  if (jogadorId === 1) {
    estado.cartaSelecionada = null;
    estado.acaoPendente = null;
    limparDestaques();
    esconderModalPosicao();
  }
  render();
  animarCarta(jogadorId, 'monstro', slotIndex);
  return true;
}

function aplicarEfeitoInvocacao(jogadorId, slotIndex) {
  const jogador = estado.jogadores[jogadorId];
  const monstro = jogador.zonaMonstros[slotIndex];
  if (!monstro) return;
  const oponenteId = jogadorId === 1 ? 2 : 1;
  const oponente = estado.jogadores[oponenteId];

  switch (monstro.efeito) {
    case 'ao_invocar_revive_monstro':
      if (jogador.cemiterio.length > 0) {
        const maisForte = jogador.cemiterio.reduce((a, b) => (b.atk > a.atk ? b : a));
        const idxCem = jogador.cemiterio.indexOf(maisForte);
        jogador.cemiterio.splice(idxCem, 1);
        const slotVazio = jogador.zonaMonstros.findIndex(s => s === null);
        if (slotVazio !== -1) {
          jogador.zonaMonstros[slotVazio] = { ...maisForte, jaAtacou: false, ataquesRestantes: 1, bonusAtk: 0, bonusDef: 0, temporario: false };
          adicionarLog(`${monstro.nome} reviveu ${maisForte.nome} do cemitério!`);
          animarCarta(jogadorId, 'monstro', slotVazio);
        }
      }
      break;
    case 'ao_invocar_destroi_magia_armadilha':
      for (let i = 0; i < oponente.zonaMagias.length; i++) {
        if (oponente.zonaMagias[i]) {
          adicionarLog(`${monstro.nome} destruiu ${oponente.zonaMagias[i].nome}.`);
          oponente.zonaMagias[i] = null;
        }
      }
      render();
      break;
    case 'ao_invocar_comprar_1_carta':
      comprarCarta(jogadorId, 1);
      break;
    case 'ao_invocar_causa_500_dano_direto':
      oponente.hp -= 500;
      adicionarLog(`${monstro.nome} causou 500 de dano direto!`);
      if (verificarFimDeDuelo()) return;
      render();
      break;
    case 'ao_invocar_devolve_monstro_pra_mao':
      if (oponente.zonaMonstros.some(m => m !== null)) {
        const idx = oponente.zonaMonstros.findIndex(m => m !== null);
        const alvo = oponente.zonaMonstros[idx];
        oponente.zonaMonstros[idx] = null;
        if (oponente.mao.length < 5) oponente.mao.push(alvo);
        else oponente.cemiterio.push(alvo);
        adicionarLog(`${monstro.nome} devolveu ${alvo.nome} para a mão.`);
        render();
      }
      break;
    default: break;
  }
}

function baixarArmadilha(jogadorId, maoIndex, slotIndex) {
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'armadilha') return false;
  if (slotIndex < 0 || slotIndex > 2 || jogador.zonaMagias[slotIndex] !== null) return false;
  jogador.mao.splice(maoIndex, 1);
  jogador.zonaMagias[slotIndex] = { ...carta, viradaParaBaixo: true };
  adicionarLog(`${nomeJogador(jogadorId)} baixou uma armadilha.`);
  if (jogadorId === 1) {
    estado.cartaSelecionada = null;
    estado.acaoPendente = null;
    limparDestaques();
  }
  render();
  animarCarta(jogadorId, 'magia', slotIndex);
  return true;
}

function usarMagia(jogadorId, maoIndex, alvo) {
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'magia') return false;

  const oponenteId = jogadorId === 1 ? 2 : 1;
  const oponente = estado.jogadores[oponenteId];
  for (let i = 0; i < oponente.zonaMagias.length; i++) {
    const arm = oponente.zonaMagias[i];
    if (arm && arm.tipo === 'armadilha' && arm.viradaParaBaixo && arm.efeito === 'armadilha_negar_magia') {
      arm.viradaParaBaixo = false;
      render();
      animarCarta(oponenteId, 'magia', i, 'trap');
      adicionarLog(`Armadilha "Silêncio Arcano" ativada! Magia ${carta.nome} foi negada.`);
      oponente.zonaMagias[i] = null;
      jogador.mao.splice(maoIndex, 1);
      render();
      return true;
    }
  }

  if (jogadorId === 1) {
    const handCard = document.querySelector(`.hand-card[data-index="${maoIndex}"]`);
    if (handCard) {
      handCard.classList.add('magic-activating');
      setTimeout(() => handCard.remove(), 800);
    }
  } else {
    adicionarLog(`${nomeJogador(jogadorId)} ativou ${carta.nome}.`);
  }

  jogador.mao.splice(maoIndex, 1);

  switch (carta.efeito) {
    case 'buff_500':
      if (alvo && alvo.tipo === 'proprio') {
        const monstro = jogador.zonaMonstros[alvo.slot];
        if (monstro) {
          monstro.bonusAtk = (monstro.bonusAtk || 0) + 500;
          adicionarLog(`${monstro.nome} ganhou +500 de ATK.`);
          animarCarta(jogadorId, 'monstro', alvo.slot);
        }
      }
      break;
    case 'buff_1000':
      if (alvo && alvo.tipo === 'proprio') {
        const monstro = jogador.zonaMonstros[alvo.slot];
        if (monstro) {
          monstro.bonusAtk = (monstro.bonusAtk || 0) + 1000;
          monstro.bonusDef = (monstro.bonusDef || 0) + 1000;
          adicionarLog(`${monstro.nome} ganhou +1000 de ATK e DEF.`);
          animarCarta(jogadorId, 'monstro', alvo.slot);
        }
      }
      break;
    case 'destruir_inimigo':
      if (alvo && alvo.tipo === 'inimigo') {
        const inimigo = oponente;
        const monstro = inimigo.zonaMonstros[alvo.slot];
        if (monstro) {
          if (monstro.efeito === 'imune_a_magias' || monstro.efeito === 'nao_pode_ser_destruido_por_efeito') {
            adicionarLog(`${monstro.nome} é imune a magias e não foi destruído.`);
          } else {
            destruirMonstro(oponenteId, alvo.slot, 'efeito de magia');
          }
        }
      }
      break;
    case 'destruir_todos_inimigos':
      for (let i = 0; i < oponente.zonaMonstros.length; i++) {
        const monstro = oponente.zonaMonstros[i];
        if (monstro && monstro.efeito !== 'imune_a_magias' && monstro.efeito !== 'nao_pode_ser_destruido_por_efeito') {
          destruirMonstro(oponenteId, i, 'efeito de magia');
        }
      }
      render();
      break;
    case 'reviver_monstro':
      if (alvo && alvo.tipo === 'cemiterio') {
        const cemiterio = jogador.cemiterio;
        const monstro = cemiterio[alvo.index];
        if (monstro) {
          cemiterio.splice(alvo.index, 1);
          const slotVazio = jogador.zonaMonstros.findIndex(s => s === null);
          if (slotVazio !== -1) {
            jogador.zonaMonstros[slotVazio] = { ...monstro, jaAtacou: false, ataquesRestantes: 1, bonusAtk: 0, bonusDef: 0, temporario: false };
            adicionarLog(`${monstro.nome} foi revivido!`);
            animarCarta(jogadorId, 'monstro', slotVazio);
          } else {
            adicionarLog('Zona de monstros cheia.');
          }
        }
      }
      break;
    case 'roubar_monstro':
      if (alvo && alvo.tipo === 'inimigo') {
        const inimigo = oponente;
        const monstro = inimigo.zonaMonstros[alvo.slot];
        if (monstro) {
          inimigo.zonaMonstros[alvo.slot] = null;
          const slotVazio = jogador.zonaMonstros.findIndex(s => s === null);
          if (slotVazio !== -1) {
            jogador.zonaMonstros[slotVazio] = { ...monstro, temporario: true, jaAtacou: false, ataquesRestantes: 1 };
            adicionarLog(`${monstro.nome} foi controlado por você até o fim do turno.`);
            animarCarta(jogadorId, 'monstro', slotVazio);
          } else {
            inimigo.cemiterio.push(monstro);
          }
          render();
        }
      }
      break;
    case 'curar_2000':
      jogador.hp += 2000;
      adicionarLog(`${nomeJogador(jogadorId)} curou 2000 de vida.`);
      break;
    case 'destruir_magias_armadilhas':
      for (let i = 0; i < oponente.zonaMagias.length; i++) {
        if (oponente.zonaMagias[i]) oponente.zonaMagias[i] = null;
      }
      adicionarLog('Todas as magias/armadilhas do oponente foram destruídas.');
      render();
      break;
    case 'comprar_2':
      comprarCarta(jogadorId, 2);
      break;
    case 'comprar_3_dano_1000':
      comprarCarta(jogadorId, 3);
      jogador.hp -= 1000;
      adicionarLog(`${nomeJogador(jogadorId)} perdeu 1000 de vida.`);
      verificarFimDeDuelo();
      break;
    default: break;
  }

  if (jogadorId === 1) {
    estado.cartaSelecionada = null;
    estado.acaoPendente = null;
    limparDestaques();
  }
  render();
  return true;
}

function destruirMonstro(jogadorId, slotIndex, motivo) {
  const jogador = estado.jogadores[jogadorId];
  const monstro = jogador.zonaMonstros[slotIndex];
  if (!monstro) return;
  aplicarEfeitoMorte(monstro, jogadorId);
  jogador.cemiterio.push(monstro);
  jogador.zonaMonstros[slotIndex] = null;
  adicionarLog(`${monstro.nome} foi destruído (${motivo}).`);
  render();
}

function verificarArmadilhaInvocacao(jogadorInvoker, slotIndex) {
  const invocador = estado.jogadores[jogadorInvoker];
  const oponenteId = jogadorInvoker === 1 ? 2 : 1;
  const oponente = estado.jogadores[oponenteId];
  const monstro = invocador.zonaMonstros[slotIndex];
  if (!monstro) return;

  for (let i = 0; i < oponente.zonaMagias.length; i++) {
    const armadilha = oponente.zonaMagias[i];
    if (armadilha && armadilha.tipo === 'armadilha' && armadilha.viradaParaBaixo) {
      if (armadilha.efeito === 'armadilha_ira' && monstro.atk > 2000) {
        armadilha.viradaParaBaixo = false;
        render();
        animarCarta(oponenteId, 'magia', i, 'trap');
        adicionarLog(`Armadilha "Ira do Submundo" ativada!`);
        setTimeout(() => {
          destruirMonstro(jogadorInvoker, slotIndex, 'armadilha Ira do Submundo');
          oponente.zonaMagias[i] = null;
        }, 800);
        break;
      } else if (armadilha.efeito === 'armadilha_negar_invocacao') {
        if (monstro.efeito !== 'imune_a_armadilhas' && monstro.efeito !== 'nao_pode_ser_destruido_por_efeito') {
          armadilha.viradaParaBaixo = false;
          render();
          animarCarta(oponenteId, 'magia', i, 'trap');
          adicionarLog(`Armadilha "Julgamento Divino" ativada! Invocação negada.`);
          setTimeout(() => {
            invocador.zonaMonstros[slotIndex] = null;
            invocador.cemiterio.push(monstro);
            oponente.zonaMagias[i] = null;
            adicionarLog(`${monstro.nome} foi destruído.`);
            render();
          }, 800);
          break;
        }
      }
    }
  }
}

function aplicarEfeitoMorte(monstro, jogadorId) {
  if (monstro.efeito === 'quando_morre_ganha_500_vida') {
    const jogador = estado.jogadores[jogadorId];
    jogador.hp += 500;
    adicionarLog(`${nomeJogador(jogadorId)} ganhou 500 de vida (${monstro.nome}).`);
  }
}

function verificarFimDeDuelo() {
  if (estado.fase === 'fim') return true;
  if (estado.jogadores[1].hp <= 0) {
    finalizarDuelo(2, 'HP zerado');
    return true;
  }
  if (estado.jogadores[2].hp <= 0) {
    finalizarDuelo(1, 'HP zerado');
    return true;
  }
  return false;
}

function alternarPosicaoMonstro(jogadorId, slotIndex) {
  const jogador = estado.jogadores[jogadorId];
  const monstro = jogador.zonaMonstros[slotIndex];
  if (!monstro) return;
  if (monstro.invocadoEsteTurno) {
    adicionarLog('Você não pode mudar a posição de um monstro no turno em que ele foi invocado.');
    return;
  }
  if (monstro.posicaoMudouEsteTurno) {
    adicionarLog('Este monstro já mudou de posição neste turno.');
    return;
  }
  monstro.posicao = monstro.posicao === 'ataque' ? 'defesa' : 'ataque';
  monstro.posicaoMudouEsteTurno = true;
  adicionarLog(`${monstro.nome} mudou para posição de ${monstro.posicao}.`);
  render();
}

// ==================== BATALHA ====================
function iniciarBatalha() {
  if (estado.fase !== 'main' || estado.jogadorAtual !== 1 || estado.hasAttacked || estado.processandoAnimacao) return;
  if (estado.primeiroTurno && estado.jogadorAtual === 1) {
    adicionarLog('Você não pode atacar no primeiro turno.');
    return;
  }
  const temAtacantes = estado.jogadores[1].zonaMonstros.some(m => m && m.posicao === 'ataque' && m.ataquesRestantes > 0 && m.efeito !== 'nao_pode_atacar');
  if (!temAtacantes) {
    adicionarLog('Nenhum monstro em posição de ataque disponível para atacar.');
    return;
  }
  estado.fase = 'batalha';
  estado.atacanteSelecionado = null;
  estado.acaoPendente = null;
  limparDestaques();
  destacarAtacantesDisponiveis(1);
  adicionarLog('Selecione um monstro atacante.');
  renderBotoes();
}

function destacarAtacantesDisponiveis(jogadorId) {
  const slots = document.querySelectorAll(`#monstro-slots-p${jogadorId} .slot`);
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    const monstro = estado.jogadores[jogadorId].zonaMonstros[index];
    if (monstro && monstro.posicao === 'ataque' && monstro.ataquesRestantes > 0 && monstro.efeito !== 'nao_pode_atacar') {
      slot.classList.add('highlight');
    }
  });
}

function selecionarAtacante(slotIndex) {
  if (estado.fase !== 'batalha' || estado.jogadorAtual !== 1 || estado.processandoAnimacao) return;
  const monstro = estado.jogadores[1].zonaMonstros[slotIndex];
  if (!monstro || monstro.posicao !== 'ataque' || monstro.ataquesRestantes === 0 || monstro.efeito === 'nao_pode_atacar') return;

  estado.atacanteSelecionado = slotIndex;
  limparDestaques();
  destacarAlvosInimigos();
  const temMonstrosInimigos = estado.jogadores[2].zonaMonstros.some(m => m !== null);
  if (!temMonstrosInimigos) document.getElementById('hp-p2').classList.add('highlight-target');
  adicionarLog(`Monstro selecionado: ${monstro.nome}. Escolha um alvo.`);
}

function destacarAlvosInimigos() {
  const slots = document.querySelectorAll(`#monstro-slots-p2 .slot`);
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    if (estado.jogadores[2].zonaMonstros[index] !== null) slot.classList.add('highlight');
  });
}

async function executarAtaque(atacanteSlot, alvoTipo, alvoSlot) {
  if (estado.fase !== 'batalha' || estado.jogadorAtual !== 1 || estado.processandoAnimacao) return;
  const atacante = estado.jogadores[1].zonaMonstros[atacanteSlot];
  if (!atacante || atacante.ataquesRestantes === 0) return;

  const defensorId = 2;
  const defensor = estado.jogadores[defensorId];
  const temMonstrosInimigos = defensor.zonaMonstros.some(m => m !== null);
  if (alvoTipo === 'jogador' && temMonstrosInimigos) {
    adicionarLog('Você não pode atacar diretamente enquanto houver monstros inimigos.');
    return;
  }

  for (let i = 0; i < defensor.zonaMagias.length; i++) {
    const armadilha = defensor.zonaMagias[i];
    if (armadilha && armadilha.tipo === 'armadilha' && armadilha.viradaParaBaixo) {
      if (armadilha.efeito === 'armadilha_escudo' && atacante.efeito !== 'imune_a_armadilhas') {
        armadilha.viradaParaBaixo = false;
        render();
        animarCarta(defensorId, 'magia', i, 'trap');
        adicionarLog(`Armadilha "Escudo de Atenas" ativada!`);
        await delay(800);
        atacante.posicao = 'defesa';
        atacante.ataquesRestantes--;
        defensor.zonaMagias[i] = null;
        estado.atacanteSelecionado = null;
        limparDestaques();
        render();
        verificarFimBatalha();
        return;
      } else if (armadilha.efeito === 'armadilha_destruir_atacantes' && atacante.efeito !== 'imune_a_armadilhas') {
        armadilha.viradaParaBaixo = false;
        render();
        animarCarta(defensorId, 'magia', i, 'trap');
        adicionarLog(`Armadilha "Força Espelhada" ativada!`);
        await delay(800);
        for (let j = 0; j < estado.jogadores[1].zonaMonstros.length; j++) {
          const m = estado.jogadores[1].zonaMonstros[j];
          if (m && m.posicao === 'ataque' && m.efeito !== 'imune_a_armadilhas' && m.efeito !== 'nao_pode_ser_destruido_por_efeito') {
            destruirMonstro(1, j, 'Força Espelhada');
          }
        }
        defensor.zonaMagias[i] = null;
        estado.atacanteSelecionado = null;
        limparDestaques();
        render();
        verificarFimBatalha();
        return;
      } else if (armadilha.efeito === 'armadilha_refletir_dano' && atacante.efeito !== 'imune_a_armadilhas') {
        armadilha.viradaParaBaixo = false;
        render();
        animarCarta(defensorId, 'magia', i, 'trap');
        adicionarLog(`Armadilha "Cilindro Mágico" ativada!`);
        await delay(800);
        estado.jogadores[1].hp -= atacante.atk;
        adicionarLog(`${atacante.nome} teve seu ataque refletido! ${nomeJogador(1)} perdeu ${atacante.atk} HP.`);
        atacante.ataquesRestantes--;
        defensor.zonaMagias[i] = null;
        if (verificarFimDeDuelo()) return;
        estado.atacanteSelecionado = null;
        limparDestaques();
        render();
        verificarFimBatalha();
        return;
      }
    }
  }

  estado.processandoAnimacao = true;
  const monstroDefensor = alvoTipo === 'monstro' ? defensor.zonaMonstros[alvoSlot] : null;
  await animarAtaque(atacanteSlot, alvoTipo === 'monstro' ? alvoSlot : null, 1, 2);

  if (alvoTipo === 'jogador') {
    defensor.hp -= atacante.atk;
    adicionarLog(`${atacante.nome} atacou diretamente! Computador perdeu ${atacante.atk} HP.`);
    atacante.ataquesRestantes--;
    if (verificarFimDeDuelo()) return;
  } else {
    if (monstroDefensor) {
      resolverBatalha(1, 2, atacanteSlot, alvoSlot);
      atacante.ataquesRestantes--;
    }
  }

  estado.processandoAnimacao = false;
  estado.atacanteSelecionado = null;
  limparDestaques();
  render();
  verificarFimBatalha();
}

function verificarFimBatalha() {
  const aindaPodeAtacar = estado.jogadores[1].zonaMonstros.some(m => m && m.posicao === 'ataque' && m.ataquesRestantes > 0 && m.efeito !== 'nao_pode_atacar');
  if (aindaPodeAtacar) {
    destacarAtacantesDisponiveis(1);
    adicionarLog('Selecione outro monstro atacante ou encerre o turno.');
  } else {
    adicionarLog('Todos os monstros atacaram. Encerre o turno.');
    renderBotoes();
  }
}

function resolverBatalha(jogadorAtacanteId, jogadorDefensorId, slotAtacante, slotDefensor) {
  const atacante = estado.jogadores[jogadorAtacanteId].zonaMonstros[slotAtacante];
  const defensor = estado.jogadores[jogadorDefensorId].zonaMonstros[slotDefensor];
  if (!atacante || !defensor) return;

  const atkTotal = atacante.atk + (atacante.bonusAtk || 0);
  const defTotal = defensor.posicao === 'ataque' ? defensor.atk + (defensor.bonusAtk || 0) : defensor.def + (defensor.bonusDef || 0);

  if (defensor.posicao === 'ataque') {
    const dif = atkTotal - defTotal;
    if (dif > 0) {
      destruirMonstro(jogadorDefensorId, slotDefensor, 'batalha');
      estado.jogadores[jogadorDefensorId].hp -= dif;
      adicionarLog(`${defensor.nome} destruído! Computador perdeu ${dif} HP.`);
      if (atacante.efeito === 'ganha_500_atk_ao_destruir_inimigo') {
        atacante.bonusAtk = (atacante.bonusAtk || 0) + 500;
        adicionarLog(`${atacante.nome} ganhou +500 de ATK.`);
      }
      if (atacante.efeito === 'cura_vida_igual_dano_causado') {
        estado.jogadores[jogadorAtacanteId].hp += dif;
        adicionarLog(`${atacante.nome} curou ${dif} de vida.`);
      }
      verificarFimDeDuelo();
    } else if (dif === 0) {
      destruirMonstro(jogadorAtacanteId, slotAtacante, 'batalha');
      destruirMonstro(jogadorDefensorId, slotDefensor, 'batalha');
      adicionarLog(`Empate! ${atacante.nome} e ${defensor.nome} destruídos.`);
      verificarFimDeDuelo();
    } else {
      destruirMonstro(jogadorAtacanteId, slotAtacante, 'batalha');
      estado.jogadores[jogadorAtacanteId].hp -= (-dif);
      adicionarLog(`${atacante.nome} destruído! ${nomeJogador(jogadorAtacanteId)} perdeu ${-dif} HP.`);
      verificarFimDeDuelo();
    }
  } else {
    const dif = atkTotal - defTotal;
    if (dif > 0) {
      destruirMonstro(jogadorDefensorId, slotDefensor, 'batalha');
      adicionarLog(`${defensor.nome} destruído em defesa.`);
      if (atacante.efeito === 'dano_perfurante' || atacante.efeito === 'ignora_defesa_ataque_direto') {
        estado.jogadores[jogadorDefensorId].hp -= dif;
        adicionarLog(`Dano perfurante! Computador perdeu ${dif} HP.`);
      }
      verificarFimDeDuelo();
    } else if (dif < 0) {
      estado.jogadores[jogadorAtacanteId].hp -= (-dif);
      adicionarLog(`${atacante.nome} não destruiu ${defensor.nome}. ${nomeJogador(jogadorAtacanteId)} perdeu ${-dif} HP.`);
      verificarFimDeDuelo();
    }
  }
}

async function executarAtaquesAutomaticos(jogadorId) {
  const jogador = estado.jogadores[jogadorId];
  const inimigoId = jogadorId === 1 ? 2 : 1;
  const inimigo = estado.jogadores[inimigoId];

  for (let i = 0; i < jogador.zonaMonstros.length; i++) {
    const monstro = jogador.zonaMonstros[i];
    if (!monstro || monstro.posicao !== 'ataque' || monstro.ataquesRestantes === 0 || monstro.efeito === 'nao_pode_atacar') continue;

    for (let j = 0; j < inimigo.zonaMagias.length; j++) {
      const armadilha = inimigo.zonaMagias[j];
      if (armadilha && armadilha.tipo === 'armadilha' && armadilha.viradaParaBaixo) {
        if (armadilha.efeito === 'armadilha_escudo' && monstro.efeito !== 'imune_a_armadilhas') {
          armadilha.viradaParaBaixo = false;
          render();
          animarCarta(inimigoId, 'magia', j, 'trap');
          adicionarLog(`Armadilha "Escudo de Atenas" ativada!`);
          await delay(800);
          monstro.posicao = 'defesa';
          monstro.ataquesRestantes--;
          inimigo.zonaMagias[j] = null;
          render();
          continue;
        } else if (armadilha.efeito === 'armadilha_destruir_atacantes' && monstro.efeito !== 'imune_a_armadilhas') {
          armadilha.viradaParaBaixo = false;
          render();
          animarCarta(inimigoId, 'magia', j, 'trap');
          adicionarLog(`Armadilha "Força Espelhada" ativada!`);
          await delay(800);
          for (let k = 0; k < jogador.zonaMonstros.length; k++) {
            const m = jogador.zonaMonstros[k];
            if (m && m.posicao === 'ataque' && m.efeito !== 'imune_a_armadilhas' && m.efeito !== 'nao_pode_ser_destruido_por_efeito') {
              destruirMonstro(jogadorId, k, 'Força Espelhada');
            }
          }
          inimigo.zonaMagias[j] = null;
          render();
          continue;
        } else if (armadilha.efeito === 'armadilha_refletir_dano' && monstro.efeito !== 'imune_a_armadilhas') {
          armadilha.viradaParaBaixo = false;
          render();
          animarCarta(inimigoId, 'magia', j, 'trap');
          adicionarLog(`Armadilha "Cilindro Mágico" ativada!`);
          await delay(800);
          jogador.hp -= monstro.atk;
          adicionarLog(`${monstro.nome} teve seu ataque refletido! ${nomeJogador(jogadorId)} perdeu ${monstro.atk} HP.`);
          monstro.ataquesRestantes--;
          inimigo.zonaMagias[j] = null;
          if (verificarFimDeDuelo()) return;
          render();
          continue;
        }
      }
    }

    const monstrosInimigos = inimigo.zonaMonstros.filter(m => m !== null);
    if (monstrosInimigos.length === 0) {
      inimigo.hp -= monstro.atk;
      adicionarLog(`${monstro.nome} atacou diretamente! Computador perdeu ${monstro.atk} HP.`);
      monstro.ataquesRestantes--;
      if (verificarFimDeDuelo()) return;
      render();
      await delay(800);
      continue;
    }

    let alvoIndex = -1;
    let melhorDiferenca = -Infinity;
    for (let j = 0; j < inimigo.zonaMonstros.length; j++) {
      const defensor = inimigo.zonaMonstros[j];
      if (!defensor) continue;
      let diff;
      if (defensor.posicao === 'ataque') {
        diff = monstro.atk - defensor.atk;
      } else {
        if (monstro.efeito === 'dano_perfurante' || monstro.efeito === 'ignora_defesa_ataque_direto') {
          diff = monstro.atk - defensor.def;
        } else {
          diff = -1;
        }
      }
      if (diff > 0 && diff > melhorDiferenca) {
        melhorDiferenca = diff;
        alvoIndex = j;
      }
    }

    if (alvoIndex !== -1) {
      const defensor = inimigo.zonaMonstros[alvoIndex];
      await animarAtaque(i, alvoIndex, jogadorId, inimigoId);
      resolverBatalha(jogadorId, inimigoId, i, alvoIndex);
      monstro.ataquesRestantes--;
      render();
      await delay(800);
    } else {
      adicionarLog(`${monstro.nome} não atacou (nenhum alvo favorável).`);
      continue;
    }
  }
}

function encerrarBatalha() {
  if (estado.fase !== 'batalha' || estado.jogadorAtual !== 1) return;
  estado.fase = 'main';
  estado.hasAttacked = true;
  estado.atacanteSelecionado = null;
  limparDestaques();
  renderBotoes();
  adicionarLog('Fase de batalha encerrada.');
}

function animarAtaque(atacanteSlot, defensorSlot, jogadorAtacanteId, jogadorDefensorId) {
  return new Promise(resolve => {
    const atacanteElement = document.querySelector(`#monstro-slots-p${jogadorAtacanteId} .slot[data-slot="${atacanteSlot}"] .card`);
    const defensorElement = defensorSlot !== null ? document.querySelector(`#monstro-slots-p${jogadorDefensorId} .slot[data-slot="${defensorSlot}"] .card`) : null;
    if (atacanteElement) atacanteElement.classList.add('attacking');
    if (defensorElement) defensorElement.classList.add('defending');
    setTimeout(() => {
      if (atacanteElement) atacanteElement.classList.remove('attacking');
      if (defensorElement) defensorElement.classList.remove('defending');
      resolve();
    }, 600);
  });
}

// ==================== FINALIZAÇÃO E VITÓRIAS ====================
// Função para mostrar a vitória da rodada (modal que some sozinho)
function exibirVitoriaRodada(vencedorId) {
    const modal = document.getElementById('modal-round-winner');
    const text = document.getElementById('round-winner-text');
    text.textContent = `${nomeJogador(vencedorId)} venceu a rodada!`;
    modal.classList.remove('hidden');

    // Some após 1.5 segundos e inicia a próxima
    setTimeout(() => {
        modal.classList.add('hidden');
        estado.campeonato.rodadaAtual++;
        adicionarLog('--- Iniciando próximo duelo ---');
        iniciarNovoDuelo(); // Agora chama sempre, sem o if que travava
    }, 1500);
}

// Função para mostrar a vitória da partida (modal fixo com botão jogar novamente)
function exibirVitoriaCampeonato(vencedorId) {
    const modal = document.getElementById('modal-endgame');
    const text = document.getElementById('endgame-winner-text');
    text.textContent = `🏆 ${nomeJogador(vencedorId)} é o grande campeão! 🏆`;
    modal.classList.remove('hidden');
}

function finalizarDuelo(vencedorId, motivo) {
  if (estado.fase === 'fim') return;
  estado.fase = 'fim';
  adicionarLog(`🏆 ${nomeJogador(vencedorId)} venceu o duelo! Motivo: ${motivo}`);
  if (vencedorId === 1) estado.campeonato.vitoriasJ1++;
  else estado.campeonato.vitoriasJ2++;
  estado.campeonato.historico.push({ rodada: estado.campeonato.rodadaAtual, vencedor: vencedorId, motivo });
  renderPlacar();

  const vitoriasNecessarias = Math.ceil(estado.campeonato.melhorDe / 2);
  
  // Verifica se já terminou o campeonato
  if (estado.campeonato.vitoriasJ1 >= vitoriasNecessarias || estado.campeonato.vitoriasJ2 >= vitoriasNecessarias) {
    adicionarLog(`🏆 Campeonato encerrado! Vencedor: ${nomeJogador(estado.campeonato.vitoriasJ1 >= vitoriasNecessarias ? 1 : 2)}`);
    render();
    exibirVitoriaCampeonato(estado.campeonato.vitoriasJ1 >= vitoriasNecessarias ? 1 : 2);
    return;
  }
  
  // Se não terminou, mostra o efeito de vitória da rodada
  exibirVitoriaRodada(vencedorId);
}

// ==================== RENDERIZAÇÃO ====================
function render() {
  renderInfoJogadores();
  renderZonas();
  renderMao();
  renderBotoes();
}

function renderInfoJogadores() {
  const p1 = estado.jogadores[1];
  const p2 = estado.jogadores[2];
  document.getElementById('hp-p1').textContent = p1.hp;
  document.getElementById('hp-p2').textContent = p2.hp;
  document.getElementById('deck-p1').textContent = p1.deck.length;
  document.getElementById('deck-p2').textContent = p2.deck.length;
  renderPlacar();
}

function renderPlacar() {
  document.getElementById('score-p1').textContent = estado.campeonato.vitoriasJ1;
  document.getElementById('score-p2').textContent = estado.campeonato.vitoriasJ2;
  document.getElementById('series-info').textContent = 
    `Melhor de ${estado.campeonato.melhorDe}: ${nomeJogadorParam} ${estado.campeonato.vitoriasJ1} x ${estado.campeonato.vitoriasJ2} Computador`;
  document.getElementById('score-player-name').textContent = nomeJogadorParam;
  document.getElementById('player-nick-display').textContent = nomeJogadorParam;
}

function renderZonas() {
  for (let i = 1; i <= 2; i++) {
    const zonaMonstros = document.getElementById(`monstro-slots-p${i}`);
    const zonaMagias = document.getElementById(`magia-slots-p${i}`);
    zonaMonstros.innerHTML = '';
    zonaMagias.innerHTML = '';

    for (let j = 0; j < 3; j++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.jogador = i;
      slot.dataset.zona = 'monstro';
      slot.dataset.slot = j;
      const monstro = estado.jogadores[i].zonaMonstros[j];
      if (monstro) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        if (monstro.posicao === 'defesa') cardDiv.classList.add('defense');
        const atkTotal = monstro.atk + (monstro.bonusAtk || 0);
        const defTotal = monstro.def + (monstro.bonusDef || 0);
        cardDiv.innerHTML = `
          <div class="card-name">${monstro.nome}</div>
          <div class="card-stats"><span>ATK ${atkTotal}</span><span>DEF ${defTotal}</span></div>
          <div class="card-position">${monstro.posicao === 'ataque' ? 'ATQ' : 'DEF'}</div>
        `;
        // AO PASSAR O MOUSE: chamar showPreview. AO SAIR: não chamar nada para fixar a carta!
        cardDiv.addEventListener('mouseenter', () => showPreview(monstro, i));
        slot.appendChild(cardDiv);
      }
      slot.addEventListener('click', () => handleSlotClick(i, 'monstro', j));
      zonaMonstros.appendChild(slot);
    }

    for (let j = 0; j < 3; j++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.jogador = i;
      slot.dataset.zona = 'magia';
      slot.dataset.slot = j;
      const carta = estado.jogadores[i].zonaMagias[j];
      if (carta) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        if (carta.viradaParaBaixo && i === 2) {
          cardDiv.classList.add('facedown');
          cardDiv.textContent = '?';
        } else {
          if (carta.viradaParaBaixo && i === 1) cardDiv.classList.add('facedown-own');
          cardDiv.innerHTML = `<div class="card-name">${carta.nome}</div><div>${carta.tipo}</div>`;
        }
        cardDiv.addEventListener('mouseenter', () => showPreview(carta, i));
        slot.appendChild(cardDiv);
      }
      slot.addEventListener('click', () => handleSlotClick(i, 'magia', j));
      zonaMagias.appendChild(slot);
    }
  }
}

function renderMao() {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = '';
  if (estado.jogadorAtual === 1) {
    estado.jogadores[1].mao.forEach((carta, index) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'hand-card';
      cardDiv.dataset.index = index;
      if (estado.cartaSelecionada === index) cardDiv.classList.add('selected');
      let info = `<div class="card-name">${carta.nome}</div>`;
      if (carta.tipo === 'monstro') info += `<div class="card-stats"><span>ATK ${carta.atk}</span><span>DEF ${carta.def}</span></div>`;
      else if (carta.tipo === 'magia') info += `<div>${carta.descricao || 'Magia'}</div>`;
      else info += `<div>${carta.descricao || 'Armadilha'}</div>`;
      cardDiv.innerHTML = info;
      cardDiv.addEventListener('mouseenter', () => showPreview(carta, 1));
      cardDiv.addEventListener('click', () => selecionarCartaDaMao(index));
      handDiv.appendChild(cardDiv);
    });
  } else {
    for (let i = 0; i < estado.jogadores[2].mao.length; i++) {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'hand-card';
      cardDiv.style.backgroundColor = '#2c3e50';
      cardDiv.style.color = 'white';
      cardDiv.textContent = '?';
      handDiv.appendChild(cardDiv);
    }
  }
}

function renderBotoes() {
  const btnAtacar = document.getElementById('btn-atacar');
  const btnEncerrar = document.getElementById('btn-encerrar');
  if (estado.fase === 'main' && estado.jogadorAtual === 1 && !estado.processandoAnimacao) {
    btnAtacar.disabled = !(estado.turno !== 1 && !estado.hasAttacked && !estado.primeiroTurno);
    btnEncerrar.disabled = false;
  } else if (estado.fase === 'batalha' && estado.jogadorAtual === 1 && !estado.processandoAnimacao) {
    btnAtacar.disabled = true;
    btnEncerrar.disabled = false; // Pode encerrar o turno a qualquer momento
  } else {
    btnAtacar.disabled = true;
    btnEncerrar.disabled = true;
  }
}

function renderLog() {
  const logDiv = document.getElementById('log');
  logDiv.innerHTML = estado.log.slice(-10).map(msg => `<div>${msg}</div>`).join('');
  logDiv.scrollTop = logDiv.scrollHeight;
}

function showPreview(carta, jogadorId) {
  const preview = document.getElementById('card-preview');
  const effectDisplay = document.getElementById('card-effect-display');
  
  preview.innerHTML = '';
  preview.classList.remove('hidden');
  
  if (carta.viradaParaBaixo && jogadorId === 2) {
    const nome = document.createElement('div');
    nome.className = 'card-name';
    nome.textContent = 'Carta virada';
    preview.appendChild(nome);
    effectDisplay.classList.add('hidden');
    return;
  }
  
  const nome = document.createElement('div');
  nome.className = 'card-name';
  nome.textContent = carta.nome;
  preview.appendChild(nome);
  
  const tipo = document.createElement('div');
  tipo.className = 'card-type';
  tipo.textContent = carta.tipo.charAt(0).toUpperCase() + carta.tipo.slice(1);
  preview.appendChild(tipo);
  
  if (carta.tipo === 'monstro') {
    const stats = document.createElement('div');
    stats.className = 'card-stats';
    stats.innerHTML = `<span>ATK ${carta.atk + (carta.bonusAtk || 0)}</span><span>DEF ${carta.def + (carta.bonusDef || 0)}</span>`;
    preview.appendChild(stats);
  }

  let efeitoTexto = '';
  if (carta.descricao) { efeitoTexto = carta.descricao; } 
  else if (carta.efeito) { efeitoTexto = `Efeito: ${carta.efeito}`; }

  if (efeitoTexto) {
    effectDisplay.textContent = efeitoTexto;
    effectDisplay.classList.remove('hidden');
  } else {
    effectDisplay.classList.add('hidden');
  }
}

function hidePreview() {
    // Função vazia intencionalmente para que o preview nunca suma enquanto não passar o mouse em outra carta
}

// ==================== DESTAQUES ====================
function limparDestaques() {
  document.querySelectorAll('.slot.highlight').forEach(el => el.classList.remove('highlight'));
  document.getElementById('hp-p2')?.classList.remove('highlight-target');
  document.getElementById('hp-p1')?.classList.remove('highlight-target');
}

function destacarSlotsMonstroVazios(jogadorId) {
  limparDestaques();
  const slots = document.querySelectorAll(`#monstro-slots-p${jogadorId} .slot`);
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    if (estado.jogadores[jogadorId].zonaMonstros[index] === null) slot.classList.add('highlight');
  });
}

function destacarMonstrosProprios() {
  limparDestaques();
  const slots = document.querySelectorAll(`#monstro-slots-p1 .slot`);
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    if (estado.jogadores[1].zonaMonstros[index] !== null) slot.classList.add('highlight');
  });
}

function destacarMonstrosInimigos() {
  limparDestaques();
  const slots = document.querySelectorAll(`#monstro-slots-p2 .slot`);
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    if (estado.jogadores[2].zonaMonstros[index] !== null) slot.classList.add('highlight');
  });
}

// ==================== ANIMAÇÃO ====================
function animarCarta(jogadorId, zona, slotIndex, tipo = 'bright') {
  const selector = `#${zona}-slots-p${jogadorId} .slot[data-slot="${slotIndex}"] .card`;
  const cardElement = document.querySelector(selector);
  if (cardElement) {
    let classe;
    switch (tipo) {
      case 'bright': classe = 'bright'; break;
      case 'trap': classe = 'trap-activating'; break;
      case 'magic': classe = 'magic-activating'; break;
      default: classe = 'bright';
    }
    cardElement.classList.add(classe);
    setTimeout(() => cardElement.classList.remove(classe), 800);
  }
}

// ==================== TRATAMENTO DE CLICKS ====================
function handleSlotClick(jogadorId, zona, slotIndex) {
  if (estado.fase === 'batalha' && estado.jogadorAtual === 1 && !estado.processandoAnimacao) {
    if (jogadorId === 1 && zona === 'monstro') {
      if (estado.atacanteSelecionado === null) selecionarAtacante(slotIndex);
      else if (estado.atacanteSelecionado === slotIndex) {
        estado.atacanteSelecionado = null;
        limparDestaques();
        destacarAtacantesDisponiveis(1);
        adicionarLog('Selecione outro monstro atacante.');
      } else selecionarAtacante(slotIndex);
    } else if (jogadorId === 2 && zona === 'monstro') {
      if (estado.atacanteSelecionado !== null) executarAtaque(estado.atacanteSelecionado, 'monstro', slotIndex);
    }
    return;
  }

  if (estado.jogadorAtual !== 1 || estado.fase !== 'main' || estado.processandoAnimacao) return;
  const jogador = estado.jogadores[1];
  const acao = estado.acaoPendente;

  if (!acao && jogadorId === 1 && zona === 'monstro') {
    alternarPosicaoMonstro(1, slotIndex);
    return;
  }

  if (acao.tipo === 'invocar') {
    if (jogadorId === 1 && zona === 'monstro' && jogador.zonaMonstros[slotIndex] === null) {
      invocarMonstro(1, estado.cartaSelecionada, slotIndex, acao.posicao);
    }
  } else if (acao.tipo === 'magia_buff') {
    if (jogadorId === 1 && zona === 'monstro' && jogador.zonaMonstros[slotIndex] !== null) {
      usarMagia(1, estado.cartaSelecionada, { tipo: 'proprio', slot: slotIndex });
    }
  } else if (acao.tipo === 'magia_destruir') {
    if (jogadorId === 2 && zona === 'monstro' && estado.jogadores[2].zonaMonstros[slotIndex] !== null) {
      usarMagia(1, estado.cartaSelecionada, { tipo: 'inimigo', slot: slotIndex });
    }
  } else if (acao.tipo === 'roubar') {
    if (jogadorId === 2 && zona === 'monstro' && estado.jogadores[2].zonaMonstros[slotIndex] !== null) {
      usarMagia(1, estado.cartaSelecionada, { tipo: 'inimigo', slot: slotIndex });
    }
  }
}

// Ação de sair da partida
function sairDaPartida() {
    if (confirm("Você tem certeza que deseja sair?")) {
        window.location.href = 'index.html';
    }
}

document.getElementById('hp-p2').addEventListener('click', () => {
  if (estado.fase === 'batalha' && estado.jogadorAtual === 1 && estado.atacanteSelecionado !== null && !estado.processandoAnimacao) {
    executarAtaque(estado.atacanteSelecionado, 'jogador', null);
  }
});

document.getElementById('btn-atacar').addEventListener('click', iniciarBatalha);
document.getElementById('btn-encerrar').addEventListener('click', () => {
  if (estado.jogadorAtual === 1 && (estado.fase === 'main' || estado.fase === 'batalha') && !estado.processandoAnimacao) {
    encerrarTurno();
  }
});

// Inicializar o campeonato automaticamente quando a página carregar
window.onload = () => {
    iniciarCampeonato();
};