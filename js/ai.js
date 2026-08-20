// =============================================================
//  ARQUIVO DE INTELIGÊNCIA ARTIFICIAL E MONTAGEM DE DECK DA IA
//  Toda a dificuldade está escondida aqui dentro!
// =============================================================

// ==================== EXPOR FUNÇÕES PARA O GLOBAL (PARA O GAME.JS ACESSAR) ====================
window.aiMontarDeck = montarDeckIA;
window.aiEscolherCarta = escolherCartaParaIA;

// ==================== SELEÇÃO DE CARTAS PESADA (NATURAL E PODEROSA) ====================
function montarDeckIA(jogadorId, deckCompleto, nivel) {
    // IDs das cartas de cada Tier (Nível de poder)
    const tier1Ids = ['m10','m11','m19','m23','m24','m27','m28','m29','m30','m37','m39','s08','s09','s12','s13','s15','t10','t11'];
    const tier2Ids = ['m05','m08','m16','m21','m25','m26','m32','m33','m34','m35','m36','m40','m41','m42','s04','s05','s10','s11','s14','s16','t08','t09'];
    const tier3Ids = ['m01','m02','m03','m04','m06','m07','m09','m12','m13','m14','m15','m17','m18','m20','m22','s01','s02','s03','s06','s07','s17','s18'];
    const trapIds = ['t01','t02','t03','t04','t05','t06','t07','t12','t13','t14','t15'];

    let finalDeck = [];
    let tier1 = deckCompleto.filter(c => tier1Ids.includes(c.id));
    let tier2 = deckCompleto.filter(c => tier2Ids.includes(c.id));
    let tier3 = deckCompleto.filter(c => tier3Ids.includes(c.id));
    let traps = deckCompleto.filter(c => trapIds.includes(c.id));
    
    if (nivel === 'facil') {
        // IA Fácil: Monstros fracos e poucas cartas mágicas (para a pessoa aprender)
        const weakMonsters = embaralhar([...tier3]).slice(0, 16);
        const weakSpells = embaralhar([...tier3.filter(c => c.tipo === 'magia')]).slice(0, 1);
        const weakTraps = embaralhar([...traps]).slice(0, 1);
        finalDeck = [...weakMonsters, ...weakSpells, ...weakTraps];
        while (finalDeck.length < 20) { finalDeck.push(tier3[0]); }
        return embaralhar(finalDeck).slice(0, 20);

    } else if (nivel === 'medio') {
        // IA Média: Um deck equilibrado, com alguns monstros médios e umas magias básicas
        const chosenStrong = embaralhar([...tier2]).slice(0, 3); 
        const chosenWeak = embaralhar([...tier3]).slice(0, 10);
        const chosenSpells = embaralhar([...tier2.filter(c => c.tipo === 'magia'), ...tier3.filter(c => c.tipo === 'magia')]).slice(0, 3);
        const chosenTraps = embaralhar([...traps]).slice(0, 2);
        finalDeck = [...chosenStrong, ...chosenWeak, ...chosenSpells, ...chosenTraps];
        while (finalDeck.length < 20) { finalDeck.push(tier3[0]); }
        return embaralhar(finalDeck).slice(0, 20);

    } else { // DIFICIL
        // IA Difícil: Alta concentração de monstros fortes e magias/poderosas.
        // A distribuição é NATURAL, ela não tem só os monstros mais fortes, tem uma mistura, 
        // mas a média de poder é muito maior que a do jogador.
        const chosenStrong = embaralhar([...tier1]).slice(0, 5); // 5 Ultra fortes
        const chosenMid = embaralhar([...tier2]).slice(0, 4);    // 4 Monstros fortes
        const chosenWeak = embaralhar([...tier3]).slice(0, 3);   // 3 Fracos
        const chosenSpells = embaralhar([...tier1.filter(c => c.tipo === 'magia'), ...tier2.filter(c => c.tipo === 'magia')]).slice(0, 3);
        const chosenTraps = embaralhar([...tier1.filter(c => c.tipo === 'armadilha'), ...tier2.filter(c => c.tipo === 'armadilha')]).slice(0, 2);
        finalDeck = [...chosenStrong, ...chosenMid, ...chosenWeak, ...chosenSpells, ...chosenTraps];
        while (finalDeck.length < 20) { finalDeck.push(tier3[0]); }
        return embaralhar(finalDeck).slice(0, 20);
    }
}

// ==================== TRAPAÇA INTELIGENTE (SÓ NO MODO DIFÍCIL) ====================
function escolherCartaParaIA(jogadorId) {
    const jogador = estado.jogadores[jogadorId];
    const deck = jogador.deck;
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
            if (carta.efeito === 'destruir_inimigo' && estado.jogadores[jogadorId === 1 ? 2 : 1].zonaMonstros.some(m => m && m.atk > 2000)) pontos += 12;
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

// ==================== LÓGICA DE ATAQUE DA IA ====================
async function executarAtaquesAutomaticos(jogadorId) {
  const jogador = estado.jogadores[jogadorId];
  const inimigoId = jogadorId === 1 ? 2 : 1;
  const inimigo = estado.jogadores[inimigoId];

  for (let i = 0; i < jogador.zonaMonstros.length; i++) {
    const monstro = jogador.zonaMonstros[i];
    if (!monstro || monstro.posicao !== 'ataque' || monstro.ataquesRestantes === 0 || monstro.efeito === 'nao_pode_atacar') continue;

    // 1. Verifica armadilhas do oponente
    for (let j = 0; j < inimigo.zonaMagias.length; j++) {
      const armadilha = inimigo.zonaMagias[j];
      if (armadilha && armadilha.tipo === 'armadilha' && armadilha.viradaParaBaixo) {
        if (armadilha.efeito === 'armadilha_escudo' && monstro.efeito !== 'imune_a_armadilhas') {
          armadilha.viradaParaBaixo = false; render(); animarCarta(inimigoId, 'magia', j, 'trap');
          adicionarLog(`Armadilha "Escudo de Atenas" ativada!`); await delay(800);
          monstro.posicao = 'defesa'; monstro.ataquesRestantes--; inimigo.zonaMagias[j] = null; render(); continue;
        } else if (armadilha.efeito === 'armadilha_destruir_atacantes' && monstro.efeito !== 'imune_a_armadilhas') {
          armadilha.viradaParaBaixo = false; render(); animarCarta(inimigoId, 'magia', j, 'trap');
          adicionarLog(`Armadilha "Força Espelhada" ativada!`); await delay(800);
          for (let k = 0; k < jogador.zonaMonstros.length; k++) { const m = jogador.zonaMonstros[k]; if (m && m.posicao === 'ataque' && m.efeito !== 'imune_a_armadilhas' && m.efeito !== 'nao_pode_ser_destruido_por_efeito') { destruirMonstro(jogadorId, k, 'Força Espelhada'); } }
          inimigo.zonaMagias[j] = null; render(); continue;
        } else if (armadilha.efeito === 'armadilha_refletir_dano' && monstro.efeito !== 'imune_a_armadilhas') {
          armadilha.viradaParaBaixo = false; render(); animarCarta(inimigoId, 'magia', j, 'trap');
          adicionarLog(`Armadilha "Cilindro Mágico" ativada!`); await delay(800);
          jogador.hp -= monstro.atk; adicionarLog(`${monstro.nome} teve seu ataque refletido! ${nomeJogador(jogadorId)} perdeu ${monstro.atk} HP.`);
          monstro.ataquesRestantes--; inimigo.zonaMagias[j] = null; if (verificarFimDeDuelo()) return; render(); continue;
        }
      }
    }

    const monstrosInimigos = inimigo.zonaMonstros.filter(m => m !== null);
    // 2. Se não tiver monstros inimigos, ataca diretamente
    if (monstrosInimigos.length === 0) {
      inimigo.hp -= monstro.atk; adicionarLog(`${monstro.nome} atacou diretamente! Computador perdeu ${monstro.atk} HP.`);
      monstro.ataquesRestantes--; if (verificarFimDeDuelo()) return; render(); await delay(800); continue;
    }

    // 3. Analisa os alvos
    let alvoIndex = -1;
    let melhorDiferenca = -Infinity; // Prioridade 1: Matar
    let alvoSacrificioIndex = -1;
    let menorDanoRecebido = Infinity; // Prioridade 2: Atacar o mais fraco (Modo Difícil)

    for (let j = 0; j < inimigo.zonaMonstros.length; j++) {
      const defensor = inimigo.zonaMonstros[j];
      if (!defensor) continue;
      
      let diff = -999999;
      let podeAtacar = false;
      if (defensor.posicao === 'ataque') { diff = monstro.atk - defensor.atk; podeAtacar = true; } 
      else { if (monstro.efeito === 'dano_perfurante' || monstro.efeito === 'ignora_defesa_ataque_direto') { diff = monstro.atk - defensor.def; podeAtacar = true; } }
      if (!podeAtacar) continue;

      // Lógica de escolha inteligente de alvo
      if (diff > 0) { // Vai conseguir matar o alvo
        if (diff > melhorDiferenca) { melhorDiferenca = diff; alvoIndex = j; }
      } else if (defensor.posicao === 'ataque') { // Vai perder se atacar
        let danoRecebido = Math.abs(diff);
        if (danoRecebido < menorDanoRecebido) { menorDanoRecebido = danoRecebido; alvoSacrificioIndex = j; }
      }
    }

    if (alvoIndex !== -1) { // Mata o inimigo
      await animarAtaque(i, alvoIndex, jogadorId, inimigoId);
      resolverBatalha(jogadorId, inimigoId, i, alvoIndex);
      monstro.ataquesRestantes--; render(); await delay(800);
    } else if (nivelDificuldade === 'dificil' && alvoSacrificioIndex !== -1) {
      // MODO DIFÍCIL: Mesmo não conseguindo matar, ataca taticamente (sacrifício calculado)
      await animarAtaque(i, alvoSacrificioIndex, jogadorId, inimigoId);
      adicionarLog(`${monstro.nome} atacou taticamente (modo difícil).`);
      resolverBatalha(jogadorId, inimigoId, i, alvoSacrificioIndex);
      monstro.ataquesRestantes--; render(); await delay(800);
    } else {
      adicionarLog(`${monstro.nome} não atacou (sem alvo favorável).`); continue;
    }
  }
}

// ==================== EXECUÇÃO DO TURNO DA IA ====================
async function aiTurn(estado) {
  const jogadorId = estado.jogadorAtual;
  const jogador = estado.jogadores[jogadorId];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Análise inicial do inimigo (Para decidir posição de defesa)
  const inimigo = estado.jogadores[jogadorId === 1 ? 2 : 1];
  const inimigoMonstros = inimigo.zonaMonstros.filter(m => m !== null);
  let maiorForcaInimiga = 0;
  if (inimigoMonstros.length > 0) {
      maiorForcaInimiga = inimigoMonstros.reduce((max, m) => Math.max(max, (m.posicao === 'ataque' ? (m.atk + (m.bonusAtk || 0)) : (m.def + (m.bonusDef || 0)))), 0);
  }

  // ==========================================================
  // PASSO 1: Usar magias táticas primeiro
  // ==========================================================
  // Prioriza as magias de destruir todos (se houver) para limpar o campo do inimigo
  const magiasDestruirTodos = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'destruir_todos_inimigos');
  if (magiasDestruirTodos.length > 0 && estado.jogadores[jogadorId === 1 ? 2 : 1].zonaMonstros.some(m => m !== null)) {
    usarMagia(jogadorId, magiasDestruirTodos[0].index, null);
    await delay(800);
  }

  // Magias de roubo e destruição específica
  const magiasRoubar = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'roubar_monstro');
  if (magiasRoubar.length > 0) {
    const inimigoLocal = estado.jogadores[jogadorId === 1 ? 2 : 1];
    let alvoIndex = -1; let maiorAtk = 0;
    for (let i = 0; i < inimigoLocal.zonaMonstros.length; i++) { const m = inimigoLocal.zonaMonstros[i]; if (m && m.atk > maiorAtk) { maiorAtk = m.atk; alvoIndex = i; } }
    if (alvoIndex !== -1 && (nivelDificuldade !== 'dificil' || maiorAtk >= 2000)) {
      usarMagia(jogadorId, magiasRoubar[0].index, { tipo: 'inimigo', slot: alvoIndex });
      await delay(800);
    }
  }

  const magiasDestruir = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'destruir_inimigo');
  for (let magia of magiasDestruir) {
    const inimigoLocal = estado.jogadores[jogadorId === 1 ? 2 : 1];
    let alvoIndex = -1; let maiorAtk = 0;
    for (let i = 0; i < inimigoLocal.zonaMonstros.length; i++) { const m = inimigoLocal.zonaMonstros[i]; if (m && m.atk > maiorAtk) { maiorAtk = m.atk; alvoIndex = i; } }
    if (alvoIndex !== -1 && (nivelDificuldade !== 'dificil' || maiorAtk >= 2000 || jogador.hp < 2000)) {
      usarMagia(jogadorId, magia.index, { tipo: 'inimigo', slot: alvoIndex });
      await delay(800);
    }
  }

  // ==========================================================
  // PASSO 2: Invocar monstros (do mais forte para o mais fraco) + defesa inteligente
  // ==========================================================
  const monstrosNaMao = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'monstro')
    .sort((a, b) => b.carta.atk - a.carta.atk);

  for (let item of monstrosNaMao) {
    const slotVazio = jogador.zonaMonstros.findIndex(slot => slot === null);
    if (slotVazio !== -1) {
      let posicao = 'ataque';
      // Lógica de defesa: Se for muito mais fraco que o inimigo, se defende
      if (item.carta.atk < maiorForcaInimiga * 0.8 && inimigoMonstros.length > 0) { posicao = 'defesa'; }
      invocarMonstro(jogadorId, item.index, slotVazio, posicao);
      await delay(800);
    } else { break; }
  }

  // ==========================================================
  // PASSO 3: Magias de Buff (Aplicadas após invocar)
  // ==========================================================
  const magiasBuff = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && (item.carta.efeito === 'buff_500' || item.carta.efeito === 'buff_1000'));
  for (let magia of magiasBuff) {
    let alvoIndex = -1; let maiorAtk = 0;
    for (let i = 0; i < jogador.zonaMonstros.length; i++) { const m = jogador.zonaMonstros[i]; if (m && m.atk > maiorAtk) { maiorAtk = m.atk; alvoIndex = i; } }
    if (alvoIndex !== -1) {
      usarMagia(jogadorId, magia.index, { tipo: 'proprio', slot: alvoIndex });
      await delay(800);
    }
  }

  const magiasReviver = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'reviver_monstro');
  if (magiasReviver.length > 0 && jogador.cemiterio.length > 0) {
    const maisForte = jogador.cemiterio.reduce((a, b) => (b.atk > a.atk ? b : a));
    const idxCem = jogador.cemiterio.indexOf(maisForte);
    usarMagia(jogadorId, magiasReviver[0].index, { tipo: 'cemiterio', index: idxCem });
    await delay(800);
  }

  const magiasCurar = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'curar_2000');
  if (magiasCurar.length > 0 && jogador.hp < 3000) {
    usarMagia(jogadorId, magiasCurar[0].index, null); await delay(800);
  }

  const magiasComprar = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && (item.carta.efeito === 'comprar_2' || item.carta.efeito === 'comprar_3_dano_1000'));
  for (let magia of magiasComprar) {
    if (jogador.mao.length < 3) { usarMagia(jogadorId, magia.index, null); await delay(800); }
  }

  // ==========================================================
  // PASSO 4: Baixar armadilhas
  // ==========================================================
  const armadilhas = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'armadilha');
  for (let arm of armadilhas) {
    const slotVazio = jogador.zonaMagias.findIndex(slot => slot === null);
    if (slotVazio !== -1) { baixarArmadilha(jogadorId, arm.index, slotVazio); await delay(800); }
  }

  // ==========================================================
  // PASSO 5: Atacar (se não for o primeiro turno)
  // ==========================================================
  if (!(estado.primeiroTurno && estado.jogadorAtual === jogadorId)) {
    await executarAtaquesAutomaticos(jogadorId);
  }

  // ==========================================================
  // PASSO 6: Encerrar turno
  // ==========================================================
  encerrarTurno();
}