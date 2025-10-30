// screens/WelcomeTour.js
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Dimensions, Animated, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { Baby, Camera, TrendingUp, ChevronRight, Sparkles } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function WelcomeTour() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const from = params?.from ?? 'login';   // 'login' | 'settings'
  const firstRun = params?.firstRun ?? (from === 'login'); 

  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);

  const slides = [
    {
      icon: Baby,
      title: "Welcome to Baby Tracker",
      subtitle: "Your parenting companion",
      description: "Track your little one's precious moments, growth, and milestones all in one beautiful place.",
      gradient: ['#E1F5FE', '#FCE4EC']
    },
    {
      icon: Camera,
      title: "Capture Every Moment",
      subtitle: "Create lasting memories",
      description: "From first smiles to first steps, keep a beautiful record of your baby's journey.",
      gradient: ['#FCE4EC', '#F3E5F5']
    },
    {
      icon: TrendingUp,
      title: "Smart Insights",
      subtitle: "Data-driven parenting",
      description: "Helpful insights for feeding, sleeping, and growth patterns.",
      gradient: ['#F3E5F5', '#E1F5FE']
    }
  ];

  const onFinish = async () => {
    if (firstRun) {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          const db = getFirestore();
          await updateDoc(doc(db, 'users', user.uid), { hasSeenWelcome: true });
        }
      } catch (e) {
        console.log('set hasSeenWelcome failed', e);
      }
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } else {
      navigation.goBack();
    }
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (currentSlide + 1), animated: true });
      setCurrentSlide(currentSlide + 1);
    } else {
      onFinish();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent />
      {/* Optional close when coming from Settings */}
      {from === 'settings' && (
        <TouchableOpacity style={styles.skipBtn} onPress={onFinish} activeOpacity={0.8}>
          <Text style={styles.skipText}>Close</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentSlide(idx);
        }}
        scrollEventThrottle={16}
      >
        {slides.map((s, i) => {
          const Icon = s.icon;
          return (
            <LinearGradient key={i} colors={s.gradient} style={styles.slide}>
              <View style={styles.iconWrap}>
                <View style={styles.iconBadge}>
                  <Icon size={60} color="white" strokeWidth={1.5} />
                </View>
                <View style={styles.sparkle}><Sparkles size={22} color="#F8BBD9" /></View>
              </View>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.subtitle}>{s.subtitle}</Text>
              <Text style={styles.desc}>{s.description}</Text>
            </LinearGradient>
          );
        })}
      </ScrollView>

      {/* Dots + CTA */}
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { opacity: currentSlide === i ? 1 : 0.3, width: currentSlide === i ? 28 : 10 }
              ]}
            />
          ))}
        </View>
        <TouchableOpacity onPress={handleNext} activeOpacity={0.85} style={styles.cta}>
          <LinearGradient colors={['#81D4FA', '#F8BBD9']} style={styles.ctaGrad}>
            <Text style={styles.ctaText}>
              {currentSlide === slides.length - 1 ? (firstRun ? 'Get Started' : 'Done') : 'Continue'}
            </Text>
            <ChevronRight size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#fff' },
  slide:{ width, flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:40 },
  iconWrap:{ position:'relative', marginBottom:48 },
  iconBadge:{ width:140, height:140, borderRadius:70, justifyContent:'center', alignItems:'center', backgroundColor:'#81D4FA' },
  sparkle:{ position:'absolute', top:8, right:8 },
  title:{ fontSize:32, fontWeight:'800', color:'#2E3A59', textAlign:'center', marginBottom:10 },
  subtitle:{ fontSize:18, fontWeight:'600', color:'#5C6B7D', textAlign:'center', marginBottom:22 },
  desc:{ fontSize:16, color:'#7C8B9A', textAlign:'center', lineHeight:24, maxWidth:'85%' },
  bottom:{ position:'absolute', bottom: Platform.OS==='ios'? 50: 30, width:'100%', alignItems:'center' },
  dots:{ flexDirection:'row', marginBottom:22 },
  dot:{ height:10, borderRadius:5, marginHorizontal:5, backgroundColor:'#81D4FA' },
  cta:{ borderRadius:28, overflow:'hidden' },
  ctaGrad:{ flexDirection:'row', alignItems:'center', gap:8, paddingVertical:14, paddingHorizontal:40, borderRadius:28 },
  ctaText:{ color:'#fff', fontSize:18, fontWeight:'700' },
  skipBtn:{ position:'absolute', top: Platform.OS==='ios'? 60: 40, right:24, zIndex:10, backgroundColor:'rgba(255,255,255,0.9)', paddingHorizontal:16, paddingVertical:8, borderRadius:20 },
  skipText:{ color:'#7C8B9A', fontWeight:'700' },
});