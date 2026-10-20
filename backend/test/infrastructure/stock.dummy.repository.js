export function createDummyStockRepository() {
  const stocks = [];
  let idCounter = 1;

  return {
    create: async (stockData) => {
      const hexId = 'f0f0f0' + (idCounter++).toString(16).padStart(18, '0');
      const newStock = { _id: hexId, ...stockData };
      stocks.push(newStock);
      return newStock;
    },
    findByProductId: async (productId) => {
      return (
        stocks.find(
          (s) =>
            String(s.productId) === String(productId) ||
            String(s.productId?._id) === String(productId),
        ) ?? null
      );
    },
    updateQuantity: async (productId, newQuantity) => {
      const stock = stocks.find(
        (s) =>
          String(s.productId) === String(productId) ||
          String(s.productId?._id) === String(productId),
      );
      if (!stock) return null;
      stock.quantity = newQuantity;
      return stock;
    },
    listStock: async (query = {}) => {
      let result = [...stocks];
      const term = query.search?.trim().toLowerCase();

      if (term) {
        result = result.filter((s) => {
          const productName = s.productId?.name || '';
          return productName.toLowerCase().includes(term);
        });
      }

      return result;
    },
    _getStocks: () => stocks,
  };
}
