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
  const FISCAL_MODULE = {
  "name": "Dúvidas Fiscais",
  "type": "instruction",
  "description": "Orientações fiscais de prévia: CFOPs, CST/CSOSN, devoluções, ST, DIFAL, remessas e cancelamento. Sempre validar com a contabilidade antes de emitir.",
  "keywords": [
    "fiscal", "cfop", "cst", "csosn", "icms", "st", "substituicao tributaria",
    "devolucao", "difal", "remessa", "transferencia", "venda", "nota fiscal", "nfe"
  ],
  "knowledgeItems": [
    {
      "title": "Emitir devolução de mercadoria para consumidor final (Pessoa Física)",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "devolucao pessoa fisica", "devolucao consumidor final", "devolucao cpf",
        "cfop 1202", "cfop 2202", "cliente devolveu produto"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a operação é dentro do estado ou interestadual.", "orientacao": "O CFOP muda conforme a UF do destino.", "atalho": null },
          { "passo": 2, "acao": "A loja emite a NF-e de entrada — o consumidor PF não emite nota.", "orientacao": "Pessoa Física nunca emite nota fiscal; quem registra a operação é o estabelecimento.", "atalho": null },
          { "passo": 3, "acao": "Use CFOP 1.202 (mesmo estado) ou 2.202 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Preencha o CPF do cliente no campo destinatário da NF-e.", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Referencie a chave de 44 dígitos da nota original no campo NFref.", "orientacao": "A chave fica impressa no DANFE da NF-e ou NFC-e original.", "atalho": null },
          { "passo": 6, "acao": "Copie NCM, CST/CSOSN, alíquotas e valores da nota original.", "orientacao": "Não recalcule nada — os dados fiscais devem ser idênticos aos da nota de venda.", "atalho": null },
          { "passo": 7, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — quem fecha o caso fiscal é o contador.", "atalho": null }
        ]
      }
    },
    {
      "title": "Emitir devolução de mercadoria para Pessoa Jurídica (sem ST)",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "devolucao pj", "devolucao empresa", "devolucao sem st",
        "cfop 1202", "cfop 2202", "nota de devolucao pj"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a operação é dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Quem emite a nota é o comprador PJ devolvendo a mercadoria.", "orientacao": "Diferente do caso PF, a empresa que comprou e devolve emite a nota de devolução.", "atalho": null },
          { "passo": 3, "acao": "Use CFOP 1.202 (mesmo estado) ou 2.202 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Inverta o CFOP da venda original.", "orientacao": "Se a nota original era 5.xxx use 1.xxx; se era 6.xxx use 2.xxx.", "atalho": null },
          { "passo": 5, "acao": "Replique NCM, CST/CSOSN, alíquotas e valores da nota original.", "orientacao": "Não recalcule — os dados fiscais devem ser idênticos aos da nota de venda.", "atalho": null },
          { "passo": 6, "acao": "Referencie a chave de 44 dígitos da nota original no campo NFref.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — confirme com o contador os valores de imposto a estornar.", "atalho": null }
        ]
      }
    },
    {
      "title": "Emitir devolução de mercadoria com Substituição Tributária (ST)",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "devolucao st", "devolucao com substituicao tributaria",
        "cfop 1411", "cfop 2411", "cst 60", "csosn 500",
        "recuperar icms st", "ressarcimento st"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a operação é dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Use CFOP 1.411 (mesmo estado) ou 2.411 (outro estado).", "orientacao": "NÃO use 1.202 ou 2.202 — em devolução com ST o CFOP é específico.", "atalho": null },
          { "passo": 3, "acao": "Mantenha o CST/CSOSN da nota original.", "orientacao": "CST 60 para Lucro Presumido/Real ou CSOSN 500 para Simples Nacional.", "atalho": null },
          { "passo": 4, "acao": "Lembre que o ICMS-ST já foi recolhido pelo substituto tributário.", "orientacao": "O imposto já foi pago lá atrás, antes da venda chegar ao varejo.", "atalho": null },
          { "passo": 5, "acao": "Para recuperar o ICMS-ST pago, oriente consultar a SEFAZ do estado.", "orientacao": "Cada UF tem um procedimento próprio para restituição.", "atalho": null },
          { "passo": 6, "acao": "Referencie a chave de 44 dígitos da nota original no campo NFref.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — quem fecha o caso fiscal é o contador.", "atalho": null }
        ]
      }
    },
    {
      "title": "Emitir remessa para conserto ou garantia",
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
          { "passo": 2, "acao": "Emita NF-e de saída com CFOP 5.949 (mesmo estado) ou 6.949 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Use CST 00 (LP/LR) ou CSOSN 102/500 (Simples Nacional).", "orientacao": "Conforme o regime tributário da empresa que emite.", "atalho": null },
          { "passo": 4, "acao": "No retorno, o destinatário emite NF-e com CFOP 1.949 (mesmo estado) ou 2.949 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Em regra, não há fato gerador de ICMS.", "orientacao": "Como não há transferência de propriedade, não incide ICMS pela lógica normal — mas alguns estados exigem destaque.", "atalho": null },
          { "passo": 6, "acao": "Inclua nas observações do XML o motivo da remessa.", "orientacao": "Ex: 'Remessa para conserto/garantia — retornará ao remetente'. Quando possível, informe o prazo.", "atalho": null },
          { "passo": 7, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — alguns estados exigem destaque de ICMS mesmo em remessa.", "atalho": null }
        ]
      }
    },
    {
      "title": "Emitir transferência de mercadoria entre filiais da mesma empresa",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "transferencia filial", "transferencia estabelecimento", "cfop 5152", "cfop 6152",
        "adc 49", "mesmo cnpj raiz"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se é transferência dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Emita NF-e de saída com CFOP 5.152 (mesmo estado) ou 6.152 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Verifique se emitente e destinatário têm o mesmo CNPJ raiz.", "orientacao": "Inscrições Estaduais diferentes, mas raiz do CNPJ idêntica.", "atalho": null },
          { "passo": 4, "acao": "Use CST 00 (LP/LR) ou CSOSN 102 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "Considere a decisão do STF na ADC 49/2021.", "orientacao": "O destaque de ICMS na transferência deixou de ser obrigatório como regra geral.", "atalho": null },
          { "passo": 6, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — alguns estados ainda exigem destaque por convênio.", "atalho": null }
        ]
      }
    },
    {
      "title": "Emitir venda de produto com ST já recolhida",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "venda com st", "produto com st", "cfop 5405", "cfop 6404",
        "cst 60", "csosn 500", "st ja paga", "bebida cosmetico cigarro limpeza"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme se a venda é dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Use CFOP 5.405 (mesmo estado) ou 6.404 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Use CST 60 (LP/LR) ou CSOSN 500 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Não destaque ICMS na saída.", "orientacao": "O imposto já foi recolhido pelo substituto (fabricante/importador); o varejista não destaca.", "atalho": null },
          { "passo": 5, "acao": "Deixe Base de Cálculo de ICMS-ST e valor do ST zerados.", "orientacao": "Esses campos só são preenchidos quando o emitente é o substituto que está gerando o ST.", "atalho": null },
          { "passo": 6, "acao": "Verifique se o produto tem PIS/COFINS no regime monofásico.", "orientacao": "Comum em combustíveis, bebidas frias, cosméticos e medicamentos.", "atalho": null },
          { "passo": 7, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — quem fecha o caso fiscal é o contador.", "atalho": null }
        ]
      }
    },
    {
      "title": "Emitir venda como substituto tributário (gerar o ST)",
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
          { "passo": 2, "acao": "Use CFOP 5.401 (mesmo estado) ou 6.401 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Use CST 10 (LP/LR) ou CSOSN 201/202 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Calcule a Base de Cálculo do ST.", "orientacao": "BC-ST = (Valor do produto + Frete + Outras despesas + IPI) × (1 + MVA% do estado destino).", "atalho": null },
          { "passo": 5, "acao": "Calcule o ICMS-ST.", "orientacao": "ICMS-ST = (BC-ST × alíquota interna do destino) − ICMS próprio da operação.", "atalho": null },
          { "passo": 6, "acao": "Consulte a MVA vigente para o NCM e estado destino.", "orientacao": "MVA varia por NCM e por UF; usar a tabela da SEFAZ do estado de destino.", "atalho": null },
          { "passo": 7, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — confirme com o contador os valores de ST.", "atalho": null }
        ]
      }
    },
    {
      "title": "Emitir venda de produto isento ou não tributado",
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
          { "passo": 2, "acao": "Use CFOP 5.102 (mesmo estado) ou 6.102 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Use CST 40 (LP/LR) ou CSOSN 103 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Não destaque ICMS na nota.", "orientacao": "Isento ou não incidente conforme o caso.", "atalho": null },
          { "passo": 5, "acao": "Confirme se a isenção é prevista em convênio nacional ou lei estadual.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "Verifique PIS/COFINS para o NCM.", "orientacao": "Confirme se há alíquota zero ou isenção específica para esse produto.", "atalho": null },
          { "passo": 7, "acao": "Inclua o dispositivo legal da isenção nas observações do XML.", "orientacao": "Ex: convênio ICMS XX/XXX, lei estadual nº ... etc.", "atalho": null },
          { "passo": 8, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — quem confirma o dispositivo legal é o contador.", "atalho": null }
        ]
      }
    },
    {
      "title": "Emitir venda padrão (produto tributado normalmente)",
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
          { "passo": 2, "acao": "Use CFOP 5.102 (mesmo estado) ou 6.102 (outro estado).", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Use CST 00 (LP/LR) ou CSOSN 102 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Destaque o ICMS pela alíquota aplicável ao destino.", "orientacao": null, "atalho": null },
          { "passo": 5, "acao": "No Simples Nacional, use a alíquota efetiva do PGDAS.", "orientacao": "Não use a alíquota padrão do estado — a efetiva do PGDAS é diferente e varia mês a mês.", "atalho": null },
          { "passo": 6, "acao": "Verifique PIS/COFINS conforme o regime do produto.", "orientacao": "Monofásico, cumulativo ou não cumulativo conforme NCM.", "atalho": null },
          { "passo": 7, "acao": "Confira se há redução de base de cálculo ou benefício fiscal.", "orientacao": "Alguns NCMs têm benefícios estaduais específicos.", "atalho": null },
          { "passo": 8, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — quem fecha o caso fiscal é o contador.", "atalho": null }
        ]
      }
    },
    {
      "title": "Emitir venda interestadual para consumidor final PF (com DIFAL)",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "difal", "venda interestadual pf", "consumidor final outro estado",
        "diferencial de aliquota", "cfop 6102", "cgsn 140"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Confirme que a venda é interestadual e o destinatário é consumidor final Pessoa Física.", "orientacao": null, "atalho": null },
          { "passo": 2, "acao": "Use CFOP 6.102.", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Use CST 00 (LP/LR) ou CSOSN 102 (Simples Nacional).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Identifique a alíquota interestadual aplicável.", "orientacao": "7% para destino Norte, Nordeste ou Centro-Oeste; 12% para destino Sul ou Sudeste.", "atalho": null },
          { "passo": 5, "acao": "Calcule o DIFAL.", "orientacao": "DIFAL = (alíquota interna do estado destino − alíquota interestadual) × base de cálculo.", "atalho": null },
          { "passo": 6, "acao": "No Simples Nacional, verifique se o estado de destino exige DIFAL.", "orientacao": "A Resolução CGSN 140/2018 prevê o recolhimento, mas alguns estados não cobram. Verifique convênio vigente.", "atalho": null },
          { "passo": 7, "acao": "Preencha os campos de DIFAL na NF-e quando aplicável.", "orientacao": null, "atalho": null },
          { "passo": 8, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — o cálculo do DIFAL tem alta complexidade e o contador confirma os valores.", "atalho": null }
        ]
      }
    },
    {
      "title": "Orientar cancelamento de NF-e (dentro ou fora do prazo de 24h)",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "cancelar nfe", "cancelamento 24h", "prazo cancelamento nota",
        "sefaz rejeitou cancelamento", "como cancelar nota fora do prazo"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Verifique há quanto tempo a NF-e foi autorizada pela SEFAZ.", "orientacao": "A SEFAZ permite cancelamento apenas em até 24 horas após a autorização.", "atalho": null },
          { "passo": 2, "acao": "Se estiver dentro de 24h, oriente o cancelamento no sistema.", "orientacao": "Acesse a NF-e, escolha a opção Cancelar e informe uma justificativa com pelo menos 15 caracteres.", "atalho": null },
          { "passo": 3, "acao": "Se já passou de 24h, NÃO tente cancelar.", "orientacao": "A SEFAZ rejeita o pedido. Não oriente o cliente a tentar.", "atalho": null },
          { "passo": 4, "acao": "Após 24h, oriente emissão de NF-e de devolução (entrada).", "orientacao": "Use o CFOP correto (1.202/2.202 sem ST; 1.411/2.411 com ST) referenciando a nota original no NFref.", "atalho": null },
          { "passo": 5, "acao": "Antes de emitir a devolução, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — quem fecha o caso fiscal é o contador.", "atalho": null }
        ]
      }
    },
    {
      "title": "Identificar o CFOP correto entre 1.202 (entrada) e 5.202 (saída)",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "diferenca 1202 5202", "qual cfop usar devolucao",
        "cfop entrada saida devolucao", "1202 ou 5202"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Lembre da regra mnemônica: 1 = entrada, 5 = saída.", "orientacao": "Primeiro dígito do CFOP indica o sentido da mercadoria pra empresa que emite.", "atalho": null },
          { "passo": 2, "acao": "Pergunte: quem está emitindo a nota e pra onde a mercadoria está indo?", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Use 1.202 quando a loja RECEBE de volta uma mercadoria que vendeu.", "orientacao": "Quem emite é o cliente PJ que está devolvendo; pra loja é entrada.", "atalho": null },
          { "passo": 4, "acao": "Use 5.202 quando a loja DEVOLVE ao fornecedor uma mercadoria que comprou.", "orientacao": "Quem emite é a própria loja; é saída de mercadoria da empresa.", "atalho": null },
          { "passo": 5, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — quem fecha o caso fiscal é o contador.", "atalho": null }
        ]
      }
    },
    {
      "title": "Identificar o CSOSN correto entre 102 e 500 (Simples Nacional)",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "csosn 102", "csosn 500", "diferenca csosn",
        "qual csosn usar", "simples nacional codigos", "csosn produto com st"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Pergunte: o produto tem ST já recolhida?", "orientacao": "Olhe na nota de compra: se veio com CSOSN 500 ou CST 60, é produto com ST.", "atalho": null },
          { "passo": 2, "acao": "Se SEM ST, use CSOSN 102.", "orientacao": "Tributada pelo Simples Nacional, sem permissão de crédito ao destinatário. O ICMS está incluído no DAS.", "atalho": null },
          { "passo": 3, "acao": "Se COM ST já paga, use CSOSN 500.", "orientacao": "Comum no varejo de bebidas, cosméticos, limpeza, cigarros etc. — não destaca ICMS na nota.", "atalho": null },
          { "passo": 4, "acao": "Lembre a regra rápida: veio com 500/60 na compra, vende com 500.", "orientacao": "Se não tinha ST na compra, vende com 102.", "atalho": null },
          { "passo": 5, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — quem fecha o caso fiscal é o contador.", "atalho": null }
        ]
      }
    },
    {
      "title": "Calcular o DIFAL em vendas interestaduais",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "calcular difal", "diferencial aliquota explicacao",
        "como calcular difal", "difal simples nacional", "o que e difal"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Identifique se é venda interestadual para consumidor final.", "orientacao": "DIFAL incide quando o destinatário é PJ não contribuinte ou PF em outro estado.", "atalho": null },
          { "passo": 2, "acao": "Identifique a alíquota interestadual aplicável.", "orientacao": "7% se destino é Norte, Nordeste ou Centro-Oeste; 12% se Sul ou Sudeste.", "atalho": null },
          { "passo": 3, "acao": "Aplique a fórmula do DIFAL.", "orientacao": "DIFAL = (alíquota interna do estado destino − alíquota interestadual) × base de cálculo.", "atalho": null },
          { "passo": 4, "acao": "Para Simples Nacional, verifique se o estado exige DIFAL.", "orientacao": "A Resolução CGSN 140/2018 prevê o recolhimento, mas nem todos os estados cobram do SN.", "atalho": null },
          { "passo": 5, "acao": "Preencha os campos de DIFAL na NF-e.", "orientacao": "Quando aplicável, a nota precisa carregar os valores corretos pra SEFAZ aceitar.", "atalho": null },
          { "passo": 6, "acao": "Antes de emitir, valide com a contabilidade.", "orientacao": "Estas são orientações apenas de prévia — DIFAL tem alta complexidade e o contador confirma os valores.", "atalho": null }
        ]
      }
    },
    {
      "title": "Aplicar checklist completo de atendimento fiscal",
      "type": "instruction",
      "is_active": true,
      "keywords": [
        "checklist fiscal", "passo a passo atendimento fiscal",
        "validacao atendimento fiscal", "lista verificacao fiscal"
      ],
      "content": {
        "type": "instruction",
        "steps": [
          { "passo": 1, "acao": "Identifique o regime tributário do cliente.", "orientacao": "Simples Nacional, Lucro Presumido, Lucro Real ou MEI — muda CFOP, CST/CSOSN e cálculo.", "atalho": null },
          { "passo": 2, "acao": "Confirme se a operação é dentro do estado ou interestadual.", "orientacao": null, "atalho": null },
          { "passo": 3, "acao": "Verifique se o produto tem Substituição Tributária (ST).", "orientacao": null, "atalho": null },
          { "passo": 4, "acao": "Identifique o destinatário.", "orientacao": "PJ contribuinte, PJ não contribuinte ou consumidor final PF.", "atalho": null },
          { "passo": 5, "acao": "Oriente o CFOP correto para o cenário.", "orientacao": null, "atalho": null },
          { "passo": 6, "acao": "Oriente o CST ou CSOSN apropriado.", "orientacao": null, "atalho": null },
          { "passo": 7, "acao": "Informe a alíquota de ICMS de referência.", "orientacao": "Sempre com a ressalva de validar com a contabilidade.", "atalho": null },
          { "passo": 8, "acao": "Verifique PIS/COFINS.", "orientacao": "Monofásico, isento ou normal conforme o NCM.", "atalho": null },
          { "passo": 9, "acao": "Alerte sobre IPI se aplicável.", "orientacao": "Prazo de 15 dias para devolução com aproveitamento de IPI.", "atalho": null },
          { "passo": 10, "acao": "Em devolução, confirme se o cliente tem a chave de 44 dígitos da nota original.", "orientacao": null, "atalho": null },
          { "passo": 11, "acao": "Em devolução, confira a inversão do CFOP.", "orientacao": "5→1 ou 6→2.", "atalho": null },
          { "passo": 12, "acao": "Em devolução, reforce que dados fiscais devem ser replicados da nota original.", "orientacao": null, "atalho": null },
          { "passo": 13, "acao": "Confirme se é caso de cancelamento (24h) ou devolução (após 24h).", "orientacao": null, "atalho": null },
          { "passo": 14, "acao": "Informe ao cliente que ele deve validar com a contabilidade antes de emitir.", "orientacao": "Use o tom de prévia — não afirme que algo está 100% certo do ponto de vista fiscal.", "atalho": null },
          { "passo": 15, "acao": "Registre o atendimento com as orientações dadas.", "orientacao": "Importante pra auditoria interna e melhoria do FAQ.", "atalho": null },
          { "passo": 16, "acao": "Anote dúvidas recorrentes para incluir no FAQ interno.", "orientacao": null, "atalho": null }
        ]
      }
    }
  ]
}


  if (!FISCAL_MODULE) {
    console.error('[install-fiscal] Variável FISCAL_MODULE vazia.')
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
