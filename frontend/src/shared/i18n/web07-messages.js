/**
 * WEB07 texts (AI configuration and execution), merged into `messages` by message.js.
 * Business validation codes of the back end are translated as `feedback.validation.ai_<code>`.
 */
const LLM_PROMPT_EN = `You prepare supplier data for the LaPrizza planning service.
Attached: the product export (JSON) and the supplier price lists.
Answer ONLY with one JSON object, no comments, in this format:
{
  "name": "<scenario name>",
  "suppliers": [{ "id": "<short code, unique>", "name": "<supplier name>" }],
  "products": [{ "productId": "<id from the export>", "offers": [
    { "supplierId": "<listed supplier id>", "priceEur": <price of one pack, EUR>,
      "stockUnits": <whole number of stock units in one pack, at least 1>,
      "leadTimeDays": <delivery time in days, 0 or more>,
      "supplyLimit": <optional: maximum packs, whole number> } ] }]
}
Rules: use only productId values from the export and never invent products; at most one offer
per supplier and product; if no supplier sells a product, use "offers": []; do not guess
missing prices or lead times: leave the offer out.`;

const LLM_PROMPT_PT = `Preparas dados de fornecedores para o serviço de planeamento da LaPrizza.
Em anexo: o export de produtos (JSON) e as tabelas de preços dos fornecedores.
Responde APENAS com um objeto JSON, sem comentários, neste formato:
{
  "name": "<nome do cenário>",
  "suppliers": [{ "id": "<código curto, único>", "name": "<nome do fornecedor>" }],
  "products": [{ "productId": "<id do export>", "offers": [
    { "supplierId": "<id de um fornecedor listado>", "priceEur": <preço de uma embalagem, EUR>,
      "stockUnits": <número inteiro de unidades de stock por embalagem, pelo menos 1>,
      "leadTimeDays": <prazo de entrega em dias, 0 ou mais>,
      "supplyLimit": <opcional: máximo de embalagens, número inteiro> } ] }]
}
Regras: usa só valores de productId do export e nunca inventes produtos; no máximo uma oferta
por fornecedor e produto; se nenhum fornecedor vender um produto, usa "offers": []; não
adivinhes preços ou prazos em falta: deixa essa oferta de fora.`;

export const web07Messages = {
  en: {
    feedback: {
      validation: {
        object_base: 'Each item must be an object.',
        ai_productUnknown: 'Unknown product (or not sellable).',
        ai_sizeRequired: 'Choose a size: this pizza is sold in sizes.',
        ai_sizeIncompatible: 'This size does not apply to the product.',
        ai_dateInvalid: 'Enter a valid date.',
        ai_dateOutside: 'The date is outside the forecast period.',
        ai_periodInvalid: 'The end date is before the start date.',
        ai_duplicate: 'Repeated date, product and size: keep only one entry.',
        ai_noEntries: 'Add at least one daily quantity.',
        ai_productDuplicate: 'This product appears more than once.',
        ai_supplierIdDuplicate: 'Repeated supplier id.',
        ai_offerSupplierUnknown:
          'The supplier of the offer is not in "suppliers".',
        ai_offerDuplicate: 'The same supplier has two offers for this product.',
        ai_jsonEmpty: 'Paste the JSON or choose a file.',
        ai_jsonNotObject: 'The file must contain one JSON object.',
        ai_jsonSyntax: 'The text is not valid JSON.',
        ai_jsonSyntaxAt: 'The text is not valid JSON.',
        planning_forecastNotFound:
          'This forecast no longer exists or was deactivated.',
        planning_supplierScenarioNotFound:
          'This supplier scenario no longer exists or was deactivated.',
      },
    },
    ai: {
      tabs: {
        forecasts: 'Forecasts',
        suppliers: 'Suppliers',
        execution: 'Execution',
        results: 'Results',
      },
      ui: {
        close: 'Close',
        saving: 'Saving...',
        simulationBanner:
          'Planning is a simulation: it never changes the stock nor creates purchase orders.',
      },
      fc: {
        versionedHint:
          'Forecasts are versioned: saving changes creates a new version and keeps the old one, so earlier results stay valid.',
        empty: 'There are no forecasts yet.',
        entriesCol: 'Entries',
        entriesCount_one: '{{count}} entry, {{days}} day(s)',
        entriesCount_other: '{{count}} entries, {{days}} day(s)',
        latest: 'Latest',
        newVersion: 'New version',
        newVersionOf: 'New version of “{{name}}” (v{{version}})',
        immutableHint:
          'v{{version}} is not changed: saving creates the next version. Results already calculated stay linked to v{{version}}.',
        deactivate: 'Deactivate',
        deactivateTitle: 'Deactivate forecast',
        deactivateConfirm:
          'Deactivate “{{name}}” v{{version}}? It is no longer listed nor used in new calculations. Saved results are kept.',
        deactivated: '“{{name}}” v{{version}} was deactivated.',
        saved: '“{{name}}” v{{version}} was saved.',
        entryN: 'Entry {{n}}',
        chooseProduct: '— Choose a product —',
        unknownProduct: 'Unknown product ({{id}})',
        chooseSize: '— Choose a size —',
        noSizes: 'No sizes',
        duplicate: 'Duplicate',
        duplicateEntry: 'Duplicate entry {{n}} for the next day',
        removeEntry: 'Remove entry {{n}}',
        runWith: 'Run with this forecast',
        daysWithEntries: 'Days with consumption',
        totalQuantity: 'Total quantity',
      },
      sp: {
        exportCount_one: '{{count}} product available for offers.',
        exportCount_other: '{{count}} products available for offers.',
        exportNeeded:
          'The product export is used to show product names and products without supplier.',
        llmTitle: 'Prepare the file with an LLM',
        llmHelp:
          'Give an LLM the product export and the supplier price lists with this prompt, then paste its answer below. The answer is always inspected before saving.',
        llmPrompt: LLM_PROMPT_EN,
        copyPrompt: 'Copy prompt',
        copied: 'Prompt copied.',
        copyFailed:
          'The prompt could not be copied. Select and copy it manually.',
        name: 'Scenario name',
        nameHint:
          'Empty: uses "name" of the file. An existing name creates its next version.',
        inspecting: 'Inspecting...',
        atLine: '(line {{line}}, column {{column}})',
        validAs:
          'Valid. Confirming saves “{{name}}” as v{{version}}. Nothing has been saved yet.',
        summary:
          '{{suppliers}} supplier(s), {{offers}} offer(s), {{withoutSupplier}} product(s) without supplier.',
        simulated: 'Simulated',
        noLimit: 'No limit',
        notInFile: '(not in the file)',
        saved: 'Supplier scenario “{{name}}” v{{version}} saved.',
        savedTitle: 'Supplier scenarios',
        savedHint:
          'Active versions. A calculation uses the scenario you choose (by default the latest).',
        empty: 'There are no supplier scenarios yet.',
        suppliersCol: 'Suppliers',
        productsCol: 'Products',
        deactivateTitle: 'Deactivate supplier scenario',
        deactivateConfirm:
          'Deactivate “{{name}}” v{{version}}? It is no longer used in new calculations. Saved results are kept.',
        deactivated: 'Supplier scenario “{{name}}” v{{version}} deactivated.',
      },
      run: {
        latestForecast: 'Latest active forecast',
        latestSuppliers: 'Latest active supplier scenario',
        listsUnavailable:
          'The forecasts or supplier scenarios could not be loaded: the latest active ones will be used.',
        pending: 'Calculating... please wait.',
        saved: 'Result saved in the history.',
        openInHistory: 'Open in results',
        dailyNeeds: 'Daily needs',
        noDailyNeeds: 'No need on any day: the stock covers the forecast.',
        need: 'Need',
        purchases: 'Replenishment by product',
        covered: 'Covered',
        status: 'Status',
        statuses: {
          on_time: 'On time',
          late: 'Late',
          partial: 'Partially covered',
          unavailable: 'Not covered',
        },
        filterForecast: 'Forecast',
        allForecasts: 'All forecasts',
        empty: 'No calculation was saved yet.',
        stockSource: 'Stock',
        sources: {
          'backend-live': 'Current stock',
          scenario: 'Stock of the scenario',
        },
        feasibility: 'Feasibility',
        notFeasible: 'Not feasible',
        noSuppliers: 'No supplier scenario',
        detailTitle: 'Result of {{date}}',
        aiScenario: 'AI scenario',
      },
    },
  },
  pt: {
    feedback: {
      validation: {
        object_base: 'Cada elemento tem de ser um objeto.',
        ai_productUnknown: 'Produto desconhecido (ou não vendável).',
        ai_sizeRequired:
          'Escolha um tamanho: esta pizza é vendida por tamanhos.',
        ai_sizeIncompatible: 'Este tamanho não se aplica ao produto.',
        ai_dateInvalid: 'Indique uma data válida.',
        ai_dateOutside: 'A data está fora do período da previsão.',
        ai_periodInvalid: 'A data de fim é anterior à data de início.',
        ai_duplicate:
          'Data, produto e tamanho repetidos: mantenha só uma entrada.',
        ai_noEntries: 'Adicione pelo menos uma quantidade diária.',
        ai_productDuplicate: 'Este produto aparece mais do que uma vez.',
        ai_supplierIdDuplicate: 'Id de fornecedor repetido.',
        ai_offerSupplierUnknown:
          'O fornecedor da oferta não está em "suppliers".',
        ai_offerDuplicate:
          'O mesmo fornecedor tem duas ofertas para este produto.',
        ai_jsonEmpty: 'Cole o JSON ou escolha um ficheiro.',
        ai_jsonNotObject: 'O ficheiro tem de conter um objeto JSON.',
        ai_jsonSyntax: 'O texto não é JSON válido.',
        ai_jsonSyntaxAt: 'O texto não é JSON válido.',
        planning_forecastNotFound:
          'Esta previsão já não existe ou foi desativada.',
        planning_supplierScenarioNotFound:
          'Este cenário de fornecedores já não existe ou foi desativado.',
      },
    },
    ai: {
      tabs: {
        forecasts: 'Previsões',
        suppliers: 'Fornecedores',
        execution: 'Execução',
        results: 'Resultados',
      },
      ui: {
        close: 'Fechar',
        saving: 'A guardar...',
        simulationBanner:
          'O planeamento é uma simulação: nunca altera o stock nem cria encomendas.',
      },
      fc: {
        versionedHint:
          'As previsões têm versões: guardar alterações cria uma versão nova e mantém a anterior, por isso os resultados já calculados continuam válidos.',
        empty: 'Ainda não há previsões.',
        entriesCol: 'Entradas',
        entriesCount_one: '{{count}} entrada, {{days}} dia(s)',
        entriesCount_other: '{{count}} entradas, {{days}} dia(s)',
        latest: 'Mais recente',
        newVersion: 'Nova versão',
        newVersionOf: 'Nova versão de “{{name}}” (v{{version}})',
        immutableHint:
          'A v{{version}} não é alterada: guardar cria a versão seguinte. Os resultados já calculados ficam associados à v{{version}}.',
        deactivate: 'Desativar',
        deactivateTitle: 'Desativar previsão',
        deactivateConfirm:
          'Desativar “{{name}}” v{{version}}? Deixa de aparecer na lista e de ser usada em novos cálculos. Os resultados guardados mantêm-se.',
        deactivated: '“{{name}}” v{{version}} foi desativada.',
        saved: '“{{name}}” v{{version}} foi guardada.',
        entryN: 'Entrada {{n}}',
        chooseProduct: '— Escolha um produto —',
        unknownProduct: 'Produto desconhecido ({{id}})',
        chooseSize: '— Escolha um tamanho —',
        noSizes: 'Sem tamanhos',
        duplicate: 'Duplicar',
        duplicateEntry: 'Duplicar a entrada {{n}} para o dia seguinte',
        removeEntry: 'Remover a entrada {{n}}',
        runWith: 'Executar com esta previsão',
        daysWithEntries: 'Dias com consumo',
        totalQuantity: 'Quantidade total',
      },
      sp: {
        exportCount_one: '{{count}} produto disponível para ofertas.',
        exportCount_other: '{{count}} produtos disponíveis para ofertas.',
        exportNeeded:
          'O export de produtos é usado para mostrar os nomes e os produtos sem fornecedor.',
        llmTitle: 'Preparar o ficheiro com um LLM',
        llmHelp:
          'Dê a um LLM o export de produtos e as tabelas de preços dos fornecedores com este prompt e cole a resposta abaixo. A resposta é sempre inspecionada antes de guardar.',
        llmPrompt: LLM_PROMPT_PT,
        copyPrompt: 'Copiar prompt',
        copied: 'Prompt copiado.',
        copyFailed:
          'Não foi possível copiar o prompt. Selecione-o e copie-o manualmente.',
        name: 'Nome do cenário',
        nameHint:
          'Vazio: usa o "name" do ficheiro. Um nome que já existe cria a versão seguinte.',
        inspecting: 'A inspecionar...',
        atLine: '(linha {{line}}, coluna {{column}})',
        validAs:
          'Válido. Ao confirmar, “{{name}}” é guardado como v{{version}}. Ainda nada foi guardado.',
        summary:
          '{{suppliers}} fornecedor(es), {{offers}} oferta(s), {{withoutSupplier}} produto(s) sem fornecedor.',
        simulated: 'Simulado',
        noLimit: 'Sem limite',
        notInFile: '(não está no ficheiro)',
        saved: 'Cenário de fornecedores “{{name}}” v{{version}} guardado.',
        savedTitle: 'Cenários de fornecedores',
        savedHint:
          'Versões ativas. Um cálculo usa o cenário escolhido (por omissão, o mais recente).',
        empty: 'Ainda não há cenários de fornecedores.',
        suppliersCol: 'Fornecedores',
        productsCol: 'Produtos',
        deactivateTitle: 'Desativar cenário de fornecedores',
        deactivateConfirm:
          'Desativar “{{name}}” v{{version}}? Deixa de ser usado em novos cálculos. Os resultados guardados mantêm-se.',
        deactivated:
          'Cenário de fornecedores “{{name}}” v{{version}} desativado.',
      },
      run: {
        latestForecast: 'Previsão ativa mais recente',
        latestSuppliers: 'Cenário de fornecedores ativo mais recente',
        listsUnavailable:
          'Não foi possível carregar as previsões ou os cenários de fornecedores: serão usados os ativos mais recentes.',
        pending: 'A calcular... aguarde.',
        saved: 'Resultado guardado no histórico.',
        openInHistory: 'Abrir nos resultados',
        dailyNeeds: 'Necessidades diárias',
        noDailyNeeds:
          'Sem necessidades em nenhum dia: o stock cobre a previsão.',
        need: 'Necessidade',
        purchases: 'Reposição por produto',
        covered: 'Coberto',
        status: 'Estado',
        statuses: {
          on_time: 'A tempo',
          late: 'Atrasado',
          partial: 'Parcialmente coberto',
          unavailable: 'Não coberto',
        },
        filterForecast: 'Previsão',
        allForecasts: 'Todas as previsões',
        empty: 'Ainda não foi guardado nenhum cálculo.',
        stockSource: 'Stock',
        sources: {
          'backend-live': 'Stock atual',
          scenario: 'Stock do cenário',
        },
        feasibility: 'Viabilidade',
        notFeasible: 'Não viável',
        noSuppliers: 'Sem cenário de fornecedores',
        detailTitle: 'Resultado de {{date}}',
        aiScenario: 'Cenário de IA',
      },
    },
  },
};

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Deep merge of message dictionaries; a key defined twice is a mistake, so it throws. */
export function mergeMessages(base, extra, path = '') {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const at = path ? `${path}.${key}` : key;
    if (isPlainObject(value) && isPlainObject(out[key]))
      out[key] = mergeMessages(out[key], value, at);
    else if (key in out) throw new Error(`Duplicate i18n key: ${at}`);
    else out[key] = value;
  }
  return out;
}
