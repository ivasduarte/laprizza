import * as stockService from '../../application/stock/stock.service.js';

export const list = async (req, res, next, repos) => {
  try {
    const stockList = await stockService.listStock(req.query, repos);
    res.status(200).json(stockList);
  } catch (error) {
    next(error);
  }
};

export const getByProductId = async (req, res, next, repos) => {
  try {
    const stock = await stockService.getStockByProductId(req.params.productId, repos);
    res.status(200).json(stock);
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req, res, next, repos) => {
  try {
    const { amount, operation } = req.body;
    const updatedStock = await stockService.adjustStock(
      req.params.productId,
      amount,
      operation,
      repos,
    );
    res.status(200).json(updatedStock);
  } catch (error) {
    next(error);
  }
};
