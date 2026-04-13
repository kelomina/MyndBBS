export interface RouteWhitelistProps {
  id: string;
  path: string;
  isPrefix: boolean;
  minRole: string | null;
  description: string | null;
}

/**
 * Callers: [SystemApplicationService]
 * Callees: []
 * Description: Represents the RouteWhitelist Aggregate Root within the System domain. Manages dynamic gateway access rules.
 * Keywords: routewhitelist, aggregate, root, domain, entity, system, gateway
 */
export class RouteWhitelist {
  private props: RouteWhitelistProps;

  private constructor(props: RouteWhitelistProps) {
    this.props = { ...props };
  }

  public static create(props: RouteWhitelistProps): RouteWhitelist {
    if (!props.path) {
      throw new Error('ERR_ROUTE_PATH_REQUIRED');
    }
    return new RouteWhitelist(props);
  }

  public static load(props: RouteWhitelistProps): RouteWhitelist {
    return new RouteWhitelist(props);
  }

  public get id(): string { return this.props.id; }
  public get path(): string { return this.props.path; }
  public get isPrefix(): boolean { return this.props.isPrefix; }
  public get minRole(): string | null { return this.props.minRole; }
  public get description(): string | null { return this.props.description; }

  public update(path: string, isPrefix: boolean, minRole: string | null, description: string | null): void {
    if (!path) {
      throw new Error('ERR_ROUTE_PATH_REQUIRED');
    }
    this.props.path = path;
    this.props.isPrefix = isPrefix;
    this.props.minRole = minRole;
    this.props.description = description;
  }
}