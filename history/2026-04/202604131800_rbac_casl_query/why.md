# Domain Context & Purpose (Why)

## Background
The application has successfully migrated its write model to a 100% Domain-Driven Design (DDD) architecture. However, the Role-Based Access Control (RBAC) read model—specifically the generation of CASL rules—currently relies on a mix of middleware and hardcoded logic in `casl.ts`. 
While CQRS permits the read model to bypass the domain layer and directly query the database for performance, the current implementation scatters these read queries across the middleware layer and the CASL builder itself.

## Value Proposition
By extracting the RBAC read model into a dedicated `AccessControlQueryService`:
1. **Architectural Purity**: We achieve a true Command Query Responsibility Segregation (CQRS). The Query Service executes raw Prisma queries to produce highly-optimized, serializable Data Transfer Objects (DTOs).
2. **Performance**: The CASL rule generation is completely decoupled from the database and can be cached in Redis at the user level (`ability_rules:user:{userId}`). This drastically reduces database load for every authenticated request.
3. **Dynamic Permissions**: The system shifts from hardcoded roles to a truly dynamic, database-driven permission model (`Permission.action` parsed as `action:subject`).