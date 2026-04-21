// =============================================================
//  Autorização Prévia — Parametrização de Materiais e Medicamentos
//  Unimed Cerrado — Coordenação de Contas Médicas
//
//  Copyright (c) 2026 Wárreno Hendrick Costa Lima Guimarães
//  Todos os direitos reservados.
//
//  Versão: 1.0.0
// =============================================================

require('dotenv').config();
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// -------------------------------------------------------------
//  CONFIGURAÇÕES
// -------------------------------------------------------------
const ARQUIVO_EXCEL = path.join(__dirname, '../dados/base.xlsx');
const URL_LOGIN     = 'https://unimedcerrado.topsaude.com.br/TSNMVC/Account/Login';
const USUARIO       = process.env.USUARIO;
const SENHA         = process.env.SENHA;

// Mapeamento coluna B → índice do radio button (#ind_tipo_mat_med)
// Ordem na tela: 0=Brasíndice, 1=Simpro, 2=PTU(Intercâmbio), 3=Própria, 4=TUSS(materiais), 5=TUSS(medicamentos)
const TIPO_MAP = {
  'PTU':               2,
  'TUSS MATERIAIS':    4,
  'TUSS MEDICAMENTOS': 5,
};

// -------------------------------------------------------------
//  LEITURA DA PLANILHA
// -------------------------------------------------------------
function lerPlanilha() {
  if (!fs.existsSync(ARQUIVO_EXCEL)) {
    throw new Error(`Arquivo não encontrado: ${ARQUIVO_EXCEL}`);
  }
  const workbook = XLSX.readFile(ARQUIVO_EXCEL);
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const dados    = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  return dados
    .slice(1)
    .filter(row => row[0] && row[1])
    .map(row => ({
      codigo: String(row[0]).trim().padStart(8, '0'),
      tipo:   String(row[1]).trim().toUpperCase(),
    }));
}

// -------------------------------------------------------------
//  LOG DE EXECUÇÃO
// -------------------------------------------------------------
const LOG_PATH = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_PATH)) fs.mkdirSync(LOG_PATH, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_FILE  = path.join(LOG_PATH, `execucao_${timestamp}.csv`);

function iniciarLog() {
  fs.writeFileSync(LOG_FILE, 'codigo;tipo;resultado;observacao\n', 'utf8');
}

function registrarLog(codigo, tipo, resultado, observacao = '') {
  const linha = `${codigo};${tipo};${resultado};${observacao}\n`;
  fs.appendFileSync(LOG_FILE, linha, 'utf8');
  const icone = resultado === 'SUCESSO' ? '✅' : resultado === 'IGNORADO' ? '⚠️' : '❌';
  console.log(`${icone}  [${resultado}] ${codigo} (${tipo})${observacao ? ' — ' + observacao : ''}`);
}

// -------------------------------------------------------------
//  CONTROLE DE PROGRESSO (retomada entre sessões)
// -------------------------------------------------------------
const PROGRESSO_FILE = path.join(LOG_PATH, 'progresso.json');

function carregarProgresso() {
  if (!fs.existsSync(PROGRESSO_FILE)) return { ultimoIndice: -1 };
  try {
    return JSON.parse(fs.readFileSync(PROGRESSO_FILE, 'utf8'));
  } catch (_) {
    return { ultimoIndice: -1 };
  }
}

function salvarProgresso(indice) {
  fs.writeFileSync(PROGRESSO_FILE, JSON.stringify({ ultimoIndice: indice }, null, 2), 'utf8');
}

function resetarProgresso() {
  if (fs.existsSync(PROGRESSO_FILE)) fs.unlinkSync(PROGRESSO_FILE);
}

// -------------------------------------------------------------
//  HELPERS DE IFRAME
// -------------------------------------------------------------
function principal2(page) {
  return page
    .locator('#iframeasp')
    .contentFrame()
    .locator('iframe[name="principal2"]')
    .contentFrame();
}

function toolbar(page) {
  return page
    .locator('#iframeasp')
    .contentFrame()
    .locator('iframe[name="toolbarMvcToAsp"]')
    .contentFrame();
}

// Polling seguro: tenta encontrar o seletor no iframe a cada 500ms
// Retorna true se encontrou, false se esgotou o tempo — nunca lança exceção
async function esperarElemento(page, seletor, timeoutMs = 20000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      const count = await principal2(page).locator(seletor).count();
      if (count > 0) return true;
    } catch (_) {
      // iframe ainda não disponível — tenta novamente
    }
    await page.waitForTimeout(500);
  }
  return false;
}

// -------------------------------------------------------------
//  NAVEGAÇÃO PARA TELA DE BUSCA
// -------------------------------------------------------------
async function irParaCadastro(page) {
  await page.getByRole('link', { name: 'Cadastro de Material e' }).click();

  console.log('   ⏳ Aguardando tela de busca carregar...');
  const carregou = await esperarElemento(page, '#ind_tipo_mat_med', 20000);

  if (!carregou) {
    throw new Error('Tela de Cadastro de Material e Medicamento não carregou dentro do tempo esperado.');
  }

  await page.waitForTimeout(600);
  console.log('   ✔  Tela de busca pronta.');
}

// -------------------------------------------------------------
//  PARAMETRIZAÇÃO DO FORMULÁRIO (reutilizável)
// -------------------------------------------------------------
async function parametrizarFormulario(page) {
  const frame = principal2(page);

  // Marca "técnica / administrativa"
  const radioTecnica = frame
    .getByRole('cell', { name: 'técnica / administrativa' })
    .locator('#ind_autorizacao');
  await radioTecnica.scrollIntoViewIfNeeded();
  const jaMarcado = await radioTecnica.isChecked();
  if (!jaMarcado) {
    await radioTecnica.check();
    await page.waitForTimeout(300);
  }

  // Limpa campos de código de referência (depara)
  const camposLimpar = [
    '#COD_DEPARA_BRASINDICE',
    '#COD_DEPARA_SIMPRO',
    '#COD_DEPARA_PTU',
    '#COD_DEPARA_TUSS_MED',
    '#COD_DEPARA_TUSS_MAT',
  ];
  for (const seletor of camposLimpar) {
    try {
      const campo = principal2(page).locator(seletor);
      if (await campo.count() > 0) {
        await campo.scrollIntoViewIfNeeded();
        await campo.clear();
      }
    } catch (_) {}
  }
}

// -------------------------------------------------------------
//  RELOGIN AUTOMÁTICO
// -------------------------------------------------------------
async function relogarSeNecessario(page) {
  const url = page.url();
  if (!url.includes('Login')) return false;

  console.log('   ⚠️  Sessão expirada — realizando login novamente...');
  await page.getByRole('textbox', { name: 'Usuário' }).fill(USUARIO);
  await page.getByRole('textbox', { name: 'Senha'   }).fill(SENHA);
  await page.getByRole('button',  { name: 'Entrar'  }).click();
  await page.waitForLoadState('networkidle');

  // Renavega até o menu
  await page.getByRole('link', { name: ' Honorários, Serviços e' }).click();
  await page.getByRole('link', { name: ' Material / Medicamento'  }).click();
  await irParaCadastro(page);

  console.log('   ✔  Login refeito. Retomando execução...');
  return true;
}

// -------------------------------------------------------------
//  AUTOMAÇÃO PRINCIPAL
// -------------------------------------------------------------
async function main() {
  if (!USUARIO || !SENHA) {
    throw new Error('Credenciais não encontradas. Verifique o arquivo .env (USUARIO e SENHA).');
  }

  const registros = lerPlanilha();
  const progresso  = carregarProgresso();
  const iniciarEm  = progresso.ultimoIndice + 1;

  console.log(`\n📋 ${registros.length} registros carregados da planilha.`);

  if (iniciarEm > 0) {
    console.log(`⏭️  Retomando a partir do registro ${iniciarEm + 1} (${iniciarEm} já processados).`);
    console.log(`   Para reiniciar do zero, delete o arquivo: logs/progresso.json\n`);
  } else {
    console.log(`🆕 Nenhum progresso anterior encontrado. Iniciando do zero.\n`);
  }

  console.log(`📄 Log será gravado em: ${LOG_FILE}\n`);
  iniciarLog();

  const browser = await chromium.launch({ headless: false, slowMo: 0 });
  const context = await browser.newContext();
  const page    = await context.newPage();

  try {
    // ----- LOGIN -----
    console.log('🔐 Realizando login...');
    await page.goto(URL_LOGIN);
    await page.getByRole('textbox', { name: 'Usuário' }).fill(USUARIO);
    await page.getByRole('textbox', { name: 'Senha'   }).fill(SENHA);
    await page.getByRole('button',  { name: 'Entrar'  }).click();
    await page.waitForLoadState('networkidle');
    console.log('✅ Login realizado.\n');

    // ----- NAVEGAÇÃO INICIAL AO MENU -----
    await page.getByRole('link', { name: ' Honorários, Serviços e' }).click();
    await page.getByRole('link', { name: ' Material / Medicamento'  }).click();
    await irParaCadastro(page);

  } catch (e) {
    console.error('❌ Falha na inicialização (login ou navegação):', e.message);
    await browser.close();
    process.exit(1);
  }

  // ----- LOOP POR REGISTROS -----
  let sucesso = 0, erro = 0, ignorado = 0;

  for (let i = 0; i < registros.length; i++) {
    const { codigo, tipo } = registros[i];
    const indice = TIPO_MAP[tipo];
    console.log(`\n[${i + 1}/${registros.length}] Processando: ${codigo} | ${tipo}`);

    // Pula registros já processados em execução anterior
    if (i < iniciarEm) {
      process.stdout.write(`\r   ⏭️  Pulando registros já processados... ${i + 1}/${iniciarEm}`);
      continue;
    }
    if (i === iniciarEm && iniciarEm > 0) console.log(''); // quebra linha do progresso acima

    // Verifica se a sessão expirou antes de cada registro
    try {
      await relogarSeNecessario(page);
    } catch (e) {
      registrarLog(codigo, tipo, 'ERRO', 'Falha ao tentar relogar: ' + e.message.slice(0, 80));
      erro++;
      continue;
    }

    if (indice === undefined) {
      registrarLog(codigo, tipo, 'IGNORADO', `Tipo desconhecido: "${tipo}"`);
      ignorado++;
      continue;
    }

    try {
      const frame = principal2(page);

      // 1. Seleciona o tipo
      await frame.locator('#ind_tipo_mat_med').nth(indice).check();

      // 2. Preenche o código e clica na lupa
      await frame.locator('#cod_item_mat_med').fill(codigo);
      await toolbar(page).locator('div').first().click();

      // 3. Aguarda o cadastro abrir — usa cell "técnica / administrativa" como indicador
      //    pois é o elemento definitivo que confirma que o cadastro carregou
      console.log('   ⏳ Aguardando cadastro do item abrir...');
      const cadastroAbriu = await esperarElemento(page, 'td:has(#ind_autorizacao)', 15000);

      if (!cadastroAbriu) {
        registrarLog(codigo, tipo, 'ERRO', 'Cadastro não encontrado ou não abriu após pesquisa');
        erro++;
        await irParaCadastro(page);
        continue;
      }

      await page.waitForTimeout(400);
      const framePos = principal2(page);

      // 4. Marca técnica/administrativa e limpa campos de referência (depara)
      await parametrizarFormulario(page);

      // 5. Salva
      await toolbar(page).locator('#btn_acao_alterar > img').click();

      // 9. Aguarda a resposta do servidor via polling —
      //    verifica a cada 500ms por até 15s se a mensagem de sucesso ou erro apareceu
      //    Tratativas especiais:
      //    - "Descrição já cadastrada" → acrescenta "_" à descrição e salva novamente
      //    - "Referência do fabricante e ANVISA já cadastrado" → limpa campos e salva novamente
      console.log('   ⏳ Aguardando confirmação do servidor...');
      let msgSucesso = false;
      let msgErroTexto = '';

      // Ações obrigatórias antes de qualquer tentativa de salvar:
      // marca Técnica/Administrativa e limpa campos "depara"
      async function prepararFormulario() {
        const framePre = principal2(page);

        // Marca "técnica / administrativa"
        const radioTecnicaPre = framePre
          .getByRole('cell', { name: 'técnica / administrativa' })
          .locator('#ind_autorizacao');
        await radioTecnicaPre.scrollIntoViewIfNeeded();
        const jaMarcadoPre = await radioTecnicaPre.isChecked();
        if (!jaMarcadoPre) {
          await radioTecnicaPre.check();
          await page.waitForTimeout(300);
        }

        // Limpa campos "depara"
        const camposLimparPre = [
          '#COD_DEPARA_BRASINDICE',
          '#COD_DEPARA_SIMPRO',
          '#COD_DEPARA_PTU',
          '#COD_DEPARA_TUSS_MED',
          '#COD_DEPARA_TUSS_MAT',
        ];
        for (const seletor of camposLimparPre) {
          try {
            const campo = principal2(page).locator(seletor);
            if (await campo.count() > 0) {
              await campo.scrollIntoViewIfNeeded();
              await campo.clear();
            }
          } catch (_) {}
        }
      }

      // Aguarda a mensagem atual desaparecer da tela antes de iniciar novo polling.
      // Necessário nas retentativas para evitar capturar a mensagem de erro anterior.
      async function aguardarLimpezaTela(textoAnterior, timeoutMs = 5000) {
        if (!textoAnterior) return;
        const inicio = Date.now();
        while (Date.now() - inicio < timeoutMs) {
          try {
            const frameCheck = principal2(page);
            const ainda = await frameCheck
              .getByText(textoAnterior, { exact: false })
              .count();
            if (ainda === 0) return;
          } catch (_) {}
          await page.waitForTimeout(300);
        }
      }

      async function tentarSalvar(textoAnterior = '') {
        // Se houver mensagem anterior visível, aguarda ela sumir antes de fazer polling
        await aguardarLimpezaTela(textoAnterior);

        const inicioTentativa = Date.now();
        while (Date.now() - inicioTentativa < 15000) {
          try {
            const frameResult = principal2(page);

            const countSucesso = await frameResult
              .getByText('Operação realizada com sucesso')
              .count();

            if (countSucesso > 0) {
              return { sucesso: true, msg: '' };
            }

            const countErro = await frameResult
              .locator('.alert, .error, [class*="erro"], [class*="msg"]')
              .count();

            if (countErro > 0) {
              const txt = await frameResult
                .locator('.alert, .error, [class*="erro"], [class*="msg"]')
                .first()
                .textContent()
                .catch(() => '');

              if (txt.trim()) {
                if (txt.toLowerCase().includes('sucesso')) {
                  return { sucesso: true, msg: '' };
                }
                return { sucesso: false, msg: txt.trim() };
              }
            }
          } catch (_) {
            // iframe em transição — aguarda e tenta novamente
          }
          await page.waitForTimeout(500);
        }
        return { sucesso: false, msg: 'Timeout: resposta do servidor não detectada' };
      }

      // Primeira tentativa de salvar
      let resultado = await tentarSalvar();

      // Tratativa 1: "Descrição já cadastrada para o código X"
      if (!resultado.sucesso && resultado.msg.toLowerCase().includes('descrição já cadastrada')) {
        console.log('   ⚠️  Descrição duplicada — acrescentando "_" e salvando novamente...');
        try {
          const frameDesc = principal2(page);
          const campoDesc = frameDesc.locator('#desc_item');
          await campoDesc.scrollIntoViewIfNeeded();
          const descAtual = await campoDesc.inputValue();
          await campoDesc.fill(descAtual + '_');
          await parametrizarFormulario(page);
          await toolbar(page).locator('#btn_acao_alterar > img').click();
          resultado = await tentarSalvar(resultado.msg);
        } catch (eTrat) {
          resultado = { sucesso: false, msg: 'Erro ao tratar descrição duplicada: ' + eTrat.message.slice(0, 80) };
        }
      }

      // Tratativa 2: "Referência do fabricante e ANVISA já cadastrado para o código XXXXXXXX"
      if (!resultado.sucesso && resultado.msg.toLowerCase().includes('referência do fabricante') && resultado.msg.toLowerCase().includes('anvisa')) {
        console.log('   ⚠️  Referência/ANVISA duplicada — limpando campos e salvando novamente...');
        try {
          const frameRef = principal2(page);
          const campoFab    = frameRef.locator('#cod_ref_fabricante');
          const campoAnvisa = frameRef.locator('#cod_ministerio_saude');
          if (await campoFab.count()    > 0) { await campoFab.scrollIntoViewIfNeeded();    await campoFab.clear(); }
          if (await campoAnvisa.count() > 0) { await campoAnvisa.scrollIntoViewIfNeeded(); await campoAnvisa.clear(); }
          await parametrizarFormulario(page);
          await toolbar(page).locator('#btn_acao_alterar > img').click();
          resultado = await tentarSalvar(resultado.msg);
        } catch (eTrat) {
          resultado = { sucesso: false, msg: 'Erro ao tratar referência/ANVISA duplicada: ' + eTrat.message.slice(0, 80) };
        }
      }

      msgSucesso   = resultado.sucesso;
      msgErroTexto = resultado.msg;

      if (msgSucesso) {
        registrarLog(codigo, tipo, 'SUCESSO');
        salvarProgresso(i);
        sucesso++;
      } else {
        registrarLog(codigo, tipo, 'ERRO', msgErroTexto || 'Timeout: resposta do servidor não detectada');
        erro++;
      }

      // 10. Se houve erro, volta para a tela de busca.
      //    Se foi sucesso, a própria tela já está limpa para o próximo registro.
      if (!msgSucesso) {
        await irParaCadastro(page);
      }

    } catch (e) {
      registrarLog(codigo, tipo, 'ERRO', e.message.replace(/\n/g, ' ').slice(0, 120));
      erro++;
      try {
        await relogarSeNecessario(page);
        await irParaCadastro(page);
      } catch (e2) {
        console.error('❌ Erro ao tentar voltar ao cadastro:', e2.message);
      }
    }
  }

  // ----- RESUMO FINAL -----
  // Execução completa — remove arquivo de progresso
  resetarProgresso();
  console.log('\n' + '='.repeat(55));
  console.log('  RESUMO DA EXECUÇÃO');
  console.log('='.repeat(55));
  console.log(`  Total processado : ${registros.length}`);
  console.log(`  ✅ Sucesso        : ${sucesso}`);
  console.log(`  ❌ Erro           : ${erro}`);
  console.log(`  ⚠️  Ignorado       : ${ignorado}`);
  console.log(`  📄 Log salvo em   : ${LOG_FILE}`);
  console.log('='.repeat(55) + '\n');

  await browser.close();
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});