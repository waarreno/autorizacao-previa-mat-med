# Autorização Prévia — Parametrização de Materiais e Medicamentos

Automação web para parametrização em lote do campo **Autorização Prévia** no cadastro de Materiais e Medicamentos, com base em planilha Excel.

> Copyright (c) 2026 Wárreno Hendrick Costa Lima Guimarães  
> Unimed Cerrado — Coordenação de Contas Médicas  
> Versão: 1.0.0

---

## Descrição

A aplicação lê uma planilha Excel contendo códigos de materiais e medicamentos e seus respectivos tipos (PTU, TUSS Materiais ou TUSS Medicamentos), acessa o sistema de gestão via navegador e parametriza automaticamente a opção **Técnica/Administrativa** no campo de Autorização Prévia de cada cadastro.

A execução pode ser interrompida e retomada a qualquer momento, sem perda do progresso já realizado.

---

## Estrutura do Projeto

```
autorizacao-previa-mat-med/
├── dados/
│   └── base.xlsx              # Planilha de entrada (não versionada)
├── logs/
│   ├── execucao_*.csv         # Histórico de execuções (não versionado)
│   └── progresso.json         # Controle de retomada (não versionado)
├── scripts/
│   └── automacao.js           # Script principal
├── .env                       # Credenciais de acesso (não versionado)
├── .gitignore
├── package.json
├── README.md
├── 1_instalar.bat             # Instalação de dependências
├── 2_executar.bat             # Execução da automação
└── 3_limpar.bat               # Limpeza de dependências
```

---

## Pré-requisitos

- Windows 10 ou superior
- Node.js v22.x ou superior (ou deixar o instalador baixar automaticamente)
- Conexão com a internet (para instalação e execução)

---

## Instalação

1. Copie a pasta `autorizacao-previa-mat-med/` para o local desejado
2. Crie o arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
USUARIO=seu_usuario
SENHA=sua_senha
```

3. Execute o arquivo `1_instalar.bat`

O instalador irá:
- Verificar se o Node.js está disponível (global ou portável)
- Baixar o Node.js portável automaticamente caso não esteja instalado
- Instalar as dependências do projeto (`playwright`, `xlsx`, `dotenv`)
- Instalar o navegador Chromium
- Criar as pastas `dados/` e `logs/` se não existirem

---

## Planilha de Entrada

Coloque o arquivo `base.xlsx` na pasta `dados/`. A planilha deve seguir o formato:

| Coluna A | Coluna B |
|---|---|
| Código (8 dígitos) | Tipo |

Valores aceitos na coluna B:

| Valor | Tipo no sistema |
|---|---|
| `PTU` | PTU (Intercâmbio) |
| `TUSS MATERIAIS` | TUSS (materiais) |
| `TUSS MEDICAMENTOS` | TUSS (medicamentos) |

> A linha 1 deve conter o cabeçalho. Os dados começam a partir da linha 2.

---

## Execução

1. Certifique-se de que `dados/base.xlsx` está presente
2. Execute o arquivo `2_executar.bat`

O navegador abrirá automaticamente. O progresso é exibido no terminal em tempo real.

Para interromper a execução: **Ctrl + C**

### Retomada automática

Ao interromper ou em caso de falha, o arquivo `logs/progresso.json` registra o último registro processado com sucesso. Na próxima execução, o script retoma automaticamente do ponto onde parou.

Para reiniciar do zero, delete o arquivo `logs/progresso.json` antes de executar.

---

## Log de Execução

A cada execução é gerado um arquivo CSV em `logs/` com o nome `execucao_YYYY-MM-DDTHH-MM-SS.csv`, contendo:

| Campo | Descrição |
|---|---|
| `codigo` | Código do material ou medicamento |
| `tipo` | Tipo informado na planilha |
| `resultado` | `SUCESSO`, `ERRO` ou `IGNORADO` |
| `observacao` | Mensagem de erro ou observação, quando aplicável |

O arquivo pode ser aberto diretamente no Excel.

---

## Limpeza

Para remover as dependências instaladas (node_modules, node_portavel), execute `3_limpar.bat`.

Os arquivos de log, a planilha e as credenciais são preservados.

---

## Versionamento

| Versão | Descrição |
|---|---|
| 0.1.0 | Script inicial — leitura da planilha, login, loop básico, log CSV |
| 0.2.0 | Polling seguro substituindo waitFor rígido |
| 0.3.0 | Correção do strict mode violation + scroll até o campo |
| 0.4.0 | Seletor preciso do botão salvar |
| 0.5.0 | Polling na verificação da mensagem de sucesso pós-salvar |
| 0.6.0 | Correção do falso negativo na detecção de sucesso |
| 0.7.0 | Relogin automático por queda de sessão |
| 0.8.0 | Eliminação da navegação desnecessária após sucesso |
| 0.9.0 | Controle de progresso e retomada entre sessões |
| 1.0.0 | Nomenclatura, copyright, versionamento, arquivos .bat e README |

---

## Observações

- A execução ocorre com o navegador visível (`headless: false`) por padrão, permitindo acompanhamento visual. Para execução mais rápida em segundo plano, altere para `headless: true` e `slowMo: 0` em `scripts/automacao.js`.
- Registros com tipo desconhecido são marcados como `IGNORADO` no log e não interrompem a execução.
- Em caso de queda de sessão, o relogin é realizado automaticamente e a execução é retomada no registro seguinte.