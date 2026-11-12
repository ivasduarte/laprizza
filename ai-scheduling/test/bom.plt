% Automated tests for the Bill of Materials calculation (bom.pl, AI01).
% How to run:  swipl -q -g run_tests -t halt test/bom.plt  or ./run-tests.sh

:- use_module(library(plunit)).
:- use_module(library(http/json)).
:- use_module('../kb').
:- use_module('../bom').

:- prolog_load_context(directory, D), asserta(bom_test_dir(D)).

% ---------------------------------------------------------------------------------------------
% Helpers
% ---------------------------------------------------------------------------------------------

fixture_path(Name, Path) :-
    bom_test_dir(Dir),
    atomic_list_concat([Dir, '/../fixtures/', Name, '.json'], Path).

fixture(Name, Dict) :-
    fixture_path(Name, Path),
    setup_call_cleanup(open(Path, read, In, [encoding(utf8)]), json_read_dict(In, Dict), close(In)).

% The request of the scenario of a snapshot.
request_of(D, _{scenarioId: Id, stockMode: Mode}) :-
    get_dict(scenario, D, S), get_dict(id, S, Id), get_dict(stockMode, S, Mode).

% Calculates a snapshot (fixed calculatedAt), as the server will do: with_snapshot + bom_calculate.
calc(D, Result) :-
    request_of(D, Request),
    calc(D, Request, Result).

calc(D, Request, Result) :-
    with_snapshot(D, bom_calculate(Request, Result, [now(0)])).

calc_fixture(Name, Result) :-
    fixture(Name, D),
    calc(D, Result).

% item(Result, ProductId, Item)
item(R, Id, Item) :-
    get_dict(items, R, Items),
    member(Item, Items),
    get_dict(productId, Item, Id), !.

% Checks required / available / remaining / shortage of an item ('-' = null).
row(R, Id, Required, Available, Remaining, Shortage) :-
    item(R, Id, I),
    get_dict(required, I, Required),
    value(I, available, Available),
    value(I, remaining, Remaining),
    value(I, shortage, Shortage).

value(I, Key, Expected) :-
    get_dict(Key, I, V),
    ( V == null -> Expected = '-' ; Expected = V ).

item_ids(R, Ids) :-
    get_dict(items, R, Items),
    findall(Id, ( member(I, Items), get_dict(productId, I, Id) ), Ids).

shortages(R, Pairs) :-
    get_dict(shortages, R, Ss),
    findall(Id-Q, ( member(S, Ss), get_dict(productId, S, Id), get_dict(replenishmentNeeded, S, Q) ), Pairs).

production(R, Id, ToProduce, CanProduce, Missing) :-
    get_dict(production, R, Ps),
    member(P, Ps), get_dict(productId, P, Id), !,
    get_dict(toProduce, P, ToProduce),
    get_dict(canProduce, P, CanProduce),
    get_dict(missingIngredients, P, Ms),
    findall(M-S, ( member(X, Ms), get_dict(productId, X, M), get_dict(shortage, X, S) ), Missing).

codes(List, Codes) :-
    findall(C, ( member(P, List), get_dict(code, P, C) ), Codes0),
    msort(Codes0, Codes).

problem_codes(R, Codes) :-
    get_dict(status, R, "invalid_data"),
    get_dict(problems, R, Ps),
    codes(Ps, Codes).

warning_codes(R, Codes) :-
    get_dict(warnings, R, Ws),
    codes(Ws, Codes).

no_quantities(R) :-
    \+ get_dict(items, R, _),
    \+ get_dict(shortages, R, _),
    \+ get_dict(production, R, _).

% Snapshot variations used by the request validation tests.
with_order(Field, Value, D0, D) :-
    get_dict(orders, D0, [O|Os]), get_dict(items, O, [I|Is]),
    put_dict(Field, I, Value, I1), put_dict(items, O, [I1|Is], O1),
    put_dict(orders, D0, [O1|Os], D).

map_list(Key, Goal, D0, D) :-
    get_dict(Key, D0, L0), maplist(Goal, L0, L), put_dict(Key, D0, L, D).

set_if_id(Id, Field, Value, E0, E) :-
    (   get_dict(id, E0, Id) -> put_dict(Field, E0, Value, E) ; E = E0 ).

drop_stock(ProductId, D0, D) :-
    get_dict(stock, D0, S0),
    exclude([E]>>get_dict(productId, E, ProductId), S0, S),
    put_dict(stock, D0, S, D).

% ---------------------------------------------------------------------------------------------
% Demo scenarios (section 3.7) and the client's reference example
% ---------------------------------------------------------------------------------------------

:- begin_tests(bom_scenarios, [cleanup(clear_kb)]).

test(demo_basic_only_simple_products) :-
    calc_fixture('demo-basic', R),
    get_dict(status, R, "ok"), get_dict(feasible, R, true), get_dict(simulation, R, true),
    row(R, 'c-base-pronta', 3, 5, 2, 0),
    row(R, 'c-mozzarella', 6, 6, 0, 0),
    row(R, 'c-cogumelos', 3, 4, 1, 0),
    item_ids(R, Ids), length(Ids, 3),
    shortages(R, []),
    get_dict(production, R, []),
    warning_codes(R, ["UNMEASURED_NON_STOCK_COMPONENT"]).

test(demo_sufficient_aggregates_in_stock) :-
    calc_fixture('demo-sufficient', R),
    get_dict(feasible, R, true),
    row(R, 'c-massa', 3, 5, 2, 0),
    item(R, 'c-massa', Massa), get_dict(toProduce, Massa, 0),
    row(R, 'c-molho', 3, 5, 2, 0),
    row(R, 'c-mozzarella', 6, 10, 4, 0),
    row(R, 'c-fiambre', 1, 3, 2, 0),
    row(R, 'c-cogumelos', 1, 3, 2, 0),
    \+ item(R, 'i-farinha', _),
    shortages(R, []),
    get_dict(production, R, []).

test(demo_insufficient) :-
    calc_fixture('demo-insufficient', R),
    get_dict(feasible, R, false),
    row(R, 'c-massa', 5, 0, 0, 5),
    row(R, 'c-molho', 5, 2, 0, 3),
    row(R, 'c-mozzarella', 11, 5, 0, 6),
    row(R, 'c-fiambre', 4, 4, 0, 0),
    row(R, 'c-cogumelos', 6, 1, 0, 5),
    row(R, 'c-base-pronta', 2, 1, 0, 1),
    row(R, 'i-farinha', 10, '-', '-', '-'),
    row(R, 'i-agua', 5, '-', '-', '-'),
    row(R, 'i-fermento', 5, '-', '-', '-'),
    shortages(R, Short), msort(Short, Sorted),
    Sorted == ['c-base-pronta'-1, 'c-cogumelos'-5, 'c-molho'-3, 'c-mozzarella'-6],
    production(R, 'c-massa', 5, true, []).

test(demo_partial_only_missing_aggregates_are_expanded) :-
    calc_fixture('demo-partial', R),
    get_dict(feasible, R, false),
    row(R, 'c-massa', 3, 1, 0, 2),
    row(R, 'c-molho', 3, 5, 2, 0),
    row(R, 'c-mozzarella', 6, 4, 0, 2),
    row(R, 'i-farinha', 4, '-', '-', '-'),          % 2 x 2, not 3 x 2
    row(R, 'i-agua', 2, '-', '-', '-'),
    row(R, 'i-fermento', 2, '-', '-', '-'),
    item(R, 'i-farinha', F), get_dict(requiredDirect, F, 0), get_dict(requiredFromAggregates, F, 4),
    shortages(R, ['c-mozzarella'-2]),
    production(R, 'c-massa', 2, true, []),
    warning_codes(R, []).

test(reference_example_of_the_client) :-
    calc_fixture(reference, R),
    get_dict(feasible, R, false),
    row(R, 'c-massa', 3, 1, 0, 2),
    row(R, 'c-molho', 3, 5, 2, 0),
    row(R, 'c-mozzarella', 6, 4, 0, 2),
    row(R, 'i-farinha', 4, 3, 0, 1),
    row(R, 'i-agua', 2, 10, 8, 0),
    row(R, 'i-fermento', 2, 10, 8, 0),
    shortages(R, Short), msort(Short, ['c-mozzarella'-2, 'i-farinha'-1]),
    production(R, 'c-massa', 2, false, ['i-farinha'-1]).

test(purchased_aggregate_is_never_expanded) :-
    calc_fixture('demo-insufficient', R),
    item(R, 'c-molho', M), get_dict(kind, M, aggregate_purchased),
    \+ get_dict(toProduce, M, _),
    \+ ( get_dict(production, R, Ps), member(P, Ps), get_dict(productId, P, 'c-molho') ).

test(remaining_is_never_negative,
     [forall(member(Name, ['demo-basic', 'demo-sufficient', 'demo-insufficient', 'demo-partial', reference]))]) :-
    calc_fixture(Name, R),
    get_dict(items, R, Items),
    forall(( member(I, Items), get_dict(remaining, I, Rem), Rem \== null ), Rem >= 0).

test(result_context) :-
    calc_fixture('demo-partial', R),
    get_dict(scenario, R, S),
    get_dict(id, S, 'DEMO-PARTIAL'), get_dict(stockMode, S, scenario), get_dict(version, S, 1),
    get_dict(inputs, R, In), get_dict(snapshotId, In, 'fixture-demo-partial'),
    get_dict(sources, In, Src), get_dict(stock, Src, Stock), get_dict(scenarioId, Stock, "DEMO-PARTIAL"),
    get_dict(orders, R, [O]),
    get_dict(pizzaId, O, 'p-margherita'), get_dict(sizeName, O, 'M'), get_dict(quantity, O, 3),
    get_dict(calculatedAt, R, "1970-01-01T00:00:00.000Z").

:- end_tests(bom_scenarios).

% ---------------------------------------------------------------------------------------------
% Rules of the calculation
% ---------------------------------------------------------------------------------------------

:- begin_tests(bom_rules, [cleanup(clear_kb)]).

test(items_are_ordered_by_kind_then_name) :-
    calc_fixture('demo-insufficient', R),
    get_dict(items, R, Items),
    findall(K, ( member(I, Items), get_dict(kind, I, K) ), Kinds),
    Kinds = [aggregate_produced, aggregate_purchased | Simple],
    forall(member(K, Simple), K == simple).

test(simple_products_without_stock_control_have_null_balances) :-
    calc_fixture('demo-partial', R),
    item(R, 'i-agua', A),
    get_dict(stockControlled, A, false),
    get_dict(available, A, null), get_dict(used, A, null),
    get_dict(remaining, A, null), get_dict(shortage, A, null).

test(produced_aggregate_without_stock_control_is_produced_in_full) :-
    fixture('demo-partial', D0),
    map_list(products, set_if_id("c-massa", stockControlled, false), D0, D1),
    drop_stock("c-massa", D1, D),
    calc(D, R),
    item(R, 'c-massa', M), get_dict(toProduce, M, 3), get_dict(shortage, M, null),
    row(R, 'i-farinha', 6, '-', '-', '-'),
    production(R, 'c-massa', 3, true, []).

test(ingredient_used_directly_and_in_an_aggregate_is_processed_once) :-
    % The flour (with stock control) is also a component of the Margherita M (1 per pizza).
    fixture(reference, D0),
    get_dict(bom, D0, B0),
    append(B0, [_{pizzaId:"p-margherita", sizeId:"size-m", componentId:"i-farinha", quantity:1}], B),
    put_dict(bom, D0, B, D),
    calc(D, R),
    item(R, 'i-farinha', F),
    get_dict(requiredDirect, F, 3), get_dict(requiredFromAggregates, F, 4),
    row(R, 'i-farinha', 7, 3, 0, 4),
    item_ids(R, Ids), msort(Ids, Sorted), Sorted == ['c-massa', 'c-molho', 'c-mozzarella',
                                                     'i-agua', 'i-farinha', 'i-fermento'],
    production(R, 'c-massa', 2, false, ['i-farinha'-4]).

test(same_snapshot_same_result) :-
    fixture('demo-insufficient', D),
    calc(D, R1), calc(D, R2),
    atom_json_dict(J1, R1, [width(0)]), atom_json_dict(J2, R2, [width(0)]),
    J1 == J2.

test(calculated_at_is_iso_utc) :-
    fixture('demo-basic', D), request_of(D, Req),
    with_snapshot(D, bom_calculate(Req, R)),
    get_dict(calculatedAt, R, At),
    string_length(At, 24), sub_string(At, 23, 1, _, "Z").

test(kb_is_cleared_and_stock_is_unchanged) :-
    fixture('demo-partial', D),
    with_snapshot(D, ( findall(P-Q, stock(P, Q), Before),
                       bom_calculate(_{scenarioId:"DEMO-PARTIAL", stockMode:"scenario"}, _),
                       findall(P-Q, stock(P, Q), After) )),
    Before == After,
    \+ stock(_, _), \+ product(_, _, _, _).

:- end_tests(bom_rules).

% ---------------------------------------------------------------------------------------------
% Phase A: request validation (problems, never quantities)
% ---------------------------------------------------------------------------------------------

:- begin_tests(bom_validation, [cleanup(clear_kb)]).

partial_request(_{scenarioId:"DEMO-PARTIAL", stockMode:"scenario"}).

test(scenario_mismatch) :-
    fixture('demo-partial', D),
    calc(D, _{scenarioId:"DEMO-BASIC", stockMode:"scenario"}, R),
    problem_codes(R, ["SCENARIO_MISMATCH"]), no_quantities(R).

test(stock_mode_mismatch) :-
    fixture('demo-partial', D),
    calc(D, _{scenarioId:"DEMO-PARTIAL", stockMode:"live"}, R),
    problem_codes(R, ["SCENARIO_MISMATCH"]).

test(invalid_request, [forall(member(Request, [nope, _{}, _{scenarioId:"DEMO-PARTIAL"},
                                               _{scenarioId:"", stockMode:"scenario"}]))]) :-
    fixture('demo-partial', D),
    calc(D, Request, R),
    problem_codes(R, ["INVALID_REQUEST"]), no_quantities(R).

test(snapshot_without_scenario) :-
    fixture('demo-partial', D0),
    del_dict(scenario, D0, _, D1), del_dict(orders, D1, _, D2), del_dict(pizzas, D2, _, D),
    partial_request(Req),
    calc(D, Req, R),
    problem_codes(R, ["INVALID_SNAPSHOT"]).

test(not_predefined_pizza) :-
    fixture('demo-partial', D0),
    get_dict(pizzas, D0, Ps0),
    exclude([Z]>>get_dict(id, Z, "p-margherita"), Ps0, Ps),
    put_dict(pizzas, D0, Ps, D),
    calc(D, R),
    problem_codes(R, ["NOT_PREDEFINED_PIZZA"]), no_quantities(R).

test(size_not_allowed_for_the_pizza) :-
    fixture('demo-partial', D0),
    map_list(pizzas, set_if_id("p-margherita", sizeIds, ["size-s"]), D0, D),
    calc(D, R),
    problem_codes(R, ["INVALID_SIZE"]), no_quantities(R).

test(no_bom_lines_for_the_pizza_and_size) :-
    fixture('demo-partial', D0),
    get_dict(bom, D0, B0),
    exclude([L]>>( get_dict(pizzaId, L, "p-margherita"), get_dict(sizeId, L, "size-m") ), B0, B),
    put_dict(bom, D0, B, D),
    calc(D, R),
    problem_codes(R, ["INCOMPLETE_RECIPE"]),
    get_dict(problems, R, [P]), get_dict(reason, P, "no_bom_lines").

test(blocking_backend_issue, [forall(member(Code, ["MISSING_OR_INVALID_STOCK_UNITS", "UNKNOWN_COMPONENT"]))]) :-
    fixture('demo-partial', D0),
    put_dict(issues, D0, [_{code:Code, pizzaId:"p-margherita", sizeId:"size-m", componentId:"c-mozzarella"}], D),
    calc(D, R),
    problem_codes(R, ["INCOMPLETE_RECIPE"]), no_quantities(R).

test(produced_aggregate_without_consumption) :-
    fixture('demo-partial', D0),
    put_dict(issues, D0, [_{code:"UNMEASURED_NON_STOCK_COMPONENT", pizzaId:"p-margherita",
                             sizeId:"size-m", componentId:"c-massa"}], D),
    calc(D, R),
    problem_codes(R, ["INCOMPLETE_RECIPE"]),
    get_dict(problems, R, [P]), get_dict(reason, P, "unmeasured_produced_aggregate").

test(issue_of_a_pizza_not_ordered_is_ignored) :-
    fixture('demo-partial', D0),
    put_dict(issues, D0, [_{code:"MISSING_OR_INVALID_STOCK_UNITS", pizzaId:"p-prosciutto",
                             sizeId:"size-l", componentId:"c-fiambre"}], D),
    calc(D, R),
    get_dict(status, R, "ok"), warning_codes(R, []).

test(missing_scenario_stock) :-
    fixture('demo-partial', D0),
    drop_stock("c-mozzarella", D0, D),
    calc(D, R),
    problem_codes(R, ["MISSING_SCENARIO_STOCK"]), no_quantities(R),
    get_dict(problems, R, [P]), get_dict(productId, P, 'c-mozzarella'), get_dict(required, P, 6).

test(missing_live_stock) :-
    fixture('demo-partial', D0),
    drop_stock("c-mozzarella", D0, D1),
    get_dict(scenario, D1, S0), put_dict(stockMode, S0, "live", S), put_dict(scenario, D1, S, D),
    calc(D, R),
    problem_codes(R, ["MISSING_STOCK"]).

test(several_problems_at_once) :-
    fixture('demo-insufficient', D0),
    map_list(pizzas, set_if_id("p-margherita", sizeIds, ["size-s"]), D0, D1),
    get_dict(pizzas, D1, Ps0),
    exclude([Z]>>get_dict(id, Z, "p-funghi-simples"), Ps0, Ps),
    put_dict(pizzas, D1, Ps, D),
    calc(D, R),
    problem_codes(R, ["INVALID_SIZE", "NOT_PREDEFINED_PIZZA"]), no_quantities(R).

test(invalid_fixtures_have_no_quantities,
     [forall(member(Name, ['invalid-snapshot', 'invalid-unknown-item', 'invalid-zero-quantity',
                           'invalid-duplicates', 'invalid-incomplete-aggregate',
                           'invalid-purchased-with-composition', 'invalid-nested-aggregate',
                           'invalid-pizza-as-component', 'invalid-multiple']))]) :-
    fixture_path(Name, Path),
    bom_from_file(Path, R),
    get_dict(status, R, "invalid_data"),
    get_dict(problems, R, [_|_]),
    no_quantities(R).

:- end_tests(bom_validation).

% ---------------------------------------------------------------------------------------------
% Warnings: never block the calculation
% ---------------------------------------------------------------------------------------------

:- begin_tests(bom_warnings, [cleanup(clear_kb)]).

test(unmeasured_component_only_for_ordered_sizes) :-
    calc_fixture('demo-insufficient', R),
    get_dict(warnings, R, [W]),
    get_dict(code, W, "UNMEASURED_NON_STOCK_COMPONENT"),
    get_dict(sizeId, W, "size-l").

test(pizzas_with_stock_are_ignored_with_a_warning) :-
    fixture('demo-insufficient', D0),
    map_list(products, set_if_id("p-margherita", stockControlled, true), D0, D1),
    map_list(products, set_if_id("p-prosciutto", stockControlled, true), D1, D2),
    get_dict(stock, D2, S0),
    put_dict(stock, D2, [_{productId:"p-margherita", quantity:10} | S0], D),
    calc(D, R),
    get_dict(status, R, "ok"),
    warning_codes(R, ["PIZZA_STOCK_IGNORED", "PIZZA_STOCK_IGNORED", "UNMEASURED_NON_STOCK_COMPONENT"]),
    \+ item(R, 'p-margherita', _),
    get_dict(feasible, R, false).

:- end_tests(bom_warnings).

% ---------------------------------------------------------------------------------------------
% Console helpers
% ---------------------------------------------------------------------------------------------

:- begin_tests(bom_console).

test(bom_from_file_uses_the_scenario_of_the_file) :-
    fixture_path('demo-partial', Path),
    bom_from_file(Path, R),
    get_dict(status, R, "ok"),
    \+ product(_, _, _, _).

test(print_bom_writes_json) :-
    fixture_path('demo-basic', Path),
    with_output_to(string(S), bom_print_file(Path)),
    atom_json_dict(S, D, []),
    get_dict(status, D, "ok").

:- end_tests(bom_console).
