import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import menus from '../locales/en/menus.json';
import auth from '../locales/en/auth.json';
import common from '../locales/en/common.json';
import fields from '../locales/en/fields.json';
import permissions from '../locales/en/permissions.json';
import adminRoadmap from '../locales/en/admin_roadmap.json';
import adminCompanyProfile from '../locales/en/admin_company_profile.json';
import adminUserManager from '../locales/en/admin_user_manager.json';
import adminTeamManager from '../locales/en/admin_team_manager.json';
import adminPositionManager from '../locales/en/admin_position_manager.json';
import adminObjectManager from '../locales/en/admin_object_manager.json';
import adminViewManager from '../locales/en/admin_view_manager.json';
import adminWorkflowManager from '../locales/en/admin_workflow_manager.json';
import adminAppManager from '../locales/en/admin_app_manager.json';
import adminSsoConfig from '../locales/en/admin_sso_config.json';
import adminGeneralSettings from '../locales/en/admin_general_settings.json';
import adminAuditLog from '../locales/en/admin_audit_log.json';

import menusTH from '../locales/th/menus.json';
import authTH from '../locales/th/auth.json';
import commonTH from '../locales/th/common.json';
import fieldsTH from '../locales/th/fields.json';
import permissionsTH from '../locales/th/permissions.json';
import adminRoadmapTH from '../locales/th/admin_roadmap.json';
import adminCompanyProfileTH from '../locales/th/admin_company_profile.json';
import adminUserManagerTH from '../locales/th/admin_user_manager.json';
import adminTeamManagerTH from '../locales/th/admin_team_manager.json';
import adminPositionManagerTH from '../locales/th/admin_position_manager.json';
import adminObjectManagerTH from '../locales/th/admin_object_manager.json';
import adminViewManagerTH from '../locales/th/admin_view_manager.json';
import adminWorkflowManagerTH from '../locales/th/admin_workflow_manager.json';
import adminAppManagerTH from '../locales/th/admin_app_manager.json';
import adminSsoConfigTH from '../locales/th/admin_sso_config.json';
import adminGeneralSettingsTH from '../locales/th/admin_general_settings.json';
import adminAuditLogTH from '../locales/th/admin_audit_log.json';

i18n
  .use(initReactI18next)
  .init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          ...menus,
          ...auth,
          ...common,
          ...fields,
          ...permissions,
          ...adminRoadmap,
          ...adminCompanyProfile,
          ...adminUserManager,
          ...adminTeamManager,
          ...adminPositionManager,
          ...adminObjectManager,
          ...adminViewManager,
          ...adminWorkflowManager,
          ...adminAppManager,
          ...adminSsoConfig,
          ...adminGeneralSettings,
          ...adminAuditLog,
        },
      },
      th: {
        translation: {
          ...menusTH,
          ...authTH,
          ...commonTH,
          ...fieldsTH,
          ...permissionsTH,
          ...adminRoadmapTH,
          ...adminCompanyProfileTH,
          ...adminUserManagerTH,
          ...adminTeamManagerTH,
          ...adminPositionManagerTH,
          ...adminObjectManagerTH,
          ...adminViewManagerTH,
          ...adminWorkflowManagerTH,
          ...adminAppManagerTH,
          ...adminSsoConfigTH,
          ...adminGeneralSettingsTH,
          ...adminAuditLogTH,
        },
      },
    },
    fallbackLng: 'en',
    returnObjects: false,
    returnNull: false,
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
