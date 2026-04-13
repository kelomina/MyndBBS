export interface AccessContextDTO {
  userId: string;
  roleName: string | null;
  level: number;
  moderatedCategoryIds: string[];
}

export interface RuleDescriptorDTO {
  action: string;
  subject: string;
  conditions?: any;
}

export interface AbilityRulesDTO {
  context: AccessContextDTO;
  rules: RuleDescriptorDTO[];
}