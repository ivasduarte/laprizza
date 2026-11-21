# AI03 - Artificial Neural Networks for Restaurant Management at LaPrizza

---

## 1. What is a neural network and how does it work?

A neural network is a machine-learning model: instead of a programmer writing the rules by hand, the program is obtained from data and the desired outputs [1, slide 5]. It is built from artificial neurons; each one multiplies its inputs by weights, adds them together with a bias and applies a threshold to decide its output [1, slides 7 and 9]. Neurons are arranged in an input layer, one or more hidden layers and an output layer, each layer feeding the next [1, slide 13], and the more neurons the network has, the more closely it can approximate the shape of the problem it is learning [1, slide 11].

The weights are not known in advance, so the network has to be trained [1, slide 11]. Examples are fed in, the output is compared with the desired value to obtain the error, and the error is propagated backwards (backpropagation) to adjust the weights [1, slides 17-20], usually by gradient descent, where each weight changes according to the error and the learning rate [1, slides 21-22]. Repeating this many times makes the outputs approach the desired values [1, slides 23-24]. The practical consequences are that a network needs enough data to learn from [1, slides 26-27], only identifies what it was trained for, and has difficulty explaining its results [1, slide 4]. This is why the applications in Section 2 are tasks where examples exist, and why Sections 3 to 5 deal with data quality, evaluation and risks [4, p. 17].

---

## 2. Applications of ANNs to LaPrizza's management

Useful applications are described by their problem, inputs, outputs, expected benefits and limitations [4, p. 17].

```mermaid
flowchart TD
D1["Order history"] --> A["A: Demand forecasting (regression)"]
    D2["Stock and lead times"] --> B["B: Stock-shortage risk (classification)"]
    D3["Recorded timings: not available yet"] --> C["C: Preparation and waiting time (regression)"]
    A -->|forecast demand| B
    A -->|forecast feeds| PL["Prolog planning"]
    C -->|duration parameters| S["Prolog scheduler"]
```

### 2.1 Application A - Demand forecasting per product and size

|                       |                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem**           | The Manager must prepare daily consumption forecasts of sellable products, pizzas by size included, for a chosen period [4, pp. 6-7, 16]. In our assessment, producing them by hand is slow and depends on individual judgement. The forecast is the input from which Prolog Requirements Planning derives material needs, replenishment, suppliers, order dates and delivery dates [4, pp. 16-17]. |
| **Inputs**            | Past daily quantities of each product and size from confirmed orders [2, p. 7]; calendar information such as weekday and holidays; product active/inactive status [3, p. 7]. No customer-identifying data [4, pp. 17, 19].                                                                                                                                                                          |
| **Outputs**           | Forecast entries: date, product, applicable size and a non-negative integer quantity [4, pp. 6-7]. The conversion to stock is deterministic [4, p. 16].                                                                                                                                                                                                                                             |
| **Expected benefits** | Faster preparation of forecasts; a consistent starting point the Manager can edit [4, p. 6]; earlier visibility of unmet needs and late requirements in the resulting plan [4, pp. 16-17].                                                                                                                                                                                                          |
| **Limitations**       | Needs history that the prototype lacks [4, p. 15]; results from simulated data are only a simulation [4, p. 17]; the model is a black box [1, slide 4]; network outputs are real numbers [1, slides 17, 24] that must become non-negative integers [4, p. 7]; a proposal must pass the same validation as a manual forecast [4, pp. 6-7, 16].                                                       |
| **Model type**        | Proposed: a feed-forward network (multilayer perceptron) [1, slides 13, 15] for regression [1, slide 3], with one output per product and size and date. Inputs are recent daily quantities and calendar features (weekday, holiday). The output layer is constrained to non-negative values and then rounded to integers, as the forecast rules require [4, p. 7].                                  |

```mermaid
flowchart LR
    H["Confirmed orders history"] --> P["Pre-processing: aggregate per date, product and size"]
    C["Calendar features: weekday, holidays"] --> P
    P --> A["ANN: demand forecast"]
    A --> V["Validation: non-negative integers, forecast rules"]
    V --> M["Manager review and edit"]
    M --> R["Prolog Requirements Planning"]
    R --> O["Needs, replenishment, orders, delivery dates"]
    A -.-> B["ANN: shortage risk"]
    R -.-> B
    B -.-> M
```

### 2.2 Application B - Stock-shortage risk

|                       |                                                                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem**           | With many stock-controlled products [2, p. 6], the Manager needs to know which are likely to run short soon, in order to decide where to start replenishment under the confirmation rule [4, pp. 16, 19].                                                                                   |
| **Inputs**            | Current stock in abstract units [2, p. 6]; forecast demand (Application A); size-dependent consumption of components [2, pp. 6-7; 3, p. 9]; supplier lead time in days [4, p. 7].                                                                                                           |
| **Outputs**           | A risk/no-risk label per product and period - a binary classification for instance [1, slide 3].                                                                                                                                                                                            |
| **Expected benefits** | An early-warning layer on top of the exact calculation, which already reports shortages without negative remaining stock [4, p. 16]; useful when forecast inputs are uncertain.                                                                                                             |
| **Limitations**       | Largely redundant with the exact calculation once forecasts, stock and BOM are known [4, pp. 15-16]; it may never change stock or create purchase orders [4, pp. 16, 19]; in our assessment, shortages are rare events and therefore hard to learn.                                         |
| **Model type**        | Proposed: a feed-forward network [1, slide 15] for binary classification [1, slides 3, 8], with a single output interpreted as shortage probability and compared with a threshold [1, slide 9]. Inputs are current stock, forecast demand (Application A) and supplier lead time [4, p. 7]. |

```mermaid
flowchart LR
    S["Current stock (abstract units)"] --> N["ANN: shortage-risk classifier"]
    F["Forecast demand (Application A)"] --> N
    K["Size-dependent consumption of components"] --> N
    L["Supplier lead time (days)"] --> N
    N --> T["Risk score compared with threshold"]
    T --> R["Label per product and period: risk / no risk"]
    R --> M["Manager review"]
    M --> D["Decide where to start replenishment"]
    X["Exact stock calculation in Prolog planning"] -.->|reports shortages, used as reference| M
```

### 2.3 Application C - Preparation-time and customer-waiting-time

|                       |                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem**           | Preparation work depends on activity durations, resources and dependencies, with ovens as limited resources [2, p. 8]; estimates of activity durations and of when an order will be ready are needed to reduce customer waiting and improve utilization [2, p. 13]. |
| **Inputs**            | Order items and their state timings [2, p. 7]; pizza size and configuration [2, p. 7]; oven and resource usage [2, pp. 8, 13].                                                                                                                                      |
| **Outputs**           | Estimated duration per activity, or time until an order is ready (regression) [1, slide 3].                                                                                                                                                                         |
| **Expected benefits** | More realistic durations for the scheduler than fixed values [2, p. 8], supporting the goals of shorter waiting and better kitchen utilization [2, p. 13].                                                                                                          |
| **Limitations**       | Needs recorded durations from a real operation; the schedule itself is a Prolog planning problem [2, p. 13], so the ANN would supply parameters only. Food-preparation scheduling is not required in Sprint 2 [4, p. 3].                                            |
| **Model type**        | Proposed: a feed-forward network [1, slide 15] for regression [1, slide 3] with a single output (duration in minutes), taking order and pizza configuration and resource usage as inputs.                                                                           |

```mermaid
flowchart LR
    O["Order items and state timings"] --> N["ANN: duration estimator"]
    P["Pizza size and configuration"] --> N
    U["Oven and resource usage"] --> N
    N --> E["Estimated duration per activity or time until order is ready"]
    E --> S["Prolog scheduler: uses estimates as parameters"]
    S --> W["Schedule: waiting time, completion time, utilization"]
    W --> C["Compare with fixed durations and recorded timings"]
    C -.->|recorded timings: not available yet| N
```

---

## 3. Data quality

Machine Learning identifies only what it was trained for [1, slide 4], and deep learning performs better as the amount of data grows [1, slide 26]; the quality and amount of data are therefore decisive [1, slide 27].

### 3.1 Data needed, availability and issues per application

| App. | Data needed                                                 | Availability in the prototype                    | Main quality issues                                                                                                                                              |
| ---- | ----------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | Daily quantities per date, product and size [4, pp. 6-7]    | Orders may be predefined or generated [4, p. 15] | Simulated data teach the generator, not customers [4, pp. 17, 19]; omitted entries mean zero [4, p. 7], so "no sales" and "missing record" must be distinguished |
| B    | Stock snapshots over time plus shortage outcomes [4, p. 18] | Stock exists [3, p. 9]; outcomes need history    | Shortages are rare, so examples are few                                                                                                                          |
| C    | Recorded activity and order-state timings [2, pp. 7-8]      | None                                             | Timing must be recorded consistently per activity and resource [2, p. 8]                                                                                         |

### 3.2 Cross-cutting issues

- **Provenance:** Results from generated data must be labelled as simulation [4, pp. 7, 17, 19].
- **Units:** Quantities are product-specific abstract units [2, p. 6]; products cannot be mixed without a common basis (the planning also flags incompatible units) [4, p. 16].
- **Granularity:** Data are per date, product and size [4, pp. 6-7], and components consume different units by size [2, pp. 6-7; 3, p. 9]; the aggregation level must be fixed.
- **Catalogue drift:** Products may be deactivated without losing history [3, p. 7], and the set of sizes may evolve [3, p. 8]; models trained on an old catalogue may not fit a new one.
- **Calendar effects:** Weekday, holidays and events must be explicit features, otherwise they appear as noise.
- **Splitting:** Evaluation data must be separate from training data and respect time order [5, §5.8].
- **Appropriate data:** Only aggregated product-level or process-level data; no customer names, contacts or dietary profiles [4, pp. 17, 19].

---

## 4. Evaluation criteria

```mermaid
flowchart LR
    T["Training data: earlier period"] --> M["Model"]
    M --> E["Evaluation data: later period"]
    E --> X["MAE, RMSE, Bias or Precision, Recall, F1"]
    X --> Y["Compare with baseline"]
    Y --> Z["Impact on Prolog plan"]
```

### 4.1 Regression metrics (Applications A and C)

The slides define no regression metrics; the following standard definitions are proposed (MAE and RMSE as defined in [5, Chapter 5.8]; Bias as the mean signed error):

```
MAE = (1/n) Σ |yᵢ − ŷᵢ| (average error, in stock units or minutes)
RMSE = sqrt( (1/n) Σ (yᵢ − ŷᵢ)² ) (penalises large errors)
Bias = (1/n) Σ (ŷᵢ − yᵢ)  (systematic over/under-forecast)
```

### 4.2 Classification metrics (Application B)

The slides define the confusion matrix with true positives (PV), true negatives (NV), false positives (PF) and false negatives (NF) [1, slides 10, 12] and the metrics accuracy, error, precision, recall and F1 [1, slide 12]:

```
Accuracy = (PV + NV) / (PV + NV + PF + NF)     Error = 1 - Accuracy
Precision = PV / (PV + PF)
Recall = PV / (PV+ NF)
F1 = 2 * Precision * Recall / (Precision + Recall) = 2 * PV / (2*PV + NF + PF)
```

---

### 4.3 Business-oriented criteria

| Criterion       | Question                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline        | Does the ANN beat a trivial method (e.g. repeat the previous period, the naïve method) [5, §5.2]?                                    |
| Plan Impact     | Does using ANN forecasts reduce unmet needs and late requirements in the Prolog plan [4, pp. 16-17], compared with manual forecasts? |
| Error direction | Under-forecast causes shortages, over-forecast excess replenishment: measured separately                                             |
| Robustness      | Behaviour on atypical days and after catalogue changes [3, pp. 7-8]                                                                  |
| Usability       | Can the Manager understand and correct a proposal [1, slide 4; 4, p. 6]?                                                             |
| Kitchen goals   | Waiting time, completion time, idle resources, utilization [2, p. 13]                                                                |

---

## 5. Risks of unsuitable predictions (only some examples)

| #   | Risk                  | Applies to | Description                                                                   | Mitigation                                                        |
| --- | --------------------- | ---------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| R1  | Black-Box decisions   | All        | ANNs predict but have difficulty explaining [1, slide 4]                      | Advisory use; Manager review; show history next to the prediction |
| R2  | Invalid output format | A          | Real-valued outputs [1, slides 17, 24] versus non-negative integers [4, p. 7] | Post-process and validate with the forecast rules [4, pp. 6-7]    |
| R3  | False alarms          | B          | Alarm fatigue; wrongly suspecting staff                                       | Track precision [1, slide 12]; human review                       |
| R4  | Wrong time estimates  | C          | Errors propagate into the schedule [2, p. 13]                                 | Compare with fixed durations [2, p. 8]; keep schedule explainable |

---

## 6. Conclusion

Of the three applications studied, demand forecasting per product and size (Application A) is the most promising for LaPrizza: it addresses a task the Manager performs manually [4, p. 6], its output fits the existing forecast format [4, pp. 6-7], and it feeds the Prolog Requirements Planning [4, p. 16], so errors can be measured through their effect on the plan. Its main obstacle is data: the prototype has no real sales history, so any result obtained from generated orders is only a simulation [4, pp. 15, 17].

Stock-shortage risk (Application B) is largely redundant with the exact stock calculation once forecasts, stock and BOM are known [4, pp. 15-16], so its value would be limited to an early-warning layer under certain forecasts. Preparation and waiting-time estimation (Application C) could make the scheduler more realistic, but it requires recorded durations that do not exist yet, and the schedule itself would remain a Prolog planning problem [2, p. 13].

In all cases, an ANN should be used as an advisory tool where proposals are validated by the same rules as manual input [4, pp. 6-7] and reviewed by the Manager. Its potential can be assessed with the criteria in Section 4, starting with a comparison against a simple baseline [5, §5.2]. Applying it in practice would only make sense once real, consistently recorded data, are available. As stated in the requirements, this study does not train or deploy a neural network [4, p. 17].

---

## 7. Use of generative AI

As required by AI03 [4, p. 17]:

| Tool   | Used for                                     | How the output was checked                    | How it was incorporated        |
| ------ | -------------------------------------------- | --------------------------------------------- | ------------------------------ |
| Claude | Drafting the structure and reviewing wording | Compared with the slides and the requirements | Text was rewritten accordingly |
| Gemini | Reviewing wording                            | Validated if everything was well written      | Text was rewritten accordingly |

---

## 8. Sources consulted

References in the text use the numbers below, followed by the page. Page numbers are those printed in each document's footer; slide numbers follow the slide order of the PDF.

- [1] Ramos, C. _5 - Redes Neuronais Artificiais e Aprendizagem Profunda_. Inteligência Artificial, ISEP, 2025-2026 (theoretical slides).
- [2] _LEI-ISEP 5th Semester Integrative Project - PART II - System Specification_, v1.0, 2026/27.
- [3] _LEI-ISEP 5th Semester Integrative Project - PART III - Sprint 1 - User Stories_, v1.0, 2026/2027.
- [4] _LEI-ISEP 5th Semester Integrative Project - PART IV - Sprint 2 - User Stories_, v1.0, 2026/27.
- [5] Hyndman, R. J. & Athanasopoulos, G. _Forecasting: Principles and Practice_, 3rd ed., OTexts, 2021. Chapter 5.2 "Some simple forecasting methods"; Chapter 5.8 "Evaluating point forecast accuracy". https://otexts.com/fpp3/
