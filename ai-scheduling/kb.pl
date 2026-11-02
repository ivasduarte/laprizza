% Module Setup and Dependencies
% Declares all the exported predicates and imports required libraries

:- module(kb, [ refresh_kb/0, load_kb_from_file/1, load_kb_from_dict/1, kb_summary/0,
                kb_meta/3, product/4, size/2, bom_item/4, aggregate/2,
                aggregate_item/3, stock/2, order/2, ordered_item/4, kb_issue/2,
                forecast/5, forecast_item/5, supplier_scenario/3, supplier/2,
                supplier_offer/5, supplier_limit/3, kb_is_simulation/0 ]).

:- use_module(library(http/http_open)).
:- use_module(library(http/json)).
:- use_module(library(apply)).
:- use_module(library(lists)).
:- use_module(library(aggregate)).

:- dynamic kb_meta/3, product/4, size/2, bom_item/4, aggregate/2,
           aggregate_item/3, stock/2, order/2, ordered_item/4, kb_issue/2,
           forecast/5, forecast_item/5, supplier_scenario/3, supplier/2,
           supplier_offer/5, supplier_limit/3.

% Handles the loading, clearing and summarizing the knowledge base.
% refresh_kb fetches the data from the backend and loads it into the KB, replacing any existing data.
% load_kb_from_file(File) loads the KB from a local JSON file.

refresh_kb :-
    backend_url(Url),
    fetch_snapshot(Url, Dict),
    load_kb_from_dict(Dict).

load_kb_from_file(File) :-
    setup_call_cleanup(open(File, read, In, [encoding(utf8)]),
                       json_read_dict(In, Dict),
                       close(In)),
    load_kb_from_dict(Dict).

load_kb_from_dict(Dict) :-
    snapshot_facts(Dict, Facts),
    check_references(Facts),
    transaction(( retractall(kb_meta(_,_,_)),   retractall(product(_,_,_,_)),
                  retractall(size(_,_)),        retractall(bom_item(_,_,_,_)),
                  retractall(aggregate(_,_)),   retractall(aggregate_item(_,_,_)),
                  retractall(stock(_,_)),       retractall(order(_,_)), retractall(ordered_item(_,_,_,_)),
                  retractall(kb_issue(_,_)),
                  retractall(forecast(_,_,_,_,_)), retractall(forecast_item(_,_,_,_,_)),
                  retractall(supplier_scenario(_,_,_)), retractall(supplier(_,_)),
                  retractall(supplier_offer(_,_,_,_,_)), retractall(supplier_limit(_,_,_)),
                  maplist(assertz, Facts) )).

kb_is_simulation :- kb_meta(_, _, true), !.
kb_is_simulation :- supplier_scenario(_, _, true), !.
kb_is_simulation :- order(_, true), !.

kb_summary :-
    ( kb_meta(Id, At, Sim) -> format("snapshot ~w (~w) simulated=~w~n", [Id, At, Sim])
    ; format("knowledge base is empty~n") ),
    forall(member(Name/Arity, [product/4, size/2, bom_item/4, aggregate/2,
                               aggregate_item/3, stock/2, order/2, ordered_item/4, kb_issue/2,
                               forecast/5, forecast_item/5, supplier_scenario/3, supplier/2,
                               supplier_offer/5, supplier_limit/3]),
           ( functor(G, Name, Arity),
             aggregate_all(count, G, N),
             format("  ~w/~w: ~d~n", [Name, Arity, N]) )),
    ( kb_is_simulation -> format("  simulation: yes~n") ; format("  simulation: no~n") ).

% Handles HTTP requests to the backend service and error handling.

backend_url(Url) :-
    (   getenv('AI_BACKEND_URL', Base), Base \== ''
    ->  atomic_list_concat([Base, '/ai-data/snapshot'], Url)
    ;   throw(kb_error(config_missing('AI_BACKEND_URL')))
    ).

auth_options([request_header('Authorization'=Value)]) :-
    (   getenv('AI_SERVICE_TOKEN', Token), Token \== ''
    ->  atom_concat('Bearer ', Token, Value)
    ;   throw(kb_error(config_missing('AI_SERVICE_TOKEN')))
    ).

fetch_snapshot(Url, Dict) :-
    auth_options(Auth),
    catch(setup_call_cleanup(http_open(Url, In, [status_code(Code), timeout(10)|Auth]),
                             read_body(Code, In, Dict),
                             close(In)),
          E, rethrow(E)).

read_body(200, In, Dict) :- !,
    catch(json_read_dict(In, Dict), _, throw(kb_error(invalid_snapshot(not_json)))).
read_body(Code, _, _) :- throw(kb_error(http_status(Code))).

rethrow(kb_error(E)) :- !, throw(kb_error(E)).
rethrow(_) :- throw(kb_error(service_unavailable)).

% Transforms the JSON snapshot into a list of Prolog facts, validating required fields and types.

snapshot_facts(S, Facts) :-
    require_keys(S, [meta, products, sizes, bom, aggregates, stock], snapshot),
    get_dict(meta, S, M),
    require_keys(M, [snapshotId, retrievedAt, simulated], meta),
    get_dict(snapshotId, M, Sid0), get_dict(retrievedAt, M, At0), get_dict(simulated, M, Sim),
    to_atom(Sid0, Sid), to_atom(At0, At),
    section(S, products,   [id, name, sellable, stockControlled], product_fact,   PF),
    section(S, sizes,      [id, name],                             size_fact,      ZF),
    section(S, bom,        [pizzaId, sizeId, componentId, quantity], bom_fact,     BF),
    section(S, aggregates, [id, classification, items],            aggregate_facts, AF),
    section(S, stock,      [productId, quantity],                  stock_fact,     SF),
    optional_orders(S, OF),
    optional_forecast(S, FF),
    optional_scenario(S, CF),
    optional_issues(S, IF),
    append([[kb_meta(Sid, At, Sim)], PF, ZF, BF, AF, SF, OF, FF, CF, IF], Facts).

section(S, Key, Required, Builder, Facts) :-
    get_dict(Key, S, List),
    ( is_list(List) -> true ; throw(kb_error(invalid_snapshot(not_a_list(Key)))) ),
    forall(member(E, List), require_keys(E, Required, Key)),
    maplist(Builder, List, Lists),
    append(Lists, Facts).

optional_issues(S, Facts) :-
    (   get_dict(issues, S, List), is_list(List)
    ->  maplist(issue_fact, List, Facts)
    ;   Facts = []
    ).

optional_orders(S, Facts) :-
    (   get_dict(orders, S, _)
    ->  section(S, orders, [id, simulated, items], order_facts, Facts)
    ;   Facts = []
    ).

% Optional WEB07 Data Parsing                                                   

optional_forecast(S, Facts) :-
    (   get_dict(forecast, S, F), F \== null
    ->  forecast_facts(F, Facts)
    ;   Facts = []
    ).

forecast_facts(F, [forecast(Id, Name, Ver, Start, End)|Items]) :-
    require_keys(F, [id, name, version, startDate, endDate, entries], forecast),
    get_dict(id, F, I0), to_atom(I0, Id),
    get_dict(name, F, N0), to_atom(N0, Name),
    get_dict(version, F, V0), version_term(V0, Ver),
    get_dict(startDate, F, S0), iso_date(S0, forecast(Id), Start),
    get_dict(endDate, F, E0), iso_date(E0, forecast(Id), End),
    (   Start @=< End -> true
    ;   throw(kb_error(invalid_value(period, forecast(Id), Start-End)))
    ),
    get_dict(entries, F, Es),
    ( is_list(Es) -> true ; throw(kb_error(invalid_snapshot(not_a_list(entries)))) ),
    maplist(entry_fact(Id, Start, End), Es, Items),
    check_unique_entries(Items).

entry_fact(Id, Start, End, E, forecast_item(Id, Date, Prod, Size, Q)) :-
    require_keys(E, [date, productId, quantity], forecast_entries),
    get_dict(date, E, D0), iso_date(D0, forecast_item(Id), Date),
    (   Start @=< Date, Date @=< End -> true
    ;   throw(kb_error(date_outside_period(Date, Start, End)))
    ),
    get_dict(productId, E, P0), to_atom(P0, Prod),
    optional_atom(sizeId, E, Size),
    get_dict(quantity, E, Q),
    units(Q, forecast_item(Id, Date, Prod)).

check_unique_entries(Items) :-
    findall(k(D, P, S), member(forecast_item(_, D, P, S, _), Items), Keys0),
    msort(Keys0, Keys),
    (   append(_, [K, K|_], Keys) -> throw(kb_error(duplicate_forecast_entry(K)))
    ;   true
    ).

optional_scenario(S, Facts) :-
    (   get_dict(supplierScenario, S, Sc), Sc \== null
    ->  scenario_facts(Sc, Facts)
    ;   Facts = []
    ).

scenario_facts(Sc, Facts) :-
    require_keys(Sc, [id, version, simulated, suppliers, products], supplier_scenario),
    get_dict(id, Sc, I0), to_atom(I0, Id),
    get_dict(version, Sc, V0), version_term(V0, Ver),
    get_dict(simulated, Sc, Sim),
    (   memberchk(Sim, [true, false]) -> true
    ;   throw(kb_error(invalid_value(simulated, supplier_scenario(Id), Sim)))
    ),
    get_dict(suppliers, Sc, Ss),
    ( is_list(Ss) -> true ; throw(kb_error(invalid_snapshot(not_a_list(suppliers)))) ),
    forall(member(Su, Ss), require_keys(Su, [id], suppliers)),
    maplist(supplier_fact, Ss, SupFacts),
    check_unique_suppliers(SupFacts),
    get_dict(products, Sc, Ps),
    ( is_list(Ps) -> true ; throw(kb_error(invalid_snapshot(not_a_list(supplier_products)))) ),
    forall(member(Pr, Ps), require_keys(Pr, [productId, offers], supplier_products)),
    maplist(product_offer_facts, Ps, OfferLists), append(OfferLists, OfferFacts),
    check_unique_offers(OfferFacts),
    append([[supplier_scenario(Id, Ver, Sim)], SupFacts, OfferFacts], Facts).

supplier_fact(Su, supplier(Id, Name)) :-
    get_dict(id, Su, I0), to_atom(I0, Id),
    optional_atom(name, Su, Name).

check_unique_suppliers(SupFacts) :-
    findall(I, member(supplier(I, _), SupFacts), Ids0),
    msort(Ids0, Ids),
    (   append(_, [I, I|_], Ids) -> throw(kb_error(duplicate_supplier(I)))
    ;   true
    ).

product_offer_facts(Pr, Facts) :-
    get_dict(productId, Pr, P0), to_atom(P0, Prod),
    get_dict(offers, Pr, Os),
    ( is_list(Os) -> true ; throw(kb_error(invalid_snapshot(not_a_list(offers)))) ),
    forall(member(O, Os), require_keys(O, [supplierId, priceEur, stockUnits, leadTimeDays], offers)),
    maplist(offer_facts(Prod), Os, Lists),
    append(Lists, Facts).

offer_facts(Prod, O, [supplier_offer(Sup, Prod, Price, Units, Lead)|Limit]) :-
    get_dict(supplierId, O, S0), to_atom(S0, Sup),
    get_dict(priceEur, O, Price),
    ( number(Price), Price >= 0 -> true ; throw(kb_error(invalid_value(price, offer(Sup, Prod), Price))) ),
    get_dict(stockUnits, O, Units),
    ( integer(Units), Units > 0 -> true ; throw(kb_error(invalid_value(stock_units, offer(Sup, Prod), Units))) ),
    get_dict(leadTimeDays, O, Lead),
    ( number(Lead), Lead >= 0 -> true ; throw(kb_error(invalid_value(lead_time, offer(Sup, Prod), Lead))) ),
    (   get_dict(supplyLimit, O, L), L \== null
    ->  (   integer(L), L >= 0 -> Limit = [supplier_limit(Sup, Prod, L)]
        ;   throw(kb_error(invalid_value(supply_limit, offer(Sup, Prod), L)))
        )
    ;   Limit = []
    ).

check_unique_offers(Facts) :-
    findall(o(S, P), member(supplier_offer(S, P, _, _, _), Facts), Keys0),
    msort(Keys0, Keys),
    (   append(_, [o(S, P), o(S, P)|_], Keys) -> throw(kb_error(duplicate_offer(S, P)))
    ;   true
    ).

% Helper rules for standardizing values, dates, fields and quantities 

optional_atom(Key, Dict, Atom) :-
    (   get_dict(Key, Dict, V), V \== null -> to_atom(V, Atom)
    ;   Atom = none
    ).

version_term(V0, V) :- ( number(V0) -> V = V0 ; to_atom(V0, V) ).

iso_date(D0, Where, Date) :-
    (   catch(parse_iso_date(D0, Date), _, fail) -> true
    ;   throw(kb_error(invalid_value(date, Where, D0)))
    ).

parse_iso_date(D0, Date) :-
    atom_string(Date, D0),
    atom_codes(Date, [Y1,Y2,Y3,Y4,0'-,M1,M2,0'-,D1,D2]),
    number_codes(Y, [Y1,Y2,Y3,Y4]), number_codes(M, [M1,M2]), number_codes(D, [D1,D2]),
    M >= 1, M =< 12, D >= 1,
    date_time_stamp(date(Y, M, D, 0, 0, 0, 0, -, -), Stamp),
    stamp_date_time(Stamp, date(Y, M, D, _, _, _, _, _, _), 'UTC').

require_keys(Dict, Keys, Where) :-
    (   is_dict(Dict) -> true
    ;   throw(kb_error(invalid_snapshot(not_an_object(Where))))
    ),
    forall(member(K, Keys),
           (   get_dict(K, Dict, V), V \== null -> true
           ;   throw(kb_error(missing(K, Where)))
           )).

product_fact(P, [product(Id, Name, Sell, SC)]) :-
    get_dict(id, P, I), get_dict(name, P, N),
    get_dict(sellable, P, Sell), get_dict(stockControlled, P, SC),
    to_atom(I, Id), to_atom(N, Name).

size_fact(Z, [size(Id, Name)]) :-
    get_dict(id, Z, I), get_dict(name, Z, N), to_atom(I, Id), to_atom(N, Name).

bom_fact(B, [bom_item(P, S, C, Q)]) :-
    get_dict(pizzaId, B, P0), get_dict(sizeId, B, S0),
    get_dict(componentId, B, C0), get_dict(quantity, B, Q),
    to_atom(P0, P), to_atom(S0, S), to_atom(C0, C),
    units(Q, bom_item(P, S, C)).

aggregate_facts(A, [aggregate(Id, Class)|Items]) :-
    get_dict(id, A, I), to_atom(I, Id),
    get_dict(classification, A, C0), to_atom(C0, Class),
    (   memberchk(Class, [production, purchase]) -> true
    ;   throw(kb_error(invalid_value(classification, Id, Class)))
    ),
    get_dict(items, A, Is),
    ( is_list(Is) -> true ; throw(kb_error(invalid_snapshot(not_a_list(items)))) ),
    forall(member(It, Is), require_keys(It, [componentId, quantity], aggregate_items)),
    maplist(aggregate_item_fact(Id), Is, Items).

aggregate_item_fact(Id, It, aggregate_item(Id, C, Q)) :-
    get_dict(componentId, It, C0), get_dict(quantity, It, Q),
    to_atom(C0, C), units(Q, aggregate_item(Id, C)).

stock_fact(E, [stock(P, Q)]) :-
    get_dict(productId, E, P0), get_dict(quantity, E, Q), to_atom(P0, P),
    units(Q, stock(P)).

order_facts(O, [order(Id, Sim)|Facts]) :-
    get_dict(id, O, I), to_atom(I, Id),
    get_dict(simulated, O, Sim),
    (   memberchk(Sim, [true, false]) -> true
    ;   throw(kb_error(invalid_value(simulated, order(Id), Sim)))
    ),
    get_dict(items, O, Is),
    ( is_list(Is) -> true ; throw(kb_error(invalid_snapshot(not_a_list(order_items)))) ),
    forall(member(It, Is), require_keys(It, [pizzaId, sizeId, quantity], order_items)),
    maplist(order_item_fact(Id), Is, Facts).

order_item_fact(Id, It, ordered_item(Id, P, S, Q)) :-
    get_dict(pizzaId, It, P0), get_dict(sizeId, It, S0), get_dict(quantity, It, Q),
    to_atom(P0, P), to_atom(S0, S),
    (   integer(Q), Q > 0 -> true
    ;   throw(kb_error(invalid_value(quantity, ordered_item(Id, P, S), Q)))
    ).

issue_fact(I, kb_issue(Code, I)) :-
    get_dict(code, I, C0), to_atom(C0, Code).

units(Q, Where) :-
    (   integer(Q), Q >= 0 -> true
    ;   throw(kb_error(invalid_value(quantity, Where, Q)))
    ).

to_atom(S, A) :- atom_string(A, S).

% Validates that all references in the facts are known and consistent.

check_references(Facts) :-
    findall(I, member(product(I,_,_,_), Facts), Products),
    findall(I, member(product(I,_,_,true), Facts), Controlled),
    findall(I, member(size(I,_), Facts), Sizes),
    forall(member(bom_item(P, S, C, _), Facts),
           ( known(P, Products, bom_pizza), known(C, Products, bom_component), known(S, Sizes, bom_size) )),
    forall(member(aggregate(A, _), Facts),         known(A, Products, aggregate)),
    forall(member(aggregate_item(_, C, _), Facts), known(C, Products, aggregate_item)),
    forall(member(ordered_item(_, P, S, _), Facts),
           ( known(P, Products, order_pizza), known(S, Sizes, order_size) )),
    findall(I, member(supplier(I,_), Facts), Suppliers),
    forall(member(forecast_item(_, _, P, S, _), Facts),
           (   known(P, Products, forecast_product),
               (   S == none -> true ; known(S, Sizes, forecast_size) ) )),
    forall(member(supplier_offer(Su, P, _, _, _), Facts),
           ( known(Su, Suppliers, offer_supplier), known(P, Products, offer_product) )),
    forall(member(stock(P, _), Facts),
           (   known(P, Products, stock),
               (   memberchk(P, Controlled) -> true
               ;   throw(kb_error(not_stock_controlled(P)))
               ) )).

known(Id, Ids, Where) :-
    (   memberchk(Id, Ids) -> true
    ;   throw(kb_error(unknown_reference(Where, Id)))
    ).
