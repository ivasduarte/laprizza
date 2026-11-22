export const web05Messages = {
  en: {
    nav: {
      productCategories: 'Product Categories',
      allergens: 'Allergens',
      pizzaSizes: 'Pizza Sizes',
      pizzaComponentTypes: 'Pizza Component Types',
      products: 'Products',
      stock: 'Stock',
      predefinedPizzas: 'Predefined Pizzas',
      catalogue: 'Catalogue',
      customers: 'Customers',
      myData: 'My Data',
    },
    feedback: {
      validation: {
        pizzaComponentType_range:
          'The maximum cannot be lower than the minimum.',
        pizzaComponentType_orderTaken:
          'Another active component type already uses this assembly order.',
        pizzaComponentType_nameTaken:
          'Another active component type already has this name.',
        product_nameTaken: 'There is already a product with this name.',
        customer_phone:
          'Enter a Portuguese phone number: 9 digits starting with 2 or 91, 92, 93 or 96 (optionally +351).',
        customer_postalCode: 'Use the format 1234-567.',
        customer_postalCodeCity:
          'The postal code does not match the city. Check both fields.',
        customer_emailTaken: 'Another customer already uses this email.',
        customer_phoneTaken: 'Another customer already uses this phone number.',
        customer_contactTaken:
          'Another customer already uses this email or phone number.',
      },
    },
    entity: {
      actions: 'Actions',
      status: 'Status',
      active: 'Active',
      inactive: 'Inactive',
      view: 'View',
      edit: 'Edit',
      close: 'Close',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving...',
      search: 'Search',
      clear: 'Clear',
      backToList: 'Back to the list',
      readOnly: 'You can view this information but not change it.',
      loadFailed: 'The data could not be loaded.',
      empty: 'There are no records yet.',
      noResults: 'No results match "{{term}}".',
      unavailable: 'This record does not exist or is no longer available.',
      required: 'Fields marked with * are required.',
    },
    productCategories: {
      title: 'Product categories',
      create: 'New category',
      searchLabel: 'Category name',
      searchHint:
        'Finds the category with exactly this name (upper/lower case and accents are ignored). Leave it empty to see all active categories.',
      empty: 'There are no product categories yet.',
      noResults: 'There is no category named "{{term}}".',
      col: {
        name: 'Name',
      },
      detailTitle: 'Category "{{name}}"',
      unavailable: 'This category does not exist or has been removed.',
      products: 'Products in this category',
      noProducts: 'No product uses this category.',
      remove: 'Remove',
      confirmRemoveTitle: 'Remove category',
      confirmRemove:
        'Remove the category "{{name}}"? It will no longer be available for products.',
      created: 'Category "{{name}}" created.',
      updated: 'Category "{{name}}" updated.',
      removed: 'Category "{{name}}" removed.',
      form: {
        createTitle: 'New product category',
        editTitle: 'Edit category "{{name}}"',
        name: 'Name',
      },
      errors: {
        duplicate:
          'There is already a category with this name, or this category has been removed in the meantime.',
        notFound: 'This category no longer exists. The list has been updated.',
        inUse:
          'This category cannot be removed because it is used by products. Move those products to another category first.',
      },
    },
    allergens: {
      title: 'Allergens',
      create: 'New allergen',
      searchLabel: 'Allergen name',
      searchHint:
        'Finds the allergens whose name contains this text (upper/lower case is ignored). Leave it empty to see all active allergens.',
      empty: 'There are no allergens yet.',
      noResults: 'No allergen name contains "{{term}}".',
      col: {
        name: 'Name',
      },
      detailTitle: 'Allergen "{{name}}"',
      unavailable: 'This allergen does not exist or has been deactivated.',
      noEdit: 'The name of an allergen cannot be changed after it is created.',
      deactivate: 'Deactivate',
      confirmDeactivateTitle: 'Deactivate allergen',
      confirmDeactivate:
        'Deactivate the allergen "{{name}}"? It can no longer be used in products or dietary restrictions, and it cannot be reactivated.',
      created: 'Allergen "{{name}}" created.',
      deactivated: 'Allergen "{{name}}" deactivated.',
      form: {
        createTitle: 'New allergen',
        name: 'Name',
        nameHint: 'Check the name before saving: it cannot be changed later.',
      },
      errors: {
        duplicate:
          'There is already an allergen with this name (it may have been deactivated).',
        notFound:
          'This allergen no longer exists or has been deactivated. The list has been updated.',
        inUse:
          "This allergen cannot be deactivated because it is used by products or by customers' dietary restrictions.",
      },
    },
    pizzaSizes: {
      title: 'Pizza sizes',
      create: 'New size',
      searchLabel: 'Size name',
      searchHint:
        'Finds the sizes whose name contains this text (upper/lower case is ignored). Inactive sizes are also listed.',
      empty: 'There are no pizza sizes yet.',
      noResults: 'No size name contains "{{term}}".',
      col: {
        name: 'Name',
      },
      detailTitle: 'Size "{{name}}"',
      unavailable: 'This pizza size does not exist.',
      inactiveNote:
        'This size is inactive: it cannot be used in new component configurations or predefined pizzas until it is reactivated.',
      deactivate: 'Deactivate',
      activate: 'Reactivate',
      confirmDeactivateTitle: 'Deactivate size',
      confirmDeactivate:
        'Deactivate the size "{{name}}"? It can no longer be used in new configurations or predefined pizzas. You can reactivate it later.',
      created: 'Size "{{name}}" created.',
      updated: 'Size "{{name}}" updated.',
      deactivated: 'Size "{{name}}" deactivated.',
      activated: 'Size "{{name}}" reactivated.',
      form: {
        createTitle: 'New pizza size',
        editTitle: 'Edit size "{{name}}"',
        name: 'Name',
        nameHint: 'Between 3 and 50 characters, e.g. Small, Medium, Family.',
      },
      errors: {
        duplicate: 'There is already a pizza size with this name.',
        notFound:
          'This pizza size no longer exists. The list has been updated.',
        inUse:
          'This size cannot be deactivated because pizza components have prices configured for it. Remove those configurations first.',
      },
    },
    pizzaComponentTypes: {
      title: 'Pizza component types',
      create: 'New component type',
      searchLabel: 'Component type name',
      searchHint:
        'Finds the type with exactly this name (upper/lower case and accents are ignored). Leave it empty to see all active types in assembly order.',
      empty: 'There are no pizza component types yet.',
      noResults: 'There is no component type named "{{term}}".',
      col: {
        assemblyOrder: 'Order',
        name: 'Name',
        minQuantity: 'Minimum',
        maxQuantity: 'Maximum',
      },
      unlimited: 'Unlimited',
      detailTitle: 'Component type "{{name}}"',
      unavailable: 'This component type does not exist or has been removed.',
      remove: 'Remove',
      confirmRemoveTitle: 'Remove component type',
      confirmRemove:
        'Remove the component type "{{name}}"? Its assembly order becomes free for another type.',
      created: 'Component type "{{name}}" created.',
      updated: 'Component type "{{name}}" updated.',
      removed: 'Component type "{{name}}" removed.',
      form: {
        createTitle: 'New pizza component type',
        editTitle: 'Edit component type "{{name}}"',
        name: 'Name',
        assemblyOrder: 'Assembly order',
        assemblyOrderHint:
          'Position of this type when the pizza is assembled (1 = first). Each active type has its own order.',
        minQuantity: 'Minimum quantity',
        minHint: 'Use 0 when the type is optional in a pizza.',
        maxQuantity: 'Maximum quantity',
        unlimited: 'Unlimited (no maximum)',
      },
      errors: {
        notFound:
          'This component type no longer exists or has been removed. The list has been updated.',
        inUse:
          'This component type cannot be removed because there are products of this type.',
        invalidRules:
          'Check the values: the order must be at least 1, the minimum at least 0, the maximum at least 1, and the maximum cannot be lower than the minimum.',
      },
    },
    products: {
      title: 'Products',
      create: 'New product',
      searchLabel: 'Name or description',
      searchHint:
        'Finds the products whose name or description contains this text (upper/lower case is ignored).',
      empty: 'There are no products yet.',
      noResults: 'No product matches the search and filters.',
      filters: {
        category: 'Category',
        allCategories: 'All categories',
        sellable: 'Sellable',
        status: 'Status',
        all: 'All',
        yes: 'Yes',
        no: 'No',
        active: 'Active',
        inactive: 'Inactive',
      },
      col: {
        name: 'Name',
        category: 'Category',
        sellable: 'Sellable',
        stock: 'Stock control',
        component: 'Pizza component',
      },
      yes: 'Yes',
      no: 'No',
      unknownCategory: 'Removed category',
      unknownType: 'Removed type',
      unknownProduct: 'Unknown product',
      detailTitle: 'Product "{{name}}"',
      unavailable: 'This product does not exist.',
      inactiveNote:
        'This product is inactive: it is not sold and cannot be used in new aggregates, configurations or pizzas until it is reactivated.',
      sections: {
        characteristics: 'Characteristics',
        commercial: 'Commercial information',
        allergens: 'Allergens',
        aggregate: 'Aggregate',
      },
      fields: {
        description: 'Description',
        category: 'Category',
        sellable: 'Sellable',
        price: 'Price',
        stockControlled: 'Stock control',
        pizzaComponent: 'Pizza component',
        componentType: 'Component type',
        classification: 'Type',
      },
      noAllergens: 'No allergens declared.',
      allergensHidden:
        '{{count}} allergen(s) declared. The names are only available to managers.',
      aggregate: {
        none: 'This product is not an aggregate.',
        PRODUCED: 'Produced',
        PURCHASED: 'Purchased',
        purchasedNote: 'Purchased aggregate: it has no composition.',
        product: 'Product',
        quantity: 'Quantity',
      },
      deactivate: 'Deactivate',
      activate: 'Reactivate',
      confirmDeactivateTitle: 'Deactivate product',
      confirmDeactivate:
        'Deactivate the product "{{name}}"? It leaves the catalogue and cannot be used in new aggregates or pizzas. You can reactivate it later.',
      created: 'Product "{{name}}" created.',
      updated: 'Product "{{name}}" updated.',
      deactivated: 'Product "{{name}}" deactivated.',
      activated: 'Product "{{name}}" reactivated.',
      form: {
        createTitle: 'New product',
        editTitle: 'Edit product "{{name}}"',
        name: 'Name',
        description: 'Description',
        category: 'Category',
        chooseCategory: 'Choose a category',
        sellable: 'Sellable (shown in the catalogue)',
        price: 'Price (€)',
        stockControlled: 'Stock controlled',
        stockLocked:
          'Stock control is chosen when the product is created and cannot be changed afterwards.',
        pizzaComponent: 'Pizza component',
        componentType: 'Component type',
        chooseType: 'Choose a component type',
        allergens: 'Allergens',
        noAllergensAvailable: 'There are no active allergens.',
        aggregate: 'Aggregate',
        aggregateNone: 'Not an aggregate',
        aggregateProduced: 'Produced (made from other products)',
        aggregatePurchased: 'Purchased (bought ready, no composition)',
        items: 'Composition',
        itemsHint:
          'Only active products that are not aggregates themselves can be items. Each product can be used once.',
        itemProduct: 'Item {{index}}: product',
        itemQuantity: 'Item {{index}}: quantity',
        chooseProduct: 'Choose a product',
        addItem: 'Add item',
        removeItem: 'Remove item {{index}}',
        noCandidates: 'There are no products that can be items.',
      },
      sizeConfigs: {
        title: 'Prices per pizza size',
        intro:
          'Price of this component in each pizza size. Each size has at most one configuration.',
        size: 'Size',
        price: 'Price (€)',
        stockUnits: 'Stock units consumed',
        notConfigured: 'Not configured',
        configure: 'Configure',
        edit: 'Edit',
        remove: 'Remove',
        noSizes: 'There are no active pizza sizes to configure.',
        inactiveProduct:
          'The product is inactive: configurations can only be removed until it is reactivated.',
        createTitle: 'Configure size {{size}}',
        editTitle: 'Edit configuration of size {{size}}',
        confirmRemoveTitle: 'Remove configuration',
        confirmRemove:
          'Remove the price of this component for the size "{{size}}"? The size stops being available for this component.',
        created: 'Size "{{size}}" configured.',
        updated: 'Configuration of size "{{size}}" updated.',
        removed: 'Configuration of size "{{size}}" removed.',
        errors: {
          duplicate:
            'This size already has a configuration (it may have been created in the meantime). The table has been updated.',
          unavailable:
            'The pizza size or the product is no longer active. The table has been updated.',
          notFound:
            'This configuration no longer exists. The table has been updated.',
          invalid:
            'Check the values: the price must be 0 or more and, for stock controlled products, the stock units consumed must be a whole number of 1 or more.',
        },
      },
      errors: {
        notFound: 'This product no longer exists. The list has been updated.',
        referenceNotFound:
          'The product, its category, its component type or one of its allergens no longer exists or has been deactivated. Reload the page and try again.',
        inUse:
          'This product cannot be deactivated because it has prices configured per pizza size. Remove those configurations first.',
        invalid:
          'Check the data: name and description cannot be blank, and a sellable product needs a price of 0 or more.',
        aggregate: {
          AGGREGATE_INVALID_CLASSIFICATION:
            'Choose whether the aggregate is produced or purchased.',
          AGGREGATE_INVALID_ITEMS:
            'The composition of the aggregate is invalid.',
          AGGREGATE_INVALID_QUANTITY:
            'Each item quantity must be a whole number of 1 or more.',
          AGGREGATE_PRODUCED_WITHOUT_ITEMS:
            'A produced aggregate needs at least one item.',
          AGGREGATE_PURCHASED_WITH_ITEMS:
            'A purchased aggregate cannot have a composition.',
          AGGREGATE_DUPLICATE_ITEM:
            'The same product cannot appear twice in the composition.',
          AGGREGATE_SELF_REFERENCE:
            'A product cannot be an item of its own composition.',
          AGGREGATE_ITEM_NOT_FOUND:
            'One of the items no longer exists. Reload the page and choose again.',
          AGGREGATE_ITEM_INACTIVE: 'All items must be active products.',
          AGGREGATE_ITEM_IS_PIZZA: 'A pizza cannot be an item of an aggregate.',
          AGGREGATE_NESTED: 'An aggregate cannot contain another aggregate.',
          AGGREGATE_OWNER_IS_ITEM:
            'This product is an item of another aggregate, so it cannot be an aggregate itself.',
          AGGREGATE_OWNER_IS_PIZZA: 'A pizza cannot be an aggregate.',
        },
      },
    },
    stock: {
      title: 'Stock',
      intro:
        'Current quantity, in abstract stock units, of the products with stock control.',
      searchLabel: 'Product name',
      searchHint:
        'Finds the products whose name contains this text (upper/lower case is ignored).',
      includeInactive: 'Include inactive products',
      empty: 'There are no products with stock control yet.',
      noResults: 'No product with stock matches "{{term}}".',
      col: {
        product: 'Product',
        quantity: 'Current quantity',
      },
      viewProduct: 'View product',
      increase: 'Stock in',
      decrease: 'Stock out',
      set: 'Stock count',
      form: {
        increaseTitle: 'Stock in of {{name}}',
        decreaseTitle: 'Stock out of {{name}}',
        setTitle: 'Stock count of {{name}}',
        increaseAmount: 'Units to add',
        decreaseAmount: 'Units to remove',
        setAmount: 'Counted quantity',
        amount: 'Units',
      },
      confirmUnusualTitle: 'Unusual quantity',
      confirmUnusual:
        'The stock of "{{name}}" will change from {{from}} to {{to}} units. This is far from a usual movement: please confirm the value.',
      counted: 'Stock of "{{name}}" set to {{amount}} unit(s).',
      confirmDecreaseTitle: 'Stock out',
      confirmDecrease:
        'Remove {{amount}} unit(s) of "{{name}}"? Current stock: {{quantity}}.',
      increased: 'Added {{amount}} unit(s) to "{{name}}".',
      decreased: 'Removed {{amount}} unit(s) from "{{name}}".',
      errors: {
        notFound:
          'This product no longer exists or is inactive. The list has been updated.',
        insufficient:
          'There is not enough stock: this stock out would leave a negative quantity (current stock: {{quantity}}).',
        invalid: 'Check the units: they must be a whole number greater than 0.',
        invalidCount:
          'Check the counted quantity: it must be a whole number, 0 or greater.',
        aboveMaximum:
          'The stock of a product cannot exceed {{max}} units. Check the value.',
      },
    },
    predefinedPizzas: {
      title: 'Predefined pizzas',
      create: 'New predefined pizza',
      searchLabel: 'Pizza name',
      searchHint:
        'Finds the pizzas whose product name contains this text (upper/lower case is ignored).',
      empty: 'There are no predefined pizzas yet.',
      noResults: 'No predefined pizza name contains "{{term}}".',
      col: {
        pizza: 'Pizza',
        sizes: 'Sizes',
        components: 'Components',
      },
      componentCount_one: '{{count}} component',
      componentCount_other: '{{count}} components',
      unknownProduct: 'Unknown product',
      detailTitle: 'Predefined pizza "{{name}}"',
      unavailable:
        'This predefined pizza does not exist or has been deactivated.',
      viewProduct: 'View product',
      fields: {
        product: 'Sellable product',
        sizes: 'Available sizes',
        components: 'Default components (in assembly order)',
        allergens: 'Allergens of the components',
      },
      noComponents: 'This pizza has no components.',
      noAllergens: 'The components have no declared allergens.',
      deactivate: 'Deactivate',
      confirmDeactivateTitle: 'Deactivate predefined pizza',
      confirmDeactivate:
        'Deactivate the predefined pizza "{{name}}"? This cannot be undone: it cannot be reactivated, and its product can no longer have a predefined pizza.',
      created: 'Predefined pizza "{{name}}" created.',
      updated: 'Predefined pizza "{{name}}" updated.',
      deactivated: 'Predefined pizza "{{name}}" deactivated.',
      form: {
        createTitle: 'New predefined pizza',
        editTitle: 'Edit predefined pizza "{{name}}"',
        product: 'Sellable product',
        chooseProduct: 'Choose a product',
        productHint:
          'Active sellable products that are not pizza components and do not have a predefined pizza yet.',
        components: 'Default components',
        componentsHint:
          'Choose the active components of each type. Each type has a minimum and a maximum number of components.',
        typeRange: 'Chosen: {{count}} (minimum {{min}}, maximum {{max}})',
        noComponents: 'There are no active components of this type.',
        otherComponents: 'Components without an active type',
        sizes: 'Available sizes',
        sizesHint:
          'Every chosen component needs a price configured for every chosen size.',
      },
      errors: {
        notFound:
          'This predefined pizza no longer exists or has been deactivated. The list has been updated.',
        duplicateProduct:
          'This product already has (or had) a predefined pizza. Choose another product.',
        refused: 'The predefined pizza was not saved:',
        product:
          'The product must be active, sellable and not a pizza component.',
        sizesInactive: 'These sizes are no longer active: {{names}}.',
        componentsInvalid:
          'These components are no longer active pizza components: {{names}}.',
        typeMin: '{{type}}: choose at least {{min}} (chosen: {{count}}).',
        typeMax: '{{type}}: choose at most {{max}} (chosen: {{count}}).',
        sizeWithoutConfiguration:
          '{{size}}: there is no price configured for {{names}}.',
        invalid:
          'Check the choices: each component type needs between its minimum and maximum of active components, and every component needs a price for every chosen size.',
      },
    },
    catalogue: {
      title: 'Catalogue',
      intro:
        'Products for sale, with their prices and allergens. Check the allergens before ordering.',
      searchLabel: 'Product name or description',
      searchHint:
        'Finds the products whose name or description contains this text (upper/lower case is ignored).',
      category: 'Category',
      allCategories: 'All categories',
      empty: 'There are no products for sale yet.',
      noResults: 'No product for sale matches the search and the category.',
      price: 'Price',
      allergens: 'Allergens',
      noAllergens: 'No allergens declared.',
      view: 'View details',
      backToCatalogue: 'Back to the catalogue',
      unavailable:
        'This product is not in the catalogue: it does not exist or is no longer for sale.',
      sizePrices: 'Prices per size',
      size: 'Size',
      unknownSize: 'Unknown size',
      pizza: {
        title: 'Default configuration',
        sizes: 'Available sizes',
        otherComponents: 'Other components',
      },
    },
    customers: {
      title: 'Customers',
      create: 'New customer',
      searchLabel: 'Name, email or phone',
      searchHint:
        'Finds the customers whose name, email or phone number contains this text.',
      empty: 'There are no customers yet.',
      noResults: 'No customer matches "{{term}}".',
      fields: {
        name: 'Name',
        email: 'Email',
        phoneNumber: 'Phone',
        address: 'Address',
        city: 'City',
        dietaryRestrictions: 'Dietary restrictions',
      },
      noRestrictions: 'No dietary restrictions registered.',
      unknownAllergen: 'Removed allergen',
      detailTitle: 'Customer "{{name}}"',
      unavailable: 'This customer does not exist.',
      inactiveNote:
        'This customer is inactive. You can reactivate it at any time.',
      deactivate: 'Deactivate',
      activate: 'Reactivate',
      confirmDeactivateTitle: 'Deactivate customer',
      confirmDeactivate:
        'Deactivate the customer "{{name}}"? The data is kept and the customer can be reactivated later.',
      created: 'Customer "{{name}}" created.',
      updated: 'Customer "{{name}}" updated.',
      deactivated: 'Customer "{{name}}" deactivated.',
      activated: 'Customer "{{name}}" reactivated.',
      form: {
        createTitle: 'New customer',
        editTitle: 'Edit customer "{{name}}"',
        name: 'Name',
        contacts: 'Contacts',
        email: 'Email',
        phoneNumber: 'Phone number',
        nameHint: 'Letters only (accents allowed), e.g. Ana Sá-Pereira.',
        phoneHint: 'Portuguese number, e.g. 912 345 678 or +351 212 345 678.',
        address: 'Address',
        street: 'Street',
        houseNumber: 'Number',
        complement: 'Complement (floor, door...)',
        postalCode: 'Postal code',
        postalCodeHint: 'Format 1234-567. It must match the city.',
        city: 'City',
        district: 'District',
        dietaryRestrictions: 'Dietary restrictions (allergens to avoid)',
        noAllergens: 'There are no active allergens.',
      },
      errors: {
        notFound: 'This customer no longer exists. The list has been updated.',
        conflict:
          'The change was refused because it conflicts with existing data.',
      },
    },
    myData: {
      title: 'My data',
      contactsTitle: 'Contacts and address',
      readOnly: 'To change your data, please contact LaPrizza.',
      noProfile: 'Your account does not have customer data yet.',
      createTitle: 'Complete your customer data',
      createIntro:
        'Your account does not have customer data yet. Fill in your name and address to use the customer features.',
      emailFromAccount: '(the e-mail of your account)',
      phoneHint: 'Leave empty to use the phone number of your account.',
      created: 'Your customer data was saved.',
      errors: {
        emailInUse:
          'There is already a customer record with the e-mail of your account. Please contact LaPrizza.',
      },
    },
  },
  pt: {
    nav: {
      productCategories: 'Categorias de Produto',
      allergens: 'Alergénios',
      pizzaSizes: 'Tamanhos de Pizza',
      pizzaComponentTypes: 'Tipos de Componente',
      products: 'Produtos',
      stock: 'Stock',
      predefinedPizzas: 'Pizzas Predefinidas',
      catalogue: 'Catálogo',
      customers: 'Clientes',
      myData: 'Os Meus Dados',
    },
    feedback: {
      validation: {
        pizzaComponentType_range: 'O máximo não pode ser inferior ao mínimo.',
        pizzaComponentType_orderTaken:
          'Já existe outro tipo de componente ativo com esta ordem de montagem.',
        pizzaComponentType_nameTaken:
          'Já existe outro tipo de componente ativo com este nome.',
        product_nameTaken: 'Já existe um produto com este nome.',
        customer_phone:
          'Indique um número português: 9 dígitos começados por 2 ou por 91, 92, 93 ou 96 (opcionalmente +351).',
        customer_postalCode: 'Use o formato 1234-567.',
        customer_postalCodeCity:
          'O código postal não corresponde à localidade. Verifique os dois campos.',
        customer_emailTaken: 'Já existe outro cliente com este email.',
        customer_phoneTaken: 'Já existe outro cliente com este telefone.',
        customer_contactTaken:
          'Já existe outro cliente com este email ou com este telefone.',
      },
    },
    entity: {
      actions: 'Ações',
      status: 'Estado',
      active: 'Ativo',
      inactive: 'Inativo',
      view: 'Ver',
      edit: 'Editar',
      close: 'Fechar',
      cancel: 'Cancelar',
      save: 'Guardar',
      saving: 'A guardar...',
      search: 'Pesquisar',
      clear: 'Limpar',
      backToList: 'Voltar à lista',
      readOnly: 'Pode consultar esta informação, mas não a pode alterar.',
      loadFailed: 'Não foi possível carregar os dados.',
      empty: 'Ainda não existem registos.',
      noResults: 'Nenhum resultado corresponde a "{{term}}".',
      unavailable: 'Este registo não existe ou já não está disponível.',
      required: 'Os campos assinalados com * são obrigatórios.',
    },
    productCategories: {
      title: 'Categorias de produto',
      create: 'Nova categoria',
      searchLabel: 'Nome da categoria',
      searchHint:
        'Encontra a categoria com exatamente este nome (maiúsculas/minúsculas e acentos são ignorados). Deixe vazio para ver todas as categorias ativas.',
      empty: 'Ainda não existem categorias de produto.',
      noResults: 'Não existe nenhuma categoria com o nome "{{term}}".',
      col: {
        name: 'Nome',
      },
      detailTitle: 'Categoria "{{name}}"',
      unavailable: 'Esta categoria não existe ou foi removida.',
      products: 'Produtos desta categoria',
      noProducts: 'Nenhum produto usa esta categoria.',
      remove: 'Remover',
      confirmRemoveTitle: 'Remover categoria',
      confirmRemove:
        'Remover a categoria "{{name}}"? Deixa de estar disponível para produtos.',
      created: 'Categoria "{{name}}" criada.',
      updated: 'Categoria "{{name}}" atualizada.',
      removed: 'Categoria "{{name}}" removida.',
      form: {
        createTitle: 'Nova categoria de produto',
        editTitle: 'Editar a categoria "{{name}}"',
        name: 'Nome',
      },
      errors: {
        duplicate:
          'Já existe uma categoria com este nome, ou esta categoria foi entretanto removida.',
        notFound: 'Esta categoria já não existe. A lista foi atualizada.',
        inUse:
          'Esta categoria não pode ser removida porque é usada por produtos. Mude primeiro esses produtos para outra categoria.',
      },
    },
    allergens: {
      title: 'Alergénios',
      create: 'Novo alergénio',
      searchLabel: 'Nome do alergénio',
      searchHint:
        'Encontra os alergénios cujo nome contém este texto (maiúsculas/minúsculas são ignoradas). Deixe vazio para ver todos os alergénios ativos.',
      empty: 'Ainda não existem alergénios.',
      noResults: 'Nenhum alergénio tem "{{term}}" no nome.',
      col: {
        name: 'Nome',
      },
      detailTitle: 'Alergénio "{{name}}"',
      unavailable: 'Este alergénio não existe ou foi desativado.',
      noEdit: 'O nome de um alergénio não pode ser alterado depois de criado.',
      deactivate: 'Desativar',
      confirmDeactivateTitle: 'Desativar alergénio',
      confirmDeactivate:
        'Desativar o alergénio "{{name}}"? Deixa de poder ser usado em produtos e restrições alimentares, e não pode ser reativado.',
      created: 'Alergénio "{{name}}" criado.',
      deactivated: 'Alergénio "{{name}}" desativado.',
      form: {
        createTitle: 'Novo alergénio',
        name: 'Nome',
        nameHint:
          'Confirme o nome antes de guardar: não pode ser alterado depois.',
      },
      errors: {
        duplicate:
          'Já existe um alergénio com este nome (pode estar desativado).',
        notFound:
          'Este alergénio já não existe ou foi desativado. A lista foi atualizada.',
        inUse:
          'Este alergénio não pode ser desativado porque é usado por produtos ou nas restrições alimentares de clientes.',
      },
    },
    pizzaSizes: {
      title: 'Tamanhos de pizza',
      create: 'Novo tamanho',
      searchLabel: 'Nome do tamanho',
      searchHint:
        'Encontra os tamanhos cujo nome contém este texto (maiúsculas/minúsculas são ignoradas). Os tamanhos inativos também aparecem.',
      empty: 'Ainda não existem tamanhos de pizza.',
      noResults: 'Nenhum tamanho tem "{{term}}" no nome.',
      col: {
        name: 'Nome',
      },
      detailTitle: 'Tamanho "{{name}}"',
      unavailable: 'Este tamanho de pizza não existe.',
      inactiveNote:
        'Este tamanho está inativo: não pode ser usado em novas configurações de componentes nem em pizzas predefinidas até ser reativado.',
      deactivate: 'Desativar',
      activate: 'Reativar',
      confirmDeactivateTitle: 'Desativar tamanho',
      confirmDeactivate:
        'Desativar o tamanho "{{name}}"? Deixa de poder ser usado em novas configurações e pizzas predefinidas. Pode reativá-lo mais tarde.',
      created: 'Tamanho "{{name}}" criado.',
      updated: 'Tamanho "{{name}}" atualizado.',
      deactivated: 'Tamanho "{{name}}" desativado.',
      activated: 'Tamanho "{{name}}" reativado.',
      form: {
        createTitle: 'Novo tamanho de pizza',
        editTitle: 'Editar o tamanho "{{name}}"',
        name: 'Nome',
        nameHint:
          'Entre 3 e 50 caracteres, por exemplo Pequena, Média, Familiar.',
      },
      errors: {
        duplicate: 'Já existe um tamanho de pizza com este nome.',
        notFound:
          'Este tamanho de pizza já não existe. A lista foi atualizada.',
        inUse:
          'Este tamanho não pode ser desativado porque há componentes de pizza com preço configurado para ele. Remova primeiro essas configurações.',
      },
    },
    pizzaComponentTypes: {
      title: 'Tipos de componente de pizza',
      create: 'Novo tipo de componente',
      searchLabel: 'Nome do tipo de componente',
      searchHint:
        'Encontra o tipo com exatamente este nome (maiúsculas/minúsculas e acentos são ignorados). Deixe vazio para ver todos os tipos ativos pela ordem de montagem.',
      empty: 'Ainda não existem tipos de componente de pizza.',
      noResults: 'Não existe nenhum tipo de componente com o nome "{{term}}".',
      col: {
        assemblyOrder: 'Ordem',
        name: 'Nome',
        minQuantity: 'Mínimo',
        maxQuantity: 'Máximo',
      },
      unlimited: 'Ilimitado',
      detailTitle: 'Tipo de componente "{{name}}"',
      unavailable: 'Este tipo de componente não existe ou foi removido.',
      remove: 'Remover',
      confirmRemoveTitle: 'Remover tipo de componente',
      confirmRemove:
        'Remover o tipo de componente "{{name}}"? A sua ordem de montagem fica livre para outro tipo.',
      created: 'Tipo de componente "{{name}}" criado.',
      updated: 'Tipo de componente "{{name}}" atualizado.',
      removed: 'Tipo de componente "{{name}}" removido.',
      form: {
        createTitle: 'Novo tipo de componente de pizza',
        editTitle: 'Editar o tipo de componente "{{name}}"',
        name: 'Nome',
        assemblyOrder: 'Ordem de montagem',
        assemblyOrderHint:
          'Posição deste tipo na montagem da pizza (1 = primeiro). Cada tipo ativo tem a sua ordem.',
        minQuantity: 'Quantidade mínima',
        minHint: 'Use 0 quando o tipo é opcional numa pizza.',
        maxQuantity: 'Quantidade máxima',
        unlimited: 'Ilimitado (sem máximo)',
      },
      errors: {
        notFound:
          'Este tipo de componente já não existe ou foi removido. A lista foi atualizada.',
        inUse:
          'Este tipo de componente não pode ser removido porque há produtos deste tipo.',
        invalidRules:
          'Verifique os valores: a ordem tem de ser pelo menos 1, o mínimo pelo menos 0, o máximo pelo menos 1, e o máximo não pode ser inferior ao mínimo.',
      },
    },
    products: {
      title: 'Produtos',
      create: 'Novo produto',
      searchLabel: 'Nome ou descrição',
      searchHint:
        'Encontra os produtos cujo nome ou descrição contém este texto (maiúsculas/minúsculas são ignoradas).',
      empty: 'Ainda não existem produtos.',
      noResults: 'Nenhum produto corresponde à pesquisa e aos filtros.',
      filters: {
        category: 'Categoria',
        allCategories: 'Todas as categorias',
        sellable: 'Vendável',
        status: 'Estado',
        all: 'Todos',
        yes: 'Sim',
        no: 'Não',
        active: 'Ativos',
        inactive: 'Inativos',
      },
      col: {
        name: 'Nome',
        category: 'Categoria',
        sellable: 'Vendável',
        stock: 'Controlo de stock',
        component: 'Componente de pizza',
      },
      yes: 'Sim',
      no: 'Não',
      unknownCategory: 'Categoria removida',
      unknownType: 'Tipo removido',
      unknownProduct: 'Produto desconhecido',
      detailTitle: 'Produto "{{name}}"',
      unavailable: 'Este produto não existe.',
      inactiveNote:
        'Este produto está inativo: não é vendido e não pode ser usado em novos agregados, configurações ou pizzas até ser reativado.',
      sections: {
        characteristics: 'Características',
        commercial: 'Informação comercial',
        allergens: 'Alergénios',
        aggregate: 'Agregado',
      },
      fields: {
        description: 'Descrição',
        category: 'Categoria',
        sellable: 'Vendável',
        price: 'Preço',
        stockControlled: 'Controlo de stock',
        pizzaComponent: 'Componente de pizza',
        componentType: 'Tipo de componente',
        classification: 'Tipo',
      },
      noAllergens: 'Sem alergénios declarados.',
      allergensHidden:
        '{{count}} alergénio(s) declarado(s). Os nomes só estão disponíveis para gestores.',
      aggregate: {
        none: 'Este produto não é um agregado.',
        PRODUCED: 'Produzido',
        PURCHASED: 'Comprado',
        purchasedNote: 'Agregado comprado: não tem composição.',
        product: 'Produto',
        quantity: 'Quantidade',
      },
      deactivate: 'Desativar',
      activate: 'Reativar',
      confirmDeactivateTitle: 'Desativar produto',
      confirmDeactivate:
        'Desativar o produto "{{name}}"? Sai do catálogo e não pode ser usado em novos agregados ou pizzas. Pode reativá-lo mais tarde.',
      created: 'Produto "{{name}}" criado.',
      updated: 'Produto "{{name}}" atualizado.',
      deactivated: 'Produto "{{name}}" desativado.',
      activated: 'Produto "{{name}}" reativado.',
      form: {
        createTitle: 'Novo produto',
        editTitle: 'Editar o produto "{{name}}"',
        name: 'Nome',
        description: 'Descrição',
        category: 'Categoria',
        chooseCategory: 'Escolha uma categoria',
        sellable: 'Vendável (aparece no catálogo)',
        price: 'Preço (€)',
        stockControlled: 'Com controlo de stock',
        stockLocked:
          'O controlo de stock é escolhido na criação do produto e não pode ser alterado depois.',
        pizzaComponent: 'Componente de pizza',
        componentType: 'Tipo de componente',
        chooseType: 'Escolha um tipo de componente',
        allergens: 'Alergénios',
        noAllergensAvailable: 'Não existem alergénios ativos.',
        aggregate: 'Agregado',
        aggregateNone: 'Não é um agregado',
        aggregateProduced: 'Produzido (feito a partir de outros produtos)',
        aggregatePurchased: 'Comprado (comprado pronto, sem composição)',
        items: 'Composição',
        itemsHint:
          'Só podem ser itens produtos ativos que não sejam agregados. Cada produto só pode ser usado uma vez.',
        itemProduct: 'Item {{index}}: produto',
        itemQuantity: 'Item {{index}}: quantidade',
        chooseProduct: 'Escolha um produto',
        addItem: 'Adicionar item',
        removeItem: 'Remover o item {{index}}',
        noCandidates: 'Não existem produtos que possam ser itens.',
      },
      sizeConfigs: {
        title: 'Preços por tamanho de pizza',
        intro:
          'Preço deste componente em cada tamanho de pizza. Cada tamanho tem no máximo uma configuração.',
        size: 'Tamanho',
        price: 'Preço (€)',
        stockUnits: 'Unidades de stock consumidas',
        notConfigured: 'Sem configuração',
        configure: 'Configurar',
        edit: 'Editar',
        remove: 'Remover',
        noSizes: 'Não existem tamanhos de pizza ativos para configurar.',
        inactiveProduct:
          'O produto está inativo: só é possível remover configurações até ser reativado.',
        createTitle: 'Configurar o tamanho {{size}}',
        editTitle: 'Editar a configuração do tamanho {{size}}',
        confirmRemoveTitle: 'Remover configuração',
        confirmRemove:
          'Remover o preço deste componente para o tamanho "{{size}}"? O tamanho deixa de estar disponível para este componente.',
        created: 'Tamanho "{{size}}" configurado.',
        updated: 'Configuração do tamanho "{{size}}" atualizada.',
        removed: 'Configuração do tamanho "{{size}}" removida.',
        errors: {
          duplicate:
            'Este tamanho já tem configuração (pode ter sido criada entretanto). A tabela foi atualizada.',
          unavailable:
            'O tamanho de pizza ou o produto já não está ativo. A tabela foi atualizada.',
          notFound: 'Esta configuração já não existe. A tabela foi atualizada.',
          invalid:
            'Verifique os valores: o preço tem de ser igual ou superior a 0 e, em produtos com controlo de stock, as unidades de stock consumidas têm de ser um número inteiro igual ou superior a 1.',
        },
      },
      errors: {
        notFound: 'Este produto já não existe. A lista foi atualizada.',
        referenceNotFound:
          'O produto, a sua categoria, o seu tipo de componente ou um dos alergénios já não existe ou foi desativado. Recarregue a página e tente de novo.',
        inUse:
          'Este produto não pode ser desativado porque tem preços configurados por tamanho de pizza. Remova primeiro essas configurações.',
        invalid:
          'Verifique os dados: o nome e a descrição não podem ficar em branco, e um produto vendável precisa de um preço igual ou superior a 0.',
        aggregate: {
          AGGREGATE_INVALID_CLASSIFICATION:
            'Escolha se o agregado é produzido ou comprado.',
          AGGREGATE_INVALID_ITEMS: 'A composição do agregado é inválida.',
          AGGREGATE_INVALID_QUANTITY:
            'A quantidade de cada item tem de ser um número inteiro igual ou superior a 1.',
          AGGREGATE_PRODUCED_WITHOUT_ITEMS:
            'Um agregado produzido precisa de pelo menos um item.',
          AGGREGATE_PURCHASED_WITH_ITEMS:
            'Um agregado comprado não pode ter composição.',
          AGGREGATE_DUPLICATE_ITEM:
            'O mesmo produto não pode aparecer duas vezes na composição.',
          AGGREGATE_SELF_REFERENCE:
            'Um produto não pode ser item da sua própria composição.',
          AGGREGATE_ITEM_NOT_FOUND:
            'Um dos itens já não existe. Recarregue a página e escolha de novo.',
          AGGREGATE_ITEM_INACTIVE: 'Todos os itens têm de ser produtos ativos.',
          AGGREGATE_ITEM_IS_PIZZA:
            'Uma pizza não pode ser item de um agregado.',
          AGGREGATE_NESTED: 'Um agregado não pode conter outro agregado.',
          AGGREGATE_OWNER_IS_ITEM:
            'Este produto é item de outro agregado, por isso não pode ser ele próprio um agregado.',
          AGGREGATE_OWNER_IS_PIZZA: 'Uma pizza não pode ser um agregado.',
        },
      },
    },
    stock: {
      title: 'Stock',
      intro:
        'Quantidade atual, em unidades abstratas de stock, dos produtos com controlo de stock.',
      searchLabel: 'Nome do produto',
      searchHint:
        'Encontra os produtos cujo nome contém este texto (maiúsculas/minúsculas são ignoradas).',
      includeInactive: 'Incluir produtos inativos',
      empty: 'Ainda não há produtos com controlo de stock.',
      noResults: 'Nenhum produto com stock corresponde a "{{term}}".',
      col: {
        product: 'Produto',
        quantity: 'Quantidade atual',
      },
      viewProduct: 'Ver produto',
      increase: 'Entrada',
      decrease: 'Saída',
      set: 'Contagem',
      form: {
        increaseTitle: 'Entrada de stock de {{name}}',
        decreaseTitle: 'Saída de stock de {{name}}',
        setTitle: 'Contagem de stock de {{name}}',
        increaseAmount: 'Unidades a adicionar',
        decreaseAmount: 'Unidades a retirar',
        setAmount: 'Quantidade contada',
        amount: 'Unidades',
      },
      confirmUnusualTitle: 'Quantidade fora do normal',
      confirmUnusual:
        'O stock de "{{name}}" vai passar de {{from}} para {{to}} unidades. É um movimento muito acima do habitual: confirme o valor.',
      counted: 'O stock de "{{name}}" passou a {{amount}} unidade(s).',
      confirmDecreaseTitle: 'Saída de stock',
      confirmDecrease:
        'Retirar {{amount}} unidade(s) de "{{name}}"? Stock atual: {{quantity}}.',
      increased: 'Foram adicionadas {{amount}} unidade(s) a "{{name}}".',
      decreased: 'Foram retiradas {{amount}} unidade(s) de "{{name}}".',
      errors: {
        notFound:
          'Este produto já não existe ou está inativo. A lista foi atualizada.',
        insufficient:
          'Não há stock suficiente: esta saída deixaria o stock negativo (stock atual: {{quantity}}).',
        invalid:
          'Verifique as unidades: têm de ser um número inteiro maior do que 0.',
        invalidCount:
          'Verifique a quantidade contada: tem de ser um número inteiro igual ou maior do que 0.',
        aboveMaximum:
          'O stock de um produto não pode ultrapassar {{max}} unidades. Verifique o valor.',
      },
    },
    predefinedPizzas: {
      title: 'Pizzas predefinidas',
      create: 'Nova pizza predefinida',
      searchLabel: 'Nome da pizza',
      searchHint:
        'Encontra as pizzas cujo nome do produto contém este texto (maiúsculas/minúsculas são ignoradas).',
      empty: 'Ainda não existem pizzas predefinidas.',
      noResults: 'Nenhuma pizza predefinida tem "{{term}}" no nome.',
      col: {
        pizza: 'Pizza',
        sizes: 'Tamanhos',
        components: 'Componentes',
      },
      componentCount_one: '{{count}} componente',
      componentCount_other: '{{count}} componentes',
      unknownProduct: 'Produto desconhecido',
      detailTitle: 'Pizza predefinida "{{name}}"',
      unavailable: 'Esta pizza predefinida não existe ou foi desativada.',
      viewProduct: 'Ver produto',
      fields: {
        product: 'Produto vendável',
        sizes: 'Tamanhos disponíveis',
        components: 'Componentes por omissão (pela ordem de montagem)',
        allergens: 'Alergénios dos componentes',
      },
      noComponents: 'Esta pizza não tem componentes.',
      noAllergens: 'Os componentes não têm alergénios declarados.',
      deactivate: 'Desativar',
      confirmDeactivateTitle: 'Desativar pizza predefinida',
      confirmDeactivate:
        'Desativar a pizza predefinida "{{name}}"? Não pode ser desfeito: não pode ser reativada, e o seu produto deixa de poder ter uma pizza predefinida.',
      created: 'Pizza predefinida "{{name}}" criada.',
      updated: 'Pizza predefinida "{{name}}" atualizada.',
      deactivated: 'Pizza predefinida "{{name}}" desativada.',
      form: {
        createTitle: 'Nova pizza predefinida',
        editTitle: 'Editar a pizza predefinida "{{name}}"',
        product: 'Produto vendável',
        chooseProduct: 'Escolha um produto',
        productHint:
          'Produtos ativos e vendáveis que não são componentes de pizza e ainda não têm pizza predefinida.',
        components: 'Componentes por omissão',
        componentsHint:
          'Escolha os componentes ativos de cada tipo. Cada tipo tem um número mínimo e máximo de componentes.',
        typeRange: 'Escolhidos: {{count}} (mínimo {{min}}, máximo {{max}})',
        noComponents: 'Não existem componentes ativos deste tipo.',
        otherComponents: 'Componentes sem tipo ativo',
        sizes: 'Tamanhos disponíveis',
        sizesHint:
          'Cada componente escolhido precisa de um preço configurado para cada tamanho escolhido.',
      },
      errors: {
        notFound:
          'Esta pizza predefinida já não existe ou foi desativada. A lista foi atualizada.',
        duplicateProduct:
          'Este produto já tem (ou já teve) uma pizza predefinida. Escolha outro produto.',
        refused: 'A pizza predefinida não foi guardada:',
        product:
          'O produto tem de estar ativo, ser vendável e não ser componente de pizza.',
        sizesInactive: 'Estes tamanhos já não estão ativos: {{names}}.',
        componentsInvalid:
          'Estes componentes já não são componentes de pizza ativos: {{names}}.',
        typeMin:
          '{{type}}: escolha pelo menos {{min}} (escolhidos: {{count}}).',
        typeMax: '{{type}}: escolha no máximo {{max}} (escolhidos: {{count}}).',
        sizeWithoutConfiguration:
          '{{size}}: não há preço configurado para {{names}}.',
        invalid:
          'Verifique as escolhas: cada tipo de componente precisa de um número de componentes ativos entre o seu mínimo e o seu máximo, e cada componente precisa de preço para cada tamanho escolhido.',
      },
    },
    catalogue: {
      title: 'Catálogo',
      intro:
        'Produtos à venda, com os preços e os alergénios. Confirme os alergénios antes de encomendar.',
      searchLabel: 'Nome ou descrição do produto',
      searchHint:
        'Encontra os produtos cujo nome ou descrição contém este texto (maiúsculas/minúsculas são ignoradas).',
      category: 'Categoria',
      allCategories: 'Todas as categorias',
      empty: 'Ainda não há produtos à venda.',
      noResults: 'Nenhum produto à venda corresponde à pesquisa e à categoria.',
      price: 'Preço',
      allergens: 'Alergénios',
      noAllergens: 'Sem alergénios declarados.',
      view: 'Ver detalhes',
      backToCatalogue: 'Voltar ao catálogo',
      unavailable:
        'Este produto não está no catálogo: não existe ou já não está à venda.',
      sizePrices: 'Preços por tamanho',
      size: 'Tamanho',
      unknownSize: 'Tamanho desconhecido',
      pizza: {
        title: 'Configuração por omissão',
        sizes: 'Tamanhos disponíveis',
        otherComponents: 'Outros componentes',
      },
    },
    customers: {
      title: 'Clientes',
      create: 'Novo cliente',
      searchLabel: 'Nome, email ou telefone',
      searchHint:
        'Encontra os clientes cujo nome, email ou telefone contém este texto.',
      empty: 'Ainda não existem clientes.',
      noResults: 'Nenhum cliente corresponde a "{{term}}".',
      fields: {
        name: 'Nome',
        email: 'Email',
        phoneNumber: 'Telefone',
        address: 'Morada',
        city: 'Localidade',
        dietaryRestrictions: 'Restrições alimentares',
      },
      noRestrictions: 'Sem restrições alimentares registadas.',
      unknownAllergen: 'Alergénio removido',
      detailTitle: 'Cliente "{{name}}"',
      unavailable: 'Este cliente não existe.',
      inactiveNote:
        'Este cliente está inativo. Pode reativá-lo a qualquer momento.',
      deactivate: 'Desativar',
      activate: 'Reativar',
      confirmDeactivateTitle: 'Desativar cliente',
      confirmDeactivate:
        'Desativar o cliente "{{name}}"? Os dados são mantidos e o cliente pode ser reativado mais tarde.',
      created: 'Cliente "{{name}}" criado.',
      updated: 'Cliente "{{name}}" atualizado.',
      deactivated: 'Cliente "{{name}}" desativado.',
      activated: 'Cliente "{{name}}" reativado.',
      form: {
        createTitle: 'Novo cliente',
        editTitle: 'Editar o cliente "{{name}}"',
        name: 'Nome',
        contacts: 'Contactos',
        email: 'Email',
        phoneNumber: 'Telefone',
        nameHint: 'Apenas letras (com acentos), p. ex. Ana Sá-Pereira.',
        phoneHint:
          'Número português, por exemplo 912 345 678 ou +351 212 345 678.',
        address: 'Morada',
        street: 'Rua',
        houseNumber: 'Número',
        complement: 'Complemento (andar, porta...)',
        postalCode: 'Código postal',
        postalCodeHint: 'Formato 1234-567. Tem de corresponder à localidade.',
        city: 'Localidade',
        district: 'Distrito',
        dietaryRestrictions: 'Restrições alimentares (alergénios a evitar)',
        noAllergens: 'Não existem alergénios ativos.',
      },
      errors: {
        notFound: 'Este cliente já não existe. A lista foi atualizada.',
        conflict:
          'A alteração foi recusada porque entra em conflito com dados existentes.',
      },
    },
    myData: {
      title: 'Os meus dados',
      contactsTitle: 'Contactos e morada',
      readOnly: 'Para alterar os seus dados, contacte a LaPrizza.',
      noProfile: 'A sua conta ainda não tem dados de cliente associados.',
      createTitle: 'Complete os seus dados de cliente',
      createIntro:
        'A sua conta ainda não tem dados de cliente. Indique o seu nome e a sua morada para usar as funcionalidades de cliente.',
      emailFromAccount: '(o email da sua conta)',
      phoneHint: 'Deixe vazio para usar o telefone da sua conta.',
      created: 'Os seus dados de cliente foram guardados.',
      errors: {
        emailInUse:
          'Já existe um registo de cliente com o email da sua conta. Contacte a LaPrizza.',
      },
    },
  },
};
