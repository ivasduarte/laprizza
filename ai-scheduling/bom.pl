% Bill of Materials calculation of the LaPrizza AI service (AI01).
% Works on the knowledge base already loaded by kb.pl (inside with_snapshot/2) and never
% changes stock: every balance is a result only.
%
%   pizza -> components -> ingredients of the components produced internally
%
% Pass 1 handles the aggregates (demand only comes from the pizzas); pass 2 handles every
% simple product once, with its direct demand plus the demand of the aggregates produced.

:- module(bom, [ bom_calculate/2, bom_calculate/3, bom_from_file/2,
                 print_bom/1, bom_print_file/1 ]).

:- use_module(kb).
:- use_module(library(assoc)).
:- use_module(library(apply)).
:- use_module(library(lists)).
:- use_module(library(pairs)).
:- use_module(library(option)).
:- use_module(library(http/json)).

% Back end issues that make a recipe unusable for the pizza and size they refer to.
blocking_issue('MISSING_OR_INVALID_STOCK_UNITS').
blocking_issue('UNKNOWN_COMPONENT').

% ---------------------------------------------------------------------------------------------
% Public interface
% ---------------------------------------------------------------------------------------------

bom_calculate(Request, Result) :-
    bom_calculate(Request, Result, []).

bom_calculate(Request, Result, Options) :-
    ( option(now(Now), Options) -> true ; get_time(Now) ),
    scenario_info(Scenario),
    inputs_info(Inputs),
    order_lines(Lines),
    request_problems(Request, RequestProblems),
    order_problems(Lines, OrderProblems),
    append(RequestProblems, OrderProblems, Problems0),
    warnings(Lines, Warnings),
    (   Problems0 == []
    ->  calculate(Lines, Rows),
        stock_problems(Rows, StockProblems)
    ;   Rows = [], StockProblems = []
    ),
    append(Problems0, StockProblems, Problems1),
    sort_problems(Problems1, Problems),
    (   Problems == []
    ->  ok_result(Now, Scenario, Inputs, Lines, Rows, Warnings, Result)
    ;   Result = _{ status: "invalid_data", simulation: true, scenario: Scenario, 
                    inputs: Inputs, problems: Problems, warnings: Warnings }
    ).

bom_from_file(Path, Result) :-
    setup_call_cleanup(open(Path, read, In, [encoding(utf8)]),
                       json_read_dict(In, Dict),
                       close(In)),
    catch(with_snapshot(Dict, ( request_from_kb(Request), bom_calculate(Request, Result) )),
          kb_error(invalid_data(Problems)),
          Result = _{ status: "invalid_data", simulation: true, problems: Problems }).

print_bom(Result) :-
    json_write_dict(current_output, Result, [width(100)]),
    nl.

bom_print_file(Path) :-
    bom_from_file(Path, Result),
    print_bom(Result).

request_from_kb(_{scenarioId: Id, stockMode: Mode}) :-
    kb_scenario(Id, _, _, _, Mode), !.
request_from_kb(_{}).

% ---------------------------------------------------------------------------------------------
% Context of the result: scenario, inputs and order lines
% ---------------------------------------------------------------------------------------------

scenario_info(_{id: Id, name: Name, version: Version, stockMode: Mode}) :-
    kb_scenario(Id, Name, Version, _, Mode), !.
scenario_info(null).

inputs_info(_{snapshotId: SnapshotId, sources: Sources}) :-
    ( kb_meta(SnapshotId, _, _) -> true ; SnapshotId = null ),
    findall(Kind-Info, kb_source(Kind, Info), Pairs),
    dict_pairs(Sources, _, Pairs).

order_lines(Lines) :-
    findall(line(Order, Pizza, Size, Quantity), ordered_item(Order, Pizza, Size, Quantity), Lines0),
    msort(Lines0, Lines).

ordered_pizza_size(Lines, Pizza, Size) :-
    findall(P-S, member(line(_, P, S, _), Lines), Pairs0),
    sort(Pairs0, Pairs),
    member(Pizza-Size, Pairs).

% ---------------------------------------------------------------------------------------------
% Phase A: request validation (every problem is collected)
% ---------------------------------------------------------------------------------------------

request_problems(Request, Problems) :-
    (   \+ valid_request(Request)
    ->  problem("INVALID_REQUEST", [reason-"scenarioId and stockMode are required"], P),
        Problems = [P]
    ;   \+ kb_scenario(_, _, _, _, _)
    ->  problem("INVALID_SNAPSHOT", [reason-"no_scenario"], P),
        Problems = [P]
    ;   kb_scenario(Id, _, _, _, Mode),
        get_dict(scenarioId, Request, ReqId), get_dict(stockMode, Request, ReqMode),
        (   same_text(Id, ReqId), same_text(Mode, ReqMode)
        ->  Problems = []
        ;   problem("SCENARIO_MISMATCH",
                    [requested-_{scenarioId: ReqId, stockMode: ReqMode},
                     loaded-_{scenarioId: Id, stockMode: Mode}], P),
            Problems = [P]
        )
    ).

valid_request(Request) :-
    is_dict(Request),
    get_dict(scenarioId, Request, Id), text(Id),
    get_dict(stockMode, Request, Mode), text(Mode).

order_problems(Lines, Problems) :-
    findall(P, order_problem(Lines, P), Problems).

order_problem(Lines, P) :-
    ordered_pizza_size(Lines, Pizza, Size),
    (   \+ pizza(Pizza)
    ->  problem("NOT_PREDEFINED_PIZZA", [pizzaId-Pizza], P)
    ;   \+ pizza_size(Pizza, Size)
    ->  problem("INVALID_SIZE", [pizzaId-Pizza, sizeId-Size], P)
    ;   incomplete_recipe(Pizza, Size, Reason, Component),
        problem("INCOMPLETE_RECIPE",
                [pizzaId-Pizza, sizeId-Size, reason-Reason, componentId-Component], P)
    ).

incomplete_recipe(Pizza, Size, "no_bom_lines", null) :-
    \+ bom_item(Pizza, Size, _, _).
incomplete_recipe(Pizza, Size, Code, Component) :-
    issue_for(Pizza, Size, Code, Component),
    blocking_issue(Code).
incomplete_recipe(Pizza, Size, "unmeasured_produced_aggregate", Component) :-
    issue_for(Pizza, Size, 'UNMEASURED_NON_STOCK_COMPONENT', Component),
    aggregate(Component, production).

% A back end issue that refers to this pizza and size.
issue_for(Pizza, Size, Code, Component) :-
    kb_issue(Code, Issue),
    get_dict(pizzaId, Issue, P0), same_text(Pizza, P0),
    get_dict(sizeId, Issue, S0), same_text(Size, S0),
    (   get_dict(componentId, Issue, C0), C0 \== null -> atom_string(Component, C0)
    ;   Component = null
    ).

% MISSING_SCENARIO_STOCK / MISSING_STOCK: a stock controlled item needed without a stock entry.
stock_problems(Rows, Problems) :-
    ( kb_scenario(_, _, _, _, Mode) -> true ; Mode = scenario ),
    ( Mode == live -> Code = "MISSING_STOCK" ; Code = "MISSING_SCENARIO_STOCK" ),
    findall(P,
            ( member(Row, Rows),
              get_dict(available, Row, missing),
              get_dict(productId, Row, Id),
              get_dict(required, Row, Required),
              problem(Code, [productId-Id, required-Required], P) ),
            Problems).

% By code, then by content (duplicates removed).
sort_problems(Problems0, Problems) :-
    map_list_to_pairs(problem_key, Problems0, Pairs0),
    sort(1, @<, Pairs0, Pairs),
    pairs_values(Pairs, Problems).

problem_key(Problem, k(Code, Text)) :-
    get_dict(code, Problem, Code),
    dict_text(Problem, Text).

% ---------------------------------------------------------------------------------------------
% Warnings: never block the calculation; only for the pizzas and sizes that were ordered
% ---------------------------------------------------------------------------------------------

warnings(Lines, Warnings) :-
    findall(W, warning(Lines, W), Ws0),
    sort_problems(Ws0, Warnings).

warning(Lines, W) :-
    findall(P, member(line(_, P, _, _), Lines), Ps0),
    sort(Ps0, Pizzas),
    member(Pizza, Pizzas),
    once(( product(Pizza, _, _, true) ; stock(Pizza, _) )),
    problem("PIZZA_STOCK_IGNORED", [pizzaId-Pizza], W).
warning(Lines, Issue) :-
    ordered_pizza_size(Lines, Pizza, Size),
    kb_issue(Code, Issue),
    get_dict(pizzaId, Issue, P0), same_text(Pizza, P0),
    get_dict(sizeId, Issue, S0), same_text(Size, S0),
    \+ blocking_issue(Code),
    \+ ( Code == 'UNMEASURED_NON_STOCK_COMPONENT',
         get_dict(componentId, Issue, C0), atom_string(C, C0),
         aggregate(C, production) ).

% ---------------------------------------------------------------------------------------------
% Phase B: calculation in two passes
% ---------------------------------------------------------------------------------------------

%  Rows: one dict per product with required > 0 (internal fields are removed in the result).
calculate(Lines, Rows) :-
    direct_demand(Lines, Direct),
    assoc_to_keys(Direct, Components),
    include(is_aggregate, Components, Aggregates),
    empty_assoc(Derived0),
    foldl(aggregate_row(Direct), Aggregates, AggregateRows, Derived0, Derived),
    assoc_to_keys(Derived, DerivedIds),
    append(Components, DerivedIds, Ids0),
    sort(Ids0, Ids),
    exclude(is_aggregate, Ids, Simples),
    maplist(simple_row(Direct, Derived), Simples, SimpleRows),
    append(AggregateRows, SimpleRows, Rows).

% D(C) = sum over the order lines of quantity x consumption of C in that pizza and size.
direct_demand(Lines, Demand) :-
    empty_assoc(D0),
    foldl(add_line_demand, Lines, D0, Demand).

add_line_demand(line(_, Pizza, Size, Quantity), D0, D) :-
    findall(C-Units, bom_item(Pizza, Size, C, Units), Consumptions),
    foldl(add_consumption(Quantity), Consumptions, D0, D).

add_consumption(Quantity, C-Units, D0, D) :-
    Amount is Quantity * Units,
    add_amount(C, Amount, D0, D).

add_amount(Key, Amount, A0, A) :-
    ( get_assoc(Key, A0, Old) -> New is Old + Amount ; New = Amount ),
    put_assoc(Key, A0, New, A).

is_aggregate(Id) :- aggregate(Id, _).

% Pass 1: an aggregate uses its stock first; only what is missing of a produced one is expanded.
aggregate_row(Direct, Id, Row, Derived0, Derived) :-
    get_assoc(Id, Direct, Required),
    aggregate(Id, Class),
    ( Class == production -> Kind = aggregate_produced ; Kind = aggregate_purchased ),
    stock_balance(Id, Required, Balance),
    (   Class == production
    ->  produced_shortage(Balance, Required, ToProduce),
        findall(Item-Q, aggregate_item(Id, Item, Q), Recipe),
        foldl(add_recipe(ToProduce), Recipe, Derived0, Derived),
        Extra = [toProduce-ToProduce]
    ;   Derived = Derived0,
        Extra = []
    ),
    make_row(Id, Kind, Required, Required, 0, Balance, Extra, Row).

% Without stock control a produced aggregate is always produced in full.
produced_shortage(balance(_, _, _, Shortage), _, Shortage) :- integer(Shortage), !.
produced_shortage(_, Required, Required).

add_recipe(ToProduce, Item-Quantity, D0, D) :-
    (   ToProduce > 0
    ->  Amount is ToProduce * Quantity,
        add_amount(Item, Amount, D0, D)
    ;   D = D0
    ).

% Pass 2: every simple product once, with its direct and derived demand.
simple_row(Direct, Derived, Id, Row) :-
    ( get_assoc(Id, Direct, FromPizzas) -> true ; FromPizzas = 0 ),
    ( get_assoc(Id, Derived, FromAggregates) -> true ; FromAggregates = 0 ),
    Required is FromPizzas + FromAggregates,
    stock_balance(Id, Required, Balance),
    make_row(Id, simple, Required, FromPizzas, FromAggregates, Balance, [], Row).

%  balance(Available, Used, Remaining, Shortage); null for products without stock control,
%  missing when a stock controlled product has no stock entry.
stock_balance(Id, Required, Balance) :-
    (   \+ product(Id, _, _, true)
    ->  Balance = balance(null, null, null, null)
    ;   stock(Id, Available)
    ->  Used is min(Required, Available),
        Remaining is Available - Used,
        Shortage is Required - Used,
        Balance = balance(Available, Used, Remaining, Shortage)
    ;   Balance = balance(missing, null, null, null)
    ).

make_row(Id, Kind, Required, Direct, FromAggregates,
         balance(Available, Used, Remaining, Shortage), Extra, Row) :-
    ( product(Id, Name, _, Controlled) -> true ; Name = Id, Controlled = false ),
    dict_pairs(Base, _, [ productId-Id, name-Name, kind-Kind, stockControlled-Controlled,
                          required-Required, requiredDirect-Direct,
                          requiredFromAggregates-FromAggregates,
                          available-Available, used-Used, remaining-Remaining,
                          shortage-Shortage | Extra ]),
    Row = Base.

% ---------------------------------------------------------------------------------------------
% Result (status ok)
% ---------------------------------------------------------------------------------------------

ok_result(Now, Scenario, Inputs, Lines, Rows0, Warnings, Result) :-
    sort_rows(Rows0, Items),
    include(needs_replenishment, Items, Short),
    maplist(shortage_entry, Short, Shortages),
    include(to_produce, Items, Produced),
    maplist(production_entry(Items), Produced, Production),
    ( Shortages == [] -> Feasible = true ; Feasible = false ),
    maplist(order_entry, Lines, Orders),
    iso_timestamp(Now, CalculatedAt),
    Result = _{ status: "ok", simulation: true, feasible: Feasible,
                calculatedAt: CalculatedAt, scenario: Scenario, inputs: Inputs,
                orders: Orders, items: Items, shortages: Shortages,
                production: Production, warnings: Warnings }.

% Deterministic order: produced aggregates, purchased aggregates, simple products; then name, id.
sort_rows(Rows, Sorted) :-
    map_list_to_pairs(row_key, Rows, Pairs0),
    keysort(Pairs0, Pairs),
    pairs_values(Pairs, Sorted).

% Names are compared with the locale collation, so "Água" comes before "Fermento".
row_key(Row, k(Rank, NameKey, Id)) :-
    get_dict(kind, Row, Kind),
    kind_rank(Kind, Rank),
    get_dict(name, Row, Name),
    name_key(Name, NameKey),
    get_dict(productId, Row, Id).

name_key(Name, Key) :-
    text_to_string(Name, S),
    string_lower(S, Lower),
    collation_key(Lower, Key).

kind_rank(aggregate_produced, 1).
kind_rank(aggregate_purchased, 2).
kind_rank(simple, 3).

% A stock controlled product that is not produced internally and has a shortage.
needs_replenishment(Row) :-
    get_dict(stockControlled, Row, true),
    get_dict(kind, Row, Kind), Kind \== aggregate_produced,
    short(Row, _).

% The shortage of a stock controlled row, when there is one.
short(Row, Shortage) :-
    get_dict(shortage, Row, Shortage),
    integer(Shortage),
    Shortage > 0.

shortage_entry(Row, _{productId: Id, name: Name, kind: Kind, replenishmentNeeded: Shortage}) :-
    get_dict(productId, Row, Id),
    get_dict(name, Row, Name),
    get_dict(kind, Row, Kind),
    get_dict(shortage, Row, Shortage).

to_produce(Row) :-
    get_dict(toProduce, Row, ToProduce),
    ToProduce > 0.

% canProduce: no stock controlled item of the recipe is short; items without stock control
% never block the production.
production_entry(Items, Row, _{productId: Id, name: Name, toProduce: ToProduce,
                               canProduce: CanProduce, missingIngredients: Missing}) :-
    get_dict(productId, Row, Id),
    get_dict(name, Row, Name),
    get_dict(toProduce, Row, ToProduce),
    findall(Item-_{productId: Item, name: ItemName, shortage: Shortage},
            ( aggregate_item(Id, Item, _),
              member(I, Items), get_dict(productId, I, Item),
              get_dict(stockControlled, I, true),
              short(I, Shortage),
              get_dict(name, I, ItemName) ),
            Pairs0),
    keysort(Pairs0, Pairs),
    pairs_values(Pairs, Missing),
    ( Missing == [] -> CanProduce = true ; CanProduce = false ).

order_entry(line(Order, Pizza, Size, Quantity),
            _{orderId: Order, pizzaId: Pizza, pizzaName: PizzaName,
              sizeId: Size, sizeName: SizeName, quantity: Quantity}) :-
    ( product(Pizza, PizzaName, _, _) -> true ; PizzaName = null ),
    ( size(Size, SizeName) -> true ; SizeName = null ).

iso_timestamp(Stamp, Text) :-
    stamp_date_time(Stamp, Date, 'UTC'),
    format_time(string(Text), '%FT%T.%3fZ', Date).

% ---------------------------------------------------------------------------------------------
% Helpers
% ---------------------------------------------------------------------------------------------

problem(Code, Pairs, Problem) :-
    dict_pairs(Dict, _, Pairs),
    put_dict(code, Dict, Code, Problem).

% The JSON text of a dict: a stable sort key (dict tags are unbound, so the standard order of
% dicts can change between runs).
dict_text(Dict, Text) :-
    with_output_to(string(Text), json_write_dict(current_output, Dict, [width(0)])).

text(V) :- ( atom(V) ; string(V) ), V \== null, V \== '', V \== "".

same_text(A, B) :-
    text_to_string(A, S),
    text_to_string(B, S).