/**
 * INSTALADOR DO MÓDULO "DÚVIDAS FISCAIS" — SOFTSHOP + SOFTCOMSHOP
 *
 * Como rodar:
 *   1. Acesse https://nexus-theta-blush.vercel.app (logado)
 *   2. Abra o DevTools (F12) → aba Console
 *   3. Cole TODO o conteúdo deste arquivo e dê Enter
 *
 * O script faz POST em /api/products/<slug>/modules/paste pra cada
 * produto. Se o módulo "Dúvidas Fiscais" já existir no produto, ele
 * é REGRAVADO (o endpoint paste apaga e recria pra evitar duplicata).
 */

;(async function installFiscalModule() {
  // ──────────────────────────────────────────────────────────────────────
  // Conteúdo do módulo (replique aqui o JSON do arquivo fiscal-module.json
  // se quiser editar inline). Em produção, faça fetch do arquivo.
  // ──────────────────────────────────────────────────────────────────────
  const FISCAL_MODULE = {
  "name": "Dúvidas Fiscais",
  "type": "instruction",
  "description": "Orientações fiscais de prévia: CFOPs, CST/CSOSN, devoluções, ST, DIFAL, remessas e FAQ. Sempre validar com a contabilidade antes de emitir.",
  "keywords": [
    "fiscal", "cfop", "cst", "csosn", "icms", "st", "substituicao tributaria",
    "devolucao", "difal", "remessa", "transferencia", "venda", "nota fiscal", "nfe"
  ],
  "knowledgeItems": [
    {
      "title": "Devolução de mercadoria — consumidor final Pessoa Física",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "devolucao pf", "devolucao consumidor final", "devolucao pessoa fisica",
        "cfop 1202", "cfop 2202", "nfe entrada devolucao", "cliente devolveu produto"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a operação é dentro do estado (intra) ou para outro estado (inter). CFOP muda em função disso.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "A LOJA é quem emite a NF-e de entrada. O consumidor PF NUNCA emite nota fiscal.", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Emita uma NF-e de entrada com CFOP 1.202 (mesmo estado) ou 2.202 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "No campo destinatário, informe os dados do CPF do cliente.", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Referencie a chave de acesso de 44 dígitos da nota original (NF-e ou NFC-e) no campo NFref.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "Copie NCM, CST/CSOSN, alíquotas e valores da nota original — NÃO recalcule.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Antes de emitir, valide com a contabilidade. Esta é uma orientação de prévia — quem fecha o caso fiscal é o contador.", "orientacao": null, "atalho": null }
        ]
      }
    },
    {
      "title": "Devolução de mercadoria — Pessoa Jurídica SEM substituição tributária",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "devolucao pj", "devolucao empresa", "devolucao sem st",
        "cfop 1202", "cfop 2202", "nota de devolucao"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se é operação dentro do estado (intra) ou interestadual (inter).", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Quem emite a nota é o comprador PJ devolvendo a mercadoria.", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Emita NF-e de saída com CFOP 1.202 (mesmo estado) ou 2.202 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Replique NCM, CST/CSOSN, alíquotas e valores da nota original — não recalcule nada.", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "CFOP invertido: se a nota original tinha 5.xxx, use 1.xxx. Se tinha 6.xxx, use 2.xxx.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "Referencie a chave de acesso de 44 dígitos da nota original no campo NFref.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Antes de emitir, confirme com a contabilidade os valores de imposto a serem estornados. Esta é uma orientação de prévia.", "orientacao": null, "atalho": null }
        ]
      }
    },
    {
      "title": "Devolução de mercadoria — produto COM substituição tributária (ST)",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "devolucao st", "devolucao com substituicao tributaria",
        "cfop 1411", "cfop 2411", "cst 60", "csosn 500",
        "recuperacao icms st", "ressarcimento st"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a operação é dentro do estado (intra) ou para outro estado (inter).", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Use CFOP 1.411 (mesmo estado) ou 2.411 (outro estado) — NÃO use 1.202 ou 2.202.", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "CST/CSOSN: mantenha o mesmo da nota original (CST 60 para LP/LR ou CSOSN 500 para Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "O ICMS-ST já foi recolhido pelo substituto tributário anteriormente.", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Para recuperar o ICMS-ST pago, oriente o cliente a consultar a SEFAZ do estado — cada UF tem um procedimento próprio.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "Referencie a chave de acesso de 44 dígitos da nota original no campo NFref.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Antes de emitir, valide com a contabilidade. Esta é uma orientação de prévia — o contador é quem orienta o caso real.", "orientacao": null, "atalho": null }
        ]
      }
    },
    {
      "title": "Remessa para conserto ou garantia",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "remessa conserto", "remessa garantia", "cfop 5949", "cfop 6949",
        "retorno conserto", "envio para reparo"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Defina se a remessa é dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Emita a NF-e de saída com CFOP 5.949 (mesmo estado) ou 6.949 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "CST/CSOSN: 00 (LP/LR) ou 102/500 (Simples Nacional), conforme regime.", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "No retorno, o destinatário emite NF-e com CFOP 1.949 (mesmo estado) ou 2.949 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Não há transferência de propriedade — em regra, não incide ICMS como fato gerador normal.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "Inclua nas observações do XML: 'Remessa para conserto/garantia — retornará ao remetente'. Quando possível, informe o prazo.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Alguns estados exigem destaque de ICMS mesmo em remessa — confirme com a contabilidade. Esta é uma orientação de prévia.", "orientacao": null, "atalho": null }
        ]
      }
    },
    {
      "title": "Transferência entre filiais da mesma empresa",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "transferencia filial", "transferencia estabelecimento", "cfop 5152", "cfop 6152",
        "adc 49", "mesmo cnpj raiz"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a transferência é dentro do estado ou para outra UF.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Emite NF-e de saída com CFOP 5.152 (mesmo estado) ou 6.152 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Emitente e destinatário devem ter o mesmo CNPJ raiz com Inscrições Estaduais diferentes.", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "CST 00 (LP/LR) ou CSOSN 102 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Após a decisão do STF (ADC 49/2021), o destaque de ICMS na transferência deixou de ser obrigatório como regra geral.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "Mas alguns estados ainda exigem o destaque via convênio — confirme com a contabilidade. Esta é uma orientação de prévia.", "orientacao": null, "atalho": null }
        ]
      }
    },
    {
      "title": "Venda de produto com Substituição Tributária já recolhida",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "venda st", "produto com st", "cfop 5405", "cfop 6404",
        "cst 60", "csosn 500", "st ja paga", "bebida cosmetico cigarro limpeza"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a venda é dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Emite NF-e de saída com CFOP 5.405 (mesmo estado) ou 6.404 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "CST 60 (LP/LR) ou CSOSN 500 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "O ICMS-ST já foi pago pelo substituto (fabricante/importador) anteriormente — o varejista NÃO destaca ICMS na saída.", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Base de cálculo de ICMS-ST e valor do ST ficam zerados na nota.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "PIS/COFINS: verifique se o produto tem regime monofásico (combustíveis, bebidas frias, cosméticos, etc.). Confirme com a contabilidade. Esta é uma orientação de prévia.", "orientacao": null, "atalho": null }
        ]
      }
    },
    {
      "title": "Venda como substituto tributário (quando você gera o ST)",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "substituto tributario", "gerar st", "cfop 5401", "cfop 6401",
        "cst 10", "csosn 201", "csosn 202", "mva", "base de calculo st"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a venda é dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Emite NF-e de saída com CFOP 5.401 (mesmo estado) ou 6.401 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "CST 10 (LP/LR) ou CSOSN 201/202 (Simples Nacional, com ST a recolher).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Calcule a BC-ST: (Valor do produto + Frete + Outras despesas + IPI) × (1 + MVA%) do estado destino.", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "ICMS-ST = (BC-ST × alíquota interna do destino) − ICMS próprio da operação.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "A MVA varia por NCM e por estado — consulte a tabela vigente da SEFAZ destino.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Oriente o cliente a confirmar os valores de ST com a contabilidade antes de emitir. Esta é uma orientação de prévia.", "orientacao": null, "atalho": null }
        ]
      }
    },
    {
      "title": "Venda de produto isento ou não tributado",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "venda isenta", "produto isento", "cfop 5102", "cfop 6102",
        "cst 40", "csosn 103", "nao tributado", "isencao icms"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a venda é dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Emite NF-e com CFOP 5.102 (mesmo estado) ou 6.102 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "CST 40 (LP/LR) ou CSOSN 103 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "ICMS: sem destaque (isento ou não incidente).", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Verifique se a isenção é prevista em convênio nacional ou lei estadual específica.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "PIS/COFINS: confirme se há alíquota zero ou isenção para o NCM em questão.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Nas observações do XML, inclua o dispositivo legal que ampara a isenção. Confirme com a contabilidade. Esta é uma orientação de prévia.", "orientacao": null, "atalho": null }
        ]
      }
    },
    {
      "title": "Venda padrão — produto tributado normalmente",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "venda padrao", "venda normal", "cfop 5102", "cfop 6102",
        "cst 00", "csosn 102", "pgdas", "aliquota efetiva"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a venda é dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Emite NF-e com CFOP 5.102 (mesmo estado) ou 6.102 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "CST 00 (LP/LR) ou CSOSN 102 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Destaque o ICMS pela alíquota aplicável ao estado de destino.", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Simples Nacional: a alíquota é a efetiva do PGDAS — NÃO use a alíquota padrão do estado.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "PIS/COFINS: verifique o regime do produto (monofásico, cumulativo ou não cumulativo).", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Verifique se há redução de base de cálculo ou benefício fiscal previsto para o NCM no estado. Confirme com a contabilidade. Esta é uma orientação de prévia.", "orientacao": null, "atalho": null }
        ]
      }
    },
    {
      "title": "Venda interestadual para consumidor final PF (DIFAL)",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "difal", "venda interestadual pf", "consumidor final outro estado",
        "diferencial de aliquota", "cfop 6102", "cgsn 140"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Identifique: venda para outro estado, destinatário consumidor final Pessoa Física.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "CFOP 6.102, CST 00 (LP/LR) ou CSOSN 102 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Atenção ao DIFAL — Diferencial de Alíquota — devido ao estado de destino.", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Fórmula: DIFAL = (alíquota interna do estado destino − alíquota interestadual) × base de cálculo.", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Alíquota interestadual: 7% se destino é Norte/Nordeste/Centro-Oeste; 12% se Sul/Sudeste.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "Simples Nacional: pela Resolução CGSN 140/2018 também recolhe DIFAL, mas alguns estados não exigem — verifique convênio vigente no destino.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Preencha corretamente os campos de DIFAL na NF-e. Confirme com a contabilidade. Esta é uma orientação de prévia.", "orientacao": null, "atalho": null }
        ]
      }
    },
    {
      "title": "Cancelamento de NF-e após 24 horas",
      "type": "error",
      "is_active": true,
      "keywords": [
        "cancelar nfe", "cancelamento apos 24h", "prazo cancelamento",
        "sefaz rejeitou cancelamento", "como cancelar nota"
      ],
      "content": {
        "type": "error",
        "error_code": null,
        "description": "Cliente tenta cancelar uma NF-e após o prazo de 24 horas da autorização e a SEFAZ rejeita.",
        "cause": "A SEFAZ permite cancelamento de NF-e apenas dentro de 24 horas após a autorização. Após esse prazo, o pedido é rejeitado.",
        "solution": "Se ainda estiver dentro de 24 horas: no sistema, acesse a NF-e, escolha a opção Cancelar e informe uma justificativa com pelo menos 15 caracteres. Se já passou de 24 horas, NÃO há mais cancelamento — a única opção é emitir uma NF-e de devolução (entrada) com o CFOP correto referenciando a nota original (1.202/2.202 para devolução padrão; 1.411/2.411 quando havia ST). Use o módulo de devolução para orientar o CFOP correto. Antes de emitir, valide com a contabilidade. Esta é uma orientação de prévia.",
        "orientation": null
      }
    },
    {
      "title": "Diferença entre CFOP 1.202 e CFOP 5.202",
      "type": "error",
      "is_active": true,
      "keywords": [
        "diferenca 1202 5202", "cfop entrada saida devolucao",
        "qual cfop usar devolucao", "1202 ou 5202"
      ],
      "content": {
        "type": "error",
        "error_code": null,
        "description": "Cliente em dúvida sobre quando usar CFOP 1.202 e quando usar CFOP 5.202.",
        "cause": "Confusão entre devolução recebida (entrada) e devolução feita ao fornecedor (saída).",
        "solution": "Regra mnemônica: 1 = entrada de mercadoria; 5 = saída de mercadoria. CFOP 1.202: a loja está RECEBENDO de volta uma mercadoria que vendeu. Quem emite é o cliente PJ que está devolvendo; para o sistema da loja, é entrada. CFOP 5.202: a loja está DEVOLVENDO ao fornecedor uma mercadoria que comprou; quem emite é a própria loja; é saída de mercadoria. Pergunta-chave: quem está emitindo e para onde vai a mercadoria? Valide com a contabilidade. Esta é uma orientação de prévia.",
        "orientation": null
      }
    },
    {
      "title": "Diferença entre CSOSN 102 e CSOSN 500",
      "type": "error",
      "is_active": true,
      "keywords": [
        "csosn 102", "csosn 500", "diferenca csosn", "simples nacional codigos",
        "qual csosn usar", "csosn produto com st"
      ],
      "content": {
        "type": "error",
        "error_code": null,
        "description": "Cliente do Simples Nacional em dúvida sobre qual CSOSN usar em produtos com ou sem Substituição Tributária.",
        "cause": "Confusão entre operação tributada normal pelo Simples e operação com ICMS-ST já recolhido anteriormente.",
        "solution": "CSOSN 102 — tributada pelo Simples Nacional, sem permissão de crédito ao destinatário. Use para produtos SEM ST; o ICMS está incluído no DAS. O comprador PJ não pode aproveitar crédito desta nota. CSOSN 500 — ICMS cobrado anteriormente por substituição ou antecipação. Use para produtos COM ST já paga (fabricante/distribuidor já recolheu). Varejistas do Simples Nacional revendendo bebidas, cosméticos, limpeza, cigarros etc. costumam usar CSOSN 500 — não destaca ICMS na nota. Regra rápida: produto veio na nota de compra com CSOSN 500 ou CST 60? Vende com 500. Se não tinha ST, usa 102. Confirme com a contabilidade. Esta é uma orientação de prévia.",
        "orientation": null
      }
    },
    {
      "title": "DIFAL — Diferencial de Alíquota (entendimento geral)",
      "type": "error",
      "is_active": true,
      "keywords": [
        "o que e difal", "diferencial aliquota explicacao",
        "como calcular difal", "difal simples nacional"
      ],
      "content": {
        "type": "error",
        "error_code": null,
        "description": "Dúvida geral sobre o que é DIFAL, quando incide e como calcular.",
        "cause": "Vendas interestaduais para consumidor final (PJ não contribuinte ou PF) geram a obrigação de recolher a diferença entre a alíquota interna do destino e a interestadual — esse valor é o DIFAL.",
        "solution": "DIFAL = (alíquota interna do estado destino − alíquota interestadual) × base de cálculo. Alíquota interestadual: 7% (destino Norte/Nordeste/Centro-Oeste) ou 12% (Sul/Sudeste). Simples Nacional: a Resolução CGSN 140/2018 prevê o recolhimento do DIFAL pelo SN, mas alguns estados não cobram — verifique se o estado de destino tem convênio vigente. A NF-e precisa ter os campos de DIFAL preenchidos quando aplicável. É um tema de alta complexidade — sempre confirme com a contabilidade o cálculo correto. Esta é uma orientação de prévia.",
        "orientation": null
      }
    },
    {
      "title": "Checklist de atendimento fiscal",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "checklist fiscal", "passo a passo atendimento fiscal",
        "validacao atendimento fiscal", "lista verificacao fiscal"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "IDENTIFICAÇÃO: confirme o regime tributário do cliente (Simples Nacional / Lucro Presumido / Lucro Real / MEI).", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "IDENTIFICAÇÃO: confirme se a operação é dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "IDENTIFICAÇÃO: verifique se o produto tem Substituição Tributária (ST).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "IDENTIFICAÇÃO: identifique o destinatário (PJ contribuinte, PJ não contribuinte, consumidor final PF).", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "DADOS FISCAIS: oriente o CFOP correto com base no cenário.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "DADOS FISCAIS: oriente o CST/CSOSN apropriado.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "DADOS FISCAIS: informe alíquota de ICMS de referência com a ressalva de validação.", "orientacao": null, "atalho": null },
          { "passo": 8, "acao": "DADOS FISCAIS: verifique PIS/COFINS (monofásico, isento, normal).", "orientacao": null, "atalho": null },
          { "passo": 9, "acao": "DADOS FISCAIS: alerte sobre IPI se aplicável (prazo de 15 dias para devolução).", "orientacao": null, "atalho": null },
          { "passo": 10, "acao": "DEVOLUÇÃO (se aplicável): confirme que o cliente tem a chave de acesso da NF original (44 dígitos).", "orientacao": null, "atalho": null },
          { "passo": 11, "acao": "DEVOLUÇÃO (se aplicável): verifique se o CFOP foi invertido corretamente (5→1 ou 6→2).", "orientacao": null, "atalho": null },
          { "passo": 12, "acao": "DEVOLUÇÃO (se aplicável): reforce que dados fiscais devem ser replicados da nota original.", "orientacao": null, "atalho": null },
          { "passo": 13, "acao": "DEVOLUÇÃO (se aplicável): verifique se é cancelamento (24h) ou devolução (após 24h).", "orientacao": null, "atalho": null },
          { "passo": 14, "acao": "ENCERRAMENTO: informe ao cliente que ele DEVE validar com a contabilidade antes de emitir.", "orientacao": null, "atalho": null },
          { "passo": 15, "acao": "ENCERRAMENTO: use o tom de prévia — NÃO afirme que algo está 100% certo do ponto de vista fiscal.", "orientacao": null, "atalho": null },
          { "passo": 16, "acao": "ENCERRAMENTO: registre o atendimento com as orientações dadas.", "orientacao": null, "atalho": null },
          { "passo": 17, "acao": "ENCERRAMENTO: anote dúvidas recorrentes para incluir no FAQ interno.", "orientacao": null, "atalho": null }
        ]
      }
    }
  ]
}


  if (!FISCAL_MODULE) {
    console.error('[install-fiscal] Variável FISCAL_MODULE vazia. Cole o JSON do arquivo fiscal-module.json no lugar de /*FISCAL_MODULE_JSON_HERE*/.')
    return
  }

  const PRODUCTS = ['softshop', 'softcomshop']
  const results = []

  for (const slug of PRODUCTS) {
    console.log(`[install-fiscal] Instalando em "${slug}"…`)
    try {
      const res = await fetch(`/api/products/${slug}/modules/paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ modules: [FISCAL_MODULE] }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        console.log(`[install-fiscal] ✅ ${slug}:`, data)
        results.push({ slug, ok: true, data })
      } else {
        console.error(`[install-fiscal] ❌ ${slug} (${res.status}):`, data)
        results.push({ slug, ok: false, status: res.status, data })
      }
    } catch (err) {
      console.error(`[install-fiscal] ❌ ${slug}:`, err)
      results.push({ slug, ok: false, error: String(err) })
    }
  }

  console.log('[install-fiscal] Resumo:', results)
  const okCount = results.filter((r) => r.ok).length
  if (okCount === PRODUCTS.length) {
    alert(`✅ Módulo "Dúvidas Fiscais" instalado nos ${okCount} produtos.`)
  } else {
    alert(`⚠ Instalação parcial: ${okCount}/${PRODUCTS.length}. Veja o console pra detalhes.`)
  }
})()
