% Knowledge base of the LaPrizza AI service.
% Loads a planning snapshot (from the back end or from a file), validates it and stores it as facts.
%
% Main entry points (see the export list):
%   fetch_snapshot/3   GET /ai-data/snapshot with the token of the request (AI01)
%   validate_snapshot/2 every problem of a snapshot, without touching the facts
%   with_snapshot/2    loads a snapshot, runs a goal and clears the facts (one request at a time)
%   refresh_kb/0       legacy loader (AI06): AI_BACKEND_URL + AI_SERVICE_TOKEN, unchanged

:- module(kb, [ refresh_kb/0, load_kb_from_file/1, load_kb_from_dict/1, kb_summary/0,
                validate_snapshot/2, with_snapshot/2, clear_kb/0,
                fetch_snapshot/3, backend_base_url/1, normalize_backend_url/2,
                backend_timeout/1, check_backend_config/0,
                kb_meta/3, kb_scenario/5, kb_source/2,
                product/4, size/2, pizza/1, pizza_size/2, bom_item/4, aggregate/2,
                aggregate_item/3, stock/2, order/2, ordered_item/4, kb_issue/2,
                forecast/5, forecast_item/5, supplier_scenario/3, supplier/2,
                supplier_offer/5, supplier_limit/3, kb_is_simulation/0 ]).

:- use_module(library(http/http_open)).
:- use_module(library(http/json)).
:- use_module(library(uri)).
:- use_module(library(apply)).
:- use_module(library(lists)).
:- use_module(library(pairs)).
:- use_module(library(ordsets)).
:- use_module(library(aggregate)).

:- meta_predicate with_snapshot(+, 0).

:- dynamic kb_meta/3, kb_scenario/5, kb_source/2,
           product/4, size/2, pizza/1, pizza_size/2, bom_item/4, aggregate/2,
           aggregate_item/3, stock/2, order/2, ordered_item/4, kb_issue/2,
           forecast/5, forecast_item/5, supplier_scenario/3, supplier/2,
           supplier_offer/5, supplier_limit/3.

kb_predicates([ kb_meta/3, kb_scenario/5, kb_source/2,
                product/4, size/2, pizza/1, pizza_size/2, bom_item/4, aggregate/2,
                aggregate_item/3, stock/2, order/2, ordered_item/4, kb_issue/2,
                forecast/5, forecast_item/5, supplier_scenario/3, supplier/2,
                supplier_offer/5, supplier_limit/3 ]).

% ---------------------------------------------------------------------------------------------
% Loading, clearing and summarizing the knowledge base
% ---------------------------------------------------------------------------------------------

%! load_kb_from_file(+File) is det.
%  Loads a snapshot stored in a JSON file (fixtures, sample data).
load_kb_from_file(File) :-
    setup_call_cleanup(open(File, read, In, [encoding(utf8)]),
                       json_read_dict(In, Dict),
                       close(In)),
    load_kb_from_dict(Dict).

%! load_kb_from_dict(+Dict) is det.
%  Validates the snapshot and replaces the facts. If there is any problem it throws
%  kb_error(invalid_data(Problems)) with all of them, and the previous facts are kept.
load_kb_from_dict(Dict) :-
    with_mutex(kb, load_unlocked(Dict)).

load_unlocked(Dict) :-
    snapshot_entries(Dict, Entries, Problems),
    (   Problems == []
    ->  true
    ;   throw(kb_error(invalid_data(Problems)))
    ),
    findall(F, member(e(_, F), Entries), Facts),
    transaction(( clear_unlocked, maplist(assertz, Facts) )).

%! validate_snapshot(+Dict, -Problems) is det.
%  All the problems of a snapshot (empty list when it is valid). Does not change the facts.
validate_snapshot(Dict, Problems) :-
    snapshot_entries(Dict, _, Problems).

%! with_snapshot(+Dict, :Goal) is semidet.
%  Loads Dict, calls Goal once and clears the facts, even if Goal fails or throws.
%  Requests are serialized, so two calculations never see each other's data.
with_snapshot(Dict, Goal) :-
    with_mutex(kb, setup_call_cleanup(true,
                                      ( load_unlocked(Dict), once(Goal) ),
                                      clear_unlocked)).

%! clear_kb is det.
%  Removes every fact of the knowledge base.
clear_kb :-
    with_mutex(kb, clear_unlocked).

clear_unlocked :-
    kb_predicates(Preds),
    forall(member(Name/Arity, Preds),
           ( functor(Head, Name, Arity), retractall(Head) )).

kb_is_simulation :- kb_meta(_, _, true), !.
kb_is_simulation :- kb_scenario(_, _, _, true, _), !.
kb_is_simulation :- supplier_scenario(_, _, true), !.
kb_is_simulation :- order(_, true), !.

kb_summary :-
    (   kb_meta(Id, At, Sim) -> format("snapshot ~w (~w) simulated=~w~n", [Id, At, Sim])
    ;   format("knowledge base is empty~n")
    ),
    (   kb_scenario(SId, _, SVer, _, Mode)
    ->  format("  scenario ~w v~w (stockMode=~w)~n", [SId, SVer, Mode])
    ;   true
    ),
    kb_predicates(Preds),
    forall(member(Name/Arity, Preds),
           ( functor(G, Name, Arity),
             aggregate_all(count, G, N),
             format("  ~w/~w: ~d~n", [Name, Arity, N]) )),
    (   kb_is_simulation -> format("  simulation: yes~n") ; format("  simulation: no~n") ).

% ---------------------------------------------------------------------------------------------
% Back end configuration (AI01)
% ---------------------------------------------------------------------------------------------

default_backend_url('http://127.0.0.1:3000/api/v1').
default_backend_timeout(10).
backend_url_examples("http://127.0.0.1:3000, http://10.9.22.22/api/v1").

%! backend_base_url(-Url) is det.
%  AI_BACKEND_URL normalized to ".../api/v1" (default: the local back end).
backend_base_url(Url) :-
    (   getenv('AI_BACKEND_URL', Raw), Raw \== ''
    ->  true
    ;   default_backend_url(Raw)
    ),
    normalize_backend_url(Raw, Url).

%! normalize_backend_url(+Raw, -Url) is det.
%  Accepts http(s)://host[:port] or http(s)://host[:port]/api/v1, with or without a final "/".
%  Throws kb_error(invalid_config('AI_BACKEND_URL', Raw, Examples)) for anything else.
normalize_backend_url(Raw0, Url) :-
    text_to_string(Raw0, Raw1),
    normalize_space(string(Raw), Raw1),
    (   valid_backend_url(Raw, Scheme, Authority)
    ->  format(atom(Url), '~w://~w/api/v1', [Scheme, Authority])
    ;   backend_url_examples(Examples),
        redact_credentials(Raw, Shown),
        throw(kb_error(invalid_config('AI_BACKEND_URL', Shown, Examples)))
    ).

% Hides "user:password@" so that it never appears in error messages.
redact_credentials(Raw, Shown) :-
    (   sub_string(Raw, B, _, _, "://"),
        sub_string(Raw, At, 1, _, "@"), At > B
    ->  B3 is B + 3,
        sub_string(Raw, 0, B3, _, Head),
        sub_string(Raw, At, _, 0, Tail),
        string_concat(Head, "***", H1),
        string_concat(H1, Tail, Shown)
    ;   Shown = Raw
    ).

valid_backend_url(Raw, Scheme, Authority) :-
    uri_components(Raw, uri_components(Scheme, Authority, Path, Query, Fragment)),
    atom(Scheme), memberchk(Scheme, [http, https]),
    atom(Authority), Authority \== '',
    uri_authority_components(Authority, uri_authority(User, _, Host, Port)),
    var(User),                                   % no credentials in the URL
    atom(Host), Host \== '',
    (   var(Port) -> true
    ;   integer(Port) -> true
    ;   atom(Port), atom_number(Port, _)
    ),
    var(Query), var(Fragment),
    ( var(Path) -> true ; memberchk(Path, ['', '/', '/api/v1', '/api/v1/']) ).

%! backend_timeout(-Seconds) is det.
%  AI_BACKEND_TIMEOUT_SECONDS (default 10). Must be a number greater than 0.
backend_timeout(Seconds) :-
    (   getenv('AI_BACKEND_TIMEOUT_SECONDS', Raw), Raw \== ''
    ->  (   atom_number(Raw, Seconds), Seconds > 0
        ->  true
        ;   throw(kb_error(invalid_config('AI_BACKEND_TIMEOUT_SECONDS', Raw, "10")))
        )
    ;   default_backend_timeout(Seconds)
    ).

%! check_backend_config is det.
%  Validates the configuration at start-up (used by the server). Throws kb_error(invalid_config(...)).
check_backend_config :-
    backend_base_url(_),
    backend_timeout(_).

% ---------------------------------------------------------------------------------------------
% Fetching the snapshot with the token of the request (AI01)
% ---------------------------------------------------------------------------------------------

%! fetch_snapshot(+Params, +Token, -Dict) is det.
%  GET {AI_BACKEND_URL}/ai-data/snapshot?scenarioId=..&stockMode=.. with "Authorization: Bearer Token".
%  Params is a dict; scenarioId and stockMode are optional. Only reads from the back end.
%  The token is never part of the thrown terms. Errors:
%    kb_error(backend_unavailable(Reason))  connection_failed | status(Code) | invalid_json |
%                                           unexpected_backend_response(Code)
%    kb_error(backend_timeout)
%    kb_error(backend_denied(Status, Body)) 401/403, Body is the JSON body of the back end
%    kb_error(scenario_not_found(ScenarioId))
%    kb_error(backend_rejected(Code, Body)) 400, Code is error.code of the back end
fetch_snapshot(Params, Token, Dict) :-
    (   is_dict(Params) -> true ; throw(kb_error(invalid_params(Params))) ),
    (   text_value(Token), Token \== '', Token \== ""
    ->  true
    ;   throw(kb_error(missing_token))
    ),
    backend_base_url(Base),
    backend_timeout(Timeout),
    snapshot_url(Base, Params, Url),
    atomics_to_string(['Bearer ', Token], Authorization),
    Options = [ method(get), status_code(Status), timeout(Timeout),
                request_header('Authorization' = Authorization),
                request_header('Accept' = 'application/json') ],
    catch(setup_call_cleanup(http_open(Url, In, Options),
                             read_snapshot_response(Status, Params, In, Dict),
                             close(In)),
          Error,
          http_failure(Error)).

snapshot_url(Base, Params, Url) :-
    findall(Part,
            ( member(Key, [scenarioId, stockMode]),
              get_dict(Key, Params, Value), Value \== null,
              uri_encoded(query_value, Value, Encoded),
              format(atom(Part), '~w=~w', [Key, Encoded]) ),
            Parts),
    (   Parts == []
    ->  format(atom(Url), '~w/ai-data/snapshot', [Base])
    ;   atomic_list_concat(Parts, '&', Query),
        format(atom(Url), '~w/ai-data/snapshot?~w', [Base, Query])
    ).

read_snapshot_response(200, _, In, Dict) :- !,
    (   catch(json_read_dict(In, Dict), _, fail)
    ->  true
    ;   throw(kb_error(backend_unavailable(invalid_json)))
    ).
read_snapshot_response(Status, Params, In, _) :-
    (   catch(json_read_dict(In, Body), _, fail) -> true ; Body = null ),
    backend_error(Status, Params, Body, Error),
    throw(kb_error(Error)).

backend_error(Status, _, Body, backend_denied(Status, Body)) :-
    memberchk(Status, [401, 403]), !.
backend_error(404, Params, Body, Error) :- !,
    (   error_code(Body, "AI_SCENARIO_NOT_FOUND")
    ->  ( get_dict(scenarioId, Params, Id) -> true ; Id = null ),
        Error = scenario_not_found(Id)
    ;   Error = backend_unavailable(unexpected_backend_response(404))
    ).
backend_error(400, _, Body, backend_rejected(Code, Body)) :- !,
    ( error_code(Body, Code) -> true ; Code = "BAD_REQUEST" ).
backend_error(Status, _, _, backend_unavailable(status(Status))) :-
    Status >= 500, !.
backend_error(Status, _, _, backend_unavailable(unexpected_backend_response(Status))).

error_code(Body, Code) :-
    is_dict(Body), get_dict(error, Body, Error), is_dict(Error),
    get_dict(code, Error, Code0), text_value(Code0),
    text_to_string(Code0, Code).

% Builds a new error term: the original exception may include the stream or the URL.
http_failure(kb_error(Error)) :- !, throw(kb_error(Error)).
http_failure(Error) :- is_timeout(Error), !, throw(kb_error(backend_timeout)).
http_failure(_) :- throw(kb_error(backend_unavailable(connection_failed))).

is_timeout(error(timeout_error(_, _), _)) :- !.
is_timeout(error(socket_error(Code, _), _)) :-
    memberchk(Code, [etimedout, wsaetimedout, timeout]).

% ---------------------------------------------------------------------------------------------
% Legacy loader (AI06): kept as it was, used by test/kb.plt
% ---------------------------------------------------------------------------------------------

refresh_kb :-
    legacy_snapshot_url(Url),
    legacy_fetch_snapshot(Url, Dict),
    load_kb_from_dict(Dict).

legacy_snapshot_url(Url) :-
    (   getenv('AI_BACKEND_URL', Base), Base \== ''
    ->  atomic_list_concat([Base, '/ai-data/snapshot'], Url)
    ;   throw(kb_error(config_missing('AI_BACKEND_URL')))
    ).

legacy_auth_options([request_header('Authorization'=Value)]) :-
    (   getenv('AI_SERVICE_TOKEN', Token), Token \== ''
    ->  atom_concat('Bearer ', Token, Value)
    ;   throw(kb_error(config_missing('AI_SERVICE_TOKEN')))
    ).

legacy_fetch_snapshot(Url, Dict) :-
    legacy_auth_options(Auth),
    catch(setup_call_cleanup(http_open(Url, In, [status_code(Code), timeout(10)|Auth]),
                             legacy_read_body(Code, In, Dict),
                             close(In)),
          E, legacy_rethrow(E)).

legacy_read_body(200, In, Dict) :- !,
    catch(json_read_dict(In, Dict), _, throw(kb_error(invalid_snapshot(not_json)))).
legacy_read_body(Code, _, _) :- throw(kb_error(http_status(Code))).

legacy_rethrow(kb_error(E)) :- !, throw(kb_error(E)).
legacy_rethrow(_) :- throw(kb_error(service_unavailable)).


% ----------------------------------------------------------------------------------------
% Snapshot parsing (tolerant): every entry becomes e(Path, Fact) or a problem p(Problem).
% Malformed entries are skipped and reported; the rest of the snapshot is still checked.
% ----------------------------------------------------------------------------------------

snapshot_entries(Snapshot, Entries, Problems) :-
    (   is_dict(Snapshot)
    ->  phrase(snapshot_items(Snapshot), Items),
        findall(e(Path, Fact), member(e(Path, Fact), Items), Entries),
        findall(P, member(p(P), Items), ParseProblems),
        findall(P, check_problem(Entries, P), CheckProblems),
        append(ParseProblems, CheckProblems, Problems)
    ;   Entries = [],
        problem("INVALID_SNAPSHOT", [path-"$", reason-"not_an_object"], P),
        Problems = [P]
    ).

snapshot_items(S) --> 
    meta_items(S),
    list_section(S, products, product_entry),
    list_section(S, sizes, size_entry),
    list_section(S, bom, bom_entry),
    list_section(S, aggregates, aggregate_entry),
    list_section(S, stock, stock_entry),
    scenario_items(S),
    optional_list_section(S, issues, issue_entry),
    legacy_items(S, forecast, forecast_facts),
    legacy_items(S, supplierScenario, scenario_facts).

% --- generic helpers ---

list_section(S, Key, Entry) -->
    (   { get_dict(Key, S, List), List \== null }
    ->  (   { is_list(List) }
        ->  entries(List, Key, Entry, 0)
        ;   invalid(Key, "not_a_list")
        )
    ;   invalid(Key, "missing")
    ).

optional_list_section(S, Key, Entry) -->
    (   { get_dict(Key, S, List), List \== null }
    ->  list_section(S, Key, Entry)
    ;   []
    ).

entries([], _, _, _) --> [].
entries([X|Xs], Prefix, Entry, I) -->
    { format(string(Path), "~w[~d]", [Prefix, I]), I1 is I + 1 },
    call(Entry, X, Path),
    entries(Xs, Prefix, Entry, I1).

%  Runs Body (a non-terminal) only when Obj is an object with every key in Keys.
with_fields(Obj, Keys, Path, Body) -->
    { fields_problems(Obj, Keys, Path, Problems) },
    (   { Problems == [] }
    ->  call(Body)
    ;   problems(Problems)
    ).

fields_problems(Obj, _, Path, [P]) :-
    \+ is_dict(Obj), !,
    problem("INVALID_SNAPSHOT", [path-Path, reason-"not_an_object"], P).
fields_problems(Obj, Keys, Path, Problems) :-
    findall(P, field_problem(Obj, Keys, Path, P), Problems).

field_problem(Obj, Keys, Path, P) :-
    member(Key, Keys),
    (   \+ ( get_dict(Key, Obj, V), V \== null )
    ->  problem("INVALID_SNAPSHOT", [path-Path, reason-"missing_field", field-Key], P)
    ;   text_key(Key), get_dict(Key, Obj, V), \+ text_value(V)
    ->  problem("INVALID_SNAPSHOT", [path-Path, reason-"invalid_type", field-Key], P)
    ).

text_key(Key) :-
    memberchk(Key, [id, name, code, pizzaId, sizeId, componentId, productId,
                    classification, stockMode, snapshotId, retrievedAt]).

text_value(V) :- atomic(V), V \== null, \+ is_bool(V).

problems([]) --> [].
problems([P|Ps]) --> [p(P)], problems(Ps).

invalid(Path, Reason) -->
    { problem("INVALID_SNAPSHOT", [path-Path, reason-Reason], P) },
    [p(P)].

bad_quantity(Path, Quantity) -->
    { problem("INVALID_QUANTITY", [path-Path, quantity-Quantity], P) },
    [p(P)].

sub_path(Path, Key, SubPath) :- format(string(SubPath), "~w.~w", [Path, Key]).

% --- meta ---

meta_items(S) -->
    (   { get_dict(meta, S, M), M \== null }
    ->  with_fields(M, [snapshotId, retrievedAt, simulated], "meta", meta_fact(M))
    ;   invalid("meta", "missing")
    ).

meta_fact(M) -->
    { get_dict(snapshotId, M, Sid0), get_dict(retrievedAt, M, At0), get_dict(simulated, M, Sim),
      to_atom(Sid0, Sid), to_atom(At0, At) },
    (   { is_bool(Sim) }
    ->  [e("meta", kb_meta(Sid, At, Sim))]
    ;   invalid("meta.simulated", "not_a_boolean")
    ),
    sources_items(M).

sources_items(M) -->
    (   { get_dict(sources, M, Sources), Sources \== null }
    ->  (   { is_dict(Sources) }
        ->  source_kinds(Sources, [catalogue, stock, orders])
        ;   invalid("meta.sources", "not_an_object")
        )
    ;   []
    ).

source_kinds(_, []) --> [].
source_kinds(Sources, [Kind|Kinds]) -->
    { format(string(Path), "meta.sources.~w", [Kind]) },
    (   { get_dict(Kind, Sources, Info), Info \== null }
    ->  (   { is_dict(Info) }
        ->  [e(Path, kb_source(Kind, Info))]
        ;   invalid(Path, "not_an_object")
        )
    ;   []
    ),
    source_kinds(Sources, Kinds).

% --- catalogue ---

product_entry(P, Path) -->
    with_fields(P, [id, name, sellable, stockControlled], Path, product_fact(P, Path)).

product_fact(P, Path) -->
    { get_dict(id, P, I), get_dict(name, P, N), get_dict(sellable, P, Sell),
      get_dict(stockControlled, P, SC), to_atom(I, Id), to_atom(N, Name) },
    (   { is_bool(Sell), is_bool(SC) }
    ->  [e(Path, product(Id, Name, Sell, SC))]
    ;   invalid(Path, "not_a_boolean")
    ).

size_entry(Z, Path) -->
    with_fields(Z, [id, name], Path, size_fact(Z, Path)).

size_fact(Z, Path) -->
    { get_dict(id, Z, I), get_dict(name, Z, N), to_atom(I, Id), to_atom(N, Name) },
    [e(Path, size(Id, Name))].

bom_entry(B, Path) -->
    with_fields(B, [pizzaId, sizeId, componentId, quantity], Path, bom_fact(B, Path)).

bom_fact(B, Path) -->
    { get_dict(pizzaId, B, P0), get_dict(sizeId, B, S0), get_dict(componentId, B, C0),
      get_dict(quantity, B, Q), to_atom(P0, P), to_atom(S0, S), to_atom(C0, C) },
    (   { positive_int(Q) }
    ->  [e(Path, bom_item(P, S, C, Q))]
    ;   bad_quantity(Path, Q)
    ).

aggregate_entry(A, Path) -->
    with_fields(A, [id, classification, items], Path, aggregate_fact(A, Path)).

aggregate_fact(A, Path) -->
    { get_dict(id, A, I), get_dict(classification, A, C0), get_dict(items, A, Items),
      to_atom(I, Id), to_atom(C0, Class), sub_path(Path, items, ItemsPath) },
    (   { \+ memberchk(Class, [production, purchase]) }
    ->  { problem("INVALID_SNAPSHOT",
                  [path-Path, reason-"invalid_classification", classification-C0], P) },
        [p(P)]
    ;   { \+ is_list(Items) }
    ->  invalid(ItemsPath, "not_a_list")
    ;   [e(Path, aggregate(Id, Class))],
        composition_check(Class, Id, Items, Path),
        entries(Items, ItemsPath, aggregate_item_entry(Id), 0)
    ).

composition_check(production, Id, [], Path) --> !,
    { problem("INCOMPLETE_AGGREGATE", [path-Path, aggregateId-Id], P) },
    [p(P)].
composition_check(purchase, Id, [_|_], Path) --> !,
    { problem("PURCHASED_WITH_COMPOSITION", [path-Path, aggregateId-Id], P) },
    [p(P)].
composition_check(_, _, _, _) --> [].

aggregate_item_entry(Id, It, Path) -->
    with_fields(It, [componentId, quantity], Path, aggregate_item_fact(Id, It, Path)).

aggregate_item_fact(Id, It, Path) -->
    { get_dict(componentId, It, C0), get_dict(quantity, It, Q), to_atom(C0, C) },
    (   { positive_int(Q) }
    ->  [e(Path, aggregate_item(Id, C, Q))]
    ;   bad_quantity(Path, Q)
    ).

stock_entry(E, Path) -->
    with_fields(E, [productId, quantity], Path, stock_fact(E, Path)).

stock_fact(E, Path) -->
    { get_dict(productId, E, P0), get_dict(quantity, E, Q), to_atom(P0, P) },
    (   { non_negative_int(Q) }
    ->  [e(Path, stock(P, Q))]
    ;   bad_quantity(Path, Q)
    ).

issue_entry(I, Path) -->
    with_fields(I, [code], Path, issue_fact(I, Path)).

issue_fact(I, Path) -->
    { get_dict(code, I, C0), to_atom(C0, Code) },
    [e(Path, kb_issue(Code, I))].

% --- scenario, orders and pizzas (AI01) ---
% With a scenario, orders and pizzas are mandatory; without one (older snapshots) they are optional.

scenario_items(S) -->
    (   { get_dict(scenario, S, Sc), Sc \== null }
    ->  with_fields(Sc, [id, name, version, simulated, stockMode], "scenario", scenario_fact(Sc)),
        list_section(S, orders, order_entry),
        list_section(S, pizzas, pizza_entry)
    ;   optional_list_section(S, orders, order_entry),
        optional_list_section(S, pizzas, pizza_entry)
    ).

scenario_fact(Sc) -->
    { get_dict(id, Sc, I), get_dict(name, Sc, N), get_dict(version, Sc, V0),
      get_dict(simulated, Sc, Sim), get_dict(stockMode, Sc, M0),
      to_atom(I, Id), to_atom(N, Name), version_term(V0, Version), to_atom(M0, Mode) },
    (   { \+ is_bool(Sim) }
    ->  invalid("scenario.simulated", "not_a_boolean")
    ;   { \+ memberchk(Mode, [live, scenario]) }
    ->  invalid("scenario.stockMode", "invalid_stock_mode")
    ;   [e("scenario", kb_scenario(Id, Name, Version, Sim, Mode))]
    ).

order_entry(O, Path) -->
    with_fields(O, [id, simulated, items], Path, order_fact(O, Path)).

order_fact(O, Path) -->
    { get_dict(id, O, I), get_dict(simulated, O, Sim), get_dict(items, O, Items),
      to_atom(I, Id), sub_path(Path, items, ItemsPath) },
    (   { \+ is_bool(Sim) }
    ->  { sub_path(Path, simulated, SimPath) },
        invalid(SimPath, "not_a_boolean")
    ;   { \+ is_list(Items) }
    ->  invalid(ItemsPath, "not_a_list")
    ;   [e(Path, order(Id, Sim))],
        entries(Items, ItemsPath, order_item_entry(Id), 0)
    ).

order_item_entry(Id, It, Path) -->
    with_fields(It, [pizzaId, sizeId, quantity], Path, order_item_fact(Id, It, Path)).

order_item_fact(Id, It, Path) -->
    { get_dict(pizzaId, It, P0), get_dict(sizeId, It, S0), get_dict(quantity, It, Q),
      to_atom(P0, P), to_atom(S0, S) },
    (   { positive_int(Q) }
    ->  [e(Path, ordered_item(Id, P, S, Q))]
    ;   bad_quantity(Path, Q)
    ).

pizza_entry(Z, Path) -->
    with_fields(Z, [id, sizeIds], Path, pizza_fact(Z, Path)).

pizza_fact(Z, Path) -->
    { get_dict(id, Z, I), get_dict(sizeIds, Z, Sizes), to_atom(I, Id),
      sub_path(Path, sizeIds, SizesPath) },
    (   { is_list(Sizes) }
    ->  [e(Path, pizza(Id))],
        entries(Sizes, SizesPath, pizza_size_entry(Id), 0)
    ;   invalid(SizesPath, "not_a_list")
    ).

pizza_size_entry(Id, S0, Path) -->
    (   { text_value(S0) }
    ->  { to_atom(S0, S) },
        [e(Path, pizza_size(Id, S))]
    ;   invalid(Path, "invalid_type")
    ).

% --- WEB07 sections: their rules are unchanged; the first error becomes one problem ---

legacy_items(S, Key, Builder) -->
    (   { get_dict(Key, S, Value), Value \== null }
    ->  { atom_string(Key, Path),
          (   catch(call(Builder, Value, Facts), E, true)
          ->  true
          ;   E = failed
          ) },
        (   { var(E) }
        ->  facts_entries(Facts, Path)
        ;   { ( E = kb_error(Reason0) -> true ; Reason0 = E ),
              term_string(Reason0, Reason),
              problem("INVALID_SNAPSHOT", [path-Path, section-Key, reason-Reason], P) },
            [p(P)]
        )
    ;   []
    ).

facts_entries([], _) --> [].
facts_entries([F|Fs], Path) --> [e(Path, F)], facts_entries(Fs, Path).

% ---------------------------------------------------------------------------------------------
% Checks over the parsed entries: references, duplicates, nesting, pizzas as components
% ---------------------------------------------------------------------------------------------

check_problem(Entries, Problem) :-
    check_context(Entries, Context),
    check_rule(Entries, Context, Problem).

check_context(Es, ctx{products:Products, controlled:Controlled, sizes:Sizes,
                      pizzas:Pizzas, aggregates:Aggregates, suppliers:Suppliers}) :-
    ids(I, member(e(_, product(I, _, _, _)), Es), Products),
    ids(I, member(e(_, product(I, _, _, true)), Es), Controlled),
    ids(I, member(e(_, size(I, _)), Es), Sizes),
    ids(I, ( member(e(_, pizza(I)), Es) ; member(e(_, bom_item(I, _, _, _)), Es) ), Pizzas),
    ids(I, member(e(_, aggregate(I, _)), Es), Aggregates),
    ids(I, member(e(_, supplier(I, _)), Es), Suppliers).

ids(Template, Goal, Set) :-
    findall(Template, Goal, List),
    sort(List, Set).

in_context(Context, Kind, Id) :-
    get_dict(Kind, Context, Set),
    ord_memberchk(Id, Set).

% UNKNOWN_ITEM: a reference to a product, size, pizza or supplier that is not in the snapshot.
check_rule(Es, Ctx, P) :-
    member(e(Path, Fact), Es),
    reference(Fact, Field, Kind, Id),
    \+ in_context(Ctx, Kind, Id),
    problem("UNKNOWN_ITEM", [path-Path, field-Field, kind-Kind, id-Id], P).
% STOCK_NOT_CONTROLLED: stock of a product without stock control.
check_rule(Es, Ctx, P) :-
    member(e(Path, stock(Id, _)), Es),
    in_context(Ctx, products, Id),
    \+ in_context(Ctx, controlled, Id),
    problem("STOCK_NOT_CONTROLLED", [path-Path, productId-Id], P).
% NESTED_AGGREGATE: an aggregate cannot contain another aggregate.
check_rule(Es, Ctx, P) :-
    member(e(Path, aggregate_item(Aggregate, Item, _)), Es),
    in_context(Ctx, aggregates, Item),
    problem("NESTED_AGGREGATE", [path-Path, aggregateId-Aggregate, itemId-Item], P).
% PIZZA_AS_COMPONENT: a pizza used as a component or as an item of an aggregate.
check_rule(Es, Ctx, P) :-
    member(e(Path, Fact), Es),
    component_use(Fact, Id),
    in_context(Ctx, pizzas, Id),
    problem("PIZZA_AS_COMPONENT", [path-Path, pizzaId-Id], P).
% DUPLICATE_ENTRY: the same key more than once in a section.
check_rule(Es, _, P) :-
    duplicate_kind(Kind, Template, Key),
    findall(Key-Path, member(e(Path, Template), Es), Pairs0),
    keysort(Pairs0, Pairs),
    group_pairs_by_key(Pairs, Groups),
    member(K-Paths, Groups),
    Paths = [_, _|_],
    key_text(K, Text),
    problem("DUPLICATE_ENTRY", [kind-Kind, key-Text, paths-Paths], P).

reference(bom_item(P, _, _, _), pizzaId, products, P).
reference(bom_item(_, S, _, _), sizeId, sizes, S).
reference(bom_item(_, _, C, _), componentId, products, C).
reference(aggregate(A, _), id, products, A).
reference(aggregate_item(_, C, _), componentId, products, C).
reference(stock(P, _), productId, products, P).
reference(ordered_item(_, P, _, _), pizzaId, products, P).
reference(ordered_item(_, _, S, _), sizeId, sizes, S).
reference(pizza(P), id, products, P).
reference(pizza_size(_, S), sizeIds, sizes, S).
reference(forecast_item(_, _, P, _, _), productId, products, P).
reference(forecast_item(_, _, _, S, _), sizeId, sizes, S) :- S \== none.
reference(supplier_offer(Su, _, _, _, _), supplierId, suppliers, Su).
reference(supplier_offer(_, P, _, _, _), productId, products, P).

component_use(bom_item(_, _, C, _), C).
component_use(aggregate_item(_, C, _), C).

duplicate_kind(product, product(I, _, _, _), I).
duplicate_kind(size, size(I, _), I).
duplicate_kind(pizza, pizza(I), I).
duplicate_kind(pizza_size, pizza_size(P, S), P/S).
duplicate_kind(bom_line, bom_item(P, S, C, _), P/S/C).
duplicate_kind(aggregate, aggregate(A, _), A).
duplicate_kind(aggregate_item, aggregate_item(A, C, _), A/C).
duplicate_kind(order, order(O, _), O).
duplicate_kind(order_line, ordered_item(O, P, S, _), O/P/S).
duplicate_kind(stock, stock(P, _), P).

key_text(A/B, Text) :- !,
    key_text(A, TA),
    format(string(Text), "~w/~w", [TA, B]).
key_text(K, Text) :-
    format(string(Text), "~w", [K]).

%! problem(+Code, +Pairs, -Problem) is det.
%  A problem as a JSON-ready dict: _{code:Code, ...Pairs}.
problem(Code, Pairs, Problem) :-
    dict_pairs(Dict, _, Pairs),
    put_dict(code, Dict, Code, Problem).

% ---------------------------------------------------------------------------------------------
% WEB07 data parsing (forecast and supplier scenario): unchanged from AI06
% ---------------------------------------------------------------------------------------------

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

units(Q, Where) :-
    (   integer(Q), Q >= 0 -> true
    ;   throw(kb_error(invalid_value(quantity, Where, Q)))
    ).

positive_int(Q) :- integer(Q), Q >= 1.
non_negative_int(Q) :- integer(Q), Q >= 0.

is_bool(true).
is_bool(false).

to_atom(S, A) :- atom_string(A, S).


