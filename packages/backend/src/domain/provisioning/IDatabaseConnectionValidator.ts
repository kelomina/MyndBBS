export interface IDatabaseConnectionValidator {
  validate(dbUrl: string): Promise<boolean>;
}
