// =============================================================
//  ARQUIVO DE INTELIGÊNCIA ARTIFICIAL - VERSÃO SIMPLIFICADA
//  A IA apenas joga todas as cartas que tem, sem pensar.
//  A dificuldade vem da composição do deck.
// =============================================================

window.aiMontarDeck = montarDeckIA;
window.aiEscolherCarta = function() { return null; }; // não usado

function montarDeckIA(jogadorId, deckCompleto, nivel) {
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
        const weakMonsters = embaralhar([...tier3]).slice(0, 16);
        const weakSpells = embaralhar([...tier3.filter(c => c.tipo === 'magia')]).slice(0, 1);
        const weakTraps = embaralhar([...traps]).slice(0, 1);
        finalDeck = [...weakMonsters, ...weakSpells, ...weakTraps];
        while (finalDeck.length < 20) { finalDeck.push(tier3[0]); }
        return embaralhar(finalDeck).slice(0, 20);
    }
    else if (nivel === 'medio') {
        const chosenStrong = embaralhar([...tier2]).slice(0, 3);
        const chosenWeak = embaralhar([...tier3]).slice(0, 10);
        const chosenSpells = embaralhar([...tier2.filter(c => c.tipo === 'magia'), ...tier3.filter(c => c.tipo === 'magia')]).slice(0, 3);
        const chosenTraps = embaralhar([...traps]).slice(0, 2);
        finalDeck = [...chosenStrong, ...chosenWeak, ...chosenSpells, ...chosenTraps];
        while (finalDeck.length < 20) { finalDeck.push(tier3[0]); }
        return embaralhar(finalDeck).slice(0, 20);
    }
    else { // DIFICIL – MUITAS CARTAS FORTES
        // 6 monstros tier1, 2 monstros tier2
        const strongMonsters = embaralhar([...tier1.filter(c => c.tipo === 'monstro')]).slice(0, 6);
        const midMonsters = embaralhar([...tier2.filter(c => c.tipo === 'monstro')]).slice(0, 2);
        // 6 magias (4 tier1 + 2 tier2)
        const spells = [
            ...embaralhar([...tier1.filter(c => c.tipo === 'magia')]).slice(0, 4),
            ...embaralhar([...tier2.filter(c => c.tipo === 'magia')]).slice(0, 2)
        ];
        // 6 armadilhas (3 tier1 + 3 tier2)
        const trapsDeck = [
            ...embaralhar([...tier1.filter(c => c.tipo === 'armadilha')]).slice(0, 3),
            ...embaralhar([...tier2.filter(c => c.tipo === 'armadilha')]).slice(0, 3)
        ];
        finalDeck = [...strongMonsters, ...midMonsters, ...spells, ...trapsDeck];
        while (finalDeck.length < 20) {
            finalDeck.push(tier1[0] || tier2[0] || tier3[0]);
        }
        return embaralhar(finalDeck).slice(0, 20);
    }
}

// ==================== ATAQUE AUTOMÁTICO CORRIGIDO ====================
async function executarAtaquesAutomaticos(jogadorId) {
    const jogador = estado.jogadores[jogadorId];
    const inimigo = estado.jogadores[jogadorId === 1 ? 2 : 1];

    // Percorre os slots de 0 a 2, mas verifica a cada passo se o monstro ainda existe
    for (let i = 0; i < jogador.zonaMonstros.length; i++) {
        const monstro = jogador.zonaMonstros[i];
        if (!monstro) continue;
        if (monstro.posicao !== 'ataque' || monstro.ataquesRestantes === 0 || monstro.efeito === 'nao_pode_atacar') continue;

        // Encontra o primeiro monstro inimigo vivo
        let alvoSlot = -1;
        for (let j = 0; j < inimigo.zonaMonstros.length; j++) {
            if (inimigo.zonaMonstros[j] !== null) {
                alvoSlot = j;
                break;
            }
        }

        if (alvoSlot !== -1) {
            // Ataca monstro inimigo
            await animarAtaque(i, alvoSlot, jogadorId, jogadorId === 1 ? 2 : 1);
            resolverBatalha(jogadorId, jogadorId === 1 ? 2 : 1, i, alvoSlot);
            adicionarLog(`${monstro.nome} atacou ${inimigo.zonaMonstros[alvoSlot]?.nome || 'um monstro'}.`);
        } else {
            // Ataque direto
            inimigo.hp -= monstro.atk;
            adicionarLog(`${monstro.nome} atacou diretamente! ${nomeJogador(jogadorId === 1 ? 2 : 1)} perdeu ${monstro.atk} HP.`);
            if (verificarFimDeDuelo()) return;
        }

        // Verifica se o monstro ainda está vivo (não foi destruído em contra-ataque)
        const stillAlive = jogador.zonaMonstros[i] && jogador.zonaMonstros[i].id === monstro.id;
        if (stillAlive) {
            jogador.zonaMonstros[i].ataquesRestantes--;
        }

        render();
        await delay(800);
    }
}

// ==================== TURNO DA IA (CORRIGIDO) ====================
async function aiTurn(estado) {
    try {
        const jogadorId = estado.jogadorAtual;
        const jogador = estado.jogadores[jogadorId];
        const inimigo = estado.jogadores[jogadorId === 1 ? 2 : 1];
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

        // PASSO 1: Usar TODAS as magias da mão (na ordem que aparecem)
        for (let i = jogador.mao.length - 1; i >= 0; i--) {
            const carta = jogador.mao[i];
            if (carta.tipo === 'magia') {
                const efeito = carta.efeito;
                const precisaAlvoProprio = ['buff_500','buff_1000','buff_defesa_2000','buff_1500_dano_500','buff_2000_dano_1000_por_turno','imune_ataques_turno','ataque_duplo_destroi_no_fim'].includes(efeito);
                const precisaAlvoInimigo = ['destruir_inimigo','devolver_monstro_mao','prende_monstro_inimigo','roubar_monstro'].includes(efeito);
                const precisaAlvoCemiterio = efeito === 'reviver_monstro';

                if (precisaAlvoProprio) {
                    let alvoSlot = -1;
                    let maiorAtk = -1;
                    for (let j = 0; j < jogador.zonaMonstros.length; j++) {
                        const m = jogador.zonaMonstros[j];
                        if (m && (m.atk + (m.bonusAtk||0)) > maiorAtk) {
                            maiorAtk = m.atk + (m.bonusAtk||0);
                            alvoSlot = j;
                        }
                    }
                    if (alvoSlot !== -1) {
                        usarMagia(jogadorId, i, { tipo: 'proprio', slot: alvoSlot });
                        await delay(800);
                    }
                } else if (precisaAlvoInimigo) {
                    let alvoSlot = -1;
                    let maiorAtk = -1;
                    for (let j = 0; j < inimigo.zonaMonstros.length; j++) {
                        const m = inimigo.zonaMonstros[j];
                        if (m && (m.atk + (m.bonusAtk||0)) > maiorAtk) {
                            maiorAtk = m.atk + (m.bonusAtk||0);
                            alvoSlot = j;
                        }
                    }
                    if (alvoSlot !== -1) {
                        usarMagia(jogadorId, i, { tipo: 'inimigo', slot: alvoSlot });
                        await delay(800);
                    }
                } else if (precisaAlvoCemiterio) {
                    if (jogador.cemiterio.length > 0) {
                        const maisForte = jogador.cemiterio.reduce((a,b) => (b.atk > a.atk) ? b : a);
                        const idxCem = jogador.cemiterio.indexOf(maisForte);
                        usarMagia(jogadorId, i, { tipo: 'cemiterio', index: idxCem });
                        await delay(800);
                    }
                } else {
                    // Magia sem alvo – usa sempre
                    usarMagia(jogadorId, i, null);
                    await delay(800);
                }
            }
        }

        // PASSO 2: Invocar TODOS os monstros da mão (em posição de ataque)
        for (let i = jogador.mao.length - 1; i >= 0; i--) {
            const carta = jogador.mao[i];
            if (carta.tipo === 'monstro') {
                const slotVazio = jogador.zonaMonstros.findIndex(s => s === null);
                if (slotVazio !== -1) {
                    invocarMonstro(jogadorId, i, slotVazio, 'ataque');
                    await delay(800);
                }
            }
        }

        // PASSO 3: Baixar TODAS as armadilhas da mão
        for (let i = jogador.mao.length - 1; i >= 0; i--) {
            const carta = jogador.mao[i];
            if (carta.tipo === 'armadilha') {
                const slotVazio = jogador.zonaMagias.findIndex(s => s === null);
                if (slotVazio !== -1) {
                    baixarArmadilha(jogadorId, i, slotVazio);
                    await delay(800);
                }
            }
        }

        // PASSO 4: Atacar com todos os monstros em ataque
        if (!(estado.primeiroTurno && estado.jogadorAtual === jogadorId)) {
            await executarAtaquesAutomaticos(jogadorId);
        }

        // PASSO 5: Encerrar turno
        encerrarTurno();
    } catch (error) {
        console.error('Erro no aiTurn:', error);
        adicionarLog('Erro na IA, encerrando turno forçadamente.');
        encerrarTurno();
    }
}