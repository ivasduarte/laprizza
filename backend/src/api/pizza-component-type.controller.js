import * as compTypeService from '../application/pizza-component-type.service.js';

export async function list(req, res) {
  const componentType = await compTypeService.listComponents();
  res.status(200).json(componentType);
}