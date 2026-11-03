# UC1 - Define Predefined Pizza

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `POST /predefined-pizzas` |
| Allowed roles | MANAGER |
| Success response | 201 Created |
| Error handling | 401 (invalid token), 403 (role not allowed), 400 (invalid payload or configuration), 409 (predefined pizza already exists for the product) |

## Description

A Manager defines a predefined pizza for a sellable pizza product, choosing the available sizes and the default components. The service validates the product, the lists of ids and the whole configuration (sizes, components, limits per component type and component size configurations) before persisting it. Only one predefined pizza is allowed per product.

## Diagram

```mermaid
---
title: "UC1 - Define Predefined Pizza - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as PredefinedPizzaController<br/>[Component: Controller]
        participant service as PredefinedPizzaService<br/>[Component: Service]
        participant repo as PredefinedPizzaRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager

    manager->>route: POST /predefined-pizzas {productId, sizeIds, componentIds}
    activate route

    route->>route: verifyToken → requireRole(MANAGER) → Joi(productId, sizeIds, componentIds)

    alt Missing or invalid token
      route-->>manager: 401 Unauthorized
    else Role is not MANAGER
      route-->>manager: 403 Forbidden
    else Invalid payload (missing field, invalid id, empty list)
      route-->>manager: 400 Bad Request (Validation failed)
    else Request accepted
      route->>controller: create(req, res, next, repo)
      activate controller

      controller->>service: createPredefinedPizza(data, repo)
      activate service

      service->>repo: findProductById(productId)
      activate repo
      repo-->>service: Product info (or null)
      deactivate repo

      service->>service: validatePizzaProduct(product) [Domain]

      alt Product not found, inactive, not sellable or a Pizza Component
        service-->>controller: AppError("Invalid Predefined Pizza: ...", 400)
      else Product valid
        service->>service: validateSizeIds + validateComponentIds [Domain]

        alt Lists repeated ids
          service-->>controller: AppError("Invalid Predefined Pizza: ...", 400)
        else Lists valid
          service->>repo: findSizesByIds + findProductsByIds + listComponentTypes
          activate repo
          repo-->>service: sizes, components, component types
          deactivate repo

          service->>service: validatePredefinedPizza(...) [Domain]<br/>sizes exist and are active, components exist, are active and typed,<br/>min/max per Pizza Component Type, Component Size Configuration<br/>for every component and size

          alt Configuration invalid
            service-->>controller: AppError("Invalid Predefined Pizza: ...", 400)
          else Configuration valid
            service->>service: createPredefinedPizzaData(productId, sizeIds, componentIds) [Domain]
            service->>repo: create({productId, sizeIds, defaultConfiguration})
            activate repo
            repo-->>service: PredefinedPizza entity (or Error 11000)
            deactivate repo

            alt Product already has a Predefined Pizza (unique productId)
              service-->>controller: AppError("A Predefined Pizza already exists for this product.", 409)
            else Created
              service->>service: toPredefinedPizzaDto(pizza)
              service-->>controller: PredefinedPizzaDto
            end
          end
        end
      end
      deactivate service

      controller-->>manager: 201 Created (or error via next(error))
      deactivate controller
    end

    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
