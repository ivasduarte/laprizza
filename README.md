# LaPrizza - Integrative Project (LEI-ISEP)

## Project Overview
LaPrizza is a modern pizza restaurant information system developed as the 5th-semester Integrative Project for the Informatics Engineering Bachelor's Degree at ISEP. 

The system supports the business and operational processes of the restaurant, from customer management and pizza configuration to order processing and kitchen scheduling.

## System Modules
The project integrates four main technological areas:
* **Web Application:** The primary interface for business capabilities (identity, catalogue, order management).
* **3D Visualization:** WebGL and Three.js modules for interactive pizza building and visual kitchen monitoring.
* **Artificial Intelligence:** A Prolog-based reasoning module for scheduling food preparation activities and managing kitchen resources.
* **Systems Administration:** Infrastructure setup ensuring secure, reproducible, and scalable deployments.

## Architecture & Engineering Practices
* **Architecture:** Domain-Driven Design (DDD). Domain and business rules are isolated from presentation and persistence mechanisms.
* **Documentation:** All architectural and domain models are documented using PlantUML.
* **Testing:** Unit tests utilize a Dummy approach instead of Mockito. Automated tests cover all relevant business rules and invariants.
* **API:** Business functionality is exposed via standardized REST APIs.

## Repository Structure
This repository contains the different applications, modules, and documentation developed throughout the semester. 

*(Note to team: Map the specific folder structure here once initialized)*
* `/ai` - Prolog scheduling logic.
* `/backend` - Back-end application and REST APIs in Node.js.
* `/docs` - User Story documentation, PlantUML diagrams and System Architecture.
* `/frontend` - Web application.
* `/infra` - Deployment and systems-administration configuration and scripts.
* `/visualization3d` - 3D interaction modules (WebGL and Three.js).

## Setup and Development Environment

## Sprint 1 Focus
The current iteration establishes the technical foundations:
* Project setup, repository organization, and issue tracking.
* Core domain analysis and system architecture design.
* Back-end development focusing on users, customers, products, allergens, and pizza component configurations.
