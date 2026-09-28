import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import { getGuildInfo, getGuildRolesAction, getGuildChannelsAction } from '@/actions/guilds';
import { getConsentAdminSettings } from '@/actions/consent-admin';
import { getOfficialConsentTopics } from '@/actions/consent-topics';
import { isConsentFeatureEnabled } from '@/lib/consent/feature-gate';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import { GuildRouteProps, getGuildName } from '../helpers';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({
    subtitles: ['Guild Settings', guildName].filter(Boolean) as string[],
  });
}
import GuildAdminForm from './_components/GuildAdminForm';
import UsersConfig from './_components/UsersConfig';
import ConsentSettings from './_components/ConsentSettings';

export default async function GuildAdminPage({ params }: GuildRouteProps) {
  const { guildId } = await params;

  const guildInfoResult = await getGuildInfo(guildId);
  if (isFailure(guildInfoResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{guildInfoResult.error}</Alert>
      </Paper>
    );
  }

  const {
    role,
    allowedRoles,
    supportChannelId,
    adminContactInfo,
    adminNotificationChannelId,
    globalNotificationChannelId,
    overviewText,
    defaultSchedulingDetails,
  } = guildInfoResult.data;

  if (role !== 'admin') {
    notFound();
  }

  const [rolesResult, channelsResult] = await Promise.all([
    getGuildRolesAction(guildId),
    getGuildChannelsAction(guildId),
  ]);

  if (isFailure(rolesResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{rolesResult.error}</Alert>
      </Paper>
    );
  }

  if (isFailure(channelsResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{channelsResult.error}</Alert>
      </Paper>
    );
  }

  const consentResult =
    isConsentFeatureEnabled() && guildInfoResult.data.isConfigured
      ? await getConsentAdminSettings(guildId)
      : null;
  const topicsResult =
    consentResult && !isFailure(consentResult) && consentResult.data.enabled
      ? await getOfficialConsentTopics(guildId)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Guild Administration</h1>
      <GuildAdminForm
        roles={rolesResult.data}
        initialAllowedRoles={allowedRoles}
        channels={channelsResult.data}
        initialSupportChannelId={supportChannelId}
        initialAdminContactInfo={adminContactInfo}
        initialAdminNotificationChannelId={adminNotificationChannelId}
        initialGlobalNotificationChannelId={globalNotificationChannelId}
        initialOverviewText={overviewText}
        initialDefaultSchedulingDetails={defaultSchedulingDetails}
      />
      {consentResult &&
        (isFailure(consentResult) ? (
          <Alert type="error">{consentResult.error}</Alert>
        ) : (
          <ConsentSettings
            initialEnabled={consentResult.data.enabled}
            initialGuidance={consentResult.data.guidance}
            initialTopics={topicsResult && !isFailure(topicsResult) ? topicsResult.data : []}
            topicsError={topicsResult && isFailure(topicsResult) ? topicsResult.error : undefined}
          />
        ))}
      <UsersConfig />
    </div>
  );
}
