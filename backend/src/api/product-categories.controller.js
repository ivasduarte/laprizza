import * as prodCatService from '../application/product-categories.service.js';

export async function list(req, res) {
  const prodCategories = await prodCatService.listProductCategories();
  res.status(200).json(prodCategories);
}