import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Shield, FileText, Users, MapPin, Sparkles } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ThemedBackground, { appTheme } from './ThemedBackground';
import { useDarkMode } from './DarkMode';

const resolveTheme = (darkMode) => {
  const t = typeof appTheme === 'function' 
    ? appTheme(darkMode) 
    : (darkMode ? appTheme?.dark : appTheme?.light) || appTheme;
  
  const colors = t?.colors || {};
  return {
    text: colors.text ?? (darkMode ? '#FFFFFF' : '#2E3A59'),
    textMuted: colors.muted ?? (darkMode ? '#B0BEC5' : '#7C8B9A'),
    textStrong: colors.textStrong ?? (darkMode ? '#FFFFFF' : '#2E3A59'),
    cardBg: colors.card ?? (darkMode ? '#0F172A' : '#FFFFFF'),
    border: colors.border ?? (darkMode ? '#1E293B' : '#E0E6EA'),
    accent: colors.accent ?? (darkMode ? '#7CC8FF' : '#81D4FA'),
    
    cardGrad: t?.gradients?.card ?? 
      (darkMode ? ['#020617', '#0B1220'] : ['#FFFFFF', '#EEF5FF']),
  };
};

const PrivacySection = ({ icon, title, children, darkMode, theme }) => (
  <View style={[styles.section, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>
        {title}
      </Text>
    </View>
    <View style={styles.sectionContent}>
      {children}
    </View>
  </View>
);

const BulletPoint = ({ text, darkMode, theme }) => (
  <View style={styles.bulletRow}>
    <Text style={[styles.bullet, { color: theme.accent }]}>•</Text>
    <Text style={[styles.bulletText, { color: theme.text }]}>{text}</Text>
  </View>
);

export default function PrivacyAgreement({ navigation }) {
  const { darkMode } = useDarkMode();
  const theme = useMemo(() => resolveTheme(darkMode), [darkMode]);

  return (
    <ThemedBackground>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerButton}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={theme.cardGrad}
                style={styles.headerButtonGradient}
              >
                <ArrowLeft size={20} color={theme.textStrong} />
              </LinearGradient>
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: theme.textStrong }]}>
              Privacy & Data Usage
            </Text>

            <View style={{ width: 44 }} />
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Introduction */}
            <View style={[styles.introCard, { backgroundColor: darkMode ? '#1a3a52' : '#E3F2FD' }]}>
              <Shield size={32} color={darkMode ? '#64b5f6' : '#1976d2'} />
              <Text style={[styles.introTitle, { color: darkMode ? '#fff' : '#1976d2' }]}>
                Your Privacy Matters
              </Text>
              <Text style={[styles.introText, { color: darkMode ? '#e0e0e0' : '#333' }]}>
                This page explains how your data is used within Baby Tracker and when it's shared with third-party services.
              </Text>
            </View>

            {/* AI Insights Section */}
            <PrivacySection
              icon={<Sparkles size={24} color="#1976d2" />}
              title="AI Insights (GPT-4o Mini)"
              darkMode={darkMode}
              theme={theme}
            >
              <Text style={[styles.description, { color: theme.textMuted }]}>
                When you enable AI Insights, the following data is sent to OpenAI's GPT-4o Mini:
              </Text>
              
              <BulletPoint 
                text="Child's age (calculated from birthdate)" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Sleep duration and timing data" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Feeding frequency, types, and amounts" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Diaper change patterns and types" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Aggregated statistics (no personal identifiers)" 
                darkMode={darkMode} 
                theme={theme} 
              />
              
              <View style={[styles.disclaimer, { backgroundColor: darkMode ? '#2a2a2a' : '#FFF9C4' }]}>
                <Text style={[styles.disclaimerText, { color: darkMode ? '#FFC107' : '#F57F17' }]}>
                  <Text style={{ fontWeight: '700' }}>Important:</Text> Your child's name, photos, and personal 
                  identifying information are never sent to AI services. AI insights are for general guidance only 
                  and not a substitute for professional medical advice.
                </Text>
              </View>
            </PrivacySection>

            {/* Export Reports Section */}
            <PrivacySection
              icon={<FileText size={24} color="#4CAF50" />}
              title="PDF & Excel Exports"
              darkMode={darkMode}
              theme={theme}
            >
              <Text style={[styles.description, { color: theme.textMuted }]}>
                When you export reports, the following data is included based on your selections:
              </Text>
              
              <BulletPoint 
                text="Child's name (as you've entered it)" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Selected activity logs (sleep, feeding, diapers)" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Date ranges and statistics you've chosen" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="AI-generated insights (if enabled and selected)" 
                darkMode={darkMode} 
                theme={theme} 
              />
              
              <View style={[styles.infoBox, { backgroundColor: darkMode ? '#1a4a4a' : '#E8F5E9' }]}>
                <Text style={[styles.infoText, { color: darkMode ? '#81C784' : '#2E7D32' }]}>
                  <Text style={{ fontWeight: '700' }}>Your Control:</Text> Exported files remain on your device 
                  until you choose to share them. We never upload exports to cloud services automatically.
                </Text>
              </View>
            </PrivacySection>

            {/* Caregiver Invites Section */}
            <PrivacySection
              icon={<Users size={24} color="#FF9800" />}
              title="Caregiver Invitations"
              darkMode={darkMode}
              theme={theme}
            >
              <Text style={[styles.description, { color: theme.textMuted }]}>
                When you invite a caregiver, the following data is shared:
              </Text>
              
              <BulletPoint 
                text="Child's name and basic profile information" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Activity logs based on permission level" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Your optional message/note to the caregiver" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Real-time updates (when caregiver has access)" 
                darkMode={darkMode} 
                theme={theme} 
              />
              
              <View style={[styles.disclaimer, { backgroundColor: darkMode ? '#2a2a2a' : '#FFF9C4' }]}>
                <Text style={[styles.disclaimerText, { color: darkMode ? '#FFC107' : '#F57F17' }]}>
                  <Text style={{ fontWeight: '700' }}>You're in Control:</Text> You can revoke caregiver access 
                  at any time from the "Manage Caregivers" page. Caregivers only see children you explicitly share with them.
                </Text>
              </View>
            </PrivacySection>

            {/* Memories Feature Section */}
            <PrivacySection
              icon={<MaterialCommunityIcons name="image-multiple" size={24} color="#9C27B0" />}
              title="Memories & Media Storage"
              darkMode={darkMode}
              theme={theme}
            >
              <Text style={[styles.description, { color: theme.textMuted }]}>
                When you use the Memories feature to preserve special moments:
              </Text>
              
              <BulletPoint 
                text="Photos and videos stored securely in Firebase Storage" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Media files associated with your child's profile" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Captions, descriptions, and dates you provide" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Automatic thumbnail generation for videos" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Multiple media items per memory (photos/videos)" 
                darkMode={darkMode} 
                theme={theme} 
              />
              
              <View style={[styles.disclaimer, { backgroundColor: darkMode ? '#2a2a2a' : '#FFF9C4' }]}>
                <Text style={[styles.disclaimerText, { color: darkMode ? '#FFC107' : '#F57F17' }]}>
                  <Text style={{ fontWeight: '700' }}>Important:</Text> Your photos and videos are stored 
                  securely and are only accessible by you and caregivers you've explicitly granted access to. 
                  When you delete a memory, all associated media files are permanently removed from storage.
                </Text>
              </View>
              
              <View style={[styles.infoBox, { backgroundColor: darkMode ? '#1a4a4a' : '#E8F5E9' }]}>
                <Text style={[styles.infoText, { color: darkMode ? '#81C784' : '#2E7D32' }]}>
                  <Text style={{ fontWeight: '700' }}>Your Control:</Text> You can delete individual memories 
                  or entire collections at any time. Deleted media is immediately and permanently removed from 
                  all storage systems. We never use your photos or videos for any purpose other than displaying 
                  them to you and your authorized caregivers.
                </Text>
              </View>
            </PrivacySection>

            {/* Pediatrician Finder Section */}
            <PrivacySection
              icon={<MapPin size={24} color="#E91E63" />}
              title="Find Pediatrician Feature"
              darkMode={darkMode}
              theme={theme}
            >
              <Text style={[styles.description, { color: theme.textMuted }]}>
                When you use the pediatrician finder, the following occurs:
              </Text>
              
              <BulletPoint 
                text="Your device's GPS location is accessed (with permission)" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Location coordinates sent to Google Places API" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Search results displayed from Google's database" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="No baby/child data is included in these searches" 
                darkMode={darkMode} 
                theme={theme} 
              />
              
              <View style={[styles.infoBox, { backgroundColor: darkMode ? '#1a4a4a' : '#E8F5E9' }]}>
                <Text style={[styles.infoText, { color: darkMode ? '#81C784' : '#2E7D32' }]}>
                  <Text style={{ fontWeight: '700' }}>Location Privacy:</Text> Your location is only used for the 
                  search and is not stored or shared with any other services. You must grant location permission 
                  for this feature to work.
                </Text>
              </View>
            </PrivacySection>

            {/* Data Storage Section */}
            <PrivacySection
              icon={<Shield size={24} color="#9C27B0" />}
              title="Data Storage & Security"
              darkMode={darkMode}
              theme={theme}
            >
              <Text style={[styles.description, { color: theme.textMuted }]}>
                Your data security is our priority:
              </Text>
              
              <BulletPoint 
                text="All data encrypted in transit using HTTPS/TLS" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Stored securely in Firebase (Google Cloud)" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Access controlled via authentication" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Multi-factor authentication available" 
                darkMode={darkMode} 
                theme={theme} 
              />
              <BulletPoint 
                text="Regular security audits performed" 
                darkMode={darkMode} 
                theme={theme} 
              />
            </PrivacySection>

            {/* Your Rights Section */}
            <View style={[styles.rightsCard, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
              <Text style={[styles.rightsTitle, { color: theme.textStrong }]}>
                Your Rights
              </Text>
              <Text style={[styles.rightsText, { color: theme.text }]}>
                You have the right to:
              </Text>
              <BulletPoint text="Access all your data at any time" darkMode={darkMode} theme={theme} />
              <BulletPoint text="Export your data in standard formats" darkMode={darkMode} theme={theme} />
              <BulletPoint text="Delete your account and all associated data" darkMode={darkMode} theme={theme} />
              <BulletPoint text="Opt out of AI features while keeping core functionality" darkMode={darkMode} theme={theme} />
              <BulletPoint text="Control who has access to your child's information" darkMode={darkMode} theme={theme} />
            </View>

            {/* Contact Section */}
            <View style={[styles.contactCard, { backgroundColor: darkMode ? '#1a3a52' : '#E3F2FD' }]}>
              <Text style={[styles.contactTitle, { color: darkMode ? '#64b5f6' : '#1976d2' }]}>
                Questions About Privacy?
              </Text>
              <Text style={[styles.contactText, { color: darkMode ? '#e0e0e0' : '#333' }]}>
                If you have questions about how your data is used, please contact us at csce4902BabyTracker@gmail.com
              </Text>
              <Text style={[styles.lastUpdated, { color: theme.textMuted }]}>
                Last updated: {new Date().toLocaleDateString()}
              </Text>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
  },
  header: {
    marginTop: 20,
    marginBottom: 18,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  introCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  introText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionContent: {
    gap: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bullet: {
    fontSize: 18,
    marginRight: 8,
    marginTop: -2,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  disclaimer: {
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
  },
  disclaimerText: {
    fontSize: 13,
    lineHeight: 19,
  },
  infoBox: {
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
  },
  rightsCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  rightsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  rightsText: {
    fontSize: 14,
    marginBottom: 12,
  },
  contactCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  contactText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  lastUpdated: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});