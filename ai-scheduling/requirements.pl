% Requirements planning of the LaPrizza AI service (AI02).
% Works on the knowledge base already loaded by kb.pl (inside with_snapshot/2) and never
% changes stock: every balance is a result only.
%
%   forecast (per day) -> BOM -> gross demand per day
%   -> net need per day (stock consumed chronologically)
%   -> purchase plan (cheapest supplier that delivers on time)
%
% Decisions (see allocate_all/4 and offer_capacity/4):
%   - the order date is the reference date ("today"): retrievedAt of the snapshot, or the
%     option today(Date); an offer arrives at today + ceiling(leadTimeDays);
%   - an offer is on time for a need when it arrives on or before the day of the need;
%   - supplier_limit/3 is the total a supplier can give for a product in the whole plan;
%     without a limit the capacity is stockUnits;
%   - pass 1 allocates on-time offers (cheapest first, then earliest); pass 2 uses what is left
%     for the needs not covered, flagged as late (earliest arrival first, then cheapest);
%   - orders are not part of the plan: the forecast is the demand.

:- module(requirements, [ requirements_calculate/2, requirements_calculate/3,
                          requirements_from_file/2, print_requirements/1,
                          requirements_print_file/1 ]).

:- use_module(kb).
:- use_module(bom, []).                 % loaded only: its helpers are reached through the seam below
:- use_module(library(assoc)).
:- use_module(library(apply)).
:- use_module(library(lists)).
:- use_module(library(pairs)).
:- use_module(library(option)).
:- use_module(library(http/json)).

% ---------------------------------------------------------------------------------------------
% Helpers shared with bom.pl (one place to change if bom.pl exports them later)
% ---------------------------------------------------------------------------------------------

scenario_info(Info)                       :- bom:scenario_info(Info).
inputs_info(Info)                         :- bom:inputs_info(Info).
request_problems(Request, Problems)       :- bom:request_problems(Request, Problems).
incomplete_recipe(Pizza, Size, Why, Comp) :- bom:incomplete_recipe(Pizza, Size, Why, Comp).
sort_problems(Problems0, Problems)        :- bom:sort_problems(Problems0, Problems).
iso_timestamp(Stamp, Text)                :- bom:iso_timestamp(Stamp, Text).

% ---------------------------------------------------------------------------------------------
% Public interface
% ---------------------------------------------------------------------------------------------

requirements_calculate(Request, Result) :-
    requirements_calculate(Request, Result, []).

%! requirements_calculate(+Request, -Result, +Options) is det.
%  Options: now(Stamp) for calculatedAt, today(Date) ('YYYY-MM-DD') as the order date.
requirements_calculate(Request, Result, Options) :-
    ( option(now(Now), Options) -> true ; get_time(Now) ),
    scenario_info(Scenario),
    inputs_info(Inputs),
    request_problems(Request, RequestProblems),
    forecast_problems(ForecastProblems),
    reference_date(Options, Today, DateProblems),
    append([RequestProblems, ForecastProblems, DateProblems], Problems0),
    warnings(Warnings),
    (   Problems0 == []
    ->  calculate(Today, Rows, Production, Purchases),
        stock_problems(Rows, Production, StockProblems)
    ;   Rows = [], Production = [], Purchases = [], StockProblems = []
    ),
    append(Problems0, StockProblems, Problems1),
    sort_problems(Problems1, Problems),
    (   Problems == []
    ->  ok_result(Now, Scenario, Inputs, Today, Rows, Production, Purchases, Warnings, Result)
    ;   Result = _{ status: "invalid_data", simulation: true, scenario: Scenario,
                    inputs: Inputs, problems: Problems, warnings: Warnings }
    ).

requirements_from_file(Path, Result) :-
    setup_call_cleanup(open(Path, read, In, [encoding(utf8)]),
                       json_read_dict(In, Dict),
                       close(In)),
    catch(with_snapshot(Dict, ( request_from_kb(Request), requirements_calculate(Request, Result) )),
          kb_error(invalid_data(Problems)),
          Result = _{ status: "invalid_data", simulation: true, problems: Problems }).

print_requirements(Result) :-
    json_write_dict(current_output, Result, [width(100)]),
    nl.

requirements_print_file(Path) :-
    requirements_from_file(Path, Result),
    print_requirements(Result).

request_from_kb(_{scenarioId: Id, stockMode: Mode}) :-
    kb_scenario(Id, _, _, _, Mode), !.
request_from_kb(_{}).

% ---------------------------------------------------------------------------------------------
% Phase A: validation (every problem is collected)
% ---------------------------------------------------------------------------------------------

forecast_problems(Problems) :-
    (   forecast(_, _, _, _, _)
    ->  findall(P, forecast_item_problem(P), Problems)
    ;   problem("MISSING_FORECAST", [reason-"no_forecast"], P),
        Problems = [P]
    ).

% A forecast line with a size is a pizza of the catalogue; without a size it is a product.
forecast_item_problem(P) :-
    forecast_item(_, _, Prod, Size, _),
    (   Size == none
    ->  pizza(Prod),
        problem("INVALID_SIZE", [pizzaId-Prod, sizeId-null], P)
    ;   \+ pizza(Prod)
    ->  problem("NOT_PREDEFINED_PIZZA", [pizzaId-Prod], P)
    ;   \+ pizza_size(Prod, Size)
    ->  problem("INVALID_SIZE", [pizzaId-Prod, sizeId-Size], P)
    ;   incomplete_recipe(Prod, Size, Reason, Component),
        problem("INCOMPLETE_RECIPE",
                [pizzaId-Prod, sizeId-Size, reason-Reason, componentId-Component], P)
    ).

% The day on which the purchases are placed.
reference_date(Options, Today, Problems) :-
    (   option(today(T0), Options)
    ->  Raw = T0
    ;   kb_meta(_, At, _), text_to_string(At, S), string_length(S, L), L >= 10
    ->  sub_string(S, 0, 10, _, Raw)
    ;   Raw = ""
    ),
    atom_string(Today0, Raw),
    (   valid_date(Today0)
    ->  Today = Today0, Problems = []
    ;   Today = none,
        problem("INVALID_SNAPSHOT", [reason-"invalid_reference_date"], P),
        Problems = [P]
    ).

%  A real calendar day: the parsed date must print back as the same text (so 2026-02-30 fails).
valid_date(Date) :-
    atom_length(Date, 10),
    catch(( parse_time(Date, iso_8601, Stamp),
            stamp_date_time(Stamp, DateTime, 'UTC'),
            format_time(atom(Back), '%F', DateTime) ),
          _, fail),
    Back == Date.

% MISSING_SCENARIO_STOCK / MISSING_STOCK: a stock controlled item needed without a stock entry.
stock_problems(Rows, Production, Problems) :-
    ( kb_scenario(_, _, _, _, Mode) -> true ; Mode = scenario ),
    ( Mode == live -> Code = "MISSING_STOCK" ; Code = "MISSING_SCENARIO_STOCK" ),
    findall(P,
            (   (   member(row(Id, _, _, Required, missing, _, _), Rows)
                ;   member(prod(Id, Required, missing, _), Production)
                ),
                problem(Code, [productId-Id, required-Required], P) ),
            Problems).

warnings(Warnings) :-
    (   supplier_scenario(_, _, _)
    ->  Warnings = []
    ;   problem("NO_SUPPLIER_SCENARIO", [reason-"no_supplier_scenario"], W),
        Warnings = [W]
    ).

% ---------------------------------------------------------------------------------------------
% Phase B: calculation
%   1. gross demand per (day, product) through the BOM
%   2. produced aggregates: stock first, the rest is produced and expanded into ingredients
%   3. net need per day of every other stock controlled product
%   4. purchase plan per product
% ---------------------------------------------------------------------------------------------

calculate(Today, Rows, Production, Purchases) :-
    direct_demand(Direct),
    by_product(Direct, Groups),
    partition(produced_group, Groups, Produced, Others),
    empty_assoc(Derived0),
    foldl(produce_group, Produced, Production, Derived0, Derived),
    foldl(add_group, Others, Derived, Combined),
    by_product(Combined, CombinedGroups),
    maplist(requirement_row, CombinedGroups, Rows),
    include(has_needs, Rows, ToBuy),
    maplist(purchase_entry(Today), ToBuy, Purchases).

% --- gross demand: assoc Date-Product -> units ---

direct_demand(Demand) :-
    findall(forecast_item(Date, Prod, Size, Q), forecast_item(_, Date, Prod, Size, Q), Items),
    empty_assoc(D0),
    foldl(add_item_demand, Items, D0, Demand).

add_item_demand(forecast_item(Date, Prod, none, Q), D0, D) :- !,
    add_amount(Date-Prod, Q, D0, D).
add_item_demand(forecast_item(Date, Prod, Size, Q), D0, D) :-
    findall(C-U, bom_item(Prod, Size, C, U), Consumptions),
    foldl(add_consumption(Date, Q), Consumptions, D0, D).

add_consumption(Date, Q, C-U, D0, D) :-
    Amount is Q * U,
    add_amount(Date-C, Amount, D0, D).

add_amount(Key, Amount, A0, A) :-
    (   get_assoc(Key, A0, Old) -> New is Old + Amount ; New = Amount ),
    put_assoc(Key, A0, New, A).

%  [Product-[Date-Units, ...]], by product and by date.
by_product(Assoc, Groups) :-
    findall(P-(D-A), gen_assoc(D-P, Assoc, A), Pairs0),
    keysort(Pairs0, Pairs),
    group_pairs_by_key(Pairs, Groups).

sum_amounts(Pairs, Sum) :-
    foldl(add_second, Pairs, 0, Sum).

add_second(_-A, S0, S) :- S is S0 + A.

% --- produced aggregates ---

produced_group(Id-_) :- aggregate(Id, production).

%  prod(Id, Required, StockState, NetSchedule); the ingredients go to the derived demand.
produce_group(Id-Series, prod(Id, Required, State, Net), D0, D) :-
    sum_amounts(Series, Required),
    stock_state(Id, State),
    ( integer(State) -> Stock = State ; Stock = 0 ),
    net_series(Series, Stock, Net),
    findall(C-Q, aggregate_item(Id, C, Q), Recipe),
    foldl(add_net_recipe(Recipe), Net, D0, D).

add_net_recipe(Recipe, Date-Units, D0, D) :-
    foldl(add_recipe_item(Date, Units), Recipe, D0, D).

add_recipe_item(Date, Units, C-Q, D0, D) :-
    Amount is Units * Q,
    add_amount(Date-C, Amount, D0, D).

add_group(Product-Series, A0, A) :-
    foldl(add_series_entry(Product), Series, A0, A).

add_series_entry(Product, Date-Amount, A0, A) :-
    add_amount(Date-Product, Amount, A0, A).

% --- stock ---

%  An integer, null (no stock control) or missing (controlled, without a stock entry).
stock_state(Id, State) :-
    (   product(Id, _, _, true)
    ->  ( stock(Id, S) -> State = S ; State = missing )
    ;   State = null
    ).

%  Stock is consumed chronologically: the need of a day is what the cumulative demand exceeds
%  the stock by, minus what was already short the days before.
net_series(Series, Stock, Net) :-
    net_series(Series, Stock, 0, Net).

net_series([], _, _, []).
net_series([Date-Amount|Rest], Stock, Cum0, Net) :-
    Cum is Cum0 + Amount,
    Short is max(0, Cum - Stock) - max(0, Cum0 - Stock),
    (   Short > 0 -> Net = [Date-Short|Net1] ; Net = Net1 ),
    net_series(Rest, Stock, Cum, Net1).

%  row(Id, Kind, StockControlled, Required, Available, Shortage, Needs)
requirement_row(Id-Series, row(Id, Kind, Controlled, Required, Available, Shortage, Needs)) :-
    sum_amounts(Series, Required),
    ( aggregate(Id, purchase) -> Kind = aggregate_purchased ; Kind = simple ),
    stock_state(Id, Available),
    (   integer(Available)
    ->  Controlled = true,
        net_series(Series, Available, Needs),
        sum_amounts(Needs, Shortage)
    ;   Available == missing
    ->  Controlled = true, Needs = [], Shortage = null
    ;   Controlled = false, Needs = [], Shortage = null
    ).

has_needs(row(_, _, _, _, _, _, Needs)) :- Needs \== [].

% ---------------------------------------------------------------------------------------------
% Purchase plan of one product
% ---------------------------------------------------------------------------------------------

purchase_entry(Today, row(Id, _, _, _, _, Shortage, Needs), Entry) :-
    offers_state(Id, Today, Offers),
    allocate_all(Needs, Offers, Lines, Unmet),
    sum_amounts(Unmet, Uncovered),
    Covered is Shortage - Uncovered,
    maplist(allocation_entry, Lines, Allocations),
    foldl(line_cost, Lines, 0, Cost0),
    Cost is round(Cost0 * 100) / 100,
    purchase_status(Shortage, Uncovered, Lines, Status),
    ( Offers == [] -> Reason = "NO_SUPPLIER_OFFER" ; Reason = "INSUFFICIENT_SUPPLY" ),
    maplist(unmet_entry(Reason), Unmet, UnmetEntries),
    product_name(Id, Name),
    Entry = _{ productId: Id, name: Name, shortage: Shortage, covered: Covered,
               uncovered: Uncovered, costEur: Cost, status: Status,
               allocations: Allocations, unmet: UnmetEntries }.

purchase_status(Shortage, Uncovered, Lines, Status) :-
    (   Uncovered =:= Shortage -> Status = "unavailable"
    ;   Uncovered > 0 -> Status = "partial"
    ;   memberchk(line(late, _, _, _, _, _), Lines) -> Status = "late"
    ;   Status = "on_time"
    ).

%  o(Supplier, UnitPrice, ArrivalDate, RemainingCapacity)
offers_state(Product, Today, Offers) :-
    findall(o(Sup, Price, Arrival, Cap),
            ( supplier_offer(Sup, Product, Price, Units, Lead),
              offer_capacity(Sup, Product, Units, Cap),
              Days is ceiling(Lead),
              date_add(Today, Days, Arrival) ),
            Offers0),
    msort(Offers0, Offers).

%  The supply limit (total for the plan), when stated; otherwise the units in stock.
offer_capacity(Sup, Product, Units, Cap) :-
    (   supplier_limit(Sup, Product, Limit) -> Cap = Limit ; Cap = Units ).

date_add(Date, Days, Date2) :-
    parse_time(Date, iso_8601, Stamp),
    Stamp2 is Stamp + Days * 86400,
    stamp_date_time(Stamp2, DateTime, 'UTC'),
    format_time(atom(Date2), '%F', DateTime).

%! allocate_all(+Needs, +Offers, -Lines, -Unmet) is det.
%  Needs: [Date-Units] in chronological order. Lines: line(Phase, ForDate, Supplier, Price,
%  Arrival, Units). Unmet: [Date-Units].
%  Pass 1 gives every need, earliest first, the cheapest offer that arrives in time. Pass 2
%  gives the capacity left to the needs still open. Since the offers on time for an earlier
%  need are also on time for a later one, taking the earliest need first is also the cheapest.
allocate_all(Needs, Offers0, Lines, Unmet) :-
    allocate_pass(on_time, Needs, Offers0, Offers1, Lines1, Rest),
    allocate_pass(late, Rest, Offers1, _, Lines2, Unmet),
    append(Lines1, Lines2, Lines).

allocate_pass(_, [], Os, Os, [], []).
allocate_pass(Phase, [Date-Units|Needs], Os0, Os, Lines, Rest) :-
    allocate(Phase, Date, Units, Os0, Os1, Lines1, Left),
    allocate_pass(Phase, Needs, Os1, Os, Lines2, Rest1),
    append(Lines1, Lines2, Lines),
    (   Left > 0 -> Rest = [Date-Left|Rest1] ; Rest = Rest1 ).

allocate(_, _, 0, Os, Os, [], 0) :- !.
allocate(Phase, Date, Units, Os0, Os, Lines, Left) :-
    (   pick(Phase, Date, Os0, o(Sup, Price, Arrival, Cap))
    ->  Take is min(Units, Cap),
        Rest is Units - Take,
        NewCap is Cap - Take,
        replace_offer(Sup, NewCap, Os0, Os1),
        Lines = [line(Phase, Date, Sup, Price, Arrival, Take)|Lines1],
        allocate(Phase, Date, Rest, Os1, Os, Lines1, Left)
    ;   Os = Os0, Lines = [], Left = Units
    ).

pick(Phase, Date, Offers, Chosen) :-
    findall(Key-Offer,
            ( member(Offer, Offers),
              Offer = o(Sup, Price, Arrival, Cap),
              Cap > 0,
              eligible(Phase, Arrival, Date),
              offer_key(Phase, Price, Arrival, Sup, Key) ),
            Keyed),
    keysort(Keyed, [_-Chosen|_]).

eligible(on_time, Arrival, Date) :- Arrival @=< Date.
eligible(late, _, _).

offer_key(on_time, Price, Arrival, Sup, k(Price, Arrival, Sup)).
offer_key(late, Price, Arrival, Sup, k(Arrival, Price, Sup)).

replace_offer(Sup, NewCap, [o(Sup, Price, Arrival, _)|T], [o(Sup, Price, Arrival, NewCap)|T]) :- !.
replace_offer(Sup, NewCap, [H|T0], [H|T]) :-
    replace_offer(Sup, NewCap, T0, T).

line_cost(line(_, _, _, Price, _, Units), C0, C) :- C is C0 + Price * Units.

% ---------------------------------------------------------------------------------------------
% Result (status ok)
% ---------------------------------------------------------------------------------------------

ok_result(Now, Scenario, Inputs, Today, Rows, Production, Purchases, Warnings, Result) :-
    once(forecast(Fid, Fname, Fver, Start, End)),
    maplist(row_entry, Rows, Requirements),
    include(produces, Production, Produced),
    maplist(production_entry, Produced, ProductionEntries),
    summary(Purchases, Summary),
    iso_timestamp(Now, CalculatedAt),
    Result = _{ status: "ok", simulation: true, calculatedAt: CalculatedAt,
                scenario: Scenario, inputs: Inputs,
                plan: _{ forecastId: Fid, forecastName: Fname, version: Fver,
                         startDate: Start, endDate: End, referenceDate: Today },
                summary: Summary, requirements: Requirements,
                production: ProductionEntries, purchases: Purchases,
                warnings: Warnings }.

summary(Purchases, _{ totalCostEur: Total, productsToBuy: Count, feasible: Feasible }) :-
    length(Purchases, Count),
    foldl(add_purchase_cost, Purchases, 0, Total0),
    Total is round(Total0 * 100) / 100,
    (   forall(member(P, Purchases), get_dict(status, P, "on_time"))
    ->  Feasible = true
    ;   Feasible = false
    ).

add_purchase_cost(Purchase, S0, S) :-
    get_dict(costEur, Purchase, Cost),
    S is S0 + Cost.

row_entry(row(Id, Kind, Controlled, Required, Available, Shortage, Needs),
          _{ productId: Id, name: Name, kind: Kind, stockControlled: Controlled,
             required: Required, available: Available, shortage: Shortage,
             needs: NeedEntries }) :-
    product_name(Id, Name),
    maplist(date_entry, Needs, NeedEntries).

produces(prod(_, _, _, Net)) :- Net \== [].

production_entry(prod(Id, Required, State, Net),
                 _{ productId: Id, name: Name, required: Required, available: State,
                    toProduce: Total, schedule: Schedule }) :-
    product_name(Id, Name),
    sum_amounts(Net, Total),
    maplist(date_entry, Net, Schedule).

date_entry(Date-Units, _{date: Date, quantity: Units}).

allocation_entry(line(Phase, For, Sup, Price, Arrival, Units),
                 _{ supplierId: Sup, supplierName: Name, forDate: For, quantity: Units,
                    unitPriceEur: Price, costEur: Cost, arrivalDate: Arrival,
                    onTime: OnTime }) :-
    ( Phase == on_time -> OnTime = true ; OnTime = false ),
    ( supplier(Sup, N), N \== none -> Name = N ; Name = null ),
    Cost is round(Price * Units * 100) / 100.

unmet_entry(Reason, Date-Units, _{date: Date, quantity: Units, reason: Reason}).

product_name(Id, Name) :-
    ( product(Id, N, _, _) -> Name = N ; Name = Id ).

% ---------------------------------------------------------------------------------------------
% Helpers
% ---------------------------------------------------------------------------------------------

problem(Code, Pairs, Problem) :-
    dict_pairs(Dict, _, Pairs),
    put_dict(code, Dict, Code, Problem).
