const active = { isActive: { $ne: false } };

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
}) {
  return {
    listProducts: () =>
      productModel
        .find(active, 'name sellable stockControlled pizzaComponentTypeId sizeConfigurations')
        .lean(),
    listSizes: () => sizeModel.find(active, 'name').lean(),
    listPredefinedPizzas: () =>
      predefinedPizzaModel.find(active, 'productId sizeIds defaultConfiguration').lean(),
    listStock: async () =>
      (await stockModel.find({}, 'productId quantity').lean()).map(toStockEntry),
    getActiveForecast: () => forecastModel.findOne(active).sort({ createdAt: -1 }).lean(),
    getActiveSupplierScenario: () =>
      supplierScenarioModel.findOne(active).sort({ createdAt: -1 }).lean(),
  };
}
