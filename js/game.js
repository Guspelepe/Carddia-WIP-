// ==================== LER PARÂMETROS DA URL ====================
const urlParams = new URLSearchParams(window.location.search);
let nivelDificuldade = urlParams.get('diff') || 'medio';
const nomeJogadorParam = urlParams.get('nick') || 'Você';

// ==================== ESTADO GLOBAL ====================
const estado = {
  fase: 'inicio', turno: 1, jogadorAtual: 1, primeiroTurno: true, magiasBloqueadas: false,
  campeonato: { vitoriasJ1: 0, vitoriasJ2: 0, rodadaAtual: 1, melhorDe: parseInt(urlParams.get('bestof')) || 3, historico: [] },
  jogadores: { 1: criarJogadorInicial(1), 2: criarJogadorInicial(2) },
  deckCompartilhado: [...ALL_CARDS], cartaSelecionada: null, acaoPendente: null, atacanteSelecionado: null,
  hasAttacked: false, processandoAnimacao: false, log: []
};

function nomeJogador(id) { return id === 1 ? nomeJogadorParam : 'Computador'; }
function criarJogadorInicial(id) { return { id, hp: 4000, deck: [], mao: [], zonaMonstros: [null, null, null], zonaMagias: [null, null, null], cemiterio: [], devePularCompra: false }; }

// ==================== FUNÇÕES AUXILIARES ====================
function embaralhar(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
function comprarCarta(jogadorId, quantidade = 1) {
  const jogador = estado.jogadores[jogadorId];
  if (jogador.devePularCompra) { adicionarLog(`${nomeJogador(jogadorId)} teve sua compra pulada por um efeito!`); jogador.devePularCompra = false; return false; }
  for (let i = 0; i < quantidade; i++) {
    if (jogador.deck.length === 0) { finalizarDuelo(jogadorId === 1 ? 2 : 1, 'Deck vazio'); return false; }
    let carta = jogador.deck.shift(); // SEMPRE tira a primeira carta
    if (jogador.mao.length < 5) jogador.mao.push(carta);
    // Verificar armadilha Falso Tesouro (se o oponente tiver)
    for (let i = 0; i < estado.jogadores[jogadorId === 1 ? 2 : 1].zonaMagias.length; i++) {
        const t = estado.jogadores[jogadorId === 1 ? 2 : 1].zonaMagias[i];
        if (t && t.tipo === 'armadilha' && t.efeito === 'armadilha_dano_comprar' && quantidade > 1) {
            adicionarLog(`Armadilha "Falso Tesouro" ativada! ${nomeJogador(jogadorId)} perdeu 1000 PV.`);
            estado.jogadores[jogadorId].hp -= 1000; estado.jogadores[jogadorId === 1 ? 2 : 1].zonaMagias[i] = null;
            if (verificarFimDeDuelo()) return false;
        }
    }
  } return true;
}
function adicionarLog(mensagem) { estado.log.push(mensagem); renderLog(); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ==================== MONTAGEM DE DECK ====================
function montarDeck(jogadorId, deckCompleto, nivel) {
  // IA usa a função específica (em ai.js)
  if (jogadorId === 2) {
    return window.aiMontarDeck ? window.aiMontarDeck(jogadorId, deckCompleto, nivel) : deckCompleto.slice(0, 20);
  }

  // ----- DECK DO JOGADOR HUMANO (MUITO FRACO) -----
  const tier1Ids = ['m10','m11','m19','m23','m24','m27','m28','m29','m30','m37','m39','s08','s09','s12','s13','s15','t10','t11'];
  const tier2Ids = ['m05','m08','m16','m21','m25','m26','m32','m33','m34','m35','m36','m40','m41','m42','s04','s05','s10','s11','s14','s16','t08','t09'];
  const tier3Ids = ['m01','m02','m03','m04','m06','m07','m09','m12','m13','m14','m15','m17','m18','m20','m22','s01','s02','s03','s06','s07','s17','s18'];

  const allCards = [...ALL_CARDS];
  const tier3 = allCards.filter(c => tier3Ids.includes(c.id));
  const tier2 = allCards.filter(c => tier2Ids.includes(c.id));
  const tier1 = allCards.filter(c => tier1Ids.includes(c.id));

  // 10 monstros tier3 + 2 monstros tier2 (opcional) = 12
  const monstrosTier3 = embaralhar([...tier3.filter(c => c.tipo === 'monstro')]).slice(0, 10);
  const monstrosTier2 = embaralhar([...tier2.filter(c => c.tipo === 'monstro')]).slice(0, 2);
  const todosMonstros = [...monstrosTier3, ...monstrosTier2];
  // 4 magias tier3
  const magias = embaralhar([...tier3.filter(c => c.tipo === 'magia')]).slice(0, 4);
  // 4 armadilhas tier3
  const armadilhas = embaralhar([...tier3.filter(c => c.tipo === 'armadilha')]).slice(0, 4);
  
  let deck = [...todosMonstros, ...magias, ...armadilhas];
  // Preencher até 20 com tier3 (qualquer)
  while (deck.length < 20) {
    deck.push(tier3[Math.floor(Math.random() * tier3.length)]);
  }
  return embaralhar(deck).slice(0, 20);
}

// ==================== DICIONÁRIO DE EFETOS (MOTOR DO JOGO) ====================
// Mapa de Magias
const MAPA_EFEITOS_MAGIA = {
    'buff_500': (jog, alvo) => { const m = jog.zonaMonstros[alvo.slot]; if (m) { m.bonusAtk = (m.bonusAtk||0) + 500; adicionarLog(`${m.nome} ganhou +500 de ATK.`); animarCarta(jog.id, 'monstro', alvo.slot); } },
    'buff_1000': (jog, alvo) => { const m = jog.zonaMonstros[alvo.slot]; if (m) { m.bonusAtk = (m.bonusAtk||0) + 1000; m.bonusDef = (m.bonusDef||0) + 1000; adicionarLog(`${m.nome} ganhou +1000 de ATK e DEF.`); animarCarta(jog.id, 'monstro', alvo.slot); } },
    'buff_defesa_2000': (jog, alvo) => { const m = jog.zonaMonstros[alvo.slot]; if (m) { m.bonusDef = (m.bonusDef||0) + 2000; adicionarLog(`${m.nome} ganhou +2000 de DEF.`); animarCarta(jog.id, 'monstro', alvo.slot); } },
    'buff_1500_dano_500': (jog, alvo) => { const m = jog.zonaMonstros[alvo.slot]; if (m) { m.bonusAtk = (m.bonusAtk||0) + 1500; jog.hp -= 500; adicionarLog(`${m.nome} ganhou +1500 de ATK, mas você perdeu 500 PV.`); animarCarta(jog.id, 'monstro', alvo.slot); } },
    'buff_2000_dano_1000_por_turno': (jog, alvo) => { const m = jog.zonaMonstros[alvo.slot]; if (m) { m.bonusAtk = (m.bonusAtk||0) + 2000; adicionarLog(`${m.nome} ganhou +2000 de ATK (Amaldiçoada).`); animarCarta(jog.id, 'monstro', alvo.slot); } },
    'imune_ataques_turno': (jog, alvo) => { const m = jog.zonaMonstros[alvo.slot]; if (m) { m.imuneAtaquesEsteTurno = true; adicionarLog(`${m.nome} está imune a ataques neste turno.`); animarCarta(jog.id, 'monstro', alvo.slot); } },
    'ataque_duplo_destroi_no_fim': (jog, alvo) => { const m = jog.zonaMonstros[alvo.slot]; if (m) { m.ataquesRestantes = 2; m.turnoUsadoParaDuplo = estado.turno; adicionarLog(`${m.nome} atacará duas vezes e será destruído no final!`); animarCarta(jog.id, 'monstro', alvo.slot); } },
    'destruir_inimigo': (jog, alvo, _, op) => { const m = op.zonaMonstros[alvo.slot]; if (m) { if (m.efeito === 'imune_a_magias' || m.efeito === 'nao_pode_ser_destruido_por_efeito') adicionarLog(`${m.nome} é imune a magias.`); else destruirMonstro(op.id, alvo.slot, 'efeito de magia'); } },
    'destruir_todos_inimigos': (jog, _, __, op) => { for (let i = 0; i < op.zonaMonstros.length; i++) { const m = op.zonaMonstros[i]; if (m && m.efeito !== 'imune_a_magias' && m.efeito !== 'nao_pode_ser_destruido_por_efeito') destruirMonstro(op.id, i, 'efeito de magia'); } render(); },
    'destruir_magias_armadilhas': (jog, _, __, op) => { for (let i = 0; i < op.zonaMagias.length; i++) { if (op.zonaMagias[i]) op.zonaMagias[i] = null; } adicionarLog('Todas as magias/armadilhas do oponente foram destruídas.'); render(); },
    'devolver_monstro_mao': (jog, alvo, _, op) => { const m = op.zonaMonstros[alvo.slot]; if (m) { op.zonaMonstros[alvo.slot] = null; if (op.mao.length < 5) op.mao.push(m); else op.cemiterio.push(m); adicionarLog(`${m.nome} foi devolvido para a mão.`); render(); } },
    'prende_monstro_inimigo': (jog, alvo, _, op) => { const m = op.zonaMonstros[alvo.slot]; if (m) { m.estaPreso = true; adicionarLog(`${m.nome} está preso!`); render(); } },
    'roubar_monstro': (jog, alvo, _, op) => { const m = op.zonaMonstros[alvo.slot]; if (m) { op.zonaMonstros[alvo.slot] = null; const v = jog.zonaMonstros.findIndex(s => s === null); if (v !== -1) { jog.zonaMonstros[v] = { ...m, temporario: true, jaAtacou: false, ataquesRestantes: 1 }; adicionarLog(`${m.nome} foi controlado!`); animarCarta(jog.id, 'monstro', v); } else op.cemiterio.push(m); render(); } },
    'reviver_monstro': (jog, alvo) => { if (alvo.tipo === 'cemiterio') { const cem = jog.cemiterio; const m = cem[alvo.index]; if (m) { cem.splice(alvo.index, 1); const v = jog.zonaMonstros.findIndex(s => s === null); if (v !== -1) { jog.zonaMonstros[v] = { ...m, jaAtacou: false, ataquesRestantes: 1, bonusAtk: 0, bonusDef: 0, temporario: false }; adicionarLog(`${m.nome} foi revivido!`); animarCarta(jog.id, 'monstro', v); } else adicionarLog('Zona de monstros cheia.'); } } },
    'curar_2000': (jog) => { jog.hp += 2000; adicionarLog(`${nomeJogador(jog.id)} curou 2000 de vida.`); },
    'curar_1000_por_monstro': (jog) => { const c = jog.zonaMonstros.filter(m => m !== null).length; jog.hp += c * 1000; adicionarLog(`${nomeJogador(jog.id)} curou ${c*1000} de vida.`); },
    'comprar_2': (jog) => comprarCarta(jog.id, 2),
    'comprar_3_dano_1000': (jog) => { comprarCarta(jog.id, 3); jog.hp -= 1000; adicionarLog(`${nomeJogador(jog.id)} perdeu 1000 de vida.`); verificarFimDeDuelo(); },
    'trocar_vida_por_cartas': (jog) => { jog.hp -= 2000; comprarCarta(jog.id, 2); adicionarLog(`${nomeJogador(jog.id)} perdeu 2000 PV para comprar 2 cartas.`); verificarFimDeDuelo(); },
    'metade_vida_compra_3': (jog) => { const c = Math.ceil(jog.hp / 2); jog.hp -= c; comprarCarta(jog.id, 3); adicionarLog(`${nomeJogador(jog.id)} pagou ${c} PV para comprar 3 cartas.`); verificarFimDeDuelo(); },
    'dano_direto_1000': (jog, _, __, op) => { op.hp -= 1000; adicionarLog(`${nomeJogador(jog.id)} causou 1000 de dano direto!`); verificarFimDeDuelo(); },
    'iguala_vida_menor': (jog, _, __, op) => { if (jog.hp < op.hp) { jog.hp += (op.hp - jog.hp); adicionarLog(`${nomeJogador(jog.id)} igualou a vida à do oponente!`); } },
    'devolve_mao_compra': (jog) => { const q = jog.mao.length; for (let i = 0; i < q; i++) { jog.mao.pop(); } comprarCarta(jog.id, q); adicionarLog(`${nomeJogador(jog.id)} devolveu a mão e comprou ${q} cartas.`); },
    'olhar_mao_comprar_1': (jog, _, __, op) => { if (op.mao.length > 0) adicionarLog(`${nomeJogador(jog.id)} olhou a mão: ${op.mao.map(c=>c.nome).join(', ')}`); comprarCarta(jog.id, 1); },
    'bloqueia_magias_turno': (jog) => { estado.magiasBloqueadas = true; adicionarLog('Zona de Antimagia bloqueia magias até o próximo turno.'); },
    'destruir_monstros_baixo_atk': (jog, _, __, op) => { for (let i = 0; i < jog.zonaMonstros.length; i++) { const m = jog.zonaMonstros[i]; if (m && (m.atk + (m.bonusAtk||0)) <= 1500) destruirMonstro(jog.id, i, 'Punição dos Fracos'); } for (let i = 0; i < op.zonaMonstros.length; i++) { const m = op.zonaMonstros[i]; if (m && (m.atk + (m.bonusAtk||0)) <= 1500) destruirMonstro(op.id, i, 'Punição dos Fracos'); } render(); },
};

// Mapa de Efeitos de Invocação
const MAPA_EFEITOS_INVOCACAO = {
    'ao_invocar_revive_monstro': (jog, m) => { if (jog.cemiterio.length > 0) { const f = jog.cemiterio.reduce((a,b) => b.atk > a.atk ? b : a); const idx = jog.cemiterio.indexOf(f); jog.cemiterio.splice(idx, 1); const v = jog.zonaMonstros.findIndex(s => s === null); if (v !== -1) { jog.zonaMonstros[v] = { ...f, jaAtacou: false, ataquesRestantes: 1, bonusAtk: 0, bonusDef: 0, temporario: false }; adicionarLog(`${m.nome} reviveu ${f.nome}!`); animarCarta(jog.id, 'monstro', v); } } },
    'ao_invocar_destroi_magia_armadilha': (jog, m, op) => { for (let i = 0; i < op.zonaMagias.length; i++) { if (op.zonaMagias[i]) { adicionarLog(`${m.nome} destruiu ${op.zonaMagias[i].nome}.`); op.zonaMagias[i] = null; } } render(); },
    'ao_invocar_destroi_armadilha': (jog, m, op) => { for (let i = 0; i < op.zonaMagias.length; i++) { const t = op.zonaMagias[i]; if (t && t.tipo === 'armadilha') { adicionarLog(`${m.nome} destruiu a armadilha ${t.nome}.`); op.zonaMagias[i] = null; } } render(); },
    'ao_invocar_destroi_todas_magias': (jog, m, op) => { for (let i = 0; i < op.zonaMagias.length; i++) { const t = op.zonaMagias[i]; if (t && t.tipo === 'magia') { adicionarLog(`${m.nome} destruiu a magia ${t.nome}.`); op.zonaMagias[i] = null; } } render(); },
    'ao_invocar_ganha_1000_vida': (jog, m) => { jog.hp += 1000; adicionarLog(`${m.nome} curou 1000 PV.`); },
    'ao_invocar_causa_500_dano_em_si': (jog, m) => { jog.hp -= 500; adicionarLog(`${m.nome} causou 500 de dano a si mesmo.`); verificarFimDeDuelo(); },
    'ao_invocar_muda_inimigos_para_defesa': (jog, m, op) => { for (let i = 0; i < op.zonaMonstros.length; i++) { if (op.zonaMonstros[i]) { op.zonaMonstros[i].posicao = 'defesa'; op.zonaMonstros[i].posicaoMudouEsteTurno = true; } } adicionarLog(`${m.nome} mudou os inimigos para defesa.`); render(); },
    'ao_invocar_comprar_1_carta': (jog) => comprarCarta(jog.id, 1),
    'ao_invocar_causa_500_dano_direto': (jog, m, op) => { op.hp -= 500; adicionarLog(`${m.nome} causou 500 de dano direto!`); verificarFimDeDuelo(); render(); },
    'ao_invocar_devolve_monstro_pra_mao': (jog, m, op) => { if (op.zonaMonstros.some(s => s !== null)) { const idx = op.zonaMonstros.findIndex(s => s !== null); const a = op.zonaMonstros[idx]; op.zonaMonstros[idx] = null; if (op.mao.length < 5) op.mao.push(a); else op.cemiterio.push(a); adicionarLog(`${m.nome} devolveu ${a.nome}.`); render(); } },
    'ao_invocar_olhar_mao_oponente': (jog, m, op) => { const nomes = op.mao.map(c => c.nome).join(', '); adicionarLog(`${m.nome} espiou a mão: ${nomes}`); },
};

// Mapa de Efeitos de Morte
const MAPA_EFEITOS_MORTE = {
    'quando_morre_ganha_500_vida': (jog) => { jog.hp += 500; adicionarLog(`${nomeJogador(jog.id)} ganhou 500 de vida.`); }
};

// ==================== INICIALIZAÇÃO ====================
function iniciarCampeonato() { document.getElementById('modal-endgame').classList.add('hidden'); document.getElementById('modal-round-winner').classList.add('hidden'); estado.campeonato.vitoriasJ1 = 0; estado.campeonato.vitoriasJ2 = 0; estado.campeonato.rodadaAtual = 1; iniciarNovoDuelo(); }
function iniciarNovoDuelo() {
  estado.jogadores[1] = criarJogadorInicial(1); estado.jogadores[2] = criarJogadorInicial(2); estado.magiasBloqueadas = false;
  estado.jogadores[1].deck = montarDeck(1, [...ALL_CARDS], nivelDificuldade); estado.jogadores[2].deck = montarDeck(2, [...ALL_CARDS], nivelDificuldade);
  for (let i = 0; i < 5; i++) { comprarCarta(1); comprarCarta(2); }
  estado.jogadorAtual = Math.random() < 0.5 ? 1 : 2; estado.turno = 1; estado.primeiroTurno = true; estado.hasAttacked = false; estado.fase = 'main';
  estado.cartaSelecionada = null; estado.acaoPendente = null; estado.atacanteSelecionado = null; estado.processandoAnimacao = false;
  document.getElementById('card-preview').classList.add('hidden'); document.getElementById('card-effect-display').classList.add('hidden');
  render(); adicionarLog(`--- Novo duelo iniciado! Sorteio: ${nomeJogador(estado.jogadorAtual)} começa. ---`);
  if (estado.jogadorAtual === 1) { adicionarLog('Você não pode atacar no primeiro turno.'); } else { setTimeout(() => aiTurn(estado), 1200); }
}

// ==================== TROCA DE TURNOS ====================
function encerrarTurno() {
  if (estado.fase === 'fim') return;
  if (estado.fase === 'batalha') { estado.fase = 'main'; estado.hasAttacked = true; estado.atacanteSelecionado = null; limparDestaques(); adicionarLog('Fase de batalha encerrada.'); }
  const p1 = estado.jogadores[1]; const p2 = estado.jogadores[2];
  [p1, p2].forEach((jogador, index) => {
      const id = index + 1; let cura = 0; let dano = 0;
      jogador.zonaMonstros.forEach(m => {
          if (m) {
              if (m.efeito === 'final_turno_cura_300_por_aliado') cura += 300 * jogador.zonaMonstros.filter(s => s !== null).length;
              if (m.efeito === 'buff_2000_dano_1000_por_turno' && m.bonusAtk > 0) dano += 1000;
              if (m.efeito === 'ataque_duplo_destroi_no_fim' && m.ataquesRestantes > 0 && estado.turno === m.turnoUsadoParaDuplo) { destruirMonstro(id, jogador.zonaMonstros.indexOf(m), 'Poção da Fúria'); m.ataquesRestantes = 1; }
              m.naoPodeAtacarProximoTurno = false; m.estaPreso = false;
          }
      });
      if (cura > 0) { jogador.hp += cura; adicionarLog(`${nomeJogador(id)} curou ${cura} PV.`); }
      if (dano > 0) { jogador.hp -= dano; adicionarLog(`${nomeJogador(id)} perdeu ${dano} PV (Espada Amaldiçoada).`); if (verificarFimDeDuelo()) return; }
  });
  estado.jogadores[1].zonaMonstros.forEach(m => { if (m) { m.jaAtacou = false; m.ataquesRestantes = m.efeito === 'pode_atacar_duas_vezes' ? 2 : 1; m.invocadoEsteTurno = false; m.posicaoMudouEsteTurno = false; m.turnoUsadoParaDuplo = 0; } });
  estado.jogadores[2].zonaMonstros.forEach(m => { if (m) { m.jaAtacou = false; m.ataquesRestantes = m.efeito === 'pode_atacar_duas_vezes' ? 2 : 1; m.invocadoEsteTurno = false; m.posicaoMudouEsteTurno = false; m.turnoUsadoParaDuplo = 0; } });
  retornarMonstrosTemporarios(1); retornarMonstrosTemporarios(2);
  estado.jogadorAtual = estado.jogadorAtual === 1 ? 2 : 1; estado.turno++; estado.primeiroTurno = false; estado.hasAttacked = false; estado.fase = 'main'; estado.cartaSelecionada = null; estado.acaoPendente = null; estado.atacanteSelecionado = null; estado.processandoAnimacao = false; limparDestaques();
  const jogador = estado.jogadores[estado.jogadorAtual]; if (!comprarCarta(estado.jogadorAtual, 5 - jogador.mao.length)) return;
  render(); adicionarLog(`--- Turno ${estado.turno} - ${nomeJogador(estado.jogadorAtual)} ---`);
  if (estado.jogadorAtual === 2) setTimeout(() => aiTurn(estado), 1200);
}
function retornarMonstrosTemporarios(jogadorId) {
  const jogador = estado.jogadores[jogadorId]; const donoOriginal = jogadorId === 1 ? 2 : 1; const dono = estado.jogadores[donoOriginal];
  for (let i = 0; i < jogador.zonaMonstros.length; i++) {
    const monstro = jogador.zonaMonstros[i];
    if (monstro && monstro.temporario) {
      jogador.zonaMonstros[i] = null; const slotVazio = dono.zonaMonstros.findIndex(slot => slot === null);
      if (slotVazio !== -1) { dono.zonaMonstros[slotVazio] = monstro; monstro.temporario = false; } else { dono.cemiterio.push(monstro); adicionarLog(`${monstro.nome} retornou ao cemitério.`); }
    }
  }
}

// ==================== AÇÕES DO JOGADOR ====================
function selecionarCartaDaMao(index) {
  if (estado.fase !== 'main' || estado.jogadorAtual !== 1 || estado.processandoAnimacao) return;
  if (estado.magiasBloqueadas && estado.jogadores[1].mao[index].tipo === 'magia') { adicionarLog('Zona de Antimagia bloqueia magias.'); return; }
  const jogador = estado.jogadores[1]; if (index >= jogador.mao.length) return;
  const carta = jogador.mao[index]; estado.cartaSelecionada = null; estado.acaoPendente = null; estado.atacanteSelecionado = null; limparDestaques(); esconderModalPosicao();
  if (carta.tipo === 'monstro') {
    if (jogador.zonaMonstros.filter(slot => slot === null).length === 0) { adicionarLog('Zona de monstros cheia.'); return; }
    estado.cartaSelecionada = index; mostrarModalPosicao();
  } else if (carta.tipo === 'magia') {
    estado.cartaSelecionada = index; const efeito = carta.efeito; const alvosInimigos = estado.jogadores[2].zonaMonstros.filter(m => m !== null); const alvosProprios = estado.jogadores[1].zonaMonstros.filter(m => m !== null);
    if (['buff_500','buff_1000','buff_defesa_2000','buff_1500_dano_500','buff_2000_dano_1000_por_turno','imune_ataques_turno','ataque_duplo_destroi_no_fim'].includes(efeito)) {
      if (alvosProprios.length === 0) { adicionarLog('Você não tem monstros.'); return; }
      estado.acaoPendente = { tipo: 'magia_buff', efeito: efeito, alvos: alvosProprios }; destacarMonstrosProprios();
    } else if (['destruir_inimigo','devolver_monstro_mao','prende_monstro_inimigo'].includes(efeito)) {
      if (alvosInimigos.length === 0) { adicionarLog('Oponente sem monstros.'); return; }
      estado.acaoPendente = { tipo: 'magia_inimigo', efeito: efeito, alvos: alvosInimigos }; destacarMonstrosInimigos();
    } else if (['destruir_todos_inimigos','destruir_magias_armadilhas','curar_2000','comprar_2','comprar_3_dano_1000','dano_direto_1000','trocar_vida_por_cartas','metade_vida_compra_3','iguala_vida_menor','devolve_mao_compra','curar_1000_por_monstro','olhar_mao_comprar_1','bloqueia_magias_turno','destruir_monstros_baixo_atk'].includes(efeito)) {
      usarMagia(1, index, null);
    } else if (efeito === 'reviver_monstro') {
      if (jogador.cemiterio.length === 0) { adicionarLog('Cemitério vazio.'); return; }
      estado.acaoPendente = { tipo: 'reviver' }; const maisForte = jogador.cemiterio.reduce((a,b) => b.atk > a.atk ? b : a); usarMagia(1, index, { tipo: 'cemiterio', index: jogador.cemiterio.indexOf(maisForte) });
    } else if (efeito === 'roubar_monstro') {
      if (alvosInimigos.length === 0) { adicionarLog('Sem monstros inimigos.'); return; }
      estado.acaoPendente = { tipo: 'roubar', alvos: alvosInimigos }; destacarMonstrosInimigos();
    } else { usarMagia(1, index, null); }
  } else if (carta.tipo === 'armadilha') {
    const slotVazio = jogador.zonaMagias.findIndex(slot => slot === null);
    if (slotVazio !== -1) baixarArmadilha(1, index, slotVazio); else adicionarLog('Zona de magias cheia.');
  }
}

// ==================== MODAL DE POSIÇÃO ====================
function mostrarModalPosicao() { document.getElementById('modal-position').classList.remove('hidden'); }
function esconderModalPosicao() { document.getElementById('modal-position').classList.add('hidden'); }
document.getElementById('btn-ataque').addEventListener('click', () => {
  if (estado.cartaSelecionada !== null) { estado.acaoPendente = { tipo: 'invocar', posicao: 'ataque' }; esconderModalPosicao(); destacarSlotsMonstroVazios(1); adicionarLog(`Selecione um slot vazio para invocar ${estado.jogadores[1].mao[estado.cartaSelecionada].nome} em ataque.`); }
});
document.getElementById('btn-defesa').addEventListener('click', () => {
  if (estado.cartaSelecionada !== null) { estado.acaoPendente = { tipo: 'invocar', posicao: 'defesa' }; esconderModalPosicao(); destacarSlotsMonstroVazios(1); adicionarLog(`Selecione um slot vazio para invocar ${estado.jogadores[1].mao[estado.cartaSelecionada].nome} em defesa.`); }
});

// ==================== INVOCAR E AÇÕES (PÚBLICAS PARA IA) ====================
function invocarMonstro(jogadorId, maoIndex, slotIndex, posicao) {
  const jogador = estado.jogadores[jogadorId]; const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'monstro') return false; if (slotIndex < 0 || slotIndex > 2 || jogador.zonaMonstros[slotIndex] !== null) return false;
  jogador.mao.splice(maoIndex, 1); const ataquesRestantes = carta.efeito === 'pode_atacar_duas_vezes' ? 2 : 1;
  const monstro = { ...carta, posicao, jaAtacou: false, ataquesRestantes, bonusAtk: 0, bonusDef: 0, temporario: false, invocadoEsteTurno: true, posicaoMudouEsteTurno: false, turnoUsadoParaDuplo: 0, naoPodeAtacarProximoTurno: false, estaPreso: false };
  if (monstro.efeito === 'nao_pode_atacar_no_turno_invocado') monstro.ataquesRestantes = 0;
  jogador.zonaMonstros[slotIndex] = monstro; adicionarLog(`${nomeJogador(jogadorId)} invocou ${carta.nome} na posição ${posicao}.`);
  verificarArmadilhaInvocacao(jogadorId, slotIndex);
  if (MAPA_EFEITOS_INVOCACAO[monstro.efeito]) MAPA_EFEITOS_INVOCACAO[monstro.efeito](jogador, monstro, estado.jogadores[jogadorId === 1 ? 2 : 1]);
  const oponenteId = jogadorId === 1 ? 2 : 1;
  for (let i = 0; i < estado.jogadores[oponenteId].zonaMagias.length; i++) {
      const arm = estado.jogadores[oponenteId].zonaMagias[i];
      if (arm && arm.tipo === 'armadilha' && arm.viradaParaBaixo && arm.efeito === 'armadilha_dano_invocacao_1000') {
          arm.viradaParaBaixo = false; render(); animarCarta(oponenteId, 'magia', i, 'trap');
          adicionarLog(`Armadilha "Maldição do Sangue" ativada! ${nomeJogador(jogadorId)} perdeu 1000 PV.`);
          jogador.hp -= 1000; estado.jogadores[oponenteId].zonaMagias[i] = null; if (verificarFimDeDuelo()) return false;
      }
  }
  if (jogadorId === 1) { estado.cartaSelecionada = null; estado.acaoPendente = null; limparDestaques(); esconderModalPosicao(); }
  render(); animarCarta(jogadorId, 'monstro', slotIndex); return true;
}

function baixarArmadilha(jogadorId, maoIndex, slotIndex) {
  const jogador = estado.jogadores[jogadorId]; const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'armadilha') return false; if (slotIndex < 0 || slotIndex > 2 || jogador.zonaMagias[slotIndex] !== null) return false;
  jogador.mao.splice(maoIndex, 1); jogador.zonaMagias[slotIndex] = { ...carta, viradaParaBaixo: true };
  adicionarLog(`${nomeJogador(jogadorId)} baixou uma armadilha.`);
  if (jogadorId === 1) { estado.cartaSelecionada = null; estado.acaoPendente = null; limparDestaques(); }
  render(); animarCarta(jogadorId, 'magia', slotIndex); return true;
}

function usarMagia(jogadorId, maoIndex, alvo) {
  const jogador = estado.jogadores[jogadorId]; const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'magia') return false;
  const oponenteId = jogadorId === 1 ? 2 : 1; const oponente = estado.jogadores[oponenteId];
  // Verificar armadilha nega magia
  for (let i = 0; i < oponente.zonaMagias.length; i++) {
    const arm = oponente.zonaMagias[i];
    if (arm && arm.tipo === 'armadilha' && arm.viradaParaBaixo && arm.efeito === 'armadilha_negar_magia') {
      arm.viradaParaBaixo = false; render(); animarCarta(oponenteId, 'magia', i, 'trap');
      adicionarLog(`Armadilha "Silêncio Arcano" ativada! Magia ${carta.nome} foi negada.`);
      oponente.zonaMagias[i] = null; jogador.mao.splice(maoIndex, 1); render(); return true;
    }
  }
  if (estado.magiasBloqueadas) { adicionarLog('Zona de Antimagia bloqueia magias neste turno.'); return false; }
  if (jogadorId === 1) { const handCard = document.querySelector(`.hand-card[data-index="${maoIndex}"]`); if (handCard) { handCard.classList.add('magic-activating'); setTimeout(() => handCard.remove(), 800); } } 
  else { adicionarLog(`${nomeJogador(jogadorId)} ativou ${carta.nome}.`); }
  jogador.mao.splice(maoIndex, 1);
  if (MAPA_EFEITOS_MAGIA[carta.efeito]) MAPA_EFEITOS_MAGIA[carta.efeito](jogador, alvo, carta, oponente);
  if (jogadorId === 1) { estado.cartaSelecionada = null; estado.acaoPendente = null; limparDestaques(); }
  render(); return true;
}

function destruirMonstro(jogadorId, slotIndex, motivo) {
  const jogador = estado.jogadores[jogadorId]; const monstro = jogador.zonaMonstros[slotIndex];
  if (!monstro) return;
  if (MAPA_EFEITOS_MORTE[monstro.efeito]) MAPA_EFEITOS_MORTE[monstro.efeito](jogador);
  jogador.cemiterio.push(monstro); jogador.zonaMonstros[slotIndex] = null; adicionarLog(`${monstro.nome} foi destruído (${motivo}).`);
  if (motivo.includes('batalha')) {
      const oponenteId = jogadorId === 1 ? 2 : 1;
      for (let i = 0; i < estado.jogadores[oponenteId].zonaMagias.length; i++) {
          const arm = estado.jogadores[oponenteId].zonaMagias[i];
          if (arm && arm.tipo === 'armadilha' && arm.viradaParaBaixo && arm.efeito === 'armadilha_destroi_quem_destruiu') {
              arm.viradaParaBaixo = false; render(); animarCarta(oponenteId, 'magia', i, 'trap');
              adicionarLog(`Armadilha "Vingança Póstuma" ativada!`);
              const atacantes = estado.jogadores[oponenteId].zonaMonstros.map((m, idx) => m && m.posicao === 'ataque' ? idx : -1).filter(idx => idx !== -1);
              if (atacantes.length > 0) {
                  const atacante = estado.jogadores[oponenteId].zonaMonstros[atacantes[0]];
                  if (atacante) { adicionarLog(`Vingança Póstuma destruiu ${atacante.nome}.`); estado.jogadores[oponenteId].zonaMonstros[atacantes[0]] = null; estado.jogadores[oponenteId].cemiterio.push(atacante); }
              }
              estado.jogadores[jogadorId === 1 ? 2 : 1].zonaMagias[i] = null; render(); break;
          }
      }
  }
  render();
}

function verificarArmadilhaInvocacao(jogadorInvoker, slotIndex) {
  const invocador = estado.jogadores[jogadorInvoker]; const oponenteId = jogadorInvoker === 1 ? 2 : 1; const oponente = estado.jogadores[oponenteId]; const monstro = invocador.zonaMonstros[slotIndex];
  if (!monstro) return;
  for (let i = 0; i < oponente.zonaMagias.length; i++) {
    const arm = oponente.zonaMagias[i];
    if (arm && arm.tipo === 'armadilha' && arm.viradaParaBaixo) {
      if (arm.efeito === 'armadilha_ira' && monstro.atk > 2000) {
        arm.viradaParaBaixo = false; render(); animarCarta(oponenteId, 'magia', i, 'trap');
        adicionarLog(`Armadilha "Ira do Submundo" ativada!`); setTimeout(() => { destruirMonstro(jogadorInvoker, slotIndex, 'Ira do Submundo'); oponente.zonaMagias[i] = null; }, 800); break;
      } else if (arm.efeito === 'armadilha_negar_invocacao') {
        if (monstro.efeito !== 'imune_a_armadilhas' && monstro.efeito !== 'nao_pode_ser_destruido_por_efeito') {
          arm.viradaParaBaixo = false; render(); animarCarta(oponenteId, 'magia', i, 'trap');
          adicionarLog(`Armadilha "Julgamento Divino" ativada!`); setTimeout(() => { invocador.zonaMonstros[slotIndex] = null; invocador.cemiterio.push(monstro); oponente.zonaMagias[i] = null; adicionarLog(`${monstro.nome} foi destruído.`); render(); }, 800); break;
        }
      } else if (arm.efeito === 'armadilha_destruir_todos' && monstro.efeito !== 'imune_a_armadilhas') {
          arm.viradaParaBaixo = false; render(); animarCarta(oponenteId, 'magia', i, 'trap');
          adicionarLog(`Armadilha "Buraco Negro" ativada! Todos os monstros são destruídos!`);
          setTimeout(() => {
              for (let j=0; j<3; j++) { if (invocador.zonaMonstros[j]) destruirMonstro(jogadorInvoker, j, 'Buraco Negro'); }
              for (let j=0; j<3; j++) { if (oponente.zonaMonstros[j]) destruirMonstro(oponenteId, j, 'Buraco Negro'); }
              oponente.zonaMagias[i] = null; render();
          }, 800); break;
      }
    }
  }
}

function verificarFimDeDuelo() {
  if (estado.fase === 'fim') return true;
  if (estado.jogadores[1].hp <= 0) { 
      for(let i = 0; i < estado.jogadores[2].zonaMagias.length; i++) {
          const arm = estado.jogadores[2].zonaMagias[i];
          if (arm && arm.tipo === 'armadilha' && arm.viradaParaBaixo && arm.efeito === 'armadilha_sobrevive_com_1_pv') {
              arm.viradaParaBaixo = false; render(); animarCarta(2, 'magia', i, 'trap');
              adicionarLog(`Armadilha "Pacto de Sobrevivência" ativada! Você sobrevive com 1 PV.`);
              estado.jogadores[1].hp = 1; estado.jogadores[2].zonaMagias[i] = null; return false;
          }
      }
      finalizarDuelo(2, 'HP zerado'); return true; 
  }
  if (estado.jogadores[2].hp <= 0) { finalizarDuelo(1, 'HP zerado'); return true; }
  return false;
}

function alternarPosicaoMonstro(jogadorId, slotIndex) {
  const jogador = estado.jogadores[jogadorId]; const monstro = jogador.zonaMonstros[slotIndex];
  if (!monstro) return;
  if (monstro.efeito === 'nao_pode_mudar_para_ataque' && monstro.posicao === 'defesa') { adicionarLog(`${monstro.nome} não pode mudar para ataque.`); return; }
  if (monstro.invocadoEsteTurno) { adicionarLog('Não pode mudar no turno invocado.'); return; }
  if (monstro.posicaoMudouEsteTurno) { adicionarLog('Já mudou de posição.'); return; }
  if (monstro.estaPreso) { adicionarLog(`${monstro.nome} está preso.`); return; }
  monstro.posicao = monstro.posicao === 'ataque' ? 'defesa' : 'ataque'; monstro.posicaoMudouEsteTurno = true; adicionarLog(`${monstro.nome} mudou para ${monstro.posicao}.`); render();
}

// ==================== BATALHA DO JOGADOR ====================
function iniciarBatalha() { if (estado.fase !== 'main' || estado.jogadorAtual !== 1 || estado.hasAttacked || estado.processandoAnimacao) return; if (estado.primeiroTurno && estado.jogadorAtual === 1) { adicionarLog('Você não pode atacar no primeiro turno.'); return; } const temAtacantes = estado.jogadores[1].zonaMonstros.some(m => m && m.posicao === 'ataque' && (m.ataquesRestantes > 0 || m.efeito !== 'nao_pode_atacar') && !m.estaPreso && !m.naoPodeAtacarProximoTurno); if (!temAtacantes) { adicionarLog('Nenhum monstro em posição de ataque.'); return; } estado.fase = 'batalha'; estado.atacanteSelecionado = null; estado.acaoPendente = null; limparDestaques(); destacarAtacantesDisponiveis(1); adicionarLog('Selecione um monstro atacante.'); renderBotoes(); }
function destacarAtacantesDisponiveis(jogadorId) { const slots = document.querySelectorAll(`#monstro-slots-p${jogadorId} .slot`); slots.forEach(slot => { const index = parseInt(slot.dataset.slot); const monstro = estado.jogadores[jogadorId].zonaMonstros[index]; if (monstro && monstro.posicao === 'ataque' && monstro.ataquesRestantes > 0 && monstro.efeito !== 'nao_pode_atacar' && !monstro.estaPreso && !monstro.naoPodeAtacarProximoTurno) slot.classList.add('highlight'); }); }
function selecionarAtacante(slotIndex) { if (estado.fase !== 'batalha' || estado.jogadorAtual !== 1 || estado.processandoAnimacao) return; const monstro = estado.jogadores[1].zonaMonstros[slotIndex]; if (!monstro || monstro.posicao !== 'ataque' || monstro.ataquesRestantes === 0 || monstro.efeito === 'nao_pode_atacar' || monstro.estaPreso || monstro.naoPodeAtacarProximoTurno) return; estado.atacanteSelecionado = slotIndex; limparDestaques(); let ataqueDiretoPermitido = false; if (monstro.efeito === 'se_oponente_tem_armadilha_ataque_direto') { const temArmadilha = estado.jogadores[2].zonaMagias.some(a => a !== null && a.viradaParaBaixo); if (temArmadilha) ataqueDiretoPermitido = true; } const temMonstrosInimigos = estado.jogadores[2].zonaMonstros.some(m => m !== null); if (!temMonstrosInimigos || ataqueDiretoPermitido) document.getElementById('hp-p2').classList.add('highlight-target'); if (!temMonstrosInimigos && !ataqueDiretoPermitido) { adicionarLog(`${monstro.nome} selecionado. Ataque direto!`); } else { destacarAlvosInimigos(); adicionarLog(`Monstro selecionado: ${monstro.nome}. Escolha um alvo.`); } }
function destacarAlvosInimigos() { const slots = document.querySelectorAll(`#monstro-slots-p2 .slot`); slots.forEach(slot => { const index = parseInt(slot.dataset.slot); if (estado.jogadores[2].zonaMonstros[index] !== null) slot.classList.add('highlight'); }); }

async function executarAtaque(atacanteSlot, alvoTipo, alvoSlot) {
  if (estado.fase !== 'batalha' || estado.jogadorAtual !== 1 || estado.processandoAnimacao) return;
  const atacante = estado.jogadores[1].zonaMonstros[atacanteSlot];
  if (!atacante || atacante.ataquesRestantes === 0 || atacante.estaPreso || atacante.naoPodeAtacarProximoTurno) return;
  if (atacante.efeito === 'paga_500_vida_para_atacar' && estado.jogadores[1].hp <= 500) { adicionarLog('Vida insuficiente.'); return; }
  if (atacante.efeito === 'paga_500_vida_para_atacar') estado.jogadores[1].hp -= 500;
  const defensorId = 2; const defensor = estado.jogadores[defensorId]; const temMonstrosInimigos = defensor.zonaMonstros.some(m => m !== null);
  let ataqueDiretoPermitido = false; if (atacante.efeito === 'se_oponente_tem_armadilha_ataque_direto') { const temArmadilha = defensor.zonaMagias.some(a => a !== null && a.viradaParaBaixo); if (temArmadilha) ataqueDiretoPermitido = true; }
  if (alvoTipo === 'jogador' && temMonstrosInimigos && !ataqueDiretoPermitido) { adicionarLog('Não pode atacar diretamente.'); return; }
  
  // Verificar armadilhas antes do ataque
  for (let i = 0; i < defensor.zonaMagias.length; i++) { 
      const armadilha = defensor.zonaMagias[i];
      if (armadilha && armadilha.tipo === 'armadilha' && armadilha.viradaParaBaixo) {
        if (armadilha.efeito === 'armadilha_escudo' && atacante.efeito !== 'imune_a_armadilhas') {
            armadilha.viradaParaBaixo = false; render(); animarCarta(defensorId, 'magia', i, 'trap'); adicionarLog(`Armadilha "Escudo de Atenas" ativada!`); await delay(800); atacante.posicao = 'defesa'; atacante.ataquesRestantes--; defensor.zonaMagias[i] = null; estado.atacanteSelecionado = null; limparDestaques(); render(); verificarFimBatalha(); return;
        } else if (armadilha.efeito === 'armadilha_destruir_atacantes' && atacante.efeito !== 'imune_a_armadilhas') {
            armadilha.viradaParaBaixo = false; render(); animarCarta(defensorId, 'magia', i, 'trap'); adicionarLog(`Armadilha "Força Espelhada" ativada!`); await delay(800); for (let j = 0; j < estado.jogadores[1].zonaMonstros.length; j++) { const m = estado.jogadores[1].zonaMonstros[j]; if (m && m.posicao === 'ataque' && m.efeito !== 'imune_a_armadilhas' && m.efeito !== 'nao_pode_ser_destruido_por_efeito') { destruirMonstro(1, j, 'Força Espelhada'); } } defensor.zonaMagias[i] = null; estado.atacanteSelecionado = null; limparDestaques(); render(); verificarFimBatalha(); return;
        } else if (armadilha.efeito === 'armadilha_refletir_dano' && atacante.efeito !== 'imune_a_armadilhas') {
            armadilha.viradaParaBaixo = false; render(); animarCarta(defensorId, 'magia', i, 'trap'); adicionarLog(`Armadilha "Cilindro Mágico" ativada!`); await delay(800); estado.jogadores[1].hp -= atacante.atk; adicionarLog(`${atacante.nome} teve seu ataque refletido! ${nomeJogador(1)} perdeu ${atacante.atk} HP.`); atacante.ataquesRestantes--; defensor.zonaMagias[i] = null; if (verificarFimDeDuelo()) return; estado.atacanteSelecionado = null; limparDestaques(); render(); verificarFimBatalha(); return;
        } else if (armadilha.efeito === 'armadilha_zerar_ataque' && atacante.efeito !== 'imune_a_armadilhas') {
            armadilha.viradaParaBaixo = false; render(); animarCarta(defensorId, 'magia', i, 'trap'); adicionarLog(`Armadilha "Areia Movediça" ativada!`); await delay(800); atacante.bonusAtk = -atacante.atk; atacante.ataquesRestantes--; defensor.zonaMagias[i] = null; estado.atacanteSelecionado = null; limparDestaques(); render(); verificarFimBatalha(); return;
        } else if (armadilha.efeito === 'armadilha_destroir_maior_atk' && atacante.efeito !== 'imune_a_armadilhas') {
            armadilha.viradaParaBaixo = false; render(); animarCarta(defensorId, 'magia', i, 'trap'); adicionarLog(`Armadilha "Reflexo Sombrio" ativada!`); await delay(800); let maiorAtk = -1; let idxAtk = -1; for (let j = 0; j < estado.jogadores[1].zonaMonstros.length; j++) { const m = estado.jogadores[1].zonaMonstros[j]; if (m && m.atk > maiorAtk) { maiorAtk = m.atk; idxAtk = j; } } if (idxAtk !== -1) destruirMonstro(1, idxAtk, 'Reflexo Sombrio'); defensor.zonaMagias[i] = null; estado.atacanteSelecionado = null; limparDestaques(); render(); verificarFimBatalha(); return;
        } else if (armadilha.efeito === 'armadilha_curar_pelo_ataque' && atacante.efeito !== 'imune_a_armadilhas') {
            armadilha.viradaParaBaixo = false; render(); animarCarta(defensorId, 'magia', i, 'trap'); adicionarLog(`Armadilha "Rede de Captura" ativada!`); await delay(800); defensor.hp += atacante.atk; atacante.ataquesRestantes--; defensor.zonaMagias[i] = null; estado.atacanteSelecionado = null; limparDestaques(); render(); verificarFimBatalha(); return;
        } else if (armadilha.efeito === 'armadilha_pular_fase_batalha' && atacante.efeito !== 'imune_a_armadilhas') {
            armadilha.viradaParaBaixo = false; render(); animarCarta(defensorId, 'magia', i, 'trap'); adicionarLog(`Armadilha "Barreira de Gelo" ativada!`); await delay(800); defensor.zonaMagias[i] = null; estado.atacanteSelecionado = null; encerrarBatalha(); return;
        } else if (armadilha.efeito === 'armadilha_invoca_copia' && atacante.efeito !== 'imune_a_armadilhas') {
            armadilha.viradaParaBaixo = false; render(); animarCarta(defensorId, 'magia', i, 'trap'); adicionarLog(`Armadilha "Espelhos Gêmeos" ativada!`); await delay(800); const slotVazioD = defensor.zonaMonstros.findIndex(s => s === null); if (slotVazioD !== -1) { defensor.zonaMonstros[slotVazioD] = { ...atacante, temporario: false, invocadoEsteTurno: true, nome: `Token ${atacante.nome}` }; render(); } defensor.zonaMagias[i] = null; estado.atacanteSelecionado = null; limparDestaques(); render(); return;
        }
      }
  }

  estado.processandoAnimacao = true;
  const monstroDefensor = alvoTipo === 'monstro' ? defensor.zonaMonstros[alvoSlot] : null;
  await animarAtaque(atacanteSlot, alvoTipo === 'monstro' ? alvoSlot : null, 1, 2);
  if (alvoTipo === 'jogador') { defensor.hp -= atacante.atk + (atacante.bonusAtk || 0); adicionarLog(`${atacante.nome} atacou diretamente! Computador perdeu ${atacante.atk + (atacante.bonusAtk || 0)} HP.`); atacante.ataquesRestantes--; if (atacante.efeito === 'ao_causar_dano_oponente_descarta_1_carta' && defensor.mao.length > 0) { const descartada = defensor.mao.pop(); adicionarLog(`${atacante.nome} descartou ${descartada.nome}.`); } if (verificarFimDeDuelo()) return; }
  else { if (monstroDefensor) { resolverBatalha(1, 2, atacanteSlot, alvoSlot); atacante.ataquesRestantes--; if (monstroDefensor && !estado.jogadores[2].zonaMonstros.includes(monstroDefensor) && atacante.efeito === 'ao_destruir_inimigo_oponente_pula_compra') { estado.jogadores[2].devePularCompra = true; adicionarLog(`${atacante.nome} fez o oponente pular a compra!`); } } }
  estado.processandoAnimacao = false; estado.atacanteSelecionado = null; limparDestaques(); render(); verificarFimBatalha();
}

function verificarFimBatalha() { const aindaPodeAtacar = estado.jogadores[1].zonaMonstros.some(m => m && m.posicao === 'ataque' && m.ataquesRestantes > 0 && m.efeito !== 'nao_pode_atacar' && !m.estaPreso && !m.naoPodeAtacarProximoTurno); if (aindaPodeAtacar) { destacarAtacantesDisponiveis(1); adicionarLog('Selecione outro monstro atacante ou encerre o turno.'); } else { adicionarLog('Todos os monstros atacaram. Encerre o turno.'); renderBotoes(); } }

function resolverBatalha(jogadorAtacanteId, jogadorDefensorId, slotAtacante, slotDefensor) {
  const atacante = estado.jogadores[jogadorAtacanteId].zonaMonstros[slotAtacante]; const defensor = estado.jogadores[jogadorDefensorId].zonaMonstros[slotDefensor];
  if (!atacante || !defensor) return;
  let atkTotal = atacante.atk + (atacante.bonusAtk || 0); const defTotal = defensor.posicao === 'ataque' ? defensor.atk + (defensor.bonusAtk || 0) : defensor.def + (defensor.bonusDef || 0);
  if (atacante.efeito === 'copia_atk_do_alvo') atkTotal = defTotal;
  if (atacante.efeito === 'batalha_iguala_atk_def_do_inimigo') atkTotal = defTotal;

  if (defensor.posicao === 'ataque') {
    const dif = atkTotal - defTotal;
    if (dif > 0) { destruirMonstro(jogadorDefensorId, slotDefensor, 'batalha'); estado.jogadores[jogadorDefensorId].hp -= dif; adicionarLog(`${defensor.nome} destruído! Computador perdeu ${dif} HP.`); if (atacante.efeito === 'ganha_500_atk_ao_destruir_inimigo') { atacante.bonusAtk = (atacante.bonusAtk || 0) + 500; adicionarLog(`${atacante.nome} ganhou +500 de ATK.`); } if (atacante.efeito === 'cura_vida_igual_dano_causado') { estado.jogadores[jogadorAtacanteId].hp += dif; adicionarLog(`${atacante.nome} curou ${dif} de vida.`); } if (atacante.efeito === 'ao_causar_dano_oponente_descarta_1_carta' && estado.jogadores[jogadorDefensorId].mao.length > 0) { const descartada = estado.jogadores[jogadorDefensorId].mao.pop(); adicionarLog(`${atacante.nome} descartou ${descartada.nome}.`); } verificarFimDeDuelo(); } 
    else if (dif === 0) { destruirMonstro(jogadorAtacanteId, slotAtacante, 'batalha'); destruirMonstro(jogadorDefensorId, slotDefensor, 'batalha'); adicionarLog(`Empate! Ambos destruídos.`); verificarFimDeDuelo(); } 
    else { destruirMonstro(jogadorAtacanteId, slotAtacante, 'batalha'); estado.jogadores[jogadorAtacanteId].hp -= (-dif); adicionarLog(`${atacante.nome} destruído! ${nomeJogador(jogadorAtacanteId)} perdeu ${-dif} HP.`); verificarFimDeDuelo(); }
  } else {
    if (atacante.efeito === 'ao_atacar_destroi_monstro_em_defesa') { destruirMonstro(jogadorDefensorId, slotDefensor, 'efeito do Samurai Escarlate'); adicionarLog(`${defensor.nome} foi destruído por ${atacante.nome}!`); verificarFimDeDuelo(); return; }
    const dif = atkTotal - defTotal;
    if (dif > 0) { destruirMonstro(jogadorDefensorId, slotDefensor, 'batalha'); adicionarLog(`${defensor.nome} destruído em defesa.`); if (atacante.efeito === 'dano_perfurante' || atacante.efeito === 'ignora_defesa_ataque_direto') { estado.jogadores[jogadorDefensorId].hp -= dif; adicionarLog(`Dano perfurante! Computador perdeu ${dif} HP.`); if (atacante.efeito === 'ao_causar_dano_oponente_descarta_1_carta' && estado.jogadores[jogadorDefensorId].mao.length > 0) { const descartada = estado.jogadores[jogadorDefensorId].mao.pop(); adicionarLog(`${atacante.nome} descartou ${descartada.nome}.`); } } verificarFimDeDuelo(); } 
    else if (dif < 0) { estado.jogadores[jogadorAtacanteId].hp -= (-dif); adicionarLog(`${atacante.nome} não destruiu ${defensor.nome}. ${nomeJogador(jogadorAtacanteId)} perdeu ${-dif} HP.`); verificarFimDeDuelo(); }
  }
  if (atacante.efeito === 'inimigo_atacado_nao_pode_atacar_proximo_turno' && estado.jogadores[jogadorDefensorId].zonaMonstros[slotDefensor]) { estado.jogadores[jogadorDefensorId].zonaMonstros[slotDefensor].naoPodeAtacarProximoTurno = true; }
}

function encerrarBatalha() { if (estado.fase !== 'batalha' || estado.jogadorAtual !== 1) return; estado.fase = 'main'; estado.hasAttacked = true; estado.atacanteSelecionado = null; limparDestaques(); renderBotoes(); adicionarLog('Fase de batalha encerrada.'); }
function animarAtaque(atacanteSlot, defensorSlot, jogadorAtacanteId, jogadorDefensorId) { return new Promise(resolve => { const atacanteElement = document.querySelector(`#monstro-slots-p${jogadorAtacanteId} .slot[data-slot="${atacanteSlot}"] .card`); const defensorElement = defensorSlot !== null ? document.querySelector(`#monstro-slots-p${jogadorDefensorId} .slot[data-slot="${defensorSlot}"] .card`) : null; if (atacanteElement) atacanteElement.classList.add('attacking'); if (defensorElement) defensorElement.classList.add('defending'); setTimeout(() => { if (atacanteElement) atacanteElement.classList.remove('attacking'); if (defensorElement) defensorElement.classList.remove('defending'); resolve(); }, 600); }); }

// ==================== FINALIZAÇÃO E VITÓRIAS ====================
function exibirVitoriaRodada(vencedorId) { const modal = document.getElementById('modal-round-winner'); const text = document.getElementById('round-winner-text'); text.textContent = `${nomeJogador(vencedorId)} venceu a rodada!`; modal.classList.remove('hidden'); setTimeout(() => { modal.classList.add('hidden'); estado.campeonato.rodadaAtual++; adicionarLog('--- Iniciando próximo duelo ---'); iniciarNovoDuelo(); }, 1500); }
function exibirVitoriaCampeonato(vencedorId) { const modal = document.getElementById('modal-endgame'); const text = document.getElementById('endgame-winner-text'); text.textContent = `🏆 ${nomeJogador(vencedorId)} é o grande campeão! 🏆`; modal.classList.remove('hidden'); }
function finalizarDuelo(vencedorId, motivo) { if (estado.fase === 'fim') return; estado.fase = 'fim'; adicionarLog(`🏆 ${nomeJogador(vencedorId)} venceu o duelo! Motivo: ${motivo}`); if (vencedorId === 1) estado.campeonato.vitoriasJ1++; else estado.campeonato.vitoriasJ2++; estado.campeonato.historico.push({ rodada: estado.campeonato.rodadaAtual, vencedor: vencedorId, motivo }); renderPlacar(); const vitoriasNecessarias = Math.ceil(estado.campeonato.melhorDe / 2); if (estado.campeonato.vitoriasJ1 >= vitoriasNecessarias || estado.campeonato.vitoriasJ2 >= vitoriasNecessarias) { adicionarLog(`🏆 Campeonato encerrado! Vencedor: ${nomeJogador(estado.campeonato.vitoriasJ1 >= vitoriasNecessarias ? 1 : 2)}`); render(); exibirVitoriaCampeonato(estado.campeonato.vitoriasJ1 >= vitoriasNecessarias ? 1 : 2); return; } exibirVitoriaRodada(vencedorId); }

// ==================== RENDERIZAÇÃO ====================
function render() { renderInfoJogadores(); renderZonas(); renderMao(); renderBotoes(); }
function calcularBonusAura(jogadorId) { let bonusAtk = 0; const jogador = estado.jogadores[jogadorId]; if (jogador.zonaMonstros.some(m => m && m.efeito === 'monstros_aliados_ganham_300_atk')) bonusAtk = 300; return bonusAtk; }
function renderInfoJogadores() { const p1 = estado.jogadores[1]; const p2 = estado.jogadores[2]; document.getElementById('hp-p1').textContent = p1.hp; document.getElementById('hp-p2').textContent = p2.hp; document.getElementById('deck-p1').textContent = p1.deck.length; document.getElementById('deck-p2').textContent = p2.deck.length; renderPlacar(); }
function renderPlacar() { document.getElementById('score-p1').textContent = estado.campeonato.vitoriasJ1; document.getElementById('score-p2').textContent = estado.campeonato.vitoriasJ2; document.getElementById('series-info').textContent = `Melhor de ${estado.campeonato.melhorDe}: ${nomeJogadorParam} ${estado.campeonato.vitoriasJ1} x ${estado.campeonato.vitoriasJ2} Computador`; document.getElementById('score-player-name').textContent = nomeJogadorParam; document.getElementById('player-nick-display').textContent = nomeJogadorParam; }
function renderZonas() {
  for (let i = 1; i <= 2; i++) {
    const zonaMonstros = document.getElementById(`monstro-slots-p${i}`); const zonaMagias = document.getElementById(`magia-slots-p${i}`); zonaMonstros.innerHTML = ''; zonaMagias.innerHTML = ''; const auraBonus = calcularBonusAura(i);
    for (let j = 0; j < 3; j++) { const slot = document.createElement('div'); slot.className = 'slot'; slot.dataset.jogador = i; slot.dataset.zona = 'monstro'; slot.dataset.slot = j; const monstro = estado.jogadores[i].zonaMonstros[j]; if (monstro) { const cardDiv = document.createElement('div'); cardDiv.className = 'card'; if (monstro.posicao === 'defesa') cardDiv.classList.add('defense'); const atkTotal = monstro.atk + (monstro.bonusAtk || 0) + auraBonus; const defTotal = monstro.def + (monstro.bonusDef || 0); cardDiv.innerHTML = `<div class="card-name">${monstro.nome}</div><div class="card-stats"><span>ATK ${atkTotal}</span><span>DEF ${defTotal}</span></div><div class="card-position">${monstro.posicao === 'ataque' ? 'ATQ' : 'DEF'}</div>`; cardDiv.addEventListener('mouseenter', () => showPreview(monstro, i)); slot.appendChild(cardDiv); } slot.addEventListener('click', () => handleSlotClick(i, 'monstro', j)); zonaMonstros.appendChild(slot); }
    for (let j = 0; j < 3; j++) { const slot = document.createElement('div'); slot.className = 'slot'; slot.dataset.jogador = i; slot.dataset.zona = 'magia'; slot.dataset.slot = j; const carta = estado.jogadores[i].zonaMagias[j]; if (carta) { const cardDiv = document.createElement('div'); cardDiv.className = 'card'; if (carta.viradaParaBaixo && i === 2) { cardDiv.classList.add('facedown'); cardDiv.textContent = '?'; } else { if (carta.viradaParaBaixo && i === 1) cardDiv.classList.add('facedown-own'); cardDiv.innerHTML = `<div class="card-name">${carta.nome}</div><div>${carta.tipo}</div>`; } cardDiv.addEventListener('mouseenter', () => showPreview(carta, i)); slot.appendChild(cardDiv); } slot.addEventListener('click', () => handleSlotClick(i, 'magia', j)); zonaMagias.appendChild(slot); }
  }
}
function renderMao() { const handDiv = document.getElementById('hand'); handDiv.innerHTML = ''; if (estado.jogadorAtual === 1) { estado.jogadores[1].mao.forEach((carta, index) => { const cardDiv = document.createElement('div'); cardDiv.className = 'hand-card'; cardDiv.dataset.index = index; if (estado.cartaSelecionada === index) cardDiv.classList.add('selected'); let info = `<div class="card-name">${carta.nome}</div>`; if (carta.tipo === 'monstro') info += `<div class="card-stats"><span>ATK ${carta.atk}</span><span>DEF ${carta.def}</span></div>`; else if (carta.tipo === 'magia') info += `<div>${carta.descricao || 'Magia'}</div>`; else info += `<div>${carta.descricao || 'Armadilha'}</div>`; cardDiv.innerHTML = info; cardDiv.addEventListener('mouseenter', () => showPreview(carta, 1)); cardDiv.addEventListener('click', () => selecionarCartaDaMao(index)); handDiv.appendChild(cardDiv); }); } else { for (let i = 0; i < estado.jogadores[2].mao.length; i++) { const cardDiv = document.createElement('div'); cardDiv.className = 'hand-card'; cardDiv.style.backgroundColor = '#2c3e50'; cardDiv.style.color = 'white'; cardDiv.textContent = '?'; handDiv.appendChild(cardDiv); } } }
function renderBotoes() { const btnAtacar = document.getElementById('btn-atacar'); const btnEncerrar = document.getElementById('btn-encerrar'); if (estado.fase === 'main' && estado.jogadorAtual === 1 && !estado.processandoAnimacao) { btnAtacar.disabled = !(estado.turno !== 1 && !estado.hasAttacked && !estado.primeiroTurno); btnEncerrar.disabled = false; } else if (estado.fase === 'batalha' && estado.jogadorAtual === 1 && !estado.processandoAnimacao) { btnAtacar.disabled = true; btnEncerrar.disabled = false; } else { btnAtacar.disabled = true; btnEncerrar.disabled = true; } }
function renderLog() { const logDiv = document.getElementById('log'); logDiv.innerHTML = estado.log.slice(-15).map(msg => `<div>${msg}</div>`).join(''); logDiv.scrollTop = logDiv.scrollHeight; }
function showPreview(carta, jogadorId) {
  const preview = document.getElementById('card-preview'); const effectDisplay = document.getElementById('card-effect-display'); preview.innerHTML = ''; preview.classList.remove('hidden');
  if (carta.viradaParaBaixo && jogadorId === 2) { const nome = document.createElement('div'); nome.className = 'card-name'; nome.textContent = 'Carta virada'; preview.appendChild(nome); effectDisplay.classList.add('hidden'); return; }
  const nome = document.createElement('div'); nome.className = 'card-name'; nome.textContent = carta.nome; preview.appendChild(nome); const tipo = document.createElement('div'); tipo.className = 'card-type'; tipo.textContent = carta.tipo.charAt(0).toUpperCase() + carta.tipo.slice(1); preview.appendChild(tipo);
  if (carta.tipo === 'monstro') { const stats = document.createElement('div'); stats.className = 'card-stats'; stats.innerHTML = `<span>ATK ${carta.atk + (carta.bonusAtk || 0)}</span><span>DEF ${carta.def + (carta.bonusDef || 0)}</span>`; preview.appendChild(stats); }
  let efeitoTexto = ''; if (carta.descricao) { efeitoTexto = carta.descricao; } else if (carta.efeito) { efeitoTexto = `Efeito: ${carta.efeito}`; }
  if (efeitoTexto) { effectDisplay.textContent = efeitoTexto; effectDisplay.classList.remove('hidden'); } else { effectDisplay.classList.add('hidden'); }
}
function hidePreview() {}
function limparDestaques() { document.querySelectorAll('.slot.highlight').forEach(el => el.classList.remove('highlight')); document.getElementById('hp-p2')?.classList.remove('highlight-target'); document.getElementById('hp-p1')?.classList.remove('highlight-target'); }
function destacarSlotsMonstroVazios(jogadorId) { limparDestaques(); const slots = document.querySelectorAll(`#monstro-slots-p${jogadorId} .slot`); slots.forEach(slot => { const index = parseInt(slot.dataset.slot); if (estado.jogadores[jogadorId].zonaMonstros[index] === null) slot.classList.add('highlight'); }); }
function destacarMonstrosProprios() { limparDestaques(); const slots = document.querySelectorAll(`#monstro-slots-p1 .slot`); slots.forEach(slot => { const index = parseInt(slot.dataset.slot); if (estado.jogadores[1].zonaMonstros[index] !== null) slot.classList.add('highlight'); }); }
function destacarMonstrosInimigos() { limparDestaques(); const slots = document.querySelectorAll(`#monstro-slots-p2 .slot`); slots.forEach(slot => { const index = parseInt(slot.dataset.slot); if (estado.jogadores[2].zonaMonstros[index] !== null) slot.classList.add('highlight'); }); }
function animarCarta(jogadorId, zona, slotIndex, tipo = 'bright') { const selector = `#${zona}-slots-p${jogadorId} .slot[data-slot="${slotIndex}"] .card`; const cardElement = document.querySelector(selector); if (cardElement) { let classe; switch (tipo) { case 'bright': classe = 'bright'; break; case 'trap': classe = 'trap-activating'; break; case 'magic': classe = 'magic-activating'; break; default: classe = 'bright'; } cardElement.classList.add(classe); setTimeout(() => cardElement.classList.remove(classe), 800); } }

function handleSlotClick(jogadorId, zona, slotIndex) {
  if (estado.fase === 'batalha' && estado.jogadorAtual === 1 && !estado.processandoAnimacao) {
    if (jogadorId === 1 && zona === 'monstro') {
      if (estado.atacanteSelecionado === null) selecionarAtacante(slotIndex); else if (estado.atacanteSelecionado === slotIndex) { estado.atacanteSelecionado = null; limparDestaques(); destacarAtacantesDisponiveis(1); adicionarLog('Selecione outro monstro atacante.'); } else selecionarAtacante(slotIndex);
    } else if (jogadorId === 2 && zona === 'monstro') { if (estado.atacanteSelecionado !== null) executarAtaque(estado.atacanteSelecionado, 'monstro', slotIndex); }
    return;
  }
  if (estado.jogadorAtual !== 1 || estado.fase !== 'main' || estado.processandoAnimacao) return;
  const jogador = estado.jogadores[1]; const acao = estado.acaoPendente;
  if (!acao && jogadorId === 1 && zona === 'monstro') { alternarPosicaoMonstro(1, slotIndex); return; }
  if (acao.tipo === 'invocar') { if (jogadorId === 1 && zona === 'monstro' && jogador.zonaMonstros[slotIndex] === null) { invocarMonstro(1, estado.cartaSelecionada, slotIndex, acao.posicao); } } 
  else if (acao.tipo === 'magia_buff' || acao.tipo === 'magia_inimigo' || acao.tipo === 'roubar') { 
      const slot = (jogadorId === 1 && zona === 'monstro') ? slotIndex : -1;
      if (slot !== -1) {
          if (acao.tipo === 'magia_inimigo' && jogadorId === 2) usarMagia(1, estado.cartaSelecionada, { tipo: 'inimigo', slot: slotIndex });
          else if (acao.tipo === 'magia_buff' && jogadorId === 1) usarMagia(1, estado.cartaSelecionada, { tipo: 'proprio', slot: slotIndex });
          else if (acao.tipo === 'roubar' && jogadorId === 2) usarMagia(1, estado.cartaSelecionada, { tipo: 'inimigo', slot: slotIndex });
      } else adicionarLog('Selecione um monstro válido.');
  }
}

function sairDaPartida() { if (confirm("Você tem certeza que deseja sair?")) { window.location.href = 'index.html'; } }
document.getElementById('hp-p2').addEventListener('click', () => { if (estado.fase === 'batalha' && estado.jogadorAtual === 1 && estado.atacanteSelecionado !== null && !estado.processandoAnimacao) executarAtaque(estado.atacanteSelecionado, 'jogador', null); });
document.getElementById('btn-atacar').addEventListener('click', iniciarBatalha);
document.getElementById('btn-encerrar').addEventListener('click', () => { if (estado.jogadorAtual === 1 && (estado.fase === 'main' || estado.fase === 'batalha') && !estado.processandoAnimacao) encerrarTurno(); });

// ==================== EXPOR FUNÇÕES E VARIÁVEIS PARA IA ====================
window.invocarMonstro = invocarMonstro;
window.usarMagia = usarMagia;
window.baixarArmadilha = baixarArmadilha;
window.executarAtaquesAutomaticos = executarAtaquesAutomaticos;
window.encerrarTurno = encerrarTurno;
window.adicionarLog = adicionarLog;
window.delay = delay;
window.render = render;
window.animarCarta = animarCarta;
window.destruirMonstro = destruirMonstro;
window.resolverBatalha = resolverBatalha;
window.verificarFimDeDuelo = verificarFimDeDuelo;
window.nomeJogador = nomeJogador;
window.estado = estado;
window.calcularBonusAura = calcularBonusAura;
window.embaralhar = embaralhar;
window.nivelDificuldade = nivelDificuldade;

// Inicializar
window.onload = () => { iniciarCampeonato(); };