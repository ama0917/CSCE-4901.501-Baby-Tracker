import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";

const FeedingForm = () => {
  const [time, setTime] = useState({ hours: "", minutes: "", period: "AM" });
  const [foodType, setFoodType] = useState("");
  const [foodAmount, setFoodAmount] = useState("");
  const [mealType, setMealType] = useState("");

  const handleSubmit = () => {
    console.log({
      time: `${time.hours}:${time.minutes} ${time.period}`,
      foodType,
      foodAmount,
      mealType,
    });
    alert("Feeding Log Saved!");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Feeding Log</Text>

      {/* Time Input */}
      <View style={styles.timeContainer}>
        <TextInput
          style={styles.timeInput}
          placeholder="00"
          keyboardType="numeric"
          maxLength={2}
          onChangeText={(text) => setTime({ ...time, hours: text })}
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          style={styles.timeInput}
          placeholder="00"
          keyboardType="numeric"
          maxLength={2}
          onChangeText={(text) => setTime({ ...time, minutes: text })}
        />
        <Picker
          selectedValue={time.period}
          style={styles.picker}
          onValueChange={(itemValue) => setTime({ ...time, period: itemValue })}
        >
          <Picker.Item label="AM" value="AM" />
          <Picker.Item label="PM" value="PM" />
        </Picker>
      </View>

      {/* Food Type Input */}
      <TextInput
        style={styles.input}
        placeholder="Enter type of food..."
        value={foodType}
        onChangeText={setFoodType}
      />

      {/* Food Amount Input */}
      <TextInput
        style={styles.input}
        placeholder="Enter amount of food (if applicable)..."
        value={foodAmount}
        onChangeText={setFoodAmount}
      />

      {/* Meal Type Dropdown */}
      <Picker
        selectedValue={mealType}
        style={styles.picker}
        onValueChange={(itemValue) => setMealType(itemValue)}
      >
        <Picker.Item label="Select Meal Type" value="" />
        <Picker.Item label="Breakfast" value="breakfast" />
        <Picker.Item label="Lunch" value="lunch" />
        <Picker.Item label="Dinner" value="dinner" />
        <Picker.Item label="Snack" value="snack" />
      </Picker>

      {/* Submit Button */}
      <Button title="Complete Log" onPress={handleSubmit} color="#FFD700" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#E3F2FD",
    flex: 1,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  timeInput: {
    width: 50,
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
    textAlign: "center",
    fontSize: 18,
    borderRadius: 5,
  },
  colon: {
    fontSize: 20,
    marginHorizontal: 5,
  },
  picker: {
    width: 150,
    height: 40,
  },
  input: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
});

export default FeedingForm;
