% Automated tests for the knowledge base.
% How to run:  swipl -q -g run_tests -t halt test/kb.plt  or ./run-tests.sh

:- use_module(library(plunit)).
:- use_module(library(http/json)).
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module('../kb').

:- prolog_load_context(directory, D), asserta(test_dir(D)).

sample_file(F) :- test_dir(D), directory_file_path(D, '../sample-snapshot.json', F0), absolute_file_name(F0, F).

sample(D) :-
    sample_file(F),
    setup_call_cleanup(open(F, read, In, [encoding(utf8)]), json_read_dict(In, D), close(In)).

% Replaces Field of the first element of list Key.
mutate_first(Key, Field, Val, D, D2) :-
    get_dict(Key, D, [F|R]),
    put_dict(Field, F, Val, F2),
    put_dict(Key, D, [F2|R], D2).

count(G, N) :- aggregate_all(count, G, N).

% Problems of loading D: [] if it loads, otherwise the list of kb_error(invalid_data(Problems)).
load_problems(D, Problems) :-
    catch(( load_kb_from_dict(D), Problems = [] ), kb_error(invalid_data(Problems)), true).

% There is a problem with Code whose fields include every Key-Value in Pairs.
has_problem(Problems, Code, Pairs) :-
    member(P, Problems),
    get_dict(code, P, Code),
    forall(member(K-V, Pairs), get_dict(K, P, V)), !.

% A WEB07 section whose own parser failed: one INVALID_SNAPSHOT with the old error in reason.
has_section_problem(Problems, Section, Fragment) :-
    member(P, Problems),
    get_dict(code, P, "INVALID_SNAPSHOT"),
    get_dict(section, P, Section),
    get_dict(reason, P, Reason),
    sub_string(Reason, _, _, _, Fragment), !.

% Mutations of the WEB07 sections.
with_forecast(Mod, D) :-
    sample(D0), get_dict(forecast, D0, F0), call(Mod, F0, F), put_dict(forecast, D0, F, D).
with_scenario(Mod, D) :-
    sample(D0), get_dict(supplierScenario, D0, S0), call(Mod, S0, S), put_dict(supplierScenario, D0, S, D).

set_first_entry(Field, Val, F0, F) :-
    get_dict(entries, F0, [E|R]), put_dict(Field, E, Val, E2), put_dict(entries, F0, [E2|R], F).
dup_first_entry(F0, F) :-
    get_dict(entries, F0, [E|R]), put_dict(entries, F0, [E,E|R], F).

% First product of the sample scenario is the one with two offers.
set_first_offer(Field, Val, S0, S) :-
    get_dict(products, S0, [P|R]), get_dict(offers, P, [O|Os]),
    put_dict(Field, O, Val, O2), put_dict(offers, P, [O2|Os], P2), put_dict(products, S0, [P2|R], S).
del_first_offer(Field, S0, S) :-
    get_dict(products, S0, [P|R]), get_dict(offers, P, [O|Os]),
    del_dict(Field, O, _, O2), put_dict(offers, P, [O2|Os], P2), put_dict(products, S0, [P2|R], S).
dup_first_offer(S0, S) :-
    get_dict(products, S0, [P|R]), get_dict(offers, P, [O|Os]),
    put_dict(offers, P, [O,O|Os], P2), put_dict(products, S0, [P2|R], S).
dup_first_supplier(S0, S) :-
    get_dict(suppliers, S0, [X|R]), put_dict(suppliers, S0, [X,X|R], S).

load_sample :- sample_file(F), load_kb_from_file(F).

% ------------------------------------------------------------------

:- begin_tests(load, [setup(load_sample)]).

test(counts) :-
    count(product(_,_,_,_), 10), count(size(_,_), 3), count(bom_item(_,_,_,_), 19),
    count(aggregate(_,_), 1), count(aggregate_item(_,_,_), 3), count(stock(_,_), 8),
    count(ordered_item(_,_,_,_), 3), count(kb_issue(_,_), 0).

test(meta_marks_simulation) :- kb_meta(_, _, true).

test(bom_quantity) :- once(bom_item('p-margherita', 'size-m', 'c-mozzarella', 120)).

test(aggregate_classification_and_items) :-
    aggregate('agg-dough-crust', production),
    aggregate_item('agg-dough-crust', 'r-flour', 150).

test(ordered_items) :- ordered_item('order-sim-1', 'p-margherita', 'size-m', 30).

test(orders_are_labelled_simulated) :- order('order-sim-1', true), order('order-sim-2', true).

test(a_simulated_order_alone_makes_a_simulation) :-
    sample(D0), put_dict(meta, D0, _{snapshotId:"x", retrievedAt:"y", source:"backend", simulated:false}, D1),
    del_dict(supplierScenario, D1, _, D),
    load_kb_from_dict(D),
    kb_is_simulation,
    load_sample.

test(real_data_without_simulated_inputs_is_not_a_simulation) :-
    sample(D0), put_dict(meta, D0, _{snapshotId:"x", retrievedAt:"y", source:"backend", simulated:false}, D1),
    del_dict(supplierScenario, D1, _, D2), del_dict(orders, D2, _, D),
    load_kb_from_dict(D),
    \+ kb_is_simulation,
    load_sample.

test(reload_is_idempotent) :-
    load_sample, load_sample,
    count(bom_item(_,_,_,_), 19), count(stock(_,_), 8).

test(backend_issues_are_kept) :-
    sample(D0),
    put_dict(issues, D0, [_{code:"MISSING_OR_INVALID_STOCK_UNITS", pizzaId:"p-margherita",
                            sizeId:"size-s", componentId:"c-ham"}], D),
    load_kb_from_dict(D),
    kb_issue('MISSING_OR_INVALID_STOCK_UNITS', Details),
    get_dict(componentId, Details, "c-ham"),
    load_sample.

test(orders_are_optional) :-
    sample(D0), del_dict(orders, D0, _, D),
    load_kb_from_dict(D),
    count(ordered_item(_,_,_,_), 0),
    load_sample.

test(forecast_facts) :-
    forecast('fc-week-1', _, 1, '2026-11-02', '2026-11-04'),
    count(forecast_item(_,_,_,_,_), 4),
    forecast_item('fc-week-1', '2026-11-03', 'p-margherita', 'size-m', 55).

test(forecast_quantities_vary_over_days) :-
    forecast_item(_, '2026-11-02', 'p-margherita', 'size-m', Q1),
    forecast_item(_, '2026-11-03', 'p-margherita', 'size-m', Q2),
    Q1 =\= Q2, !.

test(supplier_scenario_is_labelled_simulated) :-
    supplier_scenario('sc-demo', 1, true), kb_is_simulation.

test(two_offers_for_one_product) :-
    findall(S, supplier_offer(S, 'c-mozzarella', _, _, _), Ss), msort(Ss, ['sup-a', 'sup-b']).

test(offer_keeps_price_units_and_lead_time) :-
    once(supplier_offer('sup-a', 'c-mozzarella', 12.5, 100, 2)).

test(supply_limit_only_when_stated) :-
    count(supplier_limit(_,_,_), 1),
    supplier_limit('sup-b', 'c-mozzarella', 500),
    \+ supplier_limit('sup-a', _, _).

test(supplier_name_is_optional) :-
    supplier('sup-a', 'Supplier A'), supplier('sup-b', none).

test(product_without_offers_has_no_configured_supplier) :-
    product('c-tomato', _, _, _), \+ supplier_offer(_, 'c-tomato', _, _, _).

test(forecast_and_scenario_are_optional) :-
    sample(D0), del_dict(forecast, D0, _, D1), del_dict(supplierScenario, D1, _, D),
    load_kb_from_dict(D),
    count(forecast(_,_,_,_,_), 0), count(supplier_offer(_,_,_,_,_), 0),
    load_sample.

:- end_tests(load).

% ------------------------------------------------------------------
% Invalid snapshots are rejected with kb_error(invalid_data(Problems)), with every problem
% (code, JSON path and details), and leave the KB untouched.

:- begin_tests(validation, [setup(load_sample), cleanup(load_sample)]).

kb_untouched :- count(bom_item(_,_,_,_), 19), count(stock(_,_), 8), kb_meta(_,_,_).

test(missing_section) :-
    sample(D0), del_dict(bom, D0, _, D), load_problems(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-bom, reason-"missing"]).

test(missing_field) :-
    sample(D0), mutate_first(products, name, null, D0, D), load_problems(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-"products[0]", field-name, reason-"missing_field"]).

test(section_not_a_list) :-
    sample(D0), put_dict(bom, D0, "x", D), load_problems(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-bom, reason-"not_a_list"]).

test(unknown_component) :-
    sample(D0), mutate_first(bom, componentId, "nope", D0, D), load_problems(D, Ps),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"bom[0]", field-componentId, id-nope]).

test(unknown_size) :-
    sample(D0), mutate_first(bom, sizeId, "nope", D0, D), load_problems(D, Ps),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"bom[0]", field-sizeId, id-nope]).

test(non_integer_units) :-
    sample(D0), mutate_first(bom, quantity, 1.5, D0, D), load_problems(D, Ps),
    has_problem(Ps, "INVALID_QUANTITY", [path-"bom[0]", quantity-1.5]).

test(negative_stock) :-
    sample(D0), mutate_first(stock, quantity, -1, D0, D), load_problems(D, Ps),
    has_problem(Ps, "INVALID_QUANTITY", [path-"stock[0]", quantity-(-1)]).

test(stock_of_non_controlled_product) :-
    sample(D0), mutate_first(stock, productId, "p-margherita", D0, D), load_problems(D, Ps),
    has_problem(Ps, "STOCK_NOT_CONTROLLED", [path-"stock[0]", productId-'p-margherita']).

test(bad_aggregate_classification) :-
    sample(D0), mutate_first(aggregates, classification, "other", D0, D), load_problems(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT",
                [path-"aggregates[0]", reason-"invalid_classification", classification-"other"]).

test(unknown_order_pizza) :-
    sample(D0),
    put_dict(orders, D0, [_{id:"o", simulated:true, items:[_{pizzaId:"nope", sizeId:"size-s", quantity:1}]}], D),
    load_problems(D, Ps),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"orders[0].items[0]", field-pizzaId, id-nope]).

test(order_missing_simulated_label) :-
    sample(D0),
    put_dict(orders, D0, [_{id:"o", items:[_{pizzaId:"p-margherita", sizeId:"size-s", quantity:1}]}], D),
    load_problems(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-"orders[0]", field-simulated, reason-"missing_field"]).

test(order_simulated_must_be_boolean) :-
    sample(D0),
    put_dict(orders, D0, [_{id:"o", simulated:"yes", items:[_{pizzaId:"p-margherita", sizeId:"size-s", quantity:1}]}], D),
    load_problems(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-"orders[0].simulated", reason-"not_a_boolean"]).

test(order_quantity_must_be_positive) :-
    sample(D0),
    put_dict(orders, D0, [_{id:"o", simulated:true, items:[_{pizzaId:"p-margherita", sizeId:"size-s", quantity:0}]}], D),
    load_problems(D, Ps),
    has_problem(Ps, "INVALID_QUANTITY", [path-"orders[0].items[0]", quantity-0]).

test(failed_load_keeps_previous_kb) :-
    sample(D0), mutate_first(bom, componentId, "nope", D0, D),
    catch(load_kb_from_dict(D), kb_error(_), true),
    kb_untouched.

% WEB07 sections keep their own rules: the first error of the section becomes one problem.

test(forecast_missing_version) :-
    with_forecast([F0, F]>>del_dict(version, F0, _, F), D), load_problems(D, Ps),
    has_section_problem(Ps, forecast, "missing(version,forecast)").

test(forecast_period_start_after_end) :-
    with_forecast([F0, F]>>put_dict(endDate, F0, "2026-10-01", F), D), load_problems(D, Ps),
    has_section_problem(Ps, forecast, "invalid_value(period").

test(forecast_date_not_a_real_date) :-
    with_forecast(set_first_entry(date, "2026-02-30"), D), load_problems(D, Ps),
    has_section_problem(Ps, forecast, "invalid_value(date").

test(forecast_date_outside_period) :-
    with_forecast(set_first_entry(date, "2027-01-01"), D), load_problems(D, Ps),
    has_section_problem(Ps, forecast, "date_outside_period").

test(forecast_duplicate_entry) :-
    with_forecast(dup_first_entry, D), load_problems(D, Ps),
    has_section_problem(Ps, forecast, "duplicate_forecast_entry").

test(forecast_negative_quantity) :-
    with_forecast(set_first_entry(quantity, -3), D), load_problems(D, Ps),
    has_section_problem(Ps, forecast, "invalid_value(quantity").

test(forecast_unknown_product) :-
    with_forecast(set_first_entry(productId, "nope"), D), load_problems(D, Ps),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"forecast", field-productId, id-nope]).

test(forecast_unknown_size) :-
    with_forecast(set_first_entry(sizeId, "nope"), D), load_problems(D, Ps),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"forecast", field-sizeId, id-nope]).

test(scenario_simulated_must_be_boolean) :-
    with_scenario([S0, S]>>put_dict(simulated, S0, "yes", S), D), load_problems(D, Ps),
    has_section_problem(Ps, supplierScenario, "invalid_value(simulated").

test(scenario_duplicate_supplier) :-
    with_scenario(dup_first_supplier, D), load_problems(D, Ps),
    has_section_problem(Ps, supplierScenario, "duplicate_supplier('sup-a')").

test(offer_unknown_supplier) :-
    with_scenario(set_first_offer(supplierId, "nope"), D), load_problems(D, Ps),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"supplierScenario", field-supplierId, id-nope]).

test(offer_unknown_product) :-
    with_scenario([S0, S]>>( get_dict(products, S0, [P|R]), put_dict(productId, P, "nope", P2),
                             put_dict(products, S0, [P2|R], S) ), D),
    load_problems(D, Ps),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"supplierScenario", field-productId, id-nope]).

test(offer_duplicate) :-
    with_scenario(dup_first_offer, D), load_problems(D, Ps),
    has_section_problem(Ps, supplierScenario, "duplicate_offer('sup-a','c-mozzarella')").

test(offer_negative_price) :-
    with_scenario(set_first_offer(priceEur, -1), D), load_problems(D, Ps),
    has_section_problem(Ps, supplierScenario, "invalid_value(price").

test(offer_stock_units_must_be_positive) :-
    with_scenario(set_first_offer(stockUnits, 0), D), load_problems(D, Ps),
    has_section_problem(Ps, supplierScenario, "invalid_value(stock_units").

test(offer_missing_lead_time) :-
    with_scenario(del_first_offer(leadTimeDays), D), load_problems(D, Ps),
    has_section_problem(Ps, supplierScenario, "missing(leadTimeDays,offers)").

test(offer_negative_lead_time) :-
    with_scenario(set_first_offer(leadTimeDays, -2), D), load_problems(D, Ps),
    has_section_problem(Ps, supplierScenario, "invalid_value(lead_time").

test(offer_invalid_supply_limit) :-
    with_scenario(set_first_offer(supplyLimit, -5), D), load_problems(D, Ps),
    has_section_problem(Ps, supplierScenario, "invalid_value(supply_limit").

test(failed_forecast_load_keeps_previous_kb) :-
    with_forecast(set_first_entry(productId, "nope"), D),
    catch(load_kb_from_dict(D), kb_error(_), true),
    kb_untouched, count(forecast_item(_,_,_,_,_), 4).

test(all_problems_are_reported_at_once) :-
    sample(D0),
    mutate_first(bom, quantity, 0, D0, D1),
    mutate_first(stock, productId, "nope", D1, D2),
    mutate_first(aggregates, classification, "other", D2, D),
    load_problems(D, Ps),
    has_problem(Ps, "INVALID_QUANTITY", [path-"bom[0]"]),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"stock[0]", id-nope]),
    has_problem(Ps, "INVALID_SNAPSHOT", [reason-"invalid_classification"]).

:- end_tests(validation).

% ------------------------------------------------------------------
% refresh_kb/0 against a local fake back end.

:- http_handler(root(ok/'ai-data'/snapshot), serve_ok, []).
:- http_handler(root(garbage/'ai-data'/snapshot), serve_garbage, []).

serve_ok(Request) :-
    (   memberchk(authorization(Auth), Request), Auth == 'Bearer test-token'
    ->  sample_file(F), read_file_to_string(F, Body, []),
        format("Content-type: application/json~n~n~w", [Body])
    ;   reply_json_dict(_{error:"unauthorized"}, [status(401)])
    ).

serve_garbage(_) :- format("Content-type: application/json~n~n{not json").

start_server :-
    http_server(http_dispatch, [port(Port)]),
    nb_setval(test_port, Port).
stop_server :-
    nb_getval(test_port, Port),
    http_stop_server(Port, []).

backend(Path) :-
    nb_getval(test_port, Port),
    format(atom(Url), 'http://127.0.0.1:~w/~w', [Port, Path]),
    setenv('AI_BACKEND_URL', Url).

fresh_kb :- retractall(kb:kb_meta(_,_,_)), retractall(kb:bom_item(_,_,_,_)).

:- begin_tests(refresh, [setup(start_server), cleanup(stop_server)]).

test(refresh_loads_the_snapshot) :-
    fresh_kb, backend(ok), setenv('AI_SERVICE_TOKEN', 'test-token'),
    refresh_kb,
    sample(D), get_dict(meta, D, M), get_dict(snapshotId, M, Id0), atom_string(Id, Id0),
    kb_meta(Id, _, _),
    count(bom_item(_,_,_,_), 19).

test(wrong_token_is_rejected, throws(kb_error(http_status(401)))) :-
    backend(ok), setenv('AI_SERVICE_TOKEN', 'wrong'), refresh_kb.

test(invalid_json_is_rejected, throws(kb_error(invalid_snapshot(not_json)))) :-
    backend(garbage), setenv('AI_SERVICE_TOKEN', 'test-token'), refresh_kb.

test(service_down, throws(kb_error(service_unavailable))) :-
    setenv('AI_BACKEND_URL', 'http://127.0.0.1:9'), setenv('AI_SERVICE_TOKEN', 'test-token'),
    refresh_kb.

test(unavailable_service_keeps_previous_kb) :-
    fresh_kb, backend(ok), setenv('AI_SERVICE_TOKEN', 'test-token'), refresh_kb,
    setenv('AI_BACKEND_URL', 'http://127.0.0.1:9'),
    catch(refresh_kb, kb_error(service_unavailable), true),
    count(bom_item(_,_,_,_), 19).

test(missing_backend_url, throws(kb_error(config_missing('AI_BACKEND_URL')))) :-
    setenv('AI_BACKEND_URL', ''), refresh_kb.

test(missing_token, throws(kb_error(config_missing('AI_SERVICE_TOKEN')))) :-
    backend(ok), setenv('AI_SERVICE_TOKEN', ''), refresh_kb.

:- end_tests(refresh).
