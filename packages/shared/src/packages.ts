/**
 * Package manifests — the static catalogue of platform packages (Sales, Ops,
 * IAM, Security…). Each manifest declares its capabilities and the admin menu
 * surface it owns; the console renders these to build the Settings & Admin
 * section and capability/permission pickers.
 */
import { PermissionDefinition } from './permissions';

export interface PackageManifest {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Sidebar section label under Settings & Admin */
  category: string;
  capabilities: {
    key: string;
    label: string;
    description: string;
  }[];
  adminMenus: {
    label: string;
    icon: string;
    path: string;
    componentKey: string;
    requiredCapability: string;
  }[];
}

export const PACKAGE_MANIFESTS: Record<string, PackageManifest> = {
  sales: {
    id: 'sales',
    name: 'Sales',
    icon: 'TrendingUp',
    description: 'Sales pipeline, forecasting, and target management',
    category: 'Sales Configuration',
    capabilities: [
      {
        key: 'package.sales.config.targets',
        label: 'Manage Sales Targets',
        description: 'Set and manage sales targets for teams and individuals.',
      },
      {
        key: 'package.sales.config.forecast',
        label: 'Manage Sales Forecast',
        description: 'Configure forecast categories and projection models.',
      },
      {
        key: 'package.sales.config.pipeline',
        label: 'Manage Pipeline Stages',
        description: 'Define and reorder deal pipeline stages.',
      },
    ],
    adminMenus: [
      {
        label: 'Sales Targets',
        icon: 'Target',
        path: '/admin/sales/targets',
        componentKey: 'SalesTargetsAdmin',
        requiredCapability: 'package.sales.config.targets',
      },
      {
        label: 'Sales Forecast',
        icon: 'BarChart3',
        path: '/admin/sales/forecast',
        componentKey: 'SalesForecastAdmin',
        requiredCapability: 'package.sales.config.forecast',
      },
      {
        label: 'Pipeline Stages',
        icon: 'GitBranchPlus',
        path: '/admin/sales/pipeline',
        componentKey: 'PipelineStagesAdmin',
        requiredCapability: 'package.sales.config.pipeline',
      },
    ],
  },

  'customer-service': {
    id: 'customer-service',
    name: 'Customer Service',
    icon: 'Headphones',
    description: 'Omnichannel customer support with LINE integration',
    category: 'CS Configuration',
    capabilities: [
      {
        key: 'package.cs.integration.line',
        label: 'LINE Integration Setup',
        description: 'Configure LINE Official Account connection and webhook settings.',
      },
      {
        key: 'package.cs.rules.manage',
        label: 'Manage Auto-Reply Rules',
        description: 'Create and manage automated response rules for common inquiries.',
      },
      {
        key: 'package.cs.routing.manage',
        label: 'Manage Agent Routing',
        description: 'Configure ticket assignment rules and agent workload distribution.',
      },
    ],
    adminMenus: [
      {
        label: 'LINE Integration',
        icon: 'MessageCircle',
        path: '/admin/cs/line-integration',
        componentKey: 'LineIntegrationAdmin',
        requiredCapability: 'package.cs.integration.line',
      },
      {
        label: 'Auto-Reply Rules',
        icon: 'Bot',
        path: '/admin/cs/auto-reply',
        componentKey: 'AutoReplyRulesAdmin',
        requiredCapability: 'package.cs.rules.manage',
      },
      {
        label: 'Agent Routing',
        icon: 'Route',
        path: '/admin/cs/agent-routing',
        componentKey: 'AgentRoutingAdmin',
        requiredCapability: 'package.cs.routing.manage',
      },
    ],
  },
};

/** Returns a flat list of all package capabilities across all manifests. */
export function getAllPackageCapabilityDefinitions(): {
  key: string;
  label: string;
  description: string;
  category: string;
  packageId: string;
}[] {
  const defs: ReturnType<typeof getAllPackageCapabilityDefinitions> = [];
  for (const pkg of Object.values(PACKAGE_MANIFESTS)) {
    for (const cap of pkg.capabilities) {
      defs.push({
        key: cap.key,
        label: cap.label,
        description: cap.description,
        category: pkg.category,
        packageId: pkg.id,
      });
    }
  }
  return defs;
}
