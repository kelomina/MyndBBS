# Domain Context & Purpose (Why)

## Background
The current Role-Based Access Control (RBAC) system in the application relies on three Prisma models: `Role`, `Permission`, and `RolePermission`. While this serves as an effective infrastructure for securing routes (via CASL or middleware), these concepts do not currently possess their own Domain Aggregates. 

In a robust enterprise system, Roles and Permissions are not static config files—they are dynamic business assets. For instance, creating a new "Sub-Moderator" role, assigning it specific permissions, and ensuring no cyclic dependencies or invalid permission strings requires explicit domain invariant checks.

## Value Proposition
By extracting `Role` and `Permission` into the System (or Identity) Domain:
1. **Architectural Completeness**: The application achieves theoretical 100% pure DDD across all non-exempt logic, eliminating any conceptual gaps where Prisma tables lack Domain Models.
2. **Invariant Protection**: Assigning permissions to a role becomes a protected domain behavior (`Role.assignPermission(...)`) rather than a loose database join.
3. **Future Extensibility**: If dynamic role creation APIs are introduced for Super Admins, the business logic will be safely encapsulated inside the Application Service and Aggregate Root, decoupled from Prisma infrastructure.