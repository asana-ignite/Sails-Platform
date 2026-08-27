/**
 * Dashboard — Executive Dashboard Archetype
 * Powered by Core UI Kit: UiKpiCard, UiRichList, UiPillTabs, UiCard, and DashboardPageShell.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, TrendingUp, DollarSign, Clock, ShoppingBag,
  ArrowRight, CreditCard, Send, Plus, ChevronRight
} from 'lucide-react';
import {
  UiCard,
  UiCardHeader,
  UiCardBody,
  UiKpiCard,
  UiRichList,
  UiRichListItem,
  UiPillTabs,
  UiAvatar,
  UiBadge,
  Button
} from '../components/ui';
import DashboardPageShell from '../components/layout/page-templates/DashboardPageShell';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [salesPeriod, setSalesPeriod] = useState('monthly');
  const [selectedClient, setSelectedClient] = useState('1');

  // Top Selling Products mock data
  const topProducts = [
    { id: '1', name: 'Cloud Enterprise Node', category: 'Infrastructure · 1,240 Units', price: '$24,800', tone: 'success' },
    { id: '2', name: 'Database Replication Engine', category: 'Data Services · 980 Units', price: '$19,600', tone: 'primary' },
    { id: '3', name: 'SSO & Multi-Tenant Gateway', category: 'Security · 750 Units', price: '$15,000', tone: 'info' },
    { id: '4', name: 'Workflow Automation Suite', category: 'Productivity · 620 Units', price: '$12,400', tone: 'warning' },
  ];

  // Top Customers / Tenants mock data
  const topCustomers = [
    { id: '1', name: 'Acme Global Corp', subtitle: 'Enterprise Tier · 45 Licenses', revenue: '$12,500' },
    { id: '2', name: 'Starlight Tech Industries', subtitle: 'Pro Tier · 32 Licenses', revenue: '$8,200' },
    { id: '3', name: 'Apex Media Systems', subtitle: 'Enterprise Tier · 28 Licenses', revenue: '$9,750' },
    { id: '4', name: 'Nexus Logistics Group', subtitle: 'Pro Tier · 20 Licenses', revenue: '$5,400' },
  ];

  // Platform Distribution mock data
  const platformChannels = [
    { id: '1', name: 'Direct Tenant API', subtitle: '12.43k Calls · 45% Share', badge: 'Top Channel', tone: 'success' as const },
    { id: '2', name: 'Partner Webhook Network', subtitle: '8.92k Calls · 32% Share', badge: 'Trending', tone: 'info' as const },
    { id: '3', name: 'SaaS Integration Hub', subtitle: '6.14k Calls · 25% Share', badge: 'Fast Growth', tone: 'warning' as const },
    { id: '4', name: 'Custom Dynamic Plugins', subtitle: '4.85k Calls · 18% Share', badge: 'Growing', tone: 'primary' as const },
  ];

  const clientAvatars = [
    { id: '1', name: 'Eleanor Pena', initials: 'EP' },
    { id: '2', name: 'Marvin McKinney', initials: 'MM' },
    { id: '3', name: 'Courtney Henry', initials: 'CH' },
    { id: '4', name: 'Jerome Bell', initials: 'JB' },
  ];

  const handleKpiAction = (title: string, opt: string) => {
    console.log(`Filter ${title} by ${opt}`);
  };

  return (
    <DashboardPageShell
      header={
        <div className="sails-page-header" style={{ marginBottom: 0 }}>
          <div>
            <h1 className="sails-page-header__title">{t('common.dashboard.title', 'Executive Dashboard')}</h1>
            <p className="sails-page-header__subtitle">{t('common.dashboard.welcome', 'Platform performance overview & operations metrics')}</p>
          </div>
          <div className="sails-dash-header-actions">
            <UiPillTabs
              tabs={[
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
                { id: 'yearly', label: 'Yearly' },
              ]}
              activeTab={salesPeriod}
              onChange={setSalesPeriod}
              size="sm"
            />
          </div>
        </div>
      }
      sideContent={
        <>
          {/* Channel / Platform Distribution Widget */}
          <UiCard>
            <UiCardHeader
              title="Integration Channels"
              subtitle="Active event distribution"
            />
            <UiCardBody style={{ padding: '8px 16px' }}>
              <UiRichList>
                {platformChannels.map((chan) => (
                  <UiRichListItem
                    key={chan.id}
                    prepend={
                      <div className={`sails-channel-icon sails-channel-icon--${chan.tone}`}>
                        <TrendingUp size={15} />
                      </div>
                    }
                    title={chan.name}
                    subtitle={chan.subtitle}
                    append={
                      <UiBadge tone={chan.tone}>{chan.badge}</UiBadge>
                    }
                  />
                ))}
              </UiRichList>
            </UiCardBody>
          </UiCard>

          {/* Quick Action / Dispatch Widget */}
          <UiCard>
            <UiCardHeader
              title="Quick Dispatch"
              subtitle="Send notification & task allocation"
            />
            <UiCardBody>
              <div className="sails-quick-dispatch">
                <label className="sails-quick-dispatch__label">Select Team Lead</label>
                <div className="sails-quick-dispatch__avatars">
                  {clientAvatars.map((client) => (
                    <UiAvatar
                      key={client.id}
                      name={client.name}
                      initials={client.initials}
                      size="sm"
                      onClick={() => setSelectedClient(client.id)}
                      className={selectedClient === client.id ? 'sails-avatar--selected' : ''}
                    />
                  ))}
                  <button type="button" className="sails-avatar-add-btn" aria-label="Add Client">
                    <Plus size={14} />
                  </button>
                </div>

                <div className="sails-quick-dispatch__form">
                  <select
                    className="sails-input sails-quick-select"
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                  >
                    <option value="1">Eleanor Pena (Core DevOps)</option>
                    <option value="2">Marvin McKinney (Security Ops)</option>
                    <option value="3">Courtney Henry (Data Team)</option>
                    <option value="4">Jerome Bell (Billing Manager)</option>
                  </select>

                  <Button variant="primary" className="sails-quick-dispatch__btn">
                    <Send size={14} className="me-1" />
                    Dispatch Task
                  </Button>
                </div>
              </div>
            </UiCardBody>
          </UiCard>
        </>
      }
    >
      {/* Hero Welcome Banner */}
      <div className="sails-card sails-dash-hero">
        <div className="sails-dash-hero__content">
          <div className="sails-dash-hero__badge">
            <UiBadge tone="info">Live Operations</UiBadge>
          </div>
          <h2 className="sails-dash-hero__headline">Welcome Back, Administrator!</h2>
          <p className="sails-dash-hero__desc">
            All system health services and multi-tenant database clusters are operating at peak efficiency. Here is today's execution report.
          </p>
          <div className="sails-dash-hero__footer">
            <div className="sails-dash-hero__stat">
              <span className="sails-dash-hero__stat-val">$85,240</span>
              <span className="sails-dash-hero__stat-label">Monthly Gross <span className="text-success ms-1">+5.2% ↗</span></span>
            </div>
            <Button variant="primary" size="md">
              View Activity Logs <ArrowRight size={14} />
            </Button>
          </div>
        </div>
        <div className="sails-dash-hero__glow"></div>
      </div>

      {/* 4x KPI Stat Cards with Progress Rings */}
      <div className="sails-dash-kpi-grid">
        <UiKpiCard
          title="Total API Requests"
          value="35,780"
          unit="/weekly"
          trend={{ value: '8.5%', direction: 'up', label: 'vs last week' }}
          progress={75}
          tone="primary"
          icon={<ShoppingBag size={17} />}
          menuOptions={['Today', 'This Week', 'This Month']}
          onMenuSelect={(opt) => handleKpiAction('API Requests', opt)}
        />
        <UiKpiCard
          title="Tenant Gross Revenue"
          value="$45,210"
          unit="/weekly"
          trend={{ value: '5.7%', direction: 'up', label: 'vs last week' }}
          progress={80}
          tone="success"
          icon={<CreditCard size={17} />}
          menuOptions={['Today', 'This Week', 'This Month']}
          onMenuSelect={(opt) => handleKpiAction('Revenue', opt)}
        />
        <UiKpiCard
          title="Active Workflows"
          value="1,245"
          unit="/weekly"
          trend={{ value: '2.1%', direction: 'down', label: 'vs last week' }}
          progress={60}
          tone="warning"
          icon={<Clock size={17} />}
          menuOptions={['Today', 'This Week', 'This Month']}
          onMenuSelect={(opt) => handleKpiAction('Workflows', opt)}
        />
        <UiKpiCard
          title="New Tenant Accounts"
          value="320"
          unit="/weekly"
          trend={{ value: '12.0%', direction: 'up', label: 'vs last week' }}
          progress={66}
          tone="info"
          icon={<Users size={17} />}
          menuOptions={['Today', 'This Week', 'This Month']}
          onMenuSelect={(opt) => handleKpiAction('Tenants', opt)}
        />
      </div>

      {/* 2-Column Split: Top Products / Services & Top Enterprise Customers */}
      <div className="sails-dash-dual-grid">
        <UiCard>
          <UiCardHeader
            title="Top Platform Services"
            subtitle="Highest volume services"
            addon={
              <a href="#!" className="sails-link-sm">See All <ChevronRight size={13} /></a>
            }
          />
          <UiCardBody style={{ padding: '8px 20px' }}>
            <UiRichList>
              {topProducts.map((prod) => (
                <UiRichListItem
                  key={prod.id}
                  prepend={
                    <div className="sails-product-thumb">
                      <ShoppingBag size={16} />
                    </div>
                  }
                  title={prod.name}
                  subtitle={prod.category}
                  append={prod.price}
                />
              ))}
            </UiRichList>
          </UiCardBody>
        </UiCard>

        <UiCard>
          <UiCardHeader
            title="Top Enterprise Tenants"
            subtitle="Highest monthly ARR contributors"
            addon={
              <a href="#!" className="sails-link-sm">See All <ChevronRight size={13} /></a>
            }
          />
          <UiCardBody style={{ padding: '8px 20px' }}>
            <UiRichList>
              {topCustomers.map((cust) => (
                <UiRichListItem
                  key={cust.id}
                  prepend={
                    <UiAvatar name={cust.name} size="sm" />
                  }
                  title={cust.name}
                  subtitle={cust.subtitle}
                  append={cust.revenue}
                />
              ))}
            </UiRichList>
          </UiCardBody>
        </UiCard>
      </div>
    </DashboardPageShell>
  );
};

export default Dashboard;
