% Tests of the AI05 service routes (POST /service/bom, POST /service/requirements): service key,
% body validation and calculation with the snapshot sent in the body. No back end is involved.
% How to run:  swipl -q -g run_tests -t halt test/service.plt  or ./run-tests.sh

:- use_module(library(plunit)).
:- use_module(library(http/json)).
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_open)).
:- use_module('../server').

:- prolog_load_context(directory, D), asserta(service_test_dir(D)).

service_key("test-service-key-0123456789abcdef0123456789").

fixture(Name, Dict) :-
    service_test_dir(Dir),
    atomic_list_concat([Dir, '/../fixtures/', Name, '.json'], Path),
    setup_call_cleanup(open(Path, read, In, [encoding(utf8)]),
                       json_read_dict(In, Dict),
                       close(In)).

:- dynamic test_port/1.

start_ai :-
    service_key(Key), setenv('AI_SERVICE_KEY', Key),
    http_server(http_dispatch, [port('127.0.0.1':Port)]),
    retractall(test_port(_)), assertz(test_port(Port)).

stop_ai :-
    test_port(Port), http_stop_server('127.0.0.1':Port, []),
    setenv('AI_SERVICE_KEY', '').

% call_service(+Path, +KeyOption, +Body, -Status, -Reply). KeyOption: key(K) | no_key
call_service(Path, KeyOption, Body, Status, Reply) :-
    test_port(Port),
    format(atom(Url), 'http://127.0.0.1:~w~w', [Port, Path]),
    ( KeyOption = key(K) -> Headers = [request_header('X-Api-Key' = K)] ; Headers = [] ),
    (   Body = raw(Text) -> Post = post(atom('application/json', Text)) ; Post = post(json(Body)) ),
    setup_call_cleanup(
        http_open(Url, In, [method(post), status_code(Status), Post|Headers]),
        read_string(In, _, Answer),
        close(In)),
    (   catch(atom_json_dict(Answer, Reply0, []), _, fail) -> Reply = Reply0 ; Reply = Answer ).

valid_body(Body) :-
    fixture('demo-partial', Snapshot),
    Body = _{request: _{scenarioId: "DEMO-PARTIAL", stockMode: "scenario"}, snapshot: Snapshot}.

error_code(Reply, Code) :- get_dict(error, Reply, E), get_dict(code, E, Code).

detail_fields(Reply, Fields) :-
    get_dict(error, Reply, E), get_dict(details, E, Ds),
    findall(F, ( member(D, Ds), get_dict(field, D, F) ), Fields0),
    msort(Fields0, Fields).

:- begin_tests(service_routes, [setup(start_ai), cleanup(stop_ai)]).

test(bom_with_the_snapshot_in_the_body) :-
    service_key(K), valid_body(B),
    call_service('/service/bom', key(K), B, 200, R),
    get_dict(status, R, "ok"),
    get_dict(simulation, R, true),
    get_dict(production, R, [P]), get_dict(productId, P, "c-massa"),
    get_dict(shortages, R, [S]), get_dict(productId, S, "c-mozzarella").

test(requirements_route_answers_with_the_json_contract) :-
    % demo-partial has no forecast: the planning answers 422 with the problems, not 500.
    service_key(K), valid_body(B),
    call_service('/service/requirements', key(K), B, Status, R),
    memberchk(Status, [200, 422]),
    (   Status == 422 -> error_code(R, "AI_INVALID_DATA") ; get_dict(status, R, "ok") ).

test(without_key_is_401) :-
    valid_body(B),
    call_service('/service/bom', no_key, B, 401, R),
    error_code(R, "SERVICE_UNAUTHORIZED").

test(wrong_key_is_401) :-
    valid_body(B),
    call_service('/service/bom', key('not-the-key'), B, 401, R),
    error_code(R, "SERVICE_UNAUTHORIZED").

test(user_token_is_not_a_service_identity) :-
    % A Bearer token (even of a MANAGER) does not open the service routes.
    test_port(Port), valid_body(B),
    format(atom(Url), 'http://127.0.0.1:~w/service/bom', [Port]),
    setup_call_cleanup(
        http_open(Url, In, [method(post), status_code(Status), post(json(B)),
                            request_header('Authorization' = 'Bearer manager.token')]),
        read_string(In, _, _), close(In)),
    Status == 401.

test(missing_request_and_snapshot_are_400) :-
    service_key(K),
    call_service('/service/bom', key(K), _{}, 400, R),
    error_code(R, "VALIDATION_ERROR"),
    detail_fields(R, ["request", "snapshot"]).

test(invalid_request_fields_are_prefixed) :-
    service_key(K), fixture('demo-partial', S),
    call_service('/service/bom', key(K),
                 _{request: _{scenarioId: "demo partial", stockMode: "x"}, snapshot: S}, 400, R),
    detail_fields(R, ["request.scenarioId", "request.stockMode"]).

test(malformed_json_is_400) :-
    service_key(K),
    call_service('/service/bom', key(K), raw('{not json'), 400, R),
    error_code(R, "VALIDATION_ERROR").

test(snapshot_of_another_scenario_is_422) :-
    service_key(K), fixture('demo-partial', S),
    call_service('/service/bom', key(K),
                 _{request: _{scenarioId: "DEMO-OTHER", stockMode: "scenario"}, snapshot: S}, 422, R),
    error_code(R, "AI_INVALID_DATA").

test(get_is_405) :-
    test_port(Port),
    format(atom(Url), 'http://127.0.0.1:~w/service/bom', [Port]),
    setup_call_cleanup(http_open(Url, In, [status_code(Status)]), read_string(In, _, _), close(In)),
    Status == 405.

:- end_tests(service_routes).

:- begin_tests(service_key_unset).

test(routes_are_closed_without_configured_key) :-
    setenv('AI_SERVICE_KEY', ''),
    \+ ai_server:service_key_ok([x_api_key('')]),
    \+ ai_server:service_key_ok([x_api_key(anything)]).

:- end_tests(service_key_unset).
