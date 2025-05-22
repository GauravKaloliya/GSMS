import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function SearchScreen() {
  const [query, setQuery] = useState('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Top Search Bar */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color="#aaa" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Search here..."
              placeholderTextColor="#aaa"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Placeholder for results */}
          <View style={styles.results}>
            <Text style={styles.resultText}>Search results will appear here</Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#eee',
  },
  results: {
    marginTop: 32,
    alignItems: 'center',
  },
  resultText: {
    color: '#aaa',
    fontSize: 16,
  },
});