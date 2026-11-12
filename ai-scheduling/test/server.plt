% Automated tests of the HTTP service (server.pl): routes, validation, error mapping, token
% handling and concurrent requests, against a fake back end that serves the fixtures.
% How to run:  swipl -q -g run_tests -t halt test/server.plt  or ./run-tests.sh

:- use_module(library(plunit)).
:- use_module(library(http/json)).
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_open)).
:- use_module(library(http/http_parameters)).
:- use_module(library(memfile)).
:- use_module(library(thread)).
:- use_module('../server').

:- prolog_load_context(directory, D), asserta(server_test_dir(D)).

fixture_file(Name, Path) :-
    server_test_dir(Dir),
    atomic_list_concat([Dir, '/../fixtures/', Name, '.json'], Path).

manager_token("manager.secret-token-123").
employee_token("employee.secret-token-456").

% ---------------------------------------------------------------------------------------------
% Fake back end: GET /api/v1/ai-data/snapshot, answer chosen by scenarioId
% ---------------------------------------------------------------------------------------------

:- dynamic backend_request/3.

:- http_handler(root(api/v1/'ai-data'/snapshot), fake_backend, []).

fake_backend(Request) :-
    memberchk(method(Method), Request),
    ( memberchk(authorization(A), Request) -> true ; A = none ),
    ( memberchk(request_uri(U), Request) -> true ; U = none ),
    assertz(backend_request(Method, A, U)),
    http_parameters(Request, [scenarioId(Id, [default('')])]),
    employee_token(Emp), atom_concat('Bearer ', Emp, EmpAuth),
    (   A == EmpAuth
    ->  reply_json_dict(_{error:_{status:403, code:"FORBIDDEN", message:"Forbidden."}}, [status(403)])
    ;   backend_answer(Id)
    ).

backend_answer('DEMO-PARTIAL')  :- !, reply_fixture('demo-partial').
backend_answer('DEMO-BASIC')    :- !, reply_fixture('demo-basic').
backend_answer('DEMO-INVALID')  :- !, reply_fixture('invalid-nested-aggregate').
backend_answer('DEMO-ROUTE')    :- !,
    reply_json_dict(_{error:_{status:404, code:"NOT_FOUND", message:"Not found."}}, [status(404)]).
backend_answer('DEMO-NOSTOCK')  :- !,
    reply_json_dict(_{error:_{status:400, code:"SCENARIO_WITHOUT_STOCK",
                              message:"The scenario has no stock of its own."}}, [status(400)]).
backend_answer('DEMO-500')      :- !,
    reply_json_dict(_{error:_{status:500, code:"INTERNAL_ERROR", message:"x"}}, [status(500)]).
backend_answer('DEMO-GARBAGE')  :- !, format("Content-type: application/json~n~n{not json").
backend_answer('DEMO-SLOW')     :- !, sleep(3), reply_json_dict(_{}).
backend_answer(_) :-
    reply_json_dict(_{error:_{status:404, code:"AI_SCENARIO_NOT_FOUND", message:"x"}}, [status(404)]).

reply_fixture(Name) :-
    fixture_file(Name, Path),
    read_file_to_string(Path, Text, [encoding(utf8)]),
    format("Content-type: application/json; charset=UTF-8~n~n"),
    set_stream(current_output, encoding(utf8)),
    write(Text).

% ---------------------------------------------------------------------------------------------
% Servers: the AI service and the fake back end, each on a free port of 127.0.0.1
% ---------------------------------------------------------------------------------------------

% A fact, not a global variable: concurrent requests run in other threads.
:- dynamic test_ports/2.

start_servers :-
    http_server(http_dispatch, [port('127.0.0.1':BackendPort)]),
    http_server(http_dispatch, [port('127.0.0.1':AiPort)]),
    retractall(test_ports(_, _)),
    assertz(test_ports(BackendPort, AiPort)),
    format(atom(Url), 'http://127.0.0.1:~w', [BackendPort]),
    setenv('AI_BACKEND_URL', Url),
    setenv('AI_BACKEND_TIMEOUT_SECONDS', '1').

stop_servers :-
    test_ports(BackendPort, AiPort),
    http_stop_server('127.0.0.1':AiPort, []),
    http_stop_server('127.0.0.1':BackendPort, []),
    setenv('AI_BACKEND_URL', ''),
    setenv('AI_BACKEND_TIMEOUT_SECONDS', '').

% call_ai(+Method, +Path, +Options, -Status, -Reply)
% Options: token(T), json(Dict), raw(Text). Reply is the JSON answer, or the text when it is not JSON.
call_ai(Method, Path, Options, Status, Reply) :-
    test_ports(_, AiPort),
    format(atom(Url), 'http://127.0.0.1:~w~w', [AiPort, Path]),
    findall(O, request_option(Options, O), Opts0),
    (   member(json(Dict), Options) -> Opts1 = [post(json(Dict))|Opts0]
    ;   member(raw(Text), Options)  -> Opts1 = [post(atom('application/json', Text))|Opts0]
    ;   Opts1 = Opts0
    ),
    setup_call_cleanup(
        http_open(Url, In, [method(Method), status_code(Status)|Opts1]),
        read_string(In, _, Body),
        close(In)),
    nb_setval(server_test_last_body, Body),
    (   catch(atom_json_dict(Body, Reply0, []), _, fail) -> Reply = Reply0 ; Reply = Body ).

request_option(Options, request_header('Authorization' = Value)) :-
    member(token(T), Options),
    atom_concat('Bearer ', T, Value).
request_option(Options, request_header('Authorization' = Value)) :-
    member(authorization(Value), Options).

bom(Token, Body, Status, Reply) :-
    call_ai(post, '/bom', [token(Token), json(Body)], Status, Reply).

error_code(Reply, Code) :-
    get_dict(error, Reply, E), get_dict(code, E, Code).

% The last answer received never includes a token.
no_token_in_last_answer :-
    nb_getval(server_test_last_body, Body),
    \+ sub_string(Body, _, _, _, "secret-token").

no_backend_call :- \+ backend_request(_, _, _).

reset_backend_log :- retractall(backend_request(_, _, _)).

item(Reply, Id, Item) :-
    get_dict(items, Reply, Items), member(Item, Items), get_dict(productId, Item, Id), !.

% ---------------------------------------------------------------------------------------------
% Routes
% ---------------------------------------------------------------------------------------------

:- begin_tests(server_routes, [setup(start_servers), cleanup(stop_servers)]).

test(health_shows_the_backend_without_calling_it, [setup(reset_backend_log)]) :-
    call_ai(get, '/health', [], 200, R),
    get_dict(status, R, "ok"),
    test_ports(BackendPort, _),
    format(string(Expected), "http://127.0.0.1:~w/api/v1", [BackendPort]),
    get_dict(backend, R, Expected),
    no_backend_call.

test(unknown_route_is_404_json) :-
    call_ai(get, '/nope', [], 404, R),
    error_code(R, "NOT_FOUND").

test(root_is_404) :-
    call_ai(get, '/', [], 404, R),
    error_code(R, "NOT_FOUND").

test(get_bom_is_405) :-
    call_ai(get, '/bom', [], 405, R),
    error_code(R, "METHOD_NOT_ALLOWED").

test(post_health_is_405) :-
    call_ai(post, '/health', [json(_{})], 405, R),
    error_code(R, "METHOD_NOT_ALLOWED").

:- end_tests(server_routes).

% ---------------------------------------------------------------------------------------------
% POST /bom: token and body validation (the back end is never called)
% ---------------------------------------------------------------------------------------------

:- begin_tests(server_bom_request, [setup(start_servers), cleanup(stop_servers)]).

test(without_authorization_is_401, [setup(reset_backend_log)]) :-
    call_ai(post, '/bom', [json(_{scenarioId:"DEMO-PARTIAL", stockMode:"scenario"})], 401, R),
    error_code(R, "TOKEN_MISSING"),
    no_backend_call.

test(other_schemes_and_empty_bearer_are_401,
     [setup(reset_backend_log),
      forall(member(Auth, ['Basic abc', 'Bearer ', 'Bearer a b']))]) :-
    call_ai(post, '/bom', [authorization(Auth), json(_{scenarioId:"DEMO-PARTIAL", stockMode:"scenario"})],
            401, R),
    error_code(R, "TOKEN_MISSING"),
    no_backend_call.

test(missing_fields_are_400_with_details, [setup(reset_backend_log)]) :-
    manager_token(T),
    bom(T, _{}, 400, R),
    error_code(R, "VALIDATION_ERROR"),
    get_dict(error, R, E), get_dict(details, E, Details),
    findall(F-Ty, ( member(X, Details), get_dict(field, X, F), get_dict(type, X, Ty) ), Pairs),
    Pairs == ["scenarioId"-"any.required", "stockMode"-"any.required"],
    no_backend_call.

test(invalid_values_are_400_and_not_repeated) :-
    manager_token(T),
    bom(T, _{scenarioId:"demo partial", stockMode:"everything"}, 400, R),
    get_dict(error, R, E), get_dict(details, E, Details),
    findall(Ty, ( member(X, Details), get_dict(type, X, Ty) ), Types),
    Types == ["string.pattern.base", "any.only"],
    nb_getval(server_test_last_body, Body),
    \+ sub_string(Body, _, _, _, "demo partial"),
    \+ sub_string(Body, _, _, _, "everything").

test(non_string_value_is_400) :-
    manager_token(T),
    bom(T, _{scenarioId:12, stockMode:"live"}, 400, R),
    get_dict(error, R, E), get_dict(details, E, [X]),
    get_dict(type, X, "string.base").

test(scenario_id_too_long_is_400) :-
    manager_token(T),
    length(L, 65), maplist(=(0'A), L), string_codes(Long, L),
    bom(T, _{scenarioId:Long, stockMode:"live"}, 400, _).

test(body_must_be_a_json_object, [forall(member(Raw, ['not json', '[1,2]', '"text"']))]) :-
    manager_token(T),
    call_ai(post, '/bom', [token(T), raw(Raw)], 400, R),
    get_dict(error, R, E), get_dict(details, E, [X]),
    get_dict(type, X, "object.base").

test(extra_fields_are_ignored) :-
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-PARTIAL", stockMode:"scenario", extra:1}, 200, _).

:- end_tests(server_bom_request).

% ---------------------------------------------------------------------------------------------
% POST /bom: calculation and back end answers
% ---------------------------------------------------------------------------------------------

:- begin_tests(server_bom_calculation, [setup(start_servers), cleanup(stop_servers)]).

test(demo_partial_is_calculated, [setup(reset_backend_log)]) :-
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-PARTIAL", stockMode:"scenario"}, 200, R),
    get_dict(status, R, "ok"),
    get_dict(feasible, R, false),
    get_dict(production, R, [P]), get_dict(productId, P, "c-massa"), get_dict(toProduce, P, 2),
    get_dict(shortages, R, [S]), get_dict(productId, S, "c-mozzarella"),
    get_dict(replenishmentNeeded, S, 2),
    item(R, "i-farinha", F), get_dict(required, F, 4),
    no_token_in_last_answer.

test(token_and_query_are_forwarded_with_a_get, [setup(reset_backend_log)]) :-
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-PARTIAL", stockMode:"scenario"}, 200, _),
    backend_request(Method, Auth, Uri),
    Method == get,
    atom_concat('Bearer ', T, Auth),
    Uri == '/api/v1/ai-data/snapshot?scenarioId=DEMO-PARTIAL&stockMode=scenario'.

test(snapshot_of_another_mode_is_422) :-
    % The fixture is a "scenario" snapshot, the request asks for "live".
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-PARTIAL", stockMode:"live"}, 422, R),
    error_code(R, "AI_INVALID_DATA"),
    get_dict(error, R, E), get_dict(details, E, Details),
    get_dict(problems, Details, Problems),
    once(( member(Pb, Problems), get_dict(code, Pb, "SCENARIO_MISMATCH") )).

test(invalid_snapshot_is_422_with_scenario_and_inputs) :-
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-INVALID", stockMode:"scenario"}, 422, R),
    error_code(R, "AI_INVALID_DATA"),
    get_dict(error, R, E), get_dict(details, E, Details),
    get_dict(problems, Details, [_|_]),
    get_dict(scenario, Details, _),
    get_dict(inputs, Details, Inputs), get_dict(snapshotId, Inputs, _),
    \+ get_dict(items, Details, _),
    \+ get_dict(shortages, Details, _).

test(employee_gets_the_403_of_the_backend) :-
    employee_token(T),
    bom(T, _{scenarioId:"DEMO-PARTIAL", stockMode:"scenario"}, 403, R),
    error_code(R, "FORBIDDEN"),
    no_token_in_last_answer.

test(unknown_scenario_is_404) :-
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-NOPE", stockMode:"scenario"}, 404, R),
    error_code(R, "AI_SCENARIO_NOT_FOUND"),
    get_dict(error, R, E), get_dict(details, E, Details),
    get_dict(scenarioId, Details, "DEMO-NOPE").

test(other_backend_404_is_503) :-
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-ROUTE", stockMode:"scenario"}, 503, R),
    error_code(R, "AI_DATA_UNAVAILABLE"),
    get_dict(error, R, E), get_dict(details, E, Details),
    get_dict(reason, Details, "unexpected_backend_response"),
    get_dict(backendStatus, Details, 404).

test(backend_400_is_422_with_its_code) :-
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-NOSTOCK", stockMode:"scenario"}, 422, R),
    error_code(R, "AI_INVALID_DATA"),
    get_dict(error, R, E), get_dict(details, E, Details),
    get_dict(problems, Details, [P]), get_dict(code, P, "SCENARIO_WITHOUT_STOCK").

test(backend_500_is_503) :-
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-500", stockMode:"scenario"}, 503, R),
    get_dict(error, R, E), get_dict(details, E, Details),
    get_dict(reason, Details, "backend_error"),
    get_dict(backendStatus, Details, 500),
    no_token_in_last_answer.

test(invalid_backend_json_is_503) :-
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-GARBAGE", stockMode:"scenario"}, 503, R),
    get_dict(error, R, E), get_dict(details, E, Details),
    get_dict(reason, Details, "invalid_backend_response").

test(slow_backend_is_504) :-
    manager_token(T),
    bom(T, _{scenarioId:"DEMO-SLOW", stockMode:"scenario"}, 504, R),
    error_code(R, "AI_DATA_TIMEOUT"),
    no_token_in_last_answer.

test(backend_down_is_503) :-
    % A refused connection takes ~2 s on Windows: a longer timeout keeps it a 503, not a 504.
    getenv('AI_BACKEND_URL', Saved),
    setenv('AI_BACKEND_URL', 'http://127.0.0.1:9'),
    setenv('AI_BACKEND_TIMEOUT_SECONDS', '10'),
    manager_token(T),
    catch(bom(T, _{scenarioId:"DEMO-PARTIAL", stockMode:"scenario"}, Status, R), E, true),
    setenv('AI_BACKEND_URL', Saved),
    setenv('AI_BACKEND_TIMEOUT_SECONDS', '1'),
    var(E),
    Status == 503,
    get_dict(error, R, Err), get_dict(details, Err, Details),
    get_dict(reason, Details, "connection_failed").

test(concurrent_requests_do_not_mix_data) :-
    Ids = ["DEMO-BASIC", "DEMO-PARTIAL", "DEMO-BASIC", "DEMO-PARTIAL",
           "DEMO-BASIC", "DEMO-PARTIAL", "DEMO-BASIC", "DEMO-PARTIAL"],
    concurrent_maplist(calculated_scenario, Ids, Results),
    Results == Ids.

% Runs POST /bom for scenario Id and returns the scenario id of the result.
calculated_scenario(Id, Got) :-
    manager_token(T),
    bom(T, _{scenarioId:Id, stockMode:"scenario"}, 200, R),
    get_dict(scenario, R, S),
    get_dict(id, S, Got).

:- end_tests(server_bom_calculation).

% ---------------------------------------------------------------------------------------------
% Internal helpers: .env lines and unexpected errors
% ---------------------------------------------------------------------------------------------

unset_test_vars :-
    forall(member(V, ['AI_SERVER_TEST_A', 'AI_SERVER_TEST_B', 'AI_SERVER_TEST_C', 'AI_SERVER_TEST_D']),
           setenv(V, '')).

:- begin_tests(server_helpers, [setup(unset_test_vars), cleanup(unset_test_vars)]).

test(env_line_sets_unset_variables) :-
    ai_server:env_line("AI_SERVER_TEST_A = \"value a\"  "),
    ai_server:env_line("export AI_SERVER_TEST_B='value b'"),
    getenv('AI_SERVER_TEST_A', A), A == 'value a',
    getenv('AI_SERVER_TEST_B', B), B == 'value b'.

test(env_line_keeps_variables_already_set) :-
    setenv('AI_SERVER_TEST_C', 'from environment'),
    ai_server:env_line("AI_SERVER_TEST_C=from file"),
    getenv('AI_SERVER_TEST_C', C), C == 'from environment'.

test(env_line_ignores_comments_and_lines_without_equals) :-
    once(ai_server:env_line("# AI_SERVER_TEST_D=x")),
    once(ai_server:env_line("NOT A LINE")),
    once(ai_server:env_line("")),
    ( getenv('AI_SERVER_TEST_D', D) -> D == '' ; true ).

test(unexpected_error_is_500_with_a_generic_message) :-
    ai_server:error_reply(error(type_error(dict, x), _), Status, Body),
    Status == 500,
    get_dict(error, Body, E),
    get_dict(code, E, "INTERNAL_ERROR"),
    get_dict(message, E, "Internal server error.").

test(unexpected_error_on_the_console_hides_the_token) :-
    manager_token(T),
    atom_concat('Bearer ', T, Auth),
    capture_user_error(ai_server:log_unexpected(500, error(foo(Auth), _), [authorization(Auth)]), Out),
    once(sub_string(Out, _, _, _, "Bearer ***")),
    \+ sub_string(Out, _, _, _, "secret-token").

% Runs Goal with user_error redirected to a string.
capture_user_error(Goal, Text) :-
    once(stream_property(Saved, alias(user_error))),
    new_memory_file(MF),
    setup_call_cleanup(
        open_memory_file(MF, write, S),
        setup_call_cleanup(set_stream(S, alias(user_error)),
                           once(Goal),
                           set_stream(Saved, alias(user_error))),
        close(S)),
    memory_file_to_string(MF, Text),
    free_memory_file(MF).

:- end_tests(server_helpers).
