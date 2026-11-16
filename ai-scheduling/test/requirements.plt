% Automated tests for the requirements planning (AI02).
% How to run:  swipl -q -g "(run_tests -> halt(0) ; halt(1))" test/requirements.plt  or ./run-tests.sh
%
% Expected values, by hand, from sample-snapshot.json (order date 2026-11-02, forecast 11-02..11-04):
%   dough (production, stock 50): needs 40 / 75 / 15 -> produce 65 on 11-03 and 15 on 11-04
%   flour (stock 5000): derived 9750 on 11-03 and 2250 on 11-04 -> short 4750 + 2250
%   mozzarella (stock 3000): short 1800 / 9800 / 1200
%   ham (stock 500): short 700 on 11-03;  mushrooms: 1000 on 11-03;  tomato and yeast have no offers

:- use_module(library(plunit)).
:- use_module(library(http/json)).
:- use_module('../kb').
:- use_module('../requirements').

:- prolog_load_context(directory, D), asserta(test_dir(D)).

sample_file(F) :-
    test_dir(D), directory_file_path(D, '../sample-snapshot.json', F0), absolute_file_name(F0, F).

sample(D) :-
    sample_file(F),
    setup_call_cleanup(open(F, read, In, [encoding(utf8)]), json_read_dict(In, D), close(In)).

% The sample plus the scenario and the pizzas that AI01 requires.
base(D) :-
    sample(D0),
    put_dict(scenario, D0, _{id:"SC-1", name:"Demo", version:1, simulated:true,
                             stockMode:"scenario"}, D1),
    put_dict(pizzas, D1, [ _{id:"p-margherita", sizeIds:["size-l", "size-m", "size-s"]},
                           _{id:"p-prosciutto", sizeIds:["size-l", "size-m"]} ], D).

request(_{scenarioId:"SC-1", stockMode:"scenario"}).

identity(D, D).

% Result of the calculation over Mutate(Base, Snapshot) with Today as the order date.
plan(Mutate, Today, Result) :-
    base(D0), call(Mutate, D0, D),
    with_snapshot(D, ( request(Rq),
                       requirements_calculate(Rq, Result, [now(0), today(Today)]) )).

plan(Result) :- plan(identity, '2026-11-02', Result).

requirement(R, Id, Row) :-
    get_dict(requirements, R, Rows), member(Row, Rows), get_dict(productId, Row, Id), !.
purchase(R, Id, P) :-
    get_dict(purchases, R, Ps), member(P, Ps), get_dict(productId, P, Id), !.
production(R, Id, P) :-
    get_dict(production, R, Ps), member(P, Ps), get_dict(productId, P, Id), !.

pairs_of(Entries, Pairs) :-
    findall(D-Q, ( member(E, Entries), get_dict(date, E, D), get_dict(quantity, E, Q) ), Pairs).

% [Supplier-ForDate-Units-OnTime]
allocations(P, Allocs) :-
    get_dict(allocations, P, Es),
    findall(Sup-Date-Q-OnTime,
            ( member(E, Es), get_dict(supplierId, E, Sup), get_dict(forDate, E, Date),
              get_dict(quantity, E, Q), get_dict(onTime, E, OnTime) ),
            Allocs).

units_of(Allocs, Supplier, Total) :-
    findall(Q, member(Supplier-_-Q-_, Allocs), Qs),
    sum_list(Qs, Total).

problem_codes(R, Codes) :-
    get_dict(problems, R, Ps),
    findall(C, ( member(P, Ps), get_dict(code, P, C) ), Codes).

set_forecast_entries(Entries, D0, D) :-
    get_dict(forecast, D0, F0), put_dict(entries, F0, Entries, F), put_dict(forecast, D0, F, D).

% Changes Field of the offer of Supplier (a string) for the first product of the scenario (mozzarella).
set_offer_field(Supplier, Field, Val, D0, D) :-
    get_dict(supplierScenario, D0, S0), get_dict(products, S0, [P|R]),
    get_dict(offers, P, Os0),
    findall(O, ( member(O0, Os0),
                 (   get_dict(supplierId, O0, Supplier)
                 ->  put_dict(Field, O0, Val, O)
                 ;   O = O0 ) ),
            Os),
    put_dict(offers, P, Os, P2), put_dict(products, S0, [P2|R], S),
    put_dict(supplierScenario, D0, S, D).

near(X, Y) :- abs(X - Y) < 0.005.

% ------------------------------------------------------------------

:- begin_tests(needs).

test(status_and_plan) :-
    plan(R),
    get_dict(status, R, "ok"), get_dict(simulation, R, true),
    get_dict(plan, R, Plan),
    get_dict(forecastId, Plan, 'fc-week-1'),
    get_dict(referenceDate, Plan, '2026-11-02').

test(order_date_defaults_to_the_snapshot_day) :-
    base(D),
    with_snapshot(D, ( request(Rq), requirements_calculate(Rq, R, [now(0)]) )),
    get_dict(plan, R, Plan), get_dict(referenceDate, Plan, '2026-11-02').

test(aggregate_stock_is_used_before_producing) :-
    plan(R), production(R, 'agg-dough-crust', P),
    get_dict(required, P, 130), get_dict(available, P, 50), get_dict(toProduce, P, 80),
    get_dict(schedule, P, S), pairs_of(S, ['2026-11-03'-65, '2026-11-04'-15]).

test(ingredients_of_the_produced_aggregate_are_derived) :-
    plan(R), requirement(R, 'r-flour', Row),
    get_dict(required, Row, 12000), get_dict(shortage, Row, 7000),
    get_dict(needs, Row, N), pairs_of(N, ['2026-11-03'-4750, '2026-11-04'-2250]).

test(stock_is_consumed_chronologically) :-
    plan(R), requirement(R, 'c-mozzarella', Row),
    get_dict(required, Row, 15800), get_dict(available, Row, 3000),
    get_dict(needs, Row, N),
    pairs_of(N, ['2026-11-02'-1800, '2026-11-03'-9800, '2026-11-04'-1200]).

test(product_covered_by_stock_has_no_needs) :-
    plan(R), requirement(R, 'r-water', Row),
    get_dict(needs, Row, []), get_dict(shortage, Row, 0),
    \+ purchase(R, 'r-water', _).

test(produced_aggregate_is_never_bought) :-
    plan(R),
    \+ purchase(R, 'agg-dough-crust', _),
    \+ requirement(R, 'agg-dough-crust', _).

test(forecast_line_without_size_is_direct_demand) :-
    plan([D0, D]>>set_forecast_entries([_{date:"2026-11-02", productId:"c-ham", quantity:700}],
                                       D0, D),
         '2026-11-02', R),
    requirement(R, 'c-ham', Row),
    get_dict(required, Row, 700), get_dict(shortage, Row, 200).

:- end_tests(needs).

% ------------------------------------------------------------------

:- begin_tests(suppliers).

test(offer_that_arrives_in_time_is_on_time) :-
    plan(R), purchase(R, 'c-ham', P),                % sup-a: lead 1 -> arrives 11-03
    allocations(P, ['sup-a'-'2026-11-03'-50-true]),
    get_dict(covered, P, 50), get_dict(uncovered, P, 650),
    get_dict(status, P, "partial").

test(cheapest_offer_that_arrives_in_time_wins) :-
    % order date 10-29: sup-a arrives 10-31 (12.5), sup-b arrives 11-02 (11.9): both on time
    plan(identity, '2026-10-29', R), purchase(R, 'c-mozzarella', P),
    allocations(P, ['sup-b'-'2026-11-02'-500-true, 'sup-a'-'2026-11-02'-100-true]),
    get_dict(covered, P, 600), get_dict(uncovered, P, 12200),
    get_dict(costEur, P, Cost), near(Cost, 7200).

test(supply_limit_is_cumulative_over_the_plan) :-
    plan(identity, '2026-10-29', R), purchase(R, 'c-mozzarella', P),
    allocations(P, Allocs),
    units_of(Allocs, 'sup-b', 500).                   % limit 500 in total, not per day

test(without_limit_the_stock_units_are_the_capacity) :-
    plan(identity, '2026-10-29', R), purchase(R, 'c-mozzarella', P),
    allocations(P, Allocs),
    units_of(Allocs, 'sup-a', 100).

test(zero_supply_limit_means_no_capacity) :-
    plan([D0, D]>>set_offer_field("sup-b", supplyLimit, 0, D0, D), '2026-10-29', R),
    purchase(R, 'c-mozzarella', P),
    allocations(P, Allocs),
    units_of(Allocs, 'sup-b', 0).

test(late_offer_is_flagged_with_its_arrival) :-
    plan(R), purchase(R, 'r-flour', P),               % sup-b: lead 3 -> arrives 11-05
    allocations(P, ['sup-b'-'2026-11-03'-1000-false]),
    get_dict(allocations, P, [A]), get_dict(arrivalDate, A, '2026-11-05'),
    get_dict(covered, P, 1000), get_dict(uncovered, P, 6000),
    get_dict(status, P, "partial"),
    get_dict(costEur, P, Cost), near(Cost, 8000).

test(late_capacity_does_not_take_the_place_of_an_on_time_need) :-
    % sup-a mozzarella (100 units, arrives 11-04) serves the need of 11-04 on time,
    % it is not spent as a late delivery of the earlier need of 11-02
    plan(R), purchase(R, 'c-mozzarella', P),
    allocations(P, Allocs),
    memberchk('sup-a'-'2026-11-04'-100-true, Allocs),
    memberchk('sup-b'-'2026-11-02'-500-false, Allocs),
    \+ memberchk('sup-a'-'2026-11-02'-_-_, Allocs).

test(product_without_offers_is_unavailable) :-
    plan(R), purchase(R, 'c-tomato', P),
    get_dict(status, P, "unavailable"), get_dict(covered, P, 0),
    get_dict(allocations, P, []),
    get_dict(unmet, P, [U|_]), get_dict(reason, U, "NO_SUPPLIER_OFFER").

test(offers_of_other_products_are_not_used) :-
    plan(R), purchase(R, 'c-mushroom', P),
    get_dict(status, P, "unavailable"), get_dict(uncovered, P, 1000).

test(supplier_name_is_null_when_absent) :-
    plan(identity, '2026-10-29', R), purchase(R, 'c-mozzarella', P),
    get_dict(allocations, P, As),
    member(A, As), get_dict(supplierId, A, 'sup-b'), get_dict(supplierName, A, null), !.

test(everything_on_time_when_supply_and_date_allow) :-
    plan([D0, D]>>( set_offer_field("sup-a", stockUnits, 20000, D0, D1),
                    set_offer_field("sup-b", supplyLimit, 20000, D1, D) ),
         '2026-10-01', R),
    purchase(R, 'c-mozzarella', P),
    get_dict(status, P, "on_time"), get_dict(uncovered, P, 0).

test(summary_totals) :-
    plan(R), get_dict(summary, R, S),
    get_dict(productsToBuy, S, 6), get_dict(feasible, S, false),
    get_dict(totalCostEur, S, Total), near(Total, 15650).   % ham 450 + mozzarella 7200 + flour 8000

:- end_tests(suppliers).

% ------------------------------------------------------------------

:- begin_tests(validation).

test(missing_forecast) :-
    plan([D0, D]>>del_dict(forecast, D0, _, D), '2026-11-02', R),
    get_dict(status, R, "invalid_data"),
    problem_codes(R, Codes), memberchk("MISSING_FORECAST", Codes).

test(size_not_offered_for_the_pizza) :-
    plan([D0, D]>>set_forecast_entries([_{date:"2026-11-02", productId:"p-prosciutto",
                                          sizeId:"size-s", quantity:5}], D0, D),
         '2026-11-02', R),
    problem_codes(R, Codes), memberchk("INVALID_SIZE", Codes).

test(pizza_without_size) :-
    plan([D0, D]>>set_forecast_entries([_{date:"2026-11-02", productId:"p-margherita",
                                          quantity:5}], D0, D),
         '2026-11-02', R),
    problem_codes(R, Codes), memberchk("INVALID_SIZE", Codes).

test(missing_stock_of_a_needed_product) :-
    plan([D0, D]>>( get_dict(stock, D0, S0),
                    exclude([E]>>get_dict(productId, E, "c-ham"), S0, S),
                    put_dict(stock, D0, S, D) ),
         '2026-11-02', R),
    problem_codes(R, Codes), memberchk("MISSING_SCENARIO_STOCK", Codes).

test(request_must_match_the_loaded_scenario) :-
    base(D),
    with_snapshot(D, requirements_calculate(_{scenarioId:"OTHER", stockMode:"scenario"}, R,
                                            [now(0), today('2026-11-02')])),
    problem_codes(R, Codes), memberchk("SCENARIO_MISMATCH", Codes).

test(invalid_order_date) :-
    base(D),
    with_snapshot(D, ( request(Rq),
                       requirements_calculate(Rq, R, [now(0), today('2026-13-45')]) )),
    problem_codes(R, Codes), memberchk("INVALID_SNAPSHOT", Codes).

test(without_supplier_scenario_everything_is_unavailable_with_a_warning) :-
    plan([D0, D]>>del_dict(supplierScenario, D0, _, D), '2026-11-02', R),
    get_dict(status, R, "ok"),
    get_dict(warnings, R, [W]), get_dict(code, W, "NO_SUPPLIER_SCENARIO"),
    get_dict(purchases, R, Ps), Ps \== [],
    forall(member(P, Ps), get_dict(status, P, "unavailable")).

test(calculation_leaves_the_knowledge_base_empty) :-
    plan(_),
    aggregate_all(count, stock(_, _), 0),
    aggregate_all(count, forecast_item(_, _, _, _, _), 0).

:- end_tests(validation).
