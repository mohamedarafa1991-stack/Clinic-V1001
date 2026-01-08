
export const features = {
  // Phase 1: Foundation
  multiTabSync: false,
  incrementalBackup: false,
  dbHealthMonitor: false,
  virtualizedLists: false,
  lazyLoading: true, // Enabled by default as architectural change

  // Phase 2: Clinical & Workflow
  clinicalIntelligence: false,
  medicationInteractions: false,
  voiceNotes: false,
  mobileOptimizations: false,

  // Phase 3: Advanced
  analytics: false,
  inventory: false,
  multiLocation: false
};

export type FeatureFlag = keyof typeof features;

export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  return features[flag];
};
