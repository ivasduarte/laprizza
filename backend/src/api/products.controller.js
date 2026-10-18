import * as productsService from '../application/products.service.js';

export const list = async (req, res, next, repos) => {
  try {
    const products = await productsService.listProducts(req.query, repos);
    res.status(200).json(products);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next, repos) => {
  try {
    const newProduct = await productsService.createProduct(req.body, repos);
    res.status(201).json(newProduct);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next, repos) => {
  try {
    const product = await productsService.getProductById(req.params.id, repos);
    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next, repos) => {
  try {
    const updatedProduct = await productsService.updateProduct(req.params.id, req.body, repos);
    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
};
