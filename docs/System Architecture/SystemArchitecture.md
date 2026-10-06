# System Architecture Document - La Prizza

## 1. Documentation Roadmap

### 1.1. Purpose and Scope

This document contains the description of the system architecture of La Prizza.
This system follows a modular, web-based architecture to support the operations of a pizza restaurant. It identifies the principal applications and modules (back-end, web application, 3d visualization, AI scheduling and infrastructure), their responsibilities and interactions.

### 1.2. Stakeholders and Concerns

| Stakeholder | Concerns to address |
|:-----------:|:-------------------:|
| New developers | Principles and rules? History of decisions? Which components exist and how are they connected? |
| Developers | Impact of a change? Which components exist and how are they connected? |
| Infrastructure | What must be installed, how and where?
| Testers | Which modules and interfaces must be tested and what do they depend on? How do the components integrate (API contracts)? How are the tests run? |
| Client | Which components exist at run-time and how are they connected? |

### 1.3. Stakeholders' documentation needs

| Stakeholder | Functional | Uses | Decomposition | Layer | C&C | Deployment |
|:-----------:|:----------:|:----:|:-------------:|:-----:|:---:|:----------:|
| New developers | x | x | x | x | x | x |
| Developers | d | d | d | d | d | d |
| Infrastructure | - | - | - | - | - | d |
| Testers | - | - | - | - | d | o |
| Client | - | - | - | - | o | o |

`d = detailed information, s = some details, o = overview, x = anything`

### 1.4 Views in this document
| View | Question it answers | Notation | Section |
|:----:|:-------------------:|:--------:|:-------:|
| Functional | What does the system do? | UML use case + C4 System Context | tbd |
| Module uses (also layers) | Which module may use which? | UML package | tbd |
| Module decomposition | How is the code decomposed into modules? | UML package | tbd |
| C&C (high level) | Which run-time components exist and how do they communicate? | C4 Container | tbd |
| Deployment | Where do the components run? | C4 Deployment | tbd |

### 1.5 Diagram conventions
- C4 for context, containers and deployment;
- UML for module views and scenarios.

`All diagrams are versioned in the repository. One abstraction level per diagram. Every diagram has title, type,
scope and legend when needed. Every element has name, type, description and technology when relevant. Every arrow
is labelled with a verb, correct direction and protocol when relevant.`