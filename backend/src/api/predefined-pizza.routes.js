import Joi from 'joi';
import * as controller from './predefined-pizza.controller.js';

import { Router } from 'express';
import { verifyToken, requireRole } from './middleware/auth.middleware.js';
import { Roles } from '../domain/users.domain.js';
import { AppError } from '../application/AppError.js';


export default function predefinedPizzaRouterFactory(repositories){
    const router = Router();

    const pizzaRepository =
        repositories && 'predefinedPizzaRepository' in repositories
            ? repositories.predefinedPizzaRepository
            : repositories;

    const readRoles = [Roles.MANAGER, Roles.EMPLOYEE];

    const objectId = Joi.string().hex().length(24).messages({
        'string.hex' : 'Invalid ID format',
        'string.length' : 'Invalid ID format',
        'string.base' : 'Invalid ID format',
    });

    const idList = (label) => Joi.array().items(objectId).min(1).messages({
        'array.base' : `${label} must be an array`,
        'array.min' : `At least one ${label} is required`,
    });

    const createSchema = Joi.object({
        productId : objectId.required().messages({
            'any.required' : 'Mandatory field',
        }),
        sizeIds : idList('Pizza Size').required().messages({
            'any.required' : 'Mandatory field',
        }),
        componentIds : idList('Pizza Component').required().messages({
            'any.required' : 'Mandatory field',
        }),
    });

    const updateSchema = Joi.object({
        sizeIds : idList('Pizza Size'),
        componentIds : idList('Pizza Component'),
        isActive : Joi.boolean().valid(false).messages({
            'any.only' : 'Only deactivation is supported: isActive must be false',
            'boolean.base' : 'isActive must be a boolean',
        }),
    }).or('sizeIds', 'componentIds', 'isActive').messages({
        'object.missing' : 'At least one of sizeIds, componentIds or isActive is required',
    });

    const searchSchema = Joi.object({
        name : Joi.string().trim().min(1).optional(),
    });

    const nameParamSchema = Joi.object({
        name: Joi.string().trim().min(1).required().messages({
            'any.required' : 'Name parameter is required',
            'string.empty' : 'Name parameter cannot be empty',
        }),
    });

    const objectIdSchema = Joi.string().hex().length(24).required().messages({
        'string.hex' : 'Invalid ID format',
        'string.length' : 'Invalid ID format',
    });


    const validateId = (req, res, next) => {
        const { error } = objectIdSchema.validate(req.params.id);
        if (error) return next (new AppError('Invalid ID format',400));
        next();
    }

    const validate = (schema, source = 'body') => (req,res,next) => {
        try{
            const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
            if (error){
                return next (
                    new AppError(
                        'Validation failed',
                        400,
                        error.details.map((d) => d.message),
                    ),
                );
            }
            if (source === 'body') req.body = value;
            next();
        }
        catch (err) {
            next(err);
        }
    };

    router.get('/', verifyToken, requireRole(readRoles), validate(searchSchema, 'query'), (req, res, next) =>
        controller.list(req,res,next, pizzaRepository),
    );

    router.post('/', verifyToken, requireRole([Roles.MANAGER]), validate(createSchema), (req,res,next) =>
        controller.create(req,res,next,pizzaRepository),
    );

    router.get('/:id', verifyToken, requireRole(readRoles), validateId, (req,res,next) =>
        controller.getById(req,res,next,pizzaRepository),
    );

    router.get('/name/:name', verifyToken, requireRole(readRoles), validate(nameParamSchema, 'params'), (req,res,next) =>
        controller.getByName(req,res,next,pizzaRepository),
    );

    router.put(
        '/:id',
        verifyToken,
        requireRole([Roles.MANAGER]),
        validateId,
        validate(updateSchema),
        (req,res,next) => controller.update(req,res,next, pizzaRepository),
    );

    return router;
}