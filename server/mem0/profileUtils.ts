import { mergeFamilyDietaryRestrictions, type FamilyMember, type Profile as DbProfile } from '@shared/schema';

export const DIETARY_KEYWORDS = [
  'allerg',
  'intoleran',
  'free',
  'vegan',
  'vegetarian',
  'pescatarian',
  'keto',
  'paleo',
  'kosher',
  'halal',
  'diet',
  'gluten',
  'dairy',
  'lactose',
  'milk',
  'nut',
  'tree nut',
  'peanut',
  'soy',
  'sesame',
  'wheat',
  'fodmap',
  'shellfish',
  'fish',
  'seafood',
  'egg',
  'seed oil',
  'sugar-free',
  'low carb',
  'low sodium',
  'no ',
  'avoid '
] as const;

const normalizeToArray = (value: any): any[] => {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const dedupeStrings = (input: any[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  input
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    });
  return result;
};

const isDietaryTerm = (value: string): boolean => {
  const lower = value.toLowerCase();
  return DIETARY_KEYWORDS.some((keyword) => lower.includes(keyword));
};

const splitDietaryFromList = (list: string[]) => {
  const dietary: string[] = [];
  const preferences: string[] = [];

  list.forEach((item) => {
    if (!item) return;
    const trimmed = item.trim();
    if (!trimmed) return;
    if (isDietaryTerm(trimmed)) {
      dietary.push(trimmed);
    } else {
      preferences.push(trimmed);
    }
  });

  return {
    dietary: dedupeStrings(dietary),
    preferences: dedupeStrings(preferences),
  };
};

const normalizeMembers = (value: any): FamilyMember[] => {
  const membersRaw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  return membersRaw.map((member: any) => ({
    name: typeof member?.name === 'string' ? member.name.trim() : member?.name,
    ageGroup: member?.ageGroup,
    preferences: dedupeStrings(normalizeToArray(member?.preferences)),
    dietaryRestrictions: dedupeStrings(normalizeToArray(member?.dietaryRestrictions ?? member?.dietary_restrictions)),
    goals: dedupeStrings(normalizeToArray(member?.goals)),
  })) as FamilyMember[];
};

const collectDietaryRestrictions = (profile: any, members: FamilyMember[], preferenceDietary: string[]): string[] => {
  const explicit = normalizeToArray(profile?.dietaryRestrictions);
  const legacy = normalizeToArray(profile?.dietary_restrictions);
  const manual = normalizeToArray(profile?.individualDietaryRestrictions);

  const mergedMembers = members.length ? mergeFamilyDietaryRestrictions(members) : [];

  const combined = dedupeStrings([
    ...explicit,
    ...legacy,
    ...manual,
    ...preferenceDietary,
    ...mergedMembers,
  ]);

  return combined;
};

const extractGoals = (profile: any, primaryGoal?: string): string[] => {
  const goalSet = new Set<string>();

  const rawGoals = profile?.goals;

  if (Array.isArray(rawGoals)) {
    rawGoals.forEach((goal) => {
      if (typeof goal !== 'string') return;
      const trimmed = goal.trim();
      if (!trimmed || trimmed.includes(':')) return;
      goalSet.add(trimmed);
    });
  } else if (rawGoals && typeof rawGoals === 'object') {
    Object.entries(rawGoals).forEach(([key, value]) => {
      if (typeof value === 'number') {
        goalSet.add(`${key}: ${value}`);
      } else if (typeof value === 'string') {
        goalSet.add(value.trim());
      }
    });
  } else if (typeof rawGoals === 'string') {
    const trimmed = rawGoals.trim();
    if (trimmed) goalSet.add(trimmed);
  }

  if (primaryGoal) {
    const trimmed = primaryGoal.trim();
    if (trimmed) goalSet.add(trimmed);
  }

  return Array.from(goalSet).slice(0, 6);
};

export interface UltraThinkProfileData {
  profileName: string;
  profileType: 'individual' | 'family';
  primaryGoal: string;
  familySize: number;
  dietaryRestrictions: string[];
  goals: string[];
  preferences: string[];
  culturalBackground: string[];
  members: FamilyMember[];
  questionnaireAnswers?: Record<string, any>;
  questionnaireSelections?: any[];
  updatedAt?: string | Date | null;
}

const getFirstDefined = <T>(source: any, keys: string[], fallback?: T): T => {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null) {
      return source[key] as T;
    }
  }
  return fallback as T;
};

export const mapProfilePayloadToUltraThink = (profile: any | null | undefined): UltraThinkProfileData | null => {
  if (!profile) return null;

  const profileName = getFirstDefined<string>(profile, ['profileName', 'profile_name'], 'User Profile') || 'User Profile';
  const profileType = (getFirstDefined<string>(profile, ['profileType', 'profile_type'], 'individual') || 'individual') as 'individual' | 'family';
  const primaryGoal = getFirstDefined<string>(profile, ['primaryGoal', 'primary_goal'], '') || '';
  const familySizeRaw = getFirstDefined<number | string>(profile, ['familySize', 'family_size'], 1);
  const familySize = Number.isNaN(Number(familySizeRaw)) ? 1 : Number(familySizeRaw) || 1;

  const members = normalizeMembers(profile?.members);

  const preferencesRaw = dedupeStrings(normalizeToArray(profile?.preferences));
  const { dietary: dietaryFromPreferences, preferences: culinaryPreferences } = splitDietaryFromList(preferencesRaw);

  const culturalBackground = dedupeStrings(normalizeToArray(profile?.culturalBackground ?? profile?.cultural_background));

  const dietaryRestrictions = collectDietaryRestrictions(profile, members, dietaryFromPreferences);

  const goals = extractGoals(profile, primaryGoal);

  const questionnaireAnswers = profile?.questionnaire_answers && typeof profile.questionnaire_answers === 'object'
    ? profile.questionnaire_answers
    : undefined;
  const questionnaireSelections = Array.isArray(profile?.questionnaire_selections)
    ? profile.questionnaire_selections
    : undefined;

  return {
    profileName,
    profileType,
    primaryGoal,
    familySize,
    dietaryRestrictions,
    goals,
    preferences: culinaryPreferences,
    culturalBackground,
    members,
    questionnaireAnswers,
    questionnaireSelections,
    updatedAt: getFirstDefined(profile, ['updatedAt', 'updated_at'], undefined),
  };
};

export const mapProfileRecordToUltraThink = (profile: DbProfile | null | undefined): UltraThinkProfileData | null => {
  if (!profile) return null;

  return mapProfilePayloadToUltraThink({
    ...profile,
    dietaryRestrictions: (profile as any)?.dietaryRestrictions,
    dietary_restrictions: (profile as any)?.dietary_restrictions,
  });
};

export const buildProfileMemorySummary = (profile: UltraThinkProfileData): string => {
  const lines: string[] = [];

  const headlineParts = [profile.profileName || 'User Profile'];
  headlineParts.push(profile.profileType === 'family' ? `Family of ${profile.familySize}` : 'Individual');
  lines.push(headlineParts.join(' • '));

  if (profile.primaryGoal) {
    lines.push(`Primary Goal: ${profile.primaryGoal}`);
  }

  if (profile.dietaryRestrictions?.length) {
    lines.push(`Dietary Restrictions: ${profile.dietaryRestrictions.join(', ')}`);
  } else {
    lines.push('Dietary Restrictions: None recorded');
  }

  const supportingGoals = profile.goals?.filter((goal) => goal !== profile.primaryGoal);
  if (supportingGoals?.length) {
    lines.push(`Supporting Goals: ${supportingGoals.join(', ')}`);
  }

  if (profile.preferences?.length) {
    lines.push(`Flavor Preferences: ${profile.preferences.join(', ')}`);
  }

  if (profile.culturalBackground?.length) {
    lines.push(`Cultural Background: ${profile.culturalBackground.join(', ')}`);
  }

  if (profile.profileType === 'family' && profile.members?.length) {
    lines.push('Family Members:');
    profile.members.forEach((member) => {
      const segments: string[] = [];
      segments.push(`- ${member.name || 'Unnamed Member'}`);
      if ((member as any)?.role) {
        segments.push(`(${(member as any).role})`);
      }
      if (member.ageGroup) {
        segments.push(member.ageGroup);
      }
      const detailParts: string[] = [];
      if (member.dietaryRestrictions?.length) {
        detailParts.push(`Restrictions: ${member.dietaryRestrictions.join(', ')}`);
      }
      if (member.preferences?.length) {
        detailParts.push(`Preferences: ${member.preferences.join(', ')}`);
      }
      if (member.goals?.length) {
        detailParts.push(`Goals: ${member.goals.join(', ')}`);
      }
      if (detailParts.length) {
        segments.push(`– ${detailParts.join(' | ')}`);
      }
      lines.push(segments.join(' '));
    });
  }

  return lines.join('\n');
};

export const computeProfileSignature = (profile: UltraThinkProfileData): string => {
  const normalizeForSignature = {
    profileName: profile.profileName,
    profileType: profile.profileType,
    primaryGoal: profile.primaryGoal,
    familySize: profile.familySize,
    dietaryRestrictions: [...(profile.dietaryRestrictions || [])].map((v) => v.toLowerCase()).sort(),
    goals: [...(profile.goals || [])].map((v) => v.toLowerCase()).sort(),
    preferences: [...(profile.preferences || [])].map((v) => v.toLowerCase()).sort(),
    culturalBackground: [...(profile.culturalBackground || [])].map((v) => v.toLowerCase()).sort(),
    members: (profile.members || []).map((member) => ({
      name: member.name || '',
      ageGroup: member.ageGroup || '',
      role: (member as any)?.role || '',
      dietaryRestrictions: [...(member.dietaryRestrictions || [])].map((v) => v.toLowerCase()).sort(),
      preferences: [...(member.preferences || [])].map((v) => v.toLowerCase()).sort(),
      goals: [...(member.goals || [])].map((v) => v.toLowerCase()).sort(),
    })),
  };

  return JSON.stringify(normalizeForSignature);
};

export const collectPreferenceCategories = (profile: UltraThinkProfileData) => ({
  dietary: profile.dietaryRestrictions || [],
  preferences: profile.preferences || [],
  cultural: profile.culturalBackground || [],
  goals: profile.goals || [],
});


