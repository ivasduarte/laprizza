import * as productCatalogueService from '../../application/product-catalogue/product-catalogue.service.js';

export const list = async (req, res, next, repos) => {
    try {
        const items = await productCatalogueService.listCatalogue(req.query, repos);
        res.status(200).json(items);
    } catch (error) {
        next(error);
    }
};

export const getById = async (req, res, next, repos) => {
    try {
        const item = await productCatalogueService.getCatalogueItemById(req.params.id, repos);
        res.status(200).json(item);
    } catch (error) {
        next(error);
    }
};