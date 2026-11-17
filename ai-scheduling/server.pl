% HTTP server of the LaPrizza AI service (AI01). Listens only on 127.0.0.1.
%
%   GET  /health   {status: "ok", backend: <AI_BACKEND_URL>}; never calls the back end
%   POST /bom      {scenarioId, stockMode} with "Authorization: Bearer <token of a MANAGER>"
%   POST /requirements   same request; requirements planning of the forecast (AI02)
%   POST /service/bom, POST /service/requirements  (AI05) called by the back end only:
%        "X-Api-Key: <AI_SERVICE_KEY>" and body {request: {scenarioId, stockMode}, snapshot}
%
% Start:  swipl ai-scheduling/server.pl      (or ./ai-scheduling/start-server.sh)
% Configuration (environment, or ai-scheduling/.env for the variables not yet set):
%   AI_BACKEND_URL (default http://127.0.0.1:3000/api/v1), AI_PORT (default 5000),
%   AI_BACKEND_TIMEOUT_SECONDS (default 10).
%
% The token of the request is only forwarded to the back end (GET /ai-data/snapshot). It is
% never written to the console nor sent back in a response. http/http_log is not loaded.

:- module(ai_server, [ main/0, start_server/1, stop_server/1 ]).

:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(socket)).
:- use_module(library(lists)).
:- use_module(library(apply)).
:- use_module(kb).
:- use_module(bom).
:- use_module(requirements).

:- initialization(main, main).

:- prolog_load_context(directory, Dir), asserta(server_dir(Dir)).

default_port(5000).

% ---------------------------------------------------------------------------------------------
% Start-up
% ---------------------------------------------------------------------------------------------

main :-
    load_env_local,
    check_config(Port),
    start_server(Port),
    backend_base_url(Backend),
    format("LaPrizza AI service listening on http://127.0.0.1:~w (back end: ~w)~n",
           [Port, Backend]),
    warn_service_key,
    flush_output,
    thread_get_message(stop_server).              % runs until the process is stopped

%  AI05: without AI_SERVICE_KEY the /service/* routes always answer 401.
warn_service_key :-
    (   getenv('AI_SERVICE_KEY', Key), atom_length(Key, L), L >= 32
    ->  true
    ;   format(user_error,
               "Warning: AI_SERVICE_KEY is not set (or has fewer than 32 characters); the back end cannot call /service/bom nor /service/requirements.~n", [])
    ).

%! start_server(+Port) is det.
%  Starts the HTTP server on 127.0.0.1:Port only. Ends the process if the port is busy.
start_server(Port) :-
    % On Windows a second server can bind the same port (SO_REUSEADDR): check it first.
    (   port_in_use(Port)
    ->  fatal("Cannot listen on 127.0.0.1:~w: the port is already in use.", [Port])
    ;   true
    ),
    catch(http_server(http_dispatch, [port('127.0.0.1':Port)]),
          Error,
          ( print_message(error, Error),
            fatal("Cannot listen on 127.0.0.1:~w (is the port already in use?).", [Port]) )).

stop_server(Port) :-
    http_stop_server('127.0.0.1':Port, []).

port_in_use(Port) :-
    catch(tcp_connect('127.0.0.1':Port, Stream, []), _, fail),
    close(Stream).

fatal(Format, Args) :-
    format(user_error, Format, Args),
    nl(user_error),
    halt(1).

%! load_env_local is det.
%  Reads ai-scheduling/.env, if it exists. Lines "KEY=value"; empty lines and "#" comments
%  are ignored; quotes around the value are removed. A variable already set (and not empty) in
%  the environment wins, so "AI_BACKEND_URL=... swipl server.pl" overrides the file.
load_env_local :-
    server_dir(Dir),
    directory_file_path(Dir, '.env', File),
    (   exists_file(File)
    ->  read_file_to_string(File, Text, [encoding(utf8)]),
        split_string(Text, "\n", "\r", Lines),
        forall(member(Line, Lines), env_line(Line))
    ;   true
    ).

env_line(Line0) :-
    normalize_space(string(Line1), Line0),
    (   ( Line1 == "" ; sub_string(Line1, 0, 1, _, "#") )
    ->  true
    ;   ( string_concat("export ", Line, Line1) -> true ; Line = Line1 ),
        sub_string(Line, B, 1, _, "="), !,
        sub_string(Line, 0, B, _, Key0),
        B1 is B + 1,
        sub_string(Line, B1, _, 0, Value0),
        normalize_space(string(Key), Key0),
        normalize_space(string(Value1), Value0),
        unquote(Value1, Value),
        set_env_if_unset(Key, Value)
    ).
env_line(_).                                      % line without "=": ignored

unquote(Value0, Value) :-
    (   member(Q, ["\"", "'"]),
        string_concat(Q, Rest, Value0),
        string_concat(Value, Q, Rest)
    ->  true
    ;   Value = Value0
    ).

set_env_if_unset(Key, Value) :-
    (   Key == "" -> true
    ;   getenv(Key, Current), Current \== '' -> true
    ;   setenv(Key, Value)
    ).

%! check_config(-Port) is det.
%  AI_BACKEND_URL and AI_BACKEND_TIMEOUT_SECONDS (kb.pl) and AI_PORT. Ends the process with a
%  clear message when one of them is invalid.
check_config(Port) :-
    catch(check_backend_config,
          kb_error(invalid_config(Name, Value, Examples)),
          fatal("Invalid configuration: ~w = \"~w\". Examples: ~w", [Name, Value, Examples])),
    (   getenv('AI_PORT', Raw), Raw \== ''
    ->  (   atom_number(Raw, Port), integer(Port), between(1, 65535, Port)
        ->  true
        ;   fatal("Invalid configuration: AI_PORT = \"~w\". Expected an integer between 1 and 65535, e.g. 5000.", [Raw])
        )
    ;   default_port(Port)
    ).

% ---------------------------------------------------------------------------------------------
% Routes. Every route is handled here, so that 404 and 405 also use the JSON error format.
% ---------------------------------------------------------------------------------------------

:- http_handler('/health', route(health), []).
:- http_handler('/bom', route(bom), []).
:- http_handler('/requirements', route(requirements), []).
% AI05: called only by the back end, with the snapshot in the body (no call back to the back end)
:- http_handler('/service/bom', route(service_bom), []).
:- http_handler('/service/requirements', route(service_requirements), []).
:- http_handler(/, route(not_found), [prefix]).

route_method(health, get).
route_method(bom, post).
route_method(requirements, post).
route_method(service_bom, post).
route_method(service_requirements, post).

%  Runs the route, sends the JSON reply and writes one line to the console (no headers).
route(Route, Request) :-
    get_time(T0),
    nb_setval(ai_request_label, ""),
    memberchk(method(Method), Request),
    memberchk(path(Path), Request),
    (   catch(handle(Route, Method, Request, Status0, Body0), Error, true)
    ->  true
    ;   Error = error(handler_failed, _)
    ),
    (   var(Error)
    ->  Status = Status0, Body = Body0
    ;   error_reply(Error, Status, Body),
        log_unexpected(Status, Error, Request)
    ),
    catch(reply_json_dict(Body, [status(Status)]), _, true),
    log_request(Method, Path, Status, T0).

handle(not_found, _, _, 404, Body) :- !,
    error_body(404, "NOT_FOUND", "Resource not found.", Body).
handle(Route, Method, Request, Status, Body) :-
    (   route_method(Route, Method)
    ->  handle_route(Route, Request, Status, Body)
    ;   Status = 405,
        error_body(405, "METHOD_NOT_ALLOWED", "Method not allowed.", Body)
    ).

handle_route(health, _, 200, _{status: "ok", backend: Backend}) :-
    backend_base_url(Url),
    atom_string(Url, Backend).
handle_route(bom, Request, Status, Body) :-
    authenticated(bom_calculate, Request, Status, Body).
handle_route(requirements, Request, Status, Body) :-
    authenticated(requirements_calculate, Request, Status, Body).
handle_route(service_bom, Request, Status, Body) :-
    service_authenticated(bom_calculate, Request, Status, Body).
handle_route(service_requirements, Request, Status, Body) :-
    service_authenticated(requirements_calculate, Request, Status, Body).

%  Calc is called as call(Calc, Params, Result) inside with_snapshot/2.
authenticated(Calc, Request, Status, Body) :-
    (   bearer_token(Request, Token)
    ->  plan_request(Calc, Request, Token, Status, Body)
    ;   Status = 401,
        error_body(401, "TOKEN_MISSING", "Authentication required.", Body)
    ).

% ---------------------------------------------------------------------------------------------
% POST /bom and POST /requirements
% ---------------------------------------------------------------------------------------------

plan_request(Calc, Request, Token, Status, Body) :-
    read_body(Request, Input),
    validate_input(Input, Details, Params),
    (   Details \== []
    ->  Status = 400,
        error_body(400, "VALIDATION_ERROR", "Validation failed.", Details, Body)
    ;   get_dict(scenarioId, Params, Id),
        get_dict(stockMode, Params, Mode),
        format(string(Label), "~w ~w", [Id, Mode]),
        nb_setval(ai_request_label, Label),
        fetch_with_deadline(Params, Token, Snapshot),
        calculate(Calc, Snapshot, Params, Status, Body)
    ).

% ---------------------------------------------------------------------------------------------
% POST /service/bom and POST /service/requirements (AI05)
%   Header: X-Api-Key: <AI_SERVICE_KEY>   (service identity of the back end)
%   Body:   {request: {scenarioId, stockMode}, snapshot: <GET /ai-data/snapshot of the back end>}
% The user (JWT + role) is authorized by the back end; this service never sees the user token.
% ---------------------------------------------------------------------------------------------

service_authenticated(Calc, Request, Status, Body) :-
    (   service_key_ok(Request)
    ->  service_plan_request(Calc, Request, Status, Body)
    ;   Status = 401,
        error_body(401, "SERVICE_UNAUTHORIZED", "Service authentication required.", Body)
    ).

%! service_key_ok(+Request) is semidet.
%  Fails when AI_SERVICE_KEY is not configured, so the service routes are closed by default.
service_key_ok(Request) :-
    getenv('AI_SERVICE_KEY', Expected0), Expected0 \== '',
    memberchk(x_api_key(Key0), Request),
    text_to_string(Expected0, Expected),
    text_to_string(Key0, Key),
    Key == Expected.

service_plan_request(Calc, Request, Status, Body) :-
    read_body(Request, Input),
    service_input(Input, ReqInput, Snapshot, SnapshotDetails),
    validate_input(ReqInput, ReqDetails, Params),
    (   Input == invalid_body
    ->  Details = ReqDetails                      % the body itself is not a JSON object
    ;   maplist(prefix_detail, ReqDetails, ReqDetails1),
        append(ReqDetails1, SnapshotDetails, Details)
    ),
    (   Details \== []
    ->  Status = 400,
        error_body(400, "VALIDATION_ERROR", "Validation failed.", Details, Body)
    ;   get_dict(scenarioId, Params, Id),
        get_dict(stockMode, Params, Mode),
        format(string(Label), "~w ~w", [Id, Mode]),
        nb_setval(ai_request_label, Label),
        calculate(Calc, Snapshot, Params, Status, Body)
    ).

%  Splits the body; a missing or non-object part is reported in the joiDetails format.
service_input(invalid_body, invalid_body, none, []) :- !.
service_input(Input, ReqInput, Snapshot, Details) :-
    (   get_dict(request, Input, R), is_dict(R) -> ReqInput = R ; ReqInput = invalid_body ),
    (   get_dict(snapshot, Input, S), is_dict(S)
    ->  Snapshot = S, Details = []
    ;   Snapshot = none,
        (   get_dict(snapshot, Input, _)
        ->  detail("snapshot", "object.base", "\"snapshot\" must be of type object", D)
        ;   detail("snapshot", "any.required", "\"snapshot\" is required", D)
        ),
        Details = [D]
    ).

%  "scenarioId" -> "request.scenarioId"; "" (request is not an object) -> "request".
prefix_detail(D0, D) :-
    get_dict(field, D0, F0),
    (   F0 == "" -> F = "request" ; string_concat("request.", F0, F) ),
    put_dict(field, D0, F, D).

%  The timeout of http_open only covers reading: connecting to an address that does not answer
%  takes ~20 s on Windows and cannot be interrupted. So the request runs in its own thread and
%  the answer is awaited for AI_BACKEND_TIMEOUT_SECONDS (+0.5 s, so that the timeout of kb.pl
%  is the one used when the back end answers too slowly). A late answer is discarded.
fetch_with_deadline(Params, Token, Snapshot) :-
    backend_timeout(Seconds),
    Limit is Seconds + 0.5,
    message_queue_create(Queue),
    call_cleanup(( thread_create(fetch_worker(Queue, Params, Token), _, [detached(true)]),
                   (   thread_get_message(Queue, Reply, [timeout(Limit)])
                   ->  true
                   ;   Reply = error(kb_error(backend_timeout))
                   ) ),
                 message_queue_destroy(Queue)),
    (   Reply = ok(Snapshot) -> true
    ;   Reply = error(Error), throw(Error)
    ).

fetch_worker(Queue, Params, Token) :-
    (   catch(fetch_snapshot(Params, Token, Snapshot), Error, true)
    ->  ( var(Error) -> Reply = ok(Snapshot) ; Reply = error(Error) )
    ;   Reply = error(error(fetch_failed, _))
    ),
    catch(thread_send_message(Queue, Reply), _, true).   % the queue is gone after a timeout

%  200 with the result; 422 when kb.pl rejects the snapshot or the calculation finds invalid data.
calculate(Calc, Snapshot, Params, Status, Body) :-
    catch(( with_snapshot(Snapshot, call(Calc, Params, Result0))
          ->  Result = Result0
          ;   throw(error(bom_calculation_failed, _))
          ),
          kb_error(invalid_data(Problems)),
          snapshot_rejected(Snapshot, Problems, Result)),
    (   get_dict(status, Result, "ok")
    ->  Status = 200, Body = Result
    ;   Status = 422,
        get_dict(scenario, Result, Scenario),
        get_dict(inputs, Result, Inputs),
        get_dict(problems, Result, ResultProblems),
        error_body(422, "AI_INVALID_DATA", "The data needed for the calculation is invalid or incomplete.",
                   _{scenario: Scenario, inputs: Inputs, problems: ResultProblems}, Body)
    ).

%  kb.pl rejected the snapshot: scenario and inputs are taken from the snapshot itself.
snapshot_rejected(Snapshot, Problems,
                  _{status: "invalid_data", scenario: Scenario, inputs: Inputs, problems: Problems}) :-
    snapshot_scenario(Snapshot, Scenario),
    snapshot_inputs(Snapshot, Inputs).

snapshot_scenario(Snapshot, Scenario) :-
    (   get_dict(scenario, Snapshot, S), is_dict(S)
    ->  findall(K-V, ( member(K, [id, name, version, stockMode]),
                       ( get_dict(K, S, V0) -> V = V0 ; V = null ) ), Pairs),
        dict_pairs(Scenario, _, Pairs)
    ;   Scenario = null
    ).

snapshot_inputs(Snapshot, _{ snapshotId: Id, sources: Sources }) :-
    (   get_dict(meta, Snapshot, Meta), is_dict(Meta)
    ->  ( get_dict(snapshotId, Meta, Id) -> true ; Id = null ),
        ( get_dict(sources, Meta, Sources), is_dict(Sources) -> true ; Sources = _{} )
    ;   Id = null, Sources = _{}
    ).

%  The body must be a JSON object; anything else is reported as a validation error.
read_body(Request, Input) :-
    (   catch(http_read_json_dict(Request, Input0), _, fail),
        is_dict(Input0)
    ->  Input = Input0
    ;   Input = invalid_body
    ).

%! validate_input(+Input, -Details, -Params) is det.
%  Details in the format of the back end (joiDetails): [{field, type, message}].
%  Extra fields are ignored. The values sent are never repeated in the messages.
validate_input(invalid_body, [Detail], _{}) :- !,
    detail("", "object.base", "\"value\" must be of type object", Detail).
validate_input(Input, Details, _{scenarioId: Id, stockMode: Mode}) :-
    field_problems(Input, scenarioId, Id, IdDetails),
    field_problems(Input, stockMode, Mode, ModeDetails),
    append(IdDetails, ModeDetails, Details).

field_problems(Input, Field, Value, Details) :-
    (   \+ get_dict(Field, Input, _)
    ->  field_detail(Field, "any.required", "is required", Details)
    ;   get_dict(Field, Input, Value0), \+ string(Value0)
    ->  field_detail(Field, "string.base", "must be a string", Details)
    ;   get_dict(Field, Input, Value0),
        \+ valid_value(Field, Value0)
    ->  invalid_value(Field, Type, Message),
        field_detail(Field, Type, Message, Details)
    ;   get_dict(Field, Input, Value),
        Details = []
    ).

valid_value(scenarioId, Value) :-
    string_length(Value, Length),
    between(1, 64, Length),
    string_codes(Value, Codes),
    forall(member(C, Codes), scenario_id_code(C)).
valid_value(stockMode, Value) :-
    memberchk(Value, ["live", "scenario"]).

invalid_value(scenarioId, "string.pattern.base",
              "fails to match the required pattern: /^[A-Z0-9-]{1,64}$/").
invalid_value(stockMode, "any.only", "must be one of [live, scenario]").

scenario_id_code(C) :- between(0'A, 0'Z, C), !.
scenario_id_code(C) :- between(0'0, 0'9, C), !.
scenario_id_code(0'-).

field_detail(Field, Type, Text, [Detail]) :-
    format(string(Message), "\"~w\" ~w", [Field, Text]),
    atom_string(Field, Name),
    detail(Name, Type, Message, Detail).

detail(Field, Type, Message, _{field: Field, type: Type, message: Message}).

%! bearer_token(+Request, -Token) is semidet.
%  "Authorization: Bearer <token>" (the scheme in any case); the token cannot be empty.
bearer_token(Request, Token) :-
    memberchk(authorization(Value), Request),
    text_to_string(Value, Text0),
    normalize_space(string(Text), Text0),
    sub_string(Text, 0, 7, _, Scheme),
    string_lower(Scheme, "bearer "),
    sub_string(Text, 7, _, 0, Token),
    Token \== "",
    \+ sub_string(Token, _, _, _, " ").

% ---------------------------------------------------------------------------------------------
% Errors: { error: { status, code, message, details? } }, as in the back end
% ---------------------------------------------------------------------------------------------

error_body(Status, Code, Message, _{error: _{status: Status, code: Code, message: Message}}).
error_body(Status, Code, Message, Details,
           _{error: _{status: Status, code: Code, message: Message, details: Details}}).

%! error_reply(+Error, -Status, -Body) is det.
error_reply(kb_error(Error), Status, Body) :-
    kb_error_reply(Error, Status, Body), !.
error_reply(_, 500, Body) :-
    error_body(500, "INTERNAL_ERROR", "Internal server error.", Body).

kb_error_reply(backend_denied(Status, Body0), Status, Body) :-
    (   is_dict(Body0), get_dict(error, Body0, _)
    ->  Body = Body0                                % the back end answer, as it is
    ;   denied_code(Status, Code, Message),
        error_body(Status, Code, Message, Body)
    ).
kb_error_reply(scenario_not_found(Id), 404, Body) :-
    error_body(404, "AI_SCENARIO_NOT_FOUND", "AI scenario not found.", _{scenarioId: Id}, Body).
kb_error_reply(backend_rejected(Code, Body0), 422, Body) :-
    (   is_dict(Body0), get_dict(error, Body0, E), is_dict(E), get_dict(message, E, Message)
    ->  true
    ;   Message = "The back end rejected the request."
    ),
    error_body(422, "AI_INVALID_DATA", "The data needed for the calculation is invalid or incomplete.",
               _{problems: [_{code: Code, message: Message}]}, Body).
kb_error_reply(backend_unavailable(Reason), 503, Body) :-
    unavailable_details(Reason, Details),
    error_body(503, "AI_DATA_UNAVAILABLE", "The back end is not available.", Details, Body).
kb_error_reply(backend_timeout, 504, Body) :-
    error_body(504, "AI_DATA_TIMEOUT", "The back end did not answer in time.", Body).
kb_error_reply(invalid_data(Problems), 422, Body) :-
    error_body(422, "AI_INVALID_DATA", "The data needed for the calculation is invalid or incomplete.",
               _{scenario: null, inputs: null, problems: Problems}, Body).

denied_code(401, "UNAUTHORIZED", "Authentication required.").
denied_code(403, "FORBIDDEN", "Forbidden.").

unavailable_details(connection_failed, _{reason: "connection_failed"}).
unavailable_details(invalid_json, _{reason: "invalid_backend_response"}).
unavailable_details(status(Code), _{reason: "backend_error", backendStatus: Code}).
unavailable_details(unexpected_backend_response(Code),
                    _{reason: "unexpected_backend_response", backendStatus: Code}).

% ---------------------------------------------------------------------------------------------
% Console: one line per request; unexpected errors with the token hidden. Never the headers.
% ---------------------------------------------------------------------------------------------

log_request(Method, Path, Status, T0) :-
    get_time(T1),
    Ms is round((T1 - T0) * 1000),
    format_time(string(At), '%FT%T', T0),
    string_upper(Method, M),
    nb_getval(ai_request_label, Label),
    (   Label == "" -> Extra = "" ; string_concat(" ", Label, Extra) ),
    % user_output: inside a handler, current_output is the HTTP response
    format(user_output, "~w ~w ~w~w -> ~w (~d ms)~n", [At, M, Path, Extra, Status, Ms]),
    flush_output(user_output).

log_unexpected(500, Error, Request) :- !,
    format(string(Text0), "~q", [Error]),
    (   bearer_token(Request, Token), Token \== ""
    ->  hide(Text0, Token, Text)
    ;   Text = Text0
    ),
    sub_text(Text, 500, Shown),
    format(user_error, "Unexpected error: ~w~n", [Shown]),
    flush_output(user_error).
log_unexpected(_, _, _).

hide(Text0, Secret, Text) :-
    atomic_list_concat(Parts, Secret, Text0),
    atomic_list_concat(Parts, '***', Text).

sub_text(Text, Max, Shown) :-
    (   string_length(Text, L), L > Max
    ->  sub_string(Text, 0, Max, _, S), string_concat(S, "...", Shown)
    ;   Shown = Text
    ).
