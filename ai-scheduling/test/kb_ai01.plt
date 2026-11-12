% Automated tests for the AI01 changes of the knowledge base:
% fixtures, accumulated validation rules, with_snapshot/2, back end configuration and fetch_snapshot/3.
% How to run:  swipl -q -g run_tests -t halt test/kb_ai01.plt  or ./run-tests.sh

:- use_module(library(plunit)).
:- use_module(library(http/json)).
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module('../kb').

:- prolog_load_context(directory, D), asserta(ai01_test_dir(D)).

fixture(Name, Dict) :-
    ai01_test_dir(Dir),
    atomic_list_concat([Dir, '/../fixtures/', Name, '.json'], Path),
    setup_call_cleanup(open(Path, read, In, [encoding(utf8)]), json_read_dict(In, Dict), close(In)).

problems_of(Name, Problems) :-
    fixture(Name, D),
    validate_snapshot(D, Problems).

codes(Problems, Codes) :-
    findall(C, ( member(P, Problems), get_dict(code, P, C) ), Cs),
    msort(Cs, Codes).

has_problem(Problems, Code, Pairs) :-
    member(P, Problems),
    get_dict(code, P, Code),
    forall(member(K-V, Pairs), get_dict(K, P, V)), !.

count(G, N) :- aggregate_all(count, G, N).

% Changes the first element of list Key in a snapshot.
set_first(Key, Field, Value, D0, D) :-
    get_dict(Key, D0, [E|Es]),
    put_dict(Field, E, Value, E1),
    put_dict(Key, D0, [E1|Es], D).

% ---------------------------------------------------------------------------------------------
% Valid fixtures: they load and produce the AI01 facts
% ---------------------------------------------------------------------------------------------

:- begin_tests(ai01_fixtures, [cleanup(clear_kb)]).

test(valid_fixtures_have_no_problems, [forall(member(Name, ['demo-basic', 'demo-sufficient',
                                                            'demo-insufficient', 'demo-partial',
                                                            reference]))]) :-
    problems_of(Name, Problems),
    Problems == [].

test(scenario_pizzas_and_sources) :-
    fixture('demo-partial', D),
    load_kb_from_dict(D),
    kb_scenario('DEMO-PARTIAL', _, 1, true, scenario),
    count(pizza(_), 3),
    count(pizza_size(_, _), 9),
    once(pizza_size('p-margherita', 'size-m')),
    count(kb_source(_, _), 3),
    once(kb_source(stock, Info)), get_dict(scenarioId, Info, "DEMO-PARTIAL"),
    kb_is_simulation.

test(scenario_orders_and_stock) :-
    fixture('demo-insufficient', D),
    load_kb_from_dict(D),
    count(ordered_item(_, _, _, _), 3),
    ordered_item('DEMO-INSUFFICIENT#1', 'p-prosciutto', 'size-l', 2),
    stock('c-massa', 0),
    \+ stock('i-farinha', _).

test(aggregates_and_backend_issues) :-
    fixture('demo-basic', D),
    load_kb_from_dict(D),
    aggregate('c-massa', production),
    aggregate('c-molho', purchase),
    aggregate_item('c-massa', 'i-farinha', 2),
    \+ aggregate_item('c-molho', _, _),
    count(kb_issue('UNMEASURED_NON_STOCK_COMPONENT', _), 3),
    \+ bom_item(_, _, 'c-oregaos', _).

test(reference_has_stock_controlled_ingredients) :-
    fixture(reference, D),
    load_kb_from_dict(D),
    product('i-farinha', _, false, true),
    stock('i-farinha', 3), stock('i-agua', 10), stock('i-fermento', 10).

test(snapshot_without_scenario_is_still_valid) :-
    fixture('demo-partial', D0),
    del_dict(scenario, D0, _, D1), del_dict(orders, D1, _, D2), del_dict(pizzas, D2, _, D),
    validate_snapshot(D, []).

:- end_tests(ai01_fixtures).

% ---------------------------------------------------------------------------------------------
% Invalid fixtures: every problem is reported, with its code and path
% ---------------------------------------------------------------------------------------------

:- begin_tests(ai01_invalid_fixtures).

test(invalid_snapshot) :-
    problems_of('invalid-snapshot', Ps),
    codes(Ps, ["INVALID_SNAPSHOT"]),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-pizzas, reason-"missing"]).

test(unknown_item) :-
    problems_of('invalid-unknown-item', Ps),
    codes(Ps, ["UNKNOWN_ITEM", "UNKNOWN_ITEM", "UNKNOWN_ITEM"]),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"bom[0]", field-componentId, id-'c-nao-existe']),
    has_problem(Ps, "UNKNOWN_ITEM", [field-productId, id-'c-desconhecido']),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"orders[0].items[0]", field-sizeId, id-'size-xl']).

test(zero_and_negative_quantities) :-
    problems_of('invalid-zero-quantity', Ps),
    codes(Ps, ["INVALID_QUANTITY", "INVALID_QUANTITY", "INVALID_QUANTITY", "INVALID_QUANTITY"]),
    has_problem(Ps, "INVALID_QUANTITY", [path-"aggregates[0].items[0]", quantity-0]),
    has_problem(Ps, "INVALID_QUANTITY", [path-"bom[0]", quantity-0]),
    has_problem(Ps, "INVALID_QUANTITY", [path-"orders[0].items[0]", quantity-0]),
    has_problem(Ps, "INVALID_QUANTITY", [path-"stock[0]", quantity-(-1)]).

test(duplicates) :-
    problems_of('invalid-duplicates', Ps),
    codes(Ps, ["DUPLICATE_ENTRY", "DUPLICATE_ENTRY", "DUPLICATE_ENTRY", "DUPLICATE_ENTRY",
               "DUPLICATE_ENTRY"]),
    has_problem(Ps, "DUPLICATE_ENTRY", [kind-product]),
    has_problem(Ps, "DUPLICATE_ENTRY", [kind-bom_line]),
    has_problem(Ps, "DUPLICATE_ENTRY", [kind-aggregate_item, key-"c-massa/i-farinha"]),
    has_problem(Ps, "DUPLICATE_ENTRY", [kind-order_line]),
    has_problem(Ps, "DUPLICATE_ENTRY", [kind-stock, key-"c-massa",
                                        paths-["stock[0]", "stock[3]"]]).

test(incomplete_aggregate) :-
    problems_of('invalid-incomplete-aggregate', Ps),
    codes(Ps, ["INCOMPLETE_AGGREGATE"]),
    has_problem(Ps, "INCOMPLETE_AGGREGATE", [aggregateId-'c-massa', path-"aggregates[0]"]).

test(purchased_with_composition) :-
    problems_of('invalid-purchased-with-composition', Ps),
    codes(Ps, ["PURCHASED_WITH_COMPOSITION"]),
    has_problem(Ps, "PURCHASED_WITH_COMPOSITION", [aggregateId-'c-molho']).

test(nested_aggregate) :-
    problems_of('invalid-nested-aggregate', Ps),
    codes(Ps, ["NESTED_AGGREGATE"]),
    has_problem(Ps, "NESTED_AGGREGATE", [aggregateId-'c-massa', itemId-'c-molho',
                                         path-"aggregates[0].items[3]"]).

test(pizza_as_component) :-
    problems_of('invalid-pizza-as-component', Ps),
    codes(Ps, ["PIZZA_AS_COMPONENT"]),
    has_problem(Ps, "PIZZA_AS_COMPONENT", [pizzaId-'p-margherita']).

test(several_problems_at_once) :-
    problems_of('invalid-multiple', Ps),
    codes(Ps, ["DUPLICATE_ENTRY", "INVALID_QUANTITY", "NESTED_AGGREGATE",
               "PURCHASED_WITH_COMPOSITION", "UNKNOWN_ITEM"]).

test(load_throws_invalid_data_and_keeps_previous_kb, [cleanup(clear_kb)]) :-
    fixture('demo-partial', Good), load_kb_from_dict(Good),
    fixture('invalid-nested-aggregate', Bad),
    catch(load_kb_from_dict(Bad), kb_error(invalid_data(Ps)), true),
    codes(Ps, ["NESTED_AGGREGATE"]),
    kb_scenario('DEMO-PARTIAL', _, _, _, _).

:- end_tests(ai01_invalid_fixtures).

% ---------------------------------------------------------------------------------------------
% Other validation rules (structure and types)
% ---------------------------------------------------------------------------------------------

:- begin_tests(ai01_rules).

test(not_an_object) :-
    validate_snapshot("x", Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-"$", reason-"not_an_object"]).

test(missing_meta) :-
    fixture('demo-basic', D0), del_dict(meta, D0, _, D),
    validate_snapshot(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-"meta", reason-"missing"]).

test(scenario_requires_orders) :-
    fixture('demo-basic', D0), del_dict(orders, D0, _, D),
    validate_snapshot(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-orders, reason-"missing"]).

test(invalid_stock_mode) :-
    fixture('demo-basic', D0), get_dict(scenario, D0, S0),
    put_dict(stockMode, S0, "other", S), put_dict(scenario, D0, S, D),
    validate_snapshot(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-"scenario.stockMode", reason-"invalid_stock_mode"]).

test(scenario_simulated_must_be_boolean) :-
    fixture('demo-basic', D0), get_dict(scenario, D0, S0),
    put_dict(simulated, S0, "yes", S), put_dict(scenario, D0, S, D),
    validate_snapshot(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-"scenario.simulated", reason-"not_a_boolean"]).

test(sources_must_be_objects) :-
    fixture('demo-basic', D0), get_dict(meta, D0, M0),
    put_dict(sources, M0, "x", M), put_dict(meta, D0, M, D),
    validate_snapshot(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-"meta.sources", reason-"not_an_object"]).

test(ids_must_be_text) :-
    fixture('demo-basic', D0), set_first(bom, componentId, _{x:1}, D0, D),
    validate_snapshot(D, Ps),
    has_problem(Ps, "INVALID_SNAPSHOT", [path-"bom[0]", field-componentId, reason-"invalid_type"]).

test(pizza_sizes_must_be_known) :-
    fixture('demo-basic', D0), get_dict(pizzas, D0, [P0|Ps0]),
    put_dict(sizeIds, P0, ["size-xl"], P), put_dict(pizzas, D0, [P|Ps0], D),
    validate_snapshot(D, Ps),
    has_problem(Ps, "UNKNOWN_ITEM", [path-"pizzas[0].sizeIds[0]", id-'size-xl']).

test(bom_component_cannot_be_a_pizza) :-
    fixture('demo-basic', D0), set_first(bom, componentId, "p-margherita", D0, D),
    validate_snapshot(D, Ps),
    has_problem(Ps, "PIZZA_AS_COMPONENT", [path-"bom[0]", pizzaId-'p-margherita']).

test(stock_of_product_without_stock_control) :-
    fixture('demo-basic', D0), get_dict(stock, D0, S0),
    append(S0, [_{productId:"i-farinha", quantity:1}], S), put_dict(stock, D0, S, D),
    validate_snapshot(D, Ps),
    has_problem(Ps, "STOCK_NOT_CONTROLLED", [productId-'i-farinha']).

test(validate_does_not_change_the_kb, [cleanup(clear_kb)]) :-
    clear_kb,
    fixture('demo-basic', D),
    validate_snapshot(D, []),
    \+ product(_, _, _, _).

:- end_tests(ai01_rules).

% ---------------------------------------------------------------------------------------------
% with_snapshot/2: one request at a time, facts always cleared
% ---------------------------------------------------------------------------------------------

:- begin_tests(ai01_with_snapshot, [setup(clear_kb), cleanup(clear_kb)]).

test(goal_sees_the_snapshot) :-
    fixture('demo-partial', D),
    with_snapshot(D, ( count(bom_item(_, _, _, _), 33), kb_scenario('DEMO-PARTIAL', _, _, _, _) )).

test(facts_are_cleared_after_success) :-
    fixture('demo-partial', D),
    with_snapshot(D, true),
    \+ product(_, _, _, _), \+ kb_meta(_, _, _).

test(facts_are_cleared_after_failure, [fail]) :-
    fixture('demo-partial', D),
    with_snapshot(D, fail).

test(facts_are_cleared_after_failure_check) :-
    fixture('demo-partial', D),
    ( with_snapshot(D, fail) -> true ; true ),
    \+ product(_, _, _, _).

test(facts_are_cleared_after_exception) :-
    fixture('demo-partial', D),
    catch(with_snapshot(D, throw(boom)), boom, true),
    \+ product(_, _, _, _).

test(invalid_snapshot_throws_and_clears) :-
    fixture('invalid-nested-aggregate', D),
    catch(with_snapshot(D, true), kb_error(invalid_data(Ps)), true),
    codes(Ps, ["NESTED_AGGREGATE"]),
    \+ product(_, _, _, _).

test(concurrent_requests_do_not_mix) :-
    fixture('demo-basic', A), fixture('demo-partial', B),
    thread_create(only_sees(A, 'DEMO-BASIC', 100), T1, []),
    thread_create(only_sees(B, 'DEMO-PARTIAL', 100), T2, []),
    thread_join(T1, S1), thread_join(T2, S2),
    S1 == true, S2 == true.

only_sees(D, Expected, Times) :-
    forall(between(1, Times, _),
           with_snapshot(D, ( findall(Id, kb_scenario(Id, _, _, _, _), [Expected]),
                              count(kb_meta(_, _, _), 1) ))).

:- end_tests(ai01_with_snapshot).

% ---------------------------------------------------------------------------------------------
% Back end configuration: AI_BACKEND_URL and AI_BACKEND_TIMEOUT_SECONDS
% ---------------------------------------------------------------------------------------------

reset_env :-
    setenv('AI_BACKEND_URL', ''),
    setenv('AI_BACKEND_TIMEOUT_SECONDS', '').

:- begin_tests(ai01_config, [setup(reset_env), cleanup(reset_env)]).

test(accepted_urls, [forall(member(Raw-Expected,
        [ 'http://127.0.0.1:3000'          - 'http://127.0.0.1:3000/api/v1',
          'http://127.0.0.1:3000/'         - 'http://127.0.0.1:3000/api/v1',
          'http://10.9.22.22/api/v1'       - 'http://10.9.22.22/api/v1',
          'http://10.9.22.22/api/v1/'      - 'http://10.9.22.22/api/v1',
          'https://example.org:8443'       - 'https://example.org:8443/api/v1',
          ' http://localhost:3000 '        - 'http://localhost:3000/api/v1' ]))]) :-
    normalize_backend_url(Raw, Url),
    Url == Expected.

test(rejected_urls, [forall(member(Raw, [ 'ftp://x', 'http://10.9.22.22/api', 'http://host/api/v1?x=1',
                                          'localhost:3000', 'http://', '' ])),
                     throws(kb_error(invalid_config('AI_BACKEND_URL', _, _)))]) :-
    normalize_backend_url(Raw, _).

test(credentials_are_hidden_in_the_error) :-
    catch(normalize_backend_url('http://user:secret@host', _),
          kb_error(invalid_config('AI_BACKEND_URL', Shown, _)), true),
    Shown == "http://***@host".

test(default_url) :-
    setenv('AI_BACKEND_URL', ''),
    backend_base_url(Url),
    Url == 'http://127.0.0.1:3000/api/v1'.

test(url_from_environment) :-
    setenv('AI_BACKEND_URL', 'http://10.9.22.22'),
    backend_base_url(Url),
    Url == 'http://10.9.22.22/api/v1'.

test(default_timeout) :-
    setenv('AI_BACKEND_TIMEOUT_SECONDS', ''),
    backend_timeout(T),
    T == 10.

test(invalid_timeout, [throws(kb_error(invalid_config('AI_BACKEND_TIMEOUT_SECONDS', abc, _)))]) :-
    setenv('AI_BACKEND_TIMEOUT_SECONDS', abc),
    backend_timeout(_).

test(check_backend_config) :-
    reset_env,
    check_backend_config.

test(check_backend_config_rejects_bad_url, [throws(kb_error(invalid_config(_, _, _)))]) :-
    setenv('AI_BACKEND_URL', 'ftp://x'),
    check_backend_config.

:- end_tests(ai01_config).

% ---------------------------------------------------------------------------------------------
% fetch_snapshot/3 against a fake back end
% ---------------------------------------------------------------------------------------------

:- dynamic fake_mode/1, fake_request/2.

:- http_handler(root(api/v1/'ai-data'/snapshot), fake_backend, []).

fake_backend(Request) :-
    fake_mode(Mode),
    ( memberchk(authorization(A), Request) -> true ; A = none ),
    ( memberchk(request_uri(U), Request) -> true ; U = none ),
    retractall(fake_request(_, _)), assertz(fake_request(A, U)),
    fake_reply(Mode).

fake_reply(ok)        :- reply_json_dict(_{meta:_{snapshotId:"fake"}}).
fake_reply(forbidden) :- reply_json_dict(_{error:_{status:403, code:"FORBIDDEN", message:"Forbidden"}}, [status(403)]).
fake_reply(scenario_not_found) :-
    reply_json_dict(_{error:_{status:404, code:"AI_SCENARIO_NOT_FOUND", message:"x"}}, [status(404)]).
fake_reply(route_not_found) :-
    reply_json_dict(_{error:_{status:404, code:"NOT_FOUND", message:"Route not found"}}, [status(404)]).
fake_reply(bad_request) :-
    reply_json_dict(_{error:_{status:400, code:"SCENARIO_WITHOUT_STOCK", message:"x"}}, [status(400)]).
fake_reply(server_error) :-
    reply_json_dict(_{error:_{status:500, code:"INTERNAL_SERVER_ERROR"}}, [status(500)]).
fake_reply(slow)    :- sleep(3), reply_json_dict(_{}).
fake_reply(garbage) :- format("Content-type: application/json~n~n{not json").

token("secret-token-123").

start_fake_backend :-
    http_server(http_dispatch, [port(Port)]),
    nb_setval(ai01_fake_port, Port),
    format(atom(Url), 'http://127.0.0.1:~w', [Port]),
    setenv('AI_BACKEND_URL', Url),
    setenv('AI_BACKEND_TIMEOUT_SECONDS', '1').

stop_fake_backend :-
    nb_getval(ai01_fake_port, Port),
    http_stop_server(Port, []),
    reset_env.

fake(Mode) :- retractall(fake_mode(_)), assertz(fake_mode(Mode)).

% Calls fetch_snapshot/3 in Mode and returns the error term (or ok(Dict)).
fetch_in(Mode, Params, Result) :-
    fake(Mode),
    token(T),
    catch(( fetch_snapshot(Params, T, D), Result = ok(D) ), E, Result = E).

no_token_in(Term) :-
    token(T),
    term_string(Term, S),
    \+ sub_string(S, _, _, _, T).

:- begin_tests(ai01_fetch, [setup(start_fake_backend), cleanup(stop_fake_backend)]).

test(ok_sends_the_token_and_the_encoded_query) :-
    fetch_in(ok, _{scenarioId:"DEMO PARTIAL&x", stockMode:"scenario"}, ok(D)),
    get_dict(meta, D, M), get_dict(snapshotId, M, "fake"),
    fake_request(Auth, Uri),
    Auth == 'Bearer secret-token-123',
    Uri == '/api/v1/ai-data/snapshot?scenarioId=DEMO%20PARTIAL%26x&stockMode=scenario'.

test(no_params_no_query) :-
    fetch_in(ok, _{}, ok(_)),
    fake_request(_, Uri),
    Uri == '/api/v1/ai-data/snapshot'.

test(denied_is_forwarded) :-
    fetch_in(forbidden, _{}, E),
    E = kb_error(backend_denied(403, Body)),
    get_dict(error, Body, Err), get_dict(code, Err, "FORBIDDEN"),
    no_token_in(E).

test(scenario_not_found) :-
    fetch_in(scenario_not_found, _{scenarioId:"DEMO-X"}, E),
    E == kb_error(scenario_not_found("DEMO-X")).

test(other_404_is_unavailable) :-
    fetch_in(route_not_found, _{}, E),
    E == kb_error(backend_unavailable(unexpected_backend_response(404))).

test(bad_request_is_rejected) :-
    fetch_in(bad_request, _{}, E),
    E = kb_error(backend_rejected("SCENARIO_WITHOUT_STOCK", _)).

test(server_error_is_unavailable) :-
    fetch_in(server_error, _{}, E),
    E == kb_error(backend_unavailable(status(500))),
    no_token_in(E).

test(timeout) :-
    fetch_in(slow, _{}, E),
    E == kb_error(backend_timeout),
    no_token_in(E).

test(invalid_json) :-
    fetch_in(garbage, _{}, E),
    E == kb_error(backend_unavailable(invalid_json)).

test(connection_refused) :-
    getenv('AI_BACKEND_URL', Saved),
    setenv('AI_BACKEND_URL', 'http://127.0.0.1:9'),
    setenv('AI_BACKEND_TIMEOUT_SECONDS', '10'),
    token(T),
    catch(fetch_snapshot(_{}, T, _), E, true),
    setenv('AI_BACKEND_URL', Saved),
    setenv('AI_BACKEND_TIMEOUT_SECONDS', '1'),
    E == kb_error(backend_unavailable(connection_failed)),
    no_token_in(E).

test(missing_token, [throws(kb_error(missing_token))]) :-
    fetch_snapshot(_{}, "", _).

test(params_must_be_a_dict, [throws(kb_error(invalid_params(nope)))]) :-
    fetch_snapshot(nope, "t", _).

:- end_tests(ai01_fetch).
