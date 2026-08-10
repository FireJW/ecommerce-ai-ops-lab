import { assertPublicSafe } from "../lib/privacy.mjs";

export function buildCreativeChannelManifest(creativeResult, config) {
  assertPublicSafe({ creativeResult, config });
  if (!creativeResult.validation?.passed || creativeResult.review_required !== true) {
    throw new Error("Creative manifest requires a validated, human-review creative result");
  }
  const avatarConsentRequired = config.uses_synthetic_avatar || config.uses_synthetic_voice;

  return {
    connector: "creative_channel_manifest/v1",
    channels: config.channels,
    source_workflow: creativeResult.workflow,
    sku: creativeResult.sku,
    assets: {
      angle: creativeResult.draft.angle,
      scenes: creativeResult.draft.scenes,
      captions: creativeResult.draft.caption,
      compliance_notes: creativeResult.draft.compliance_notes,
    },
    disclosures: {
      uses_synthetic_avatar: config.uses_synthetic_avatar,
      uses_synthetic_voice: config.uses_synthetic_voice,
      avatar_or_voice_consent_required: avatarConsentRequired,
      ai_content_label_review_required: true,
    },
    platform_sdk_mapping_required: true,
    review_required: true,
    upload_allowed: false,
  };
}
