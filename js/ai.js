// =============================================================
//  ARQUIVO DE INTELIGÊNCIA ARTIFICIAL E MONTAGEM DE DECK DA IA
//  Toda a dificuldade está escondida aqui dentro!
// =============================================================

window.aiMontarDeck = montarDeckIA;
window.aiEscolherCarta = escolherCartaParaIA;

function montarDeckIA(jogadorId, deckCompleto, nivel) {
    const tier1Ids = ['m10','m11','m19','m23','m24','m27','m28','m29','m30','m37','m39','s08','s09','s12','s13','s15','t10','t11'];
    const tier2Ids = ['m05','m08','m16','m21','m25','m26','m32','m33','m34','m35','m36','m40','m41','m42','s04','s05','s10','s11','s14','s16','t08','t09'];
    const tier3Ids = ['m01','m02','m03','m04','m06','m07','m09','m12','m13','m14','m15','m17','m18','m20','m22','s01','s02','s03','s06','s07','s17','s18'];
    const trapIds = ['t01','t02','t03','t04','t05','t06','t07','t12','t13','t14','t15'];

    let finalDeck = []; let tier1 = deckCompleto.filter(c => tier1Ids.includes(c.id)); let tier2 = deckCompleto.filter(c => tier2Ids.includes(c.id)); let tier3 = deckCompleto.filter(c => tier3Ids.includes(c.id)); let traps = deckCompleto.filter(c => trapIds.includes(c.id));
    
    if (nivel === 'facil') { const weakMonsters = embaralhar([...tier3]).slice(0, 16); const weakSpells = embaralhar([...tier3.filter(c => c.tipo === 'magia')]).slice(0, 1); const weakTraps = embaralhar([...traps]).slice(0, 1); finalDeck = [...weakMonsters, ...weakSpells, ...weakTraps]; while (finalDeck.length < 20) { finalDeck.push(tier3[0]); } return embaralhar(finalDeck).slice(0, 20); }
    
    else if (nivel === 'medio') { const chosenStrong = embaralhar([...tier2]).slice(0, 3); const chosenWeak = embaralhar([...tier3]).slice(0, 10); const chosenSpells = embaralhar([...tier2.filter(c => c.tipo === 'magia'), ...tier3.filter(c => c.tipo === 'magia')]).slice(0, 3); const chosenTraps = embaralhar([...traps]).slice(0, 2); finalDeck = [...chosenStrong, ...chosenWeak, ...chosenSpells, ...chosenTraps]; while (finalDeck.length < 20) { finalDeck.push(tier3[0]); } return embaralhar(finalDeck).slice(0, 20); }
    
    else { // DIFICIL (AQUI É ONDE A IA FICA FORTE!)
        const chosenStrong = embaralhar([...tier1]).slice(0, 8); // AUMENTEI DE 6 PARA 8
        const chosenMid = embaralhar([...tier2]).slice(0, 2); 
        const chosenWeak = embaralhar([...tier3]).slice(0, 1); // SÓ 1 MONSTRO FRACO
        const chosenSpells = embaralhar([...tier1.filter(c => c.tipo === 'magia'), ...tier2.filter(c => c.tipo === 'magia')]).slice(0, 5); // + MAGIAS PODEROSAS
        const chosenTraps = embaralhar([...tier1.filter(c => c.tipo === 'armadilha'), ...tier2.filter(c => c.tipo === 'armadilha')]).slice(0, 3); // + ARMADILHAS FORTES
        
        finalDeck = [...chosenStrong, ...chosenMid, ...chosenWeak, ...chosenSpells, ...chosenTraps];
        while (finalDeck.length < 20) { finalDeck.push(tier3[0]); }
        return embaralhar(finalDeck).slice(0, 20);
    }
}

function escolherCartaParaIA(jogadorId) {
    const jogador = estado.jogadores[jogadorId]; const deck = jogador.deck; let melhorCarta = deck[0]; let melhorPontuacao = -Infinity;
    for (const carta of deck) { let pontos = 0; if (carta.tipo === 'monstro') { pontos += carta.atk / 100; if (carta.efeito === 'ao_invocar_causa_500_dano_direto') pontos += 5; if (carta.efeito === 'dano_perfurante') pontos += 3; } else if (carta.tipo === 'magia') { if (carta.efeito === 'curar_2000' && jogador.hp < 2500) pontos += 10; if (carta.efeito === 'destruir_inimigo' && estado.jogadores[jogadorId === 1 ? 2 : 1].zonaMonstros.some(m => m && m.atk > 2000)) pontos += 12; if (carta.efeito === 'comprar_2' && jogador.mao.length < 3) pontos += 8; } else if (carta.tipo === 'armadilha') { pontos += 6; } if (pontos > melhorPontuacao) { melhorPontuacao = pontos; melhorCarta = carta; } }
    return melhorCarta;
}

async function executarAtaquesAutomaticos(jogadorId) {
  const dificuldade = window.nivelDificuldade || 'medio';
  const jogador = estado.jogadores[jogadorId]; const inimigoId = jogadorId === 1 ? 2 : 1; const inimigo = estado.jogadores[inimigoId];
  for (let i = 0; i < jogador.zonaMonstros.length; i++) {
    const monstro = jogador.zonaMonstros[i];
    if (!monstro || monstro.posicao !== 'ataque' || monstro.ataquesRestantes === 0 || monstro.efeito === 'nao_pode_atacar') continue;
    let continuarAtaque = true;
    for (let j = 0; j < inimigo.zonaMagias.length; j++) {
      const armadilha = inimigo.zonaMagias[j];
      if (armadilha && armadilha.tipo === 'armadilha' && armadilha.viradaParaBaixo) {
        if (armadilha.efeito === 'armadilha_escudo' && monstro.efeito !== 'imune_a_armadilhas') { armadilha.viradaParaBaixo = false; render(); animarCarta(inimigoId, 'magia', j, 'trap'); adicionarLog(`Armadilha "Escudo de Atenas" ativada!`); await delay(800); monstro.posicao = 'defesa'; monstro.ataquesRestantes--; inimigo.zonaMagias[j] = null; render(); continuarAtaque = false; break; }
        else if (armadilha.efeito === 'armadilha_destruir_atacantes' && monstro.efeito !== 'imune_a_armadilhas') { armadilha.viradaParaBaixo = false; render(); animarCarta(inimigoId, 'magia', j, 'trap'); adicionarLog(`Armadilha "Força Espelhada" ativada!`); await delay(800); for (let k = 0; k < jogador.zonaMonstros.length; k++) { const m = jogador.zonaMonstros[k]; if (m && m.posicao === 'ataque' && m.efeito !== 'imune_a_armadilhas' && m.efeito !== 'nao_pode_ser_destruido_por_efeito') { destruirMonstro(jogadorId, k, 'Força Espelhada'); } } inimigo.zonaMagias[j] = null; render(); continuarAtaque = false; break; }
        else if (armadilha.efeito === 'armadilha_refletir_dano' && monstro.efeito !== 'imune_a_armadilhas') { armadilha.viradaParaBaixo = false; render(); animarCarta(inimigoId, 'magia', j, 'trap'); adicionarLog(`Armadilha "Cilindro Mágico" ativada!`); await delay(800); jogador.hp -= monstro.atk; adicionarLog(`${monstro.nome} teve seu ataque refletido! ${nomeJogador(jogadorId)} perdeu ${monstro.atk} HP.`); monstro.ataquesRestantes--; inimigo.zonaMagias[j] = null; if (verificarFimDeDuelo()) return; render(); continuarAtaque = false; break; }
      }
    }
    if (!continuarAtaque) continue;
    const monstrosInimigos = inimigo.zonaMonstros.filter(m => m !== null);
    if (monstrosInimigos.length === 0) { inimigo.hp -= monstro.atk; adicionarLog(`${monstro.nome} atacou diretamente! Computador perdeu ${monstro.atk} HP.`); monstro.ataquesRestantes--; if (verificarFimDeDuelo()) return; render(); await delay(800); continue; }
    let alvoMorte = -1; let melhorDiferencaMorte = -Infinity; let alvoEscudo = -1; let menorDef = Infinity; let alvoSacrificio = -1; let menorDanoRecebido = Infinity;
    for (let j = 0; j < inimigo.zonaMonstros.length; j++) {
      const defensor = inimigo.zonaMonstros[j]; if (!defensor) continue; let diff = -999999; let danoRecebido = 0;
      if (defensor.posicao === 'ataque') { diff = monstro.atk - defensor.atk; danoRecebido = Math.abs(diff); if (diff > 0) { if (diff > melhorDiferencaMorte) { melhorDiferencaMorte = diff; alvoMorte = j; } } else { if (danoRecebido < menorDanoRecebido) { menorDanoRecebido = danoRecebido; alvoSacrificio = j; } } } 
      else { diff = monstro.atk - defensor.def; if (diff > 0) { if (diff > melhorDiferencaMorte) { melhorDiferencaMorte = diff; alvoMorte = j; } } else { if (diff > menorDef) { menorDef = diff; alvoEscudo = j; } } }
    }
    if (alvoMorte !== -1) { await animarAtaque(i, alvoMorte, jogadorId, inimigoId); resolverBatalha(jogadorId, inimigoId, i, alvoMorte); monstro.ataquesRestantes--; render(); await delay(800); } 
    else if (dificuldade === 'dificil' && alvoEscudo !== -1) { await animarAtaque(i, alvoEscudo, jogadorId, inimigoId); adicionarLog(`${monstro.nome} atacou a defesa (modo difícil).`); resolverBatalha(jogadorId, inimigoId, i, alvoEscudo); monstro.ataquesRestantes--; render(); await delay(800); } 
    else if (dificuldade === 'dificil' && alvoSacrificio !== -1) { await animarAtaque(i, alvoSacrificio, jogadorId, inimigoId); adicionarLog(`${monstro.nome} atacou em sacrifício (modo difícil).`); resolverBatalha(jogadorId, inimigoId, i, alvoSacrificio); monstro.ataquesRestantes--; render(); await delay(800); } 
    else { adicionarLog(`${monstro.nome} não atacou (sem alvo favorável).`); continue; }
  }
}

async function aiTurn(estado) {
  const jogadorId = estado.jogadorAtual; const jogador = estado.jogadores[jogadorId]; const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const dificuldade = window.nivelDificuldade || 'medio';
  const inimigo = estado.jogadores[jogadorId === 1 ? 2 : 1]; const inimigoMonstros = inimigo.zonaMonstros.filter(m => m !== null);
  let maiorForcaInimiga = 0; if (inimigoMonstros.length > 0) { maiorForcaInimiga = inimigoMonstros.reduce((max, m) => Math.max(max, (m.posicao === 'ataque' ? (m.atk + (m.bonusAtk || 0)) : (m.def + (m.bonusDef || 0)))), 0); }

  // ==========================================================
  // PASSO 1: Táticas de Alto Nível
  // ==========================================================
  // Destruir todos os inimigos (Limpa campo)
  const magiasDestruirTodos = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && item.c.efeito === 'destruir_todos_inimigos');
  if (magiasDestruirTodos.length > 0 && inimigo.zonaMonstros.some(m => m !== null)) { usarMagia(jogadorId, magiasDestruirTodos[0].index, null); await delay(800); }
  
  // Devolver ou Prender o monstro mais forte do oponente
  const magiasPrisao = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && (item.c.efeito === 'devolver_monstro_mao' || item.c.efeito === 'prende_monstro_inimigo'));
  if (magiasPrisao.length > 0) { let maiorAtk = -1; let idx = -1; for(let i=0; i<inimigo.zonaMonstros.length; i++){ const m = inimigo.zonaMonstros[i]; if(m && m.atk > maiorAtk){ maiorAtk = m.atk; idx = i; } } if (idx !== -1) { usarMagia(jogadorId, magiasPrisao[0].index, { tipo: 'inimigo', slot: idx }); await delay(800); } }
  
  // Roubar monstro
  const magiasRoubar = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && item.c.efeito === 'roubar_monstro');
  if (magiasRoubar.length > 0) { let maiorAtk = -1; let idx = -1; for(let i=0; i<inimigo.zonaMonstros.length; i++){ const m = inimigo.zonaMonstros[i]; if(m && m.atk > maiorAtk){ maiorAtk = m.atk; idx = i; } } if (idx !== -1 && (dificuldade !== 'dificil' || maiorAtk >= 1500)) { usarMagia(jogadorId, magiasRoubar[0].index, { tipo: 'inimigo', slot: idx }); await delay(800); } }
  
  // Destruir Inimigo específico (Prioridade máxima)
  const magiasDestruir = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && item.c.efeito === 'destruir_inimigo');
  for (let magia of magiasDestruir) { let maiorAtk = -1; let idx = -1; for(let i=0; i<inimigo.zonaMonstros.length; i++){ const m = inimigo.zonaMonstros[i]; if(m && m.atk > maiorAtk){ maiorAtk = m.atk; idx = i; } } if (idx !== -1) { usarMagia(jogadorId, magia.index, { tipo: 'inimigo', slot: idx }); await delay(800); } }
  
  // Destruir todos os fracos
  const magiasFracos = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && item.c.efeito === 'destruir_monstros_baixo_atk');
  if (magiasFracos.length > 0) { usarMagia(jogadorId, magiasFracos[0].index, null); await delay(800); }

  // ==========================================================
  // PASSO 2: Cura e Suporte
  // ==========================================================
  if (jogador.hp < 2500) {
      const magiasCurar = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && (item.c.efeito === 'curar_2000' || item.c.efeito === 'curar_1000_por_monstro' || item.c.efeito === 'iguala_vida_menor'));
      for (let magia of magiasCurar) { usarMagia(jogadorId, magia.index, null); await delay(800); }
  }
  
  // ==========================================================
  // PASSO 3: Invocar monstros (CORREÇÃO DO ÍNDICE AQUI)
  // ==========================================================
  let monstrosNaMao = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'monstro');
  if (jogador.hp < 2000) {
      const prioridadeCura = monstrosNaMao.filter(item => item.c.efeito === 'ao_invocar_ganha_1000_vida');
      for (let item of prioridadeCura) { const slotVazio = jogador.zonaMonstros.findIndex(slot => slot === null); if (slotVazio !== -1) { invocarMonstro(jogadorId, item.index, slotVazio, 'defesa'); await delay(800); } }
  }
  monstrosNaMao.sort((a, b) => b.c.atk - a.c.atk);
  for (let item of monstrosNaMao) {
    const idxAtual = jogador.mao.findIndex(c => c.id === item.c.id);
    if (idxAtual === -1) continue; 
    const slotVazio = jogador.zonaMonstros.findIndex(slot => slot === null);
    if (slotVazio !== -1) {
        let posicao = 'ataque';
        if (item.c.atk < maiorForcaInimiga * 0.8 && inimigoMonstros.length > 0) posicao = 'defesa';
        invocarMonstro(jogadorId, idxAtual, slotVazio, posicao);
        await delay(800);
    } else { break; }
  }

  // ==========================================================
  // PASSO 4: Magias de Buff
  // ==========================================================
  const magiasBuff = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && (item.c.efeito === 'buff_500' || item.c.efeito === 'buff_1000' || item.c.efeito === 'buff_1500_dano_500' || item.c.efeito === 'buff_2000_dano_1000_por_turno'));
  for (let magia of magiasBuff) { let idx = -1; let maiorAtk = 0; for(let i=0; i<jogador.zonaMonstros.length; i++){ const m = jogador.zonaMonstros[i]; if(m && m.atk > maiorAtk){ maiorAtk = m.atk; idx = i; } } if (idx !== -1) { usarMagia(jogadorId, magia.index, { tipo: 'proprio', slot: idx }); await delay(800); } }

  const magiasComprar = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && (item.c.efeito === 'comprar_2' || item.c.efeito === 'comprar_3_dano_1000' || item.c.efeito === 'trocar_vida_por_cartas' || item.c.efeito === 'metade_vida_compra_3' || item.c.efeito === 'devolve_mao_compra'));
  for (let magia of magiasComprar) { if (jogador.mao.length < 3) { usarMagia(jogadorId, magia.index, null); await delay(800); } }

  if (inimigo.hp < 2000) {
      const magiasDano = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && item.c.efeito === 'dano_direto_1000');
      for (let magia of magiasDano) { usarMagia(jogadorId, magia.index, null); await delay(800); }
  }
  const magiasBloqueio = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && item.c.efeito === 'bloqueia_magias_turno');
  for (let magia of magiasBloqueio) { usarMagia(jogadorId, magia.index, null); await delay(800); }

  const magiasReviver = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'magia' && item.c.efeito === 'reviver_monstro');
  if (magiasReviver.length > 0 && jogador.cemiterio.length > 0) { const maisForte = jogador.cemiterio.reduce((a,b) => b.atk > a.atk ? b : a); const idxCem = jogador.cemiterio.indexOf(maisForte); usarMagia(jogadorId, magiasReviver[0].index, { tipo: 'cemiterio', index: idxCem }); await delay(800); }

  // ==========================================================
  // PASSO 5: Baixar armadilhas
  // ==========================================================
  const armadilhas = jogador.mao.map((c, i) => ({c,i})).filter(item => item.c.tipo === 'armadilha');
  for (let arm of armadilhas) { const slotVazio = jogador.zonaMagias.findIndex(slot => slot === null); if (slotVazio !== -1) { baixarArmadilha(jogadorId, arm.index, slotVazio); await delay(800); } }

  // ==========================================================
  // PASSO 6: Atacar (se não for o primeiro turno)
  // ==========================================================
  if (!(estado.primeiroTurno && estado.jogadorAtual === jogadorId)) await executarAtaquesAutomaticos(jogadorId);

  // ==========================================================
  // PASSO 7: Encerrar turno
  // ==========================================================
  encerrarTurno();
}