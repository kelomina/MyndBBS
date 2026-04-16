export interface IDatabaseSchemaApplier {
  applySchema(): Promise<void>;
}
