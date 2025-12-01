//Run w/ npm run generate-demo (WARNING: will take about 3-7 minutes to populate data)
import { db } from '../firebaseConfig.js';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

// CONFIGURATION
const CHILD_ID = 'XVVwR2eGNgz8JavMKBce'; // Replace with actual child ID (found in firebase)
const USER_ID = 'CJTaD4VxzSZpBLcaAuzFC1Pyw0x1';   // Replace with actual user ID (found in firebase)
const END_DATE = new Date(); // Today
const START_DATE = new Date(END_DATE);
START_DATE.setFullYear(START_DATE.getFullYear() - 1); // 1 year ago

// Baby's age progression (affects patterns)
const BABY_BIRTH_DATE = new Date(START_DATE);

// Helper: Get baby's age in months at a given date
function getAgeInMonths(date) {
  const months = (date.getFullYear() - BABY_BIRTH_DATE.getFullYear()) * 12 + 
                 (date.getMonth() - BABY_BIRTH_DATE.getMonth());
  return Math.max(0, months);
}

// Helper: Random number in range
function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Random float
function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// Helper: Weighted random choice
function weightedChoice(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

// SLEEP DATA GENERATION
async function generateSleepData() {
  console.log('Generating sleep data...');
  const sleepLogs = [];
  const currentDate = new Date(START_DATE);
  
  while (currentDate <= END_DATE) {
    const ageMonths = getAgeInMonths(currentDate);
    
    // Age-appropriate sleep patterns
    let nightSleepSessions, napSessions, nightSleepDuration, napDuration;
    
    if (ageMonths < 3) {
      // Newborn: Multiple short sleeps
      nightSleepSessions = randomInRange(3, 5);
      napSessions = randomInRange(4, 6);
      nightSleepDuration = [120, 180]; // 2-3 hours per session
      napDuration = [30, 90]; // 30min-1.5hrs
    } else if (ageMonths < 6) {
      // 3-6 months: Consolidating
      nightSleepSessions = randomInRange(2, 3);
      napSessions = randomInRange(3, 4);
      nightSleepDuration = [180, 300]; // 3-5 hours
      napDuration = [60, 120]; // 1-2 hours
    } else if (ageMonths < 12) {
      // 6-12 months: More consolidated
      nightSleepSessions = randomInRange(1, 2);
      napSessions = randomInRange(2, 3);
      nightSleepDuration = [360, 480]; // 6-8 hours
      napDuration = [60, 120];
    } else {
      // 12+ months: Consistent pattern
      nightSleepSessions = 1;
      napSessions = randomInRange(1, 2);
      nightSleepDuration = [480, 600]; // 8-10 hours
      napDuration = [90, 150]; // 1.5-2.5 hours
    }
    
    // Generate night sleep
    let bedtime = new Date(currentDate);
    bedtime.setHours(19 + randomInRange(-1, 2), randomInRange(0, 59), 0, 0);
    
    for (let i = 0; i < nightSleepSessions; i++) {
      const duration = randomInRange(nightSleepDuration[0], nightSleepDuration[1]);
      const startTime = new Date(bedtime.getTime() + (i * duration * 60000));
      const endTime = new Date(startTime.getTime() + (duration * 60000));
      
      // Don't create sleeps that go into next day's logging period
      if (startTime.getDate() === currentDate.getDate()) {
        sleepLogs.push({
          childId: CHILD_ID,
          createdAt: Timestamp.fromDate(startTime),
          timestamp: Timestamp.fromDate(startTime),
          endTime: Timestamp.fromDate(endTime),
          duration: duration,
          sleepType: 'Sleep',
        });
      }
    }
    
    // Generate naps
    for (let i = 0; i < napSessions; i++) {
      const napTime = new Date(currentDate);
      napTime.setHours(9 + (i * 3) + randomInRange(-1, 1), randomInRange(0, 59), 0, 0);
      const duration = randomInRange(napDuration[0], napDuration[1]);
      const endTime = new Date(napTime.getTime() + (duration * 60000));
      
      sleepLogs.push({
        childId: CHILD_ID,
        createdAt: Timestamp.fromDate(napTime),
        timestamp: Timestamp.fromDate(napTime),
        endTime: Timestamp.fromDate(endTime),
        duration: duration,
        sleepType: 'Nap',
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Upload to Firestore
  console.log(`Uploading ${sleepLogs.length} sleep logs...`);
  for (const log of sleepLogs) {
    await addDoc(collection(db, 'sleepLogs'), log);
  }
  console.log('Sleep data uploaded!');
}

// FEEDING DATA GENERATION
async function generateFeedingData() {
  console.log('Generating feeding data...');
  const feedLogs = [];
  const currentDate = new Date(START_DATE);
  
  while (currentDate <= END_DATE) {
    const ageMonths = getAgeInMonths(currentDate);
    
    // Age-appropriate feeding patterns
    let feedingsPerDay, avgAmount, feedTypes, mealTypes;
    
    if (ageMonths < 3) {
      // Newborn: Frequent small feedings
      feedingsPerDay = randomInRange(8, 12);
      avgAmount = randomFloat(2, 4);
      feedTypes = ['Breast Milk', 'Formula'];
      mealTypes = ['Feeding'];
    } else if (ageMonths < 6) {
      // 3-6 months: Less frequent, larger amounts
      feedingsPerDay = randomInRange(6, 8);
      avgAmount = randomFloat(4, 6);
      feedTypes = ['Breast Milk', 'Formula'];
      mealTypes = ['Feeding'];
    } else if (ageMonths < 9) {
      // 6-9 months: Starting solids
      feedingsPerDay = randomInRange(5, 7);
      avgAmount = randomFloat(6, 8);
      feedTypes = ['Breast Milk', 'Formula', 'Solid Food', 'Puree'];
      mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    } else {
      // 9+ months: Regular meals + milk
      feedingsPerDay = randomInRange(4, 6);
      avgAmount = randomFloat(6, 8);
      feedTypes = ['Breast Milk', 'Formula', 'Solid Food', 'Finger Food'];
      mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    }
    
    // Generate feedings throughout the day
    const wakeTime = 6 + randomInRange(0, 2); // 6-8 AM
    const bedTime = 19 + randomInRange(0, 2); // 7-9 PM
    const awakeHours = bedTime - wakeTime;
    const intervalHours = awakeHours / feedingsPerDay;
    
    for (let i = 0; i < feedingsPerDay; i++) {
      const feedTime = new Date(currentDate);
      const hour = wakeTime + (i * intervalHours) + randomFloat(-0.5, 0.5);
      feedTime.setHours(Math.floor(hour), Math.floor((hour % 1) * 60), 0, 0);
      
      // Determine feed type based on time and age
      let feedType, mealType;
      const hourOfDay = feedTime.getHours();
      
      if (ageMonths < 6) {
        feedType = weightedChoice(feedTypes, [60, 40]); // 60% breast, 40% formula
        mealType = 'Feeding';
      } else {
        // Solid foods during meal times
        if (hourOfDay >= 7 && hourOfDay <= 9) {
          feedType = weightedChoice(['Solid Food', 'Puree', 'Breast Milk'], [40, 30, 30]);
          mealType = 'Breakfast';
        } else if (hourOfDay >= 11 && hourOfDay <= 13) {
          feedType = weightedChoice(['Solid Food', 'Puree', 'Finger Food'], [40, 35, 25]);
          mealType = 'Lunch';
        } else if (hourOfDay >= 17 && hourOfDay <= 19) {
          feedType = weightedChoice(['Solid Food', 'Finger Food', 'Puree'], [45, 30, 25]);
          mealType = 'Dinner';
        } else {
          feedType = weightedChoice(['Breast Milk', 'Formula', 'Snack'], [40, 40, 20]);
          mealType = 'Snack';
        }
      }
      
      // Amount varies by feed type
      let amount;
      if (feedType === 'Breast Milk' || feedType === 'Formula') {
        amount = (avgAmount + randomFloat(-1, 1)).toFixed(1);
      } else {
        amount = randomInRange(2, 6).toString(); // Solid food in oz
      }
      
      feedLogs.push({
        childId: CHILD_ID,
        createdAt: Timestamp.fromDate(feedTime),
        timestamp: Timestamp.fromDate(feedTime),
        amount: amount,
        amountUnit: 'oz',
        feedType: feedType,
        mealType: mealType,
        notes: '',
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Upload to Firestore
  console.log(`Uploading ${feedLogs.length} feeding logs...`);
  for (const log of feedLogs) {
    await addDoc(collection(db, 'feedLogs'), log);
  }
  console.log('Feeding data uploaded!');
}

// DIAPER DATA GENERATION
async function generateDiaperData() {
  console.log('Generating diaper data...');
  const diaperLogs = [];
  const currentDate = new Date(START_DATE);
  
  while (currentDate <= END_DATE) {
    const ageMonths = getAgeInMonths(currentDate);
    
    // Age-appropriate diaper patterns
    let wetDiapersPerDay, bmDiapersPerDay;
    
    if (ageMonths < 3) {
      // Newborn: Frequent
      wetDiapersPerDay = randomInRange(6, 10);
      bmDiapersPerDay = randomInRange(4, 8);
    } else if (ageMonths < 6) {
      // 3-6 months: Still frequent
      wetDiapersPerDay = randomInRange(6, 8);
      bmDiapersPerDay = randomInRange(3, 5);
    } else if (ageMonths < 12) {
      // 6-12 months: Reducing
      wetDiapersPerDay = randomInRange(5, 7);
      bmDiapersPerDay = randomInRange(2, 4);
    } else {
      // 12+ months: Consistent
      wetDiapersPerDay = randomInRange(5, 6);
      bmDiapersPerDay = randomInRange(1, 3);
    }
    
    const totalChanges = wetDiapersPerDay + bmDiapersPerDay;
    const wakeTime = 6 + randomInRange(0, 2);
    const bedTime = 19 + randomInRange(0, 2);
    const awakeHours = bedTime - wakeTime;
    const intervalHours = awakeHours / totalChanges;
    
    let wetCount = 0;
    let bmCount = 0;
    
    for (let i = 0; i < totalChanges; i++) {
      const changeTime = new Date(currentDate);
      const hour = wakeTime + (i * intervalHours) + randomFloat(-0.3, 0.3);
      changeTime.setHours(Math.floor(hour), Math.floor((hour % 1) * 60), 0, 0);
      
      // Determine diaper type
      let stoolType;
      const needsWet = wetCount < wetDiapersPerDay;
      const needsBM = bmCount < bmDiapersPerDay;
      
      if (needsWet && needsBM) {
        // 20% chance of combined, otherwise random
        const rand = Math.random();
        if (rand < 0.2) {
          stoolType = 'Wet+BM';
          wetCount++;
          bmCount++;
        } else if (rand < 0.6) {
          stoolType = 'Wet';
          wetCount++;
        } else {
          stoolType = 'BM';
          bmCount++;
        }
      } else if (needsWet) {
        stoolType = Math.random() < 0.9 ? 'Wet' : 'Wet+BM';
        wetCount++;
        if (stoolType === 'Wet+BM') bmCount++;
      } else if (needsBM) {
        stoolType = 'BM';
        bmCount++;
      } else {
        stoolType = 'Dry';
      }
      
      diaperLogs.push({
        childId: CHILD_ID,
        createdBy: USER_ID,
        time: Timestamp.fromDate(changeTime),
        timestamp: Timestamp.fromDate(changeTime),
        stoolType: stoolType,
        bathroomType: 'Diaper',
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Upload to Firestore
  console.log(`Uploading ${diaperLogs.length} diaper logs...`);
  for (const log of diaperLogs) {
    await addDoc(collection(db, 'diaperLogs'), log);
  }
  console.log('Diaper data uploaded!');
}

// MAIN EXECUTION
async function generateAllData() {
  console.log('Starting data generation...');
  console.log(`Date range: ${START_DATE.toDateString()} to ${END_DATE.toDateString()}`);
  
  try {
    await generateSleepData();
    await generateFeedingData();
    await generateDiaperData();
    
    console.log('\n✅ All demo data generated successfully!');
    console.log('Summary:');
    console.log(`- Sleep logs: ~${Math.floor((END_DATE - START_DATE) / (1000 * 60 * 60 * 24)) * 4} entries`);
    console.log(`- Feeding logs: ~${Math.floor((END_DATE - START_DATE) / (1000 * 60 * 60 * 24)) * 7} entries`);
    console.log(`- Diaper logs: ~${Math.floor((END_DATE - START_DATE) / (1000 * 60 * 60 * 24)) * 8} entries`);
  } catch (error) {
    console.error('Error generating data:', error);
  }
}

// Run the script
generateAllData();