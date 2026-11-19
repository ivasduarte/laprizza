const active = { isActive: { $ne: false } };
const isObjectId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

export const toStockEntry = (row) => ({
  productId: String(row.productId),
  quantity: row.quantity,
});

export function createAiDataRepository({
  productModel,
  sizeModel,
  predefinedPizzaModel,
  stockModel,
  forecastModel,
  supplierScenarioModel,
  aiScenarioRepository,
}) {
  return {
    listProducts: () =>
      productModel
        .find(
          active,
          'name price sellable stockControlled pizzaComponentTypeId sizeConfigurations aggregate',
        )
        .lean(),
    findActiveScenarioByCode: (code) => aiScenarioRepository.findActiveByCode(code),
    listSizes: () => sizeModel.find(active, 'name').lean(),
    listPredefinedPizzas: () =>
      predefinedPizzaModel.find(active, 'productId sizeIds defaultConfiguration').lean(),
    listStock: async () =>
      (await stockModel.find({}, 'productId quantity').lean()).map(toStockEntry),
    getActiveForecast: () => forecastModel.findOne(active).sort({ createdAt: -1 }).lean(),
    getActiveSupplierScenario: () =>
      supplierScenarioModel.findOne(active).sort({ createdAt: -1 }).lean(),
    findForecastById: async (id) =>
      isObjectId(id) ? forecastModel.findOne({ _id: id, ...active }).lean() : null,
    findSupplierScenarioById: async (id) =>
      isObjectId(id) ? supplierScenarioModel.findOne({ _id: id, ...active }).lean() : null,
  };
}
